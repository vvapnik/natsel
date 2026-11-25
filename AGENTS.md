# AGENTS.md

Notes for AI coding agents working in this repository.

- natsel is developed with the help of Claude Code (Anthropic).
- Docs live in `docs/` (MkDocs Material). Every page must be listed in `nav` in `mkdocs.yml`;
  CI runs `mkdocs build --strict`, so broken links and missing pages fail the deploy.
- Keep the vocabulary consistent with `docs/concept/glossary.md` (gene, allele, locus,
  species, Breeder, `dna`, fixation, extinction).
- Language of the public repo: English.
- Diagrams are TakeSix: edit `diagrams/*.takesix.json`, then render to `docs/assets/diagrams/<name>.html` with the takesix CLI (`takesix.mjs render`). No Mermaid.
- Genes (POC contract, see `docs/assets/js/natsel.js`): wrapper `data-gene="<locus>.<name>"` with direct
  `data-allele` children; the first allele is the default and stays visible, others get `hidden`. Any failure
  (no dna, unknown gene or allele, bad signature, error) must fall back to the first allele.
  Tests: `node --test tests/*.test.mjs` (CI runs them before deploy).
- Breeder (`src/breeder.js`, pure logic in `src/breeder-core.js`): the edge Worker in front of the site. It reads the
  traffic distribution from KV `population:<id>` (written by natsel-control), assigns a species and rewrites
  `[data-gene]` HTML. Assignment mode (`ASSIGNMENT`, TASK-70.17): `hash` (default) — weighted rendezvous hashing of
  HMAC(daily salt, IP + UA), no cookie, an old `dna` cookie is cleared; `cookie` — signed `dna` cookie
  (`sp=<species>;gene=allele;…` + HMAC, secret `DNA_SECRET`) for a year. Daily salts live in KV `salt:<YYYY-MM-DD>`,
  created by the hourly Cron Trigger a day ahead and expiring an hour after their UTC day; never log a salt, a visitor
  key or an IP. `assign()` in `src/breeder.js` is the single place that decides the species (pages and events). Static paths bypass it
  (`run_worker_first` in `wrangler.jsonc`). Any failure must serve the page as built (first alleles).
  Local run: `mkdocs build`, `.dev.vars` with `DNA_SECRET=...`, seed local KV, `npx wrangler dev --test-scheduled`
  (`curl /__scheduled` creates the salts; `--var ASSIGNMENT:cookie` for the cookie mode).
- Gene registration (TASK-70.16): genes are registered from the code, never by hand or by a skill.
  `scripts/scan-genes.mjs` scans the built `site/` (`data-gene` HTML and `gene("x.y", [...])` calls) and fails the
  build on a contract error; after a successful deploy `scripts/register-genes.mjs` posts the manifest to
  natsel-control `POST /api/genes/sync` (secret `NATSEL_API_TOKEN`). A gene that disappears from the code is marked
  removed. Allele 0 must stay the default; alleles are only ever appended, never reordered or dropped.
