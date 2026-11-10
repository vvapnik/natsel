# natsel vs classic A/B testing

| | Classic A/B / MVT | Multi-armed bandit | natsel |
|---|---|---|---|
| What competes | Variants of one experiment | Arms of one decision | Genes across the product, carried by species |
| Baseline | Fixed control | Usually none | None; genealogical control (child vs living parent) |
| Traffic | Split per experiment | Shifted toward winners | Split only between species; genes are scored across the species that carry them |
| Interactions | Usually assumed rare | Ignored | Measured within a locus; nested genes scored only where their parent is on |
| Where changes come from | People | People | People and LLM skills, by a gene contract |
| End of life | Manual flag cleanup | Manual | Built in: extinction deletes code, fixation removes the flag |
| Decision | Human after significance | Algorithm, per decision | Algorithm routes traffic; human approves PRs and sets limits |

## Why drop the control version?

A control is a frozen copy of the past. With a continuous stream of changes it ages,
its traffic share is wasted and it answers the wrong question ("better than three months ago?").
natsel compares each species with its living parent. For absolute calibration a
"fossil" — a frozen species on 1–2% of traffic — is an option (see [Risks](risks.md)).

## Why not "just a bandit"?

A bandit optimises one decision with fixed arms. natsel manages a **population** whose
members are constantly added and removed, scores the parts (genes) rather than the whole
(species), and owns the code lifecycle. Whether this beats a well-tuned bandit is exactly
what the emulation stage must show.

## Prior art

| Solution | What it does | Difference |
|---|---|---|
| Evolv AI | Evolutionary UI/UX optimisation, closed SaaS | Landing pages and e-commerce, not product code |
| AI-agent A/B tools (Runner AI, Fibr, …) | An agent generates variants and runs A/B | Product surface (copy, layout), with a control |
| Optimizely, VWO, GrowthBook, Unleash, LaunchDarkly | Flags, A/B, bandits, MVT | Tools for an experiment, not an autonomous loop |
| AlphaEvolve, EvoX, Evolver | Code / prompt evolution with LLMs | Optimise against a benchmark, not live traffic |
