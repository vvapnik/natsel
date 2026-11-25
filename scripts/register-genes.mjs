#!/usr/bin/env node
// Registers the scanned genes in the Control Plane (TASK-70.16). Runs after a successful deploy, so the
// registry never lists a gene the live site does not have. If it fails, the site is not affected: an
// unregistered gene is in no species' dna and the SDK and the Breeder show its first allele.
//
// Usage: NATSEL_API_TOKEN=... node scripts/register-genes.mjs [manifest=site-genes.json] [--dry-run]
// NATSEL_API defaults to https://control.natsel.vapnik.de/api.

import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const manifest = args.find((a) => !a.startsWith('--')) ?? 'site-genes.json';
const api = (process.env.NATSEL_API ?? 'https://control.natsel.vapnik.de/api').replace(/\/$/, '');
const token = process.env.NATSEL_API_TOKEN;

if (!token) {
  console.error('::error::NATSEL_API_TOKEN is not set; genes are not registered');
  process.exit(1);
}

const { genes } = JSON.parse(readFileSync(manifest, 'utf8'));
const res = await fetch(`${api}/genes/sync`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ genes: genes.map(({ name, alleles }) => ({ name, alleles })), dry_run: dryRun }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`::error::Control Plane answered ${res.status}: ${out.error ?? 'no body'}`);
  process.exit(1);
}

const log = (what, items) => items.length && console.log(`${what}: ${items.join(', ')}`);
log('created', out.create.map((g) => g.name));
log('alleles added', out.add_alleles.map((a) => `${a.gene} +${a.labels.length}`));
log('removed', out.remove);
if (out.orphans?.length) {
  console.log(`::notice::alleles without a carrier species: ${out.orphans.map((o) => `${o.gene}=${o.allele}`).join(', ')}`);
}
if (!out.changed && !out.conflicts.length) console.log(`no changes, ${genes.length} gene(s) in sync${dryRun ? ' (dry run)' : ''}`);
for (const c of out.conflicts) console.error(`::error::${c.gene}: ${c.reason}`);
process.exit(out.conflicts.length ? 1 : 0);
