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
  Tests: `node --test tests/natsel.test.mjs`.
