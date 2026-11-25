// Breeder core (POC): pure functions, no Workers APIs except WebCrypto, so they run under `node --test`.
//
// Two ways to keep a visitor in one species (ASSIGNMENT, TASK-70.17):
// - "hash" (default): nothing is stored on the device. The visitor key is HMAC(daily salt, IP + UA), and the species
//   is chosen from it by weighted rendezvous hashing. A visitor keeps the species for a UTC day; the salt is random,
//   lives in KV until shortly after its day and is never logged.
// - "cookie": the signed `dna` cookie for a year.
//
// `dna` = "<payload>.<signature>", payload = "sp=<species id>;gene=allele;…".
// `sp` is not a valid gene name, so the client SDK (parseDna) ignores it.

import { parseDna } from "../docs/assets/js/natsel.js";

export const COOKIE = "dna";
export const MODES = ["hash", "cookie"];
export const DEFAULT_MODE = "hash";

/** Assignment mode from the ASSIGNMENT variable; anything unknown -> the default. */
export const modeOf = (value) => (MODES.includes(value) ? value : DEFAULT_MODE);
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|lighthouse|headless/i;

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function sign(payload, secret) {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(payload));
  return `${payload}.${b64url(sig)}`;
}

/** Returns the payload of a correctly signed dna, or null. */
export async function verify(dna, secret) {
  try {
    if (typeof dna !== "string" || !secret) return null;
    const dot = dna.lastIndexOf(".");
    if (dot <= 0) return null;
    const payload = dna.slice(0, dot);
    const expected = await sign(payload, secret);
    // compare the HMACs of both strings: constant time regardless of input
    const key = await hmacKey(secret);
    const [a, b] = await Promise.all(
      [expected, dna].map((s) => crypto.subtle.sign("HMAC", key, new TextEncoder().encode(s))),
    );
    return b64url(a) === b64url(b) ? payload : null;
  } catch {
    return null;
  }
}

/** Species id from a dna payload ("sp=<id>;…"), or "". */
export function speciesOf(payload) {
  const m = /(?:^|;)sp=([A-Za-z0-9_-]+)(?:;|$)/.exec(payload ?? "");
  return m ? m[1] : "";
}

/** Genotype Map of a species from the KV snapshot. */
export function genotypeOf(species) {
  // snapshot dna is unsigned "gene=allele;…"; parseDna needs a trailing ".<signature>"
  return parseDna(`${species.dna}.x`);
}

/** Picks a species by share_bp. `r` in [0, 1). Returns null for an empty snapshot. */
export function pick(snapshot, r) {
  const list = snapshot?.species ?? [];
  const total = list.reduce((s, x) => s + (x.share_bp > 0 ? x.share_bp : 0), 0);
  if (total <= 0) return null;
  let t = r * total;
  for (const s of list) {
    if (s.share_bp <= 0) continue;
    if (t < s.share_bp) return s;
    t -= s.share_bp;
  }
  return list.filter((s) => s.share_bp > 0).at(-1);
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Visitor key for the hash mode: HMAC(salt, IP + "\n" + UA), hex. Null without a salt or an IP. */
export async function visitorKey(salt, ip, ua) {
  if (!salt || !ip) return null;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(salt), new TextEncoder().encode(`${ip}\n${ua ?? ""}`));
  return hex(sig);
}

/**
 * Weighted rendezvous hashing: every species scores -ln(u) / share, u = hash(key, species) in (0, 1);
 * the lowest score wins, so a species wins with probability share / total. Changing one share moves only the
 * visitors that must move (to a species that grew, away from one that shrank); removing a species moves only its own
 * visitors. Returns null for an empty snapshot.
 */
export async function rendezvous(snapshot, key) {
  let best = null;
  let bestScore = Infinity;
  for (const s of snapshot?.species ?? []) {
    if (!(s.share_bp > 0)) continue;
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${key}:${s.id}`)));
    let n = 0;
    for (let i = 0; i < 6; i++) n = n * 256 + h[i]; // 48 bits
    const u = (n + 0.5) / 2 ** 48;
    const score = -Math.log(u) / s.share_bp;
    if (score < bestScore) [best, bestScore] = [s, score];
  }
  return best;
}

// ---------- daily salt (hash mode) ----------

export const SALT_PREFIX = "salt:";

/** UTC day "YYYY-MM-DD" of a timestamp (ms). */
export const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/** The salt of `day` expires one hour after the day ends (epoch seconds): no older salt is kept. */
export const saltExpiration = (day) => Date.parse(`${day}T00:00:00Z`) / 1000 + 25 * 3600;

const randomSalt = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

/**
 * Creates the salt of `day` in KV if it is missing. Returns the salt in KV after the call.
 * Run by the Cron Trigger for today and tomorrow, so a day's salt exists long before the day starts.
 */
export async function ensureSalt(kv, day) {
  const key = SALT_PREFIX + day;
  const have = await kv.get(key);
  if (have) return have;
  const salt = randomSalt();
  await kv.put(key, salt, { expiration: saltExpiration(day) });
  return salt;
}

export const isBot = (ua) => BOT.test(ua ?? "");

export function readCookie(header, name) {
  for (const part of (header ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return "";
}

/**
 * Decides what a visitor sees. Never throws.
 * Returns { species, genotype, dna, setCookie, clearCookie, preview } where species may be null (control: first
 * alleles). `mode` is "hash" or "cookie"; the hash mode needs `visitor` (see visitorKey) and never sets a cookie,
 * and asks to clear a `dna` cookie left from the cookie mode.
 */
export async function decide({ snapshot, cookie, preview, userAgent, secret, mode = DEFAULT_MODE, visitor, random = Math.random }) {
  const hashMode = modeOf(mode) === "hash";
  const clearCookie = hashMode && !!cookie;
  const control = { species: null, genotype: new Map(), dna: "", setCookie: null, clearCookie, preview: false };
  try {
    const list = snapshot?.species ?? [];
    const byId = new Map(list.map((s) => [s.id, s]));

    // Demo: ?dna=<species id> or ?dna=<gene=allele;…>.<anything>. No cookie is set.
    if (preview) {
      const s = byId.get(preview);
      if (s) return { ...control, species: s, genotype: genotypeOf(s), dna: `sp=${s.id};${s.dna}.preview`, preview: true };
      return { ...control, genotype: parseDna(preview), dna: preview, preview: true };
    }

    if (hashMode) {
      if (!secret || !visitor || list.length === 0 || isBot(userAgent)) return control;
      const s = await rendezvous(snapshot, visitor);
      if (!s) return control;
      return { ...control, species: s, genotype: genotypeOf(s), dna: await sign(`sp=${s.id};${s.dna}`, secret) };
    }

    // Returning visitor with a valid cookie keeps the species while it is alive (in the snapshot).
    const payload = await verify(cookie, secret);
    const kept = payload && byId.get(speciesOf(payload));
    if (kept) {
      const dna = await sign(`sp=${kept.id};${kept.dna}`, secret);
      return { ...control, species: kept, genotype: genotypeOf(kept), dna, setCookie: dna === cookie ? null : dna };
    }

    // No snapshot or no secret: control, and leave any existing cookie alone.
    if (!secret || list.length === 0) return control;
    // Bots without a cookie see the control and get no cookie.
    if (!cookie && isBot(userAgent)) return control;

    const s = pick(snapshot, random());
    if (!s) return control;
    const dna = await sign(`sp=${s.id};${s.dna}`, secret);
    return { ...control, species: s, genotype: genotypeOf(s), dna, setCookie: dna };
  } catch {
    return control;
  }
}
