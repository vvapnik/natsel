# Glossary

| Biology | natsel |
|---|---|
| gene | an A/B test: one change point behind a flag |
| allele | one variant of that test: a flag value (A, B, C…) |
| gene pool | all genes of an environment with all their alleles |
| locus | screen, component, funnel step |
| epistasis | a nested gene: expressed only when its parent gene is on |
| species | one allele of every gene, assigned to a user (strictly, a genotype) |
| population | species from one gene pool competing for one niche |
| environment | an isolated product with its own traffic, gene pool and fitness |
| fitness | target metric + guardrail metrics |
| mutation | a new gene or allele, wrapped by the natsel skill |
| lethal mutation | guardrail violation → the species dies at once |
| fixation | merge into the base, remove the flag |
| extinction | a codemod merge request (no AI) deletes the losing branches |
| carrying capacity | max living species at the given traffic |

**Breeder** — the edge component that assigns a species to a user.
**`dna`** — the signed bit record of a species' genes, stored in a cookie.
**Control Plane** — registry, species, weights, statistics and UI.
