#!/usr/bin/env node
// Gene scanner (TASK-70.16): finds every gene in the built site and writes a manifest for the Control Plane.
//
// Sources:
// - HTML genes: an element with data-gene="<locus>.<name>" whose direct children with data-allele are the alleles.
// - JS genes: calls gene("<locus>.<name>", [default, ...variants]) (also natsel.gene(...)) in .js files and
//   inline scripts of the built pages.
//
// The scan runs on the build output, so it sees exactly what gets deployed. Contract errors (bad name,
// fewer than two alleles, the same gene with a different number of alleles elsewhere) fail the build.
//
// Usage: node scripts/scan-genes.mjs [siteDir=site] [out=<siteDir>/../site-genes.json]

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export const GENE_NAME = /^[a-z0-9-]+\.[a-z0-9-]+$/;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const SKIP_FILES = [/(^|\/)assets\/js\/natsel\.js$/]; // the SDK itself
const LABEL_MAX = 80;

const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

export function label(text) {
  const t = decode(
    text
      .replace(/<a\b[^>]*class="headerlink"[^>]*>[\s\S]*?<\/a>/gi, '') // MkDocs permalink anchors
      .replace(/<\/?(p|div|h[1-6]|li|br|ul|ol|section)\b[^>]*>/gi, ' ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > LABEL_MAX ? `${t.slice(0, LABEL_MAX - 1)}…` : t;
}

const attr = (attrs, name) => {
  const m = new RegExp(`(?:^|\\s)${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?`, 'i').exec(attrs);
  if (!m) return undefined;
  return m[1] ?? m[2] ?? m[3] ?? '';
};

/** HTML genes of one document: `[{ name, alleles: [label] }]`. Scripts, styles and comments are ignored. */
export function scanHtml(html) {
  const src = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const tag = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  const stack = []; // { tag, gene?, allele? }
  const genes = [];
  let m;
  while ((m = tag.exec(src))) {
    const [whole, closing, rawName, attrs] = m;
    const name = rawName.toLowerCase();
    if (closing) {
      const i = stack.map((e) => e.tag).lastIndexOf(name);
      if (i === -1) continue;
      for (const e of stack.splice(i)) {
        if (e.allele) e.gene.alleles.push(label(src.slice(e.allele.start, m.index)));
      }
      continue;
    }
    if (VOID.has(name) || /\/\s*$/.test(attrs)) continue;
    const entry = { tag: name };
    const parent = stack[stack.length - 1];
    if (parent?.geneRef && attr(attrs, 'data-allele') !== undefined) {
      entry.allele = { start: m.index + whole.length };
      entry.gene = parent.geneRef;
    }
    const geneName = attr(attrs, 'data-gene');
    if (geneName !== undefined) {
      entry.geneRef = { name: geneName, alleles: [] };
      genes.push(entry.geneRef);
    }
    stack.push(entry);
  }
  return genes;
}

// Splits the inside of an array literal into top-level elements, respecting strings, templates and brackets.
function splitArray(src, open) {
  const items = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
    } else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) {
      if (depth === 0) {
        const last = src.slice(start, i).trim();
        if (last) items.push(last);
        return items;
      }
      depth--;
    } else if (c === ',' && depth === 0) {
      items.push(src.slice(start, i).trim());
      start = i + 1;
    }
  }
  return null; // unterminated
}

const literal = (s) => {
  const m = /^(["'`])([\s\S]*)\1$/.exec(s);
  return label(m ? m[2] : s);
};

/** JS genes of one source: `[{ name, alleles: [label] }]` from `gene("x.y", [...])` calls. */
export function scanJs(src) {
  const call = /\bgene\(\s*(["'])([^"'\n]+)\1\s*,\s*\[/g;
  const genes = [];
  let m;
  while ((m = call.exec(src))) {
    const items = splitArray(src, m.index + m[0].length - 1);
    genes.push({ name: m[2], alleles: items ? items.map(literal) : [] });
  }
  return genes;
}

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(html|js|mjs)$/.test(e.name)) yield p;
  }
}

/**
 * Merges occurrences into one manifest and checks the contract.
 * `found` is `[{ name, alleles, source }]`. Returns `{ genes: [{ name, alleles, sources }], errors: [string] }`.
 */
export function merge(found) {
  const byName = new Map();
  const errors = [];
  for (const g of found) {
    if (!GENE_NAME.test(g.name)) {
      errors.push(`${g.source}: gene name "${g.name}" is not <locus>.<name> (lowercase, digits, dash)`);
      continue;
    }
    if (g.alleles.length < 2) {
      errors.push(`${g.source}: gene ${g.name} has ${g.alleles.length} allele(s), needs at least two`);
      continue;
    }
    const prev = byName.get(g.name);
    if (!prev) byName.set(g.name, { name: g.name, alleles: g.alleles, sources: [g.source] });
    else if (prev.alleles.length !== g.alleles.length) {
      errors.push(`${g.source}: gene ${g.name} has ${g.alleles.length} alleles, ${prev.sources[0]} has ${prev.alleles.length}`);
    } else if (!prev.sources.includes(g.source)) prev.sources.push(g.source);
  }
  const genes = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { genes, errors };
}

export function scanSite(siteDir) {
  const found = [];
  for (const file of walk(siteDir)) {
    const rel = relative(siteDir, file);
    if (SKIP_FILES.some((r) => r.test(rel))) continue;
    const text = readFileSync(file, 'utf8');
    const html = file.endsWith('.html') ? scanHtml(text) : [];
    for (const g of [...html, ...scanJs(text)]) found.push({ ...g, source: rel });
  }
  return merge(found);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const siteDir = resolve(process.argv[2] ?? 'site');
  const out = resolve(process.argv[3] ?? join(siteDir, '..', 'site-genes.json'));
  const { genes, errors } = scanSite(siteDir);
  for (const e of errors) console.error(`::error::${e}`);
  if (errors.length) process.exit(1);
  writeFileSync(out, `${JSON.stringify({ genes }, null, 2)}\n`);
  for (const g of genes) console.log(`${g.name}: ${g.alleles.length} alleles (${g.sources.join(', ')})`);
  console.log(`${genes.length} gene(s) -> ${relative(process.cwd(), out)}`);
}
