---
name: add-gene
description: Turn a requested change to the natsel site into a gene, so the change competes for traffic instead of replacing what is live. Use whenever someone asks to change, try or test copy, a button, a block or other behaviour of the site ("add a gene", "try another headline", "test a new CTA"), unless they explicitly ask for a plain edit.
---

# Add a gene

A gene is one small change behind a switch. The **current behaviour stays as allele 0** (the default and the
fail-safe), the requested change becomes allele 1 (more variants: 2, 3, …). Traffic decides later; nobody edits
the live behaviour away.

This skill only writes code. **Never call the Control Plane** (no curl, no API token): after a successful deploy
the pipeline scans the built site and registers new genes and alleles itself (`scripts/scan-genes.mjs`,
`scripts/register-genes.mjs`). Every live species starts with allele 0, so a new gene changes nothing for
visitors until species carrying the new allele get traffic.

## Contract (POC)

- **Name** `<locus>.<name>`: lowercase latin letters, digits, dash, exactly one dot. The locus is the place
  (`hero`, `status`, `pricing`), the name is what varies (`headline`, `cta`). Example: `hero.subtitle`.
- **Names are never reused**, even of genes deleted long ago. Check the whole history before choosing:
  `git log -p -S 'data-gene="<name>"' --oneline | head` and `git log -p -S "gene(\"<name>\"" --oneline | head`
  must find nothing, and `grep -rn '<name>' docs` too.
- **2+ alleles.** Allele 0 is exactly what the site shows now, unchanged.
- **One gene = one change.** If the request contains several independent changes, make several genes, or ask.
- **Alleles are only appended.** To add a variant to an existing gene, add it at the end; never reorder,
  rewrite or delete existing alleles (the registry numbers them; the build fails on fewer alleles).

### HTML (Markdown pages in `docs/`)

Wrap the current content; the alleles are the **direct children** marked `data-allele`, all but the first
`hidden`:

```html
<span data-gene="hero.cta"><span data-allele>CURRENT</span><span data-allele hidden>NEW</span></span>
```

- Inline content (a link, a button, a sentence): `<span>`s on one line, as in `docs/index.md`.
- Block content (a heading, paragraphs, lists): `<div ... markdown>` with blank lines inside, so Markdown
  is still rendered:

  ```html
  <div data-gene="hero.headline" markdown>
  <div data-allele markdown>

  CURRENT BLOCK

  </div>
  <div data-allele hidden markdown>

  NEW BLOCK

  </div>
  </div>
  ```

- A single raw HTML block element (e.g. `<p class="ns-lead">`): wrap it in a plain `<div data-gene="…">` and put
  `data-allele` on copies of the element itself (`<p data-allele class="ns-lead">…</p><p data-allele hidden class="ns-lead">…</p>`).
  Never put block elements inside a `<span>` gene.
- Keep classes and attributes of the original element inside every allele (e.g. `.md-button`), so the
  variant only differs in the requested way. Styles a variant needs go to `docs/assets/extra.css` under a
  new class (`.ns-…`), never by changing existing rules.
- Without JS the page shows allele 0; the edge Breeder and `docs/assets/js/natsel.js` switch alleles.

### JS

```js
const label = window.natsel.gene("pricing.cta", ["Current label", "New label"]);
```

The first array element is the current value. Use literals in the array: the scanner reads the call from the
built files, and the registry shows the literal text as the allele label.

## Steps

1. Restate the change in one line and find the exact current content (file, lines). If the request is vague
   about what the new variant says or does, ask before writing.
2. Pick the gene name and check it was never used (see above).
3. Wrap the content following the contract. Touch nothing else.
4. Check:
   ```bash
   node --test tests/*.test.mjs
   .venv/bin/mkdocs build --strict   # or mkdocs build --strict
   node scripts/scan-genes.mjs site /tmp/site-genes.json
   ```
   The scan must list the new gene with the expected number of alleles and readable labels.
5. Preview each allele: `.venv/bin/mkdocs serve`, then open the page with `?dna=<gene>=<allele>.x`
   (for example `/?dna=hero.subtitle=1.x`); allele 0 is the page without the parameter.
6. Report: gene name, file, what allele 0 and allele 1 show, preview links. Do not commit or push unless asked;
   registration happens on deploy.
