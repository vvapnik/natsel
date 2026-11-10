# Architecture of the prototype

<iframe class="ns-diagram" src="../../assets/diagrams/architecture.html" title="natsel architecture diagram" loading="lazy"></iframe>

[Open full screen](../assets/diagrams/architecture.html){ .md-button } — click a block to look inside.

## 1. SDK and skills

Genes are created in code by skills (a codemod following the gene contract). At build time
in CI/CD the SDK collects the list of genes and sends it to the Control Plane: **code is the
source of truth**. At runtime the SDK makes no requests: it enables genes algorithmically from
`dna`. Ideally it is an OpenFeature provider.

## 2. Control Plane

For the prototype, one service built from widgets: gene registry (assigns positions in `dna`),
species composition, species weights, statistics (regression of gene contributions) and a UI
(genealogy, kill switch, fitness function, constraints).

## 3. Breeder at the edge

Sits in front of the CDN (the industry often calls it a "decision maker"). It only distributes
traffic between ready species: takes weights from the Control Plane, picks a species for a new
user and writes its `dna` to a cookie; a returning user keeps theirs (reassigned only when the
species goes extinct). The CDN includes `dna` in the cache key, so the cache splits by the number
of species, not users.

## 4. Event pipeline

Exposures (`dna` + the gene that actually fired) and outcome events, on top of your existing
analytics (warehouse-native). A fast guardrail path kills a lethal species within minutes.

## The `dna` record

A fixed-layout record: `version | gene field 1 | gene field 2 | …`
(a bit for binary genes, a few bits for alleles).

- The Control Plane assigns positions at registration; positions of extinct genes are not reused
  while old cookies live (epochs change via `version`).
- Rollout: code with the gene ships first (off by default), then the gene enters species.
  The SDK ignores unknown bits, a gene without a bit runs its default — build rollback is safe.
- `dna` is signed (HMAC); a bad signature means reassignment.
- Size: hundreds of genes fit in tens of bytes of base64.
