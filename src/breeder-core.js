// Breeder core (POC): pure functions, no Workers APIs except WebCrypto, so they run under `node --test`.
//
// Cookie `dna` = "<payload>.<signature>", payload = "sp=<species id>;gene=allele;…".
// `sp` is not a valid gene name, so the client SDK (parseDna) ignores it.

import { parseDna } from "../docs/assets/js/natsel.js";

export const COOKIE = "dna";
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
 * Returns { species, genotype, dna, setCookie, preview } where species may be null (control: first alleles).
 */
export async function decide({ snapshot, cookie, preview, userAgent, secret, random = Math.random }) {
  const control = { species: null, genotype: new Map(), dna: "", setCookie: null, preview: false };
  try {
    const list = snapshot?.species ?? [];
    const byId = new Map(list.map((s) => [s.id, s]));

    // Demo: ?dna=<species id> or ?dna=<gene=allele;…>.<anything>. No cookie is set.
    if (preview) {
      const s = byId.get(preview);
      if (s) return { species: s, genotype: genotypeOf(s), dna: `sp=${s.id};${s.dna}.preview`, setCookie: null, preview: true };
      return { species: null, genotype: parseDna(preview), dna: preview, setCookie: null, preview: true };
    }

    // Returning visitor with a valid cookie keeps the species while it is alive (in the snapshot).
    const payload = await verify(cookie, secret);
    const kept = payload && byId.get(speciesOf(payload));
    if (kept) {
      const dna = await sign(`sp=${kept.id};${kept.dna}`, secret);
      return { species: kept, genotype: genotypeOf(kept), dna, setCookie: dna === cookie ? null : dna, preview: false };
    }

    // No snapshot or no secret: control, and leave any existing cookie alone.
    if (!secret || list.length === 0) return control;
    // Bots without a cookie see the control and get no cookie.
    if (!cookie && isBot(userAgent)) return control;

    const s = pick(snapshot, random());
    if (!s) return control;
    const dna = await sign(`sp=${s.id};${s.dna}`, secret);
    return { species: s, genotype: genotypeOf(s), dna, setCookie: dna, preview: false };
  } catch {
    return control;
  }
}
