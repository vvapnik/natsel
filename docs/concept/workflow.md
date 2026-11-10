# Team workflow

natsel plugs into the process a product team already has.

<iframe class="ns-diagram" src="../../assets/diagrams/workflow.html" title="natsel team workflow diagram" loading="lazy"></iframe>

[Open full screen](../assets/diagrams/workflow.html){ .md-button } — click a block to look inside.

1. A product person files an idea in the tracker (e.g. Jira).
2. An engineer implements it with natsel skills; the skills produce several alleles at once.
3. Autotests, code review, acceptance testing and stage — as usual.
4. The gene enters the pool. The Control Plane builds new species from suitable ones and sets weights.
   Optional manual control comes as **constraints** (max share, ramp-up, segments, forbidden
   combinations), not weight edits, so the statistics stay valid.
5. The Breeder routes traffic.
6. Everyone sees each idea's contribution to the metric; the result goes back to the ticket.
7. A losing gene is deleted by a PR from a skill; a winner is fixed (flag removed). A human approves.

New genes come from people's initiative; the system only combines them.

!!! warning "Known gap"
    Combinations of genes are not tested on stage. This is covered by keeping genes
    bound to one locus (dependencies only through nesting) and a fast guardrail path.
