# Architecture of the prototype

<iframe class="ns-diagram" src="../../assets/diagrams/architecture.html" title="natsel architecture diagram" loading="lazy"></iframe>

[Open full screen](../assets/diagrams/architecture.html){ .md-button } — click a block to look inside.

## 1. SDK and skills

Genes are created in code by the natsel skill: it wraps every change behind a flag following the gene contract. At build time
in CI/CD the SDK collects the list of genes and sends it to the Control Plane: **code is the
source of truth**. Along with each gene the SDK sends its parent gene, if it is nested. At runtime the SDK makes no requests: it enables genes algorithmically from
`dna`. Ideally it is an OpenFeature provider.

## 2. Control Plane

For the prototype, one service built from widgets: gene registry (assigns positions in `dna`, keeps the nesting tree),
species composition (only valid genotypes: a nested gene only with its parent; every new species passes a smoke test and an optional manual approval), species weights, statistics (regression of gene contributions) and a UI
(genealogy, kill switch, fitness function, constraints).

## 3. Breeder at the edge

Sits in front of the CDN (the industry often calls it a "decision maker"). It only distributes
traffic between ready species: takes weights from the Control Plane and picks a species for each
user in one of two ways:

- **hash** (default, nothing stored on the device): the species is derived from
  HMAC(daily salt, IP + User-Agent) by weighted rendezvous hashing. A user keeps the species for
  a day; when weights change, only the users that must move do, and extinction moves only the
  extinct species' users. The salt is random, rotated daily and never logged, so no consent
  banner is needed for the assignment itself.
- **cookie**: the signed `dna` is written to a cookie; a returning user keeps theirs (reassigned
  only when the species goes extinct). Stable for longer, but it is storage on the device, which
  usually requires consent.

The CDN includes the species in the cache key, so the cache splits by the number of species, not
users.

## 4. Event pipeline

Exposures (`dna` + the gene that actually fired) and outcome events, on top of your existing
analytics (warehouse-native). A fast guardrail path kills a lethal species within minutes.

## 5. Extinction flow

The Control Plane keeps the list of genes where selection is over. For each it takes the winning
allele and runs a **deterministic codemod (no AI)**: the flag check is replaced by the winner's
branch, the losing branches are deleted. The codemod opens a merge request; the owning team
reviews and merges it, and the gene leaves the pool on the next CI scan.

## The `dna` record

A fixed-layout record: `version | gene field 1 | gene field 2 | …`
(a bit for binary genes, a few bits for alleles).

- The Control Plane assigns positions at registration; positions of extinct genes are not reused
  while old cookies live (epochs change via `version`).
- Rollout: code with the gene ships first (off by default), then the gene enters species.
  The SDK ignores unknown bits, a gene without a bit runs its default — build rollback is safe.
- `dna` is signed (HMAC); a bad signature means reassignment.
- A nested gene has its parent recorded in the registry; its field is read only when the parent's field is on.
- Size: hundreds of genes fit in tens of bytes of base64.
