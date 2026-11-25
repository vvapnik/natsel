# Team workflow

natsel plugs into the process a product team already has. Almost everything new is done
**once, by the platform team**: the SDK and the skill, a CI step, the Control Plane, the Breeder
at the edge, events on top of existing analytics, and the cleanup codemods. **Product teams
keep working as usual**; the AI skill wraps their code in flags automatically.

<iframe class="ns-diagram" src="../../assets/diagrams/workflow.html" title="natsel team workflow diagram" loading="lazy"></iframe>

[Open full screen](../assets/diagrams/workflow.html){ .md-button } — click a block to look inside.

1. A product person files an idea in the tracker (e.g. Jira).
2. An engineer implements it with the coding agent as usual; the natsel skill wraps the change as a gene with its alleles.
3. Autotests, code review, acceptance testing and stage — as usual.
4. The gene enters the pool and every living species, with its control allele A. The Control Plane
   builds new species (automatically or by hand); each passes a smoke test and an optional manual
   approval before it gets traffic.
   Optional manual control comes as **constraints** (max share, ramp-up, segments, forbidden
   combinations), not weight edits, so the statistics stay valid.
5. The Breeder routes traffic.
6. Everyone sees each idea's contribution to the metric; the result goes back to the ticket.
7. When a gene is done, the Control Plane opens a merge request from a deterministic codemod (no AI)
   that keeps the winning allele and removes the flag. The team reviews and merges it like any other MR.

New genes come from people's initiative; the system only combines them.

!!! warning "Known gap"
    Combinations of genes are not tested on stage. This is covered by the smoke test of every
    new species, by keeping genes bound to one locus (dependencies only through nesting) and by
    a fast guardrail path.
