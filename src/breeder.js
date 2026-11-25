// Breeder (POC): an edge Worker in front of the static site. It assigns a species to each visitor
// strictly by the population's distribution from KV (written by natsel-control) and serves HTML with
// that species' alleles already in place. Non-HTML requests never reach it (see run_worker_first).
//
// Fail safe: any problem -> the page as built, where every gene shows its first (default) allele.

import { COOKIE, SALT_PREFIX, decide, ensureSalt, modeOf, readCookie, utcDay, visitorKey } from "./breeder-core.js";

const YEAR = 365 * 24 * 3600;
const EDGE_TTL = 300; // seconds a rendered (page, species, snapshot version) stays in the edge cache

/** Population of a visitor. POC: one population for everybody; segments come later. */
const populationFor = (_request, env) => env.POPULATION || "default";

async function loadSnapshot(env, population) {
  try {
    // cacheTtl: how long this edge location may reuse the value; KV's minimum is 30 s.
    return await env.DISTRIBUTIONS.get(`population:${population}`, { type: "json", cacheTtl: 30 });
  } catch {
    return null;
  }
}

// Salt of the current UTC day, per isolate. The Cron Trigger creates each day's salt a day in advance; if it is
// missing (first deploy), the isolate creates it once. Never log the salt or the visitor key.
let salt = { day: "", value: null, creating: "" };

async function loadSalt(env, now = Date.now()) {
  const day = utcDay(now);
  if (salt.day === day && salt.value) return salt.value;
  let value = null;
  try {
    value = await env.DISTRIBUTIONS.get(SALT_PREFIX + day, { cacheTtl: 300 });
    if (!value && salt.creating !== day) {
      salt.creating = day;
      value = await ensureSalt(env.DISTRIBUTIONS, day);
    }
  } catch {
    value = null;
  }
  if (value) salt = { ...salt, day, value };
  return value;
}

/**
 * Species of a request: the one place that decides it, for pages and (TASK-70.9) for events,
 * so both always agree. Returns { population, snapshot, mode, decision }.
 */
export async function assign(request, env) {
  const url = new URL(request.url);
  const population = populationFor(request, env);
  const mode = modeOf(env.ASSIGNMENT);
  const userAgent = request.headers.get("User-Agent") ?? "";
  const [snapshot, visitor] = await Promise.all([
    loadSnapshot(env, population),
    mode === "hash"
      ? loadSalt(env).then((s) => visitorKey(s, request.headers.get("CF-Connecting-IP"), userAgent))
      : null,
  ]);
  const decision = await decide({
    snapshot,
    cookie: readCookie(request.headers.get("Cookie"), COOKIE),
    preview: url.searchParams.get("dna") || "",
    userAgent,
    secret: env.DNA_SECRET,
    mode,
    visitor,
  });
  return { population, snapshot, mode, decision };
}

const escapeScript = (s) => s.replace(/</g, "\\u003c");

function rewrite(response, { genotype, natsel }) {
  const stack = []; // open [data-gene] elements: { name, next }
  return new HTMLRewriter()
    .on("head", {
      element(el) {
        el.prepend(`<script>window.natsel=${escapeScript(JSON.stringify(natsel))};</script>`, { html: true });
      },
    })
    .on("[data-gene]", {
      element(el) {
        const frame = { name: el.getAttribute("data-gene"), next: 0 };
        stack.push(frame);
        el.onEndTag(() => {
          stack.splice(stack.lastIndexOf(frame), 1);
        });
      },
    })
    .on("[data-gene] > [data-allele]", {
      element(el) {
        const frame = stack.at(-1);
        if (!frame) return;
        const idx = frame.next++;
        const chosen = genotype.get(frame.name) ?? 0;
        // If the snapshot names an allele the page does not have, the streaming rewriter cannot know it
        // in advance; natsel.js in the page then falls back to the first allele (alleleIndex checks the range).
        if (idx === chosen) el.removeAttribute("hidden");
        else el.setAttribute("hidden", "hidden");
      },
    })
    .transform(response);
}

async function render(request, env, ctx) {
  const url = new URL(request.url);
  const { population, snapshot, mode, decision: d } = await assign(request, env);
  const species = d.species?.id ?? "control";

  // Edge cache keyed by (page, species, snapshot version); previews of raw dna are not cached.
  const cacheable = request.method === "GET" && !(d.preview && !d.species);
  const key = new Request(
    `${url.origin}${url.pathname}?__natsel=${encodeURIComponent(`${population}:${species}:${snapshot?.version ?? 0}`)}`,
  );
  let html = cacheable ? await caches.default.match(key) : undefined;
  const cacheStatus = html ? "hit" : "miss";

  if (!html) {
    const asset = await env.ASSETS.fetch(request);
    const type = asset.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) return asset;
    const genes = Object.fromEntries(d.genotype);
    const natsel = { breeder: true, population, assignment: mode, species: d.species?.id ?? null, dna: d.dna, genes };
    const body = await rewrite(asset, { genotype: d.genotype, natsel }).text();
    html = new Response(body, asset);
    html.headers.delete("ETag"); // the static file's ETag does not describe the rewritten page
    html.headers.delete("Content-Length");
    html.headers.set("Cache-Control", `public, s-maxage=${EDGE_TTL}`);
    if (cacheable && asset.status === 200) ctx.waitUntil(caches.default.put(key, html.clone()));
  }

  const out = new Response(html.body, html);
  out.headers.set("Cache-Control", "private, no-cache");
  out.headers.set("Vary", "Cookie");
  out.headers.set("X-Natsel-Species", species);
  out.headers.set("X-Natsel-Cache", cacheable ? cacheStatus : "bypass");
  if (d.setCookie) {
    out.headers.append(
      "Set-Cookie",
      `${COOKIE}=${encodeURIComponent(d.setCookie)}; Path=/; Max-Age=${YEAR}; HttpOnly; Secure; SameSite=Lax`,
    );
  }
  // Hash mode stores nothing on the device: a dna cookie left from the cookie mode is removed.
  if (d.clearCookie) out.headers.append("Set-Cookie", `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  return out;
}

export default {
  // Cron Trigger (hourly): today's and tomorrow's salts exist before they are needed.
  async scheduled(_event, env) {
    const now = Date.now();
    for (const day of [utcDay(now), utcDay(now + 24 * 3600 * 1000)]) await ensureSalt(env.DISTRIBUTIONS, day);
  },

  async fetch(request, env, ctx) {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") return env.ASSETS.fetch(request);
      return await render(request, env, ctx);
    } catch (e) {
      console.error("breeder: falling back to defaults", e);
      return env.ASSETS.fetch(request);
    }
  },
};
