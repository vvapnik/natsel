# Model

natsel borrows the vocabulary of evolution because the mechanics really match.

## A tree of species

Like a phylogenetic tree in biology: species branch by mutation and crossing, some go extinct, the fittest spread.

<iframe class="ns-diagram" src="../../assets/diagrams/evolution.html" title="species evolution tree" loading="lazy"></iframe>

[Open full screen](../assets/diagrams/evolution.html){ .md-button } — click a species to read its story.

## Gene and alleles

A **gene** is a minimal change behind a flag. Its contract:

- it is **isolated** and bound to one **locus** (a screen, a component, a funnel step);
- it does **not depend** on other genes;
- it can be **removed mechanically** (a skill can delete it without a human reading the code).

Variants of one gene are **alleles**; only alleles of the same gene split traffic between themselves.

## Species

A **species** is a whole combination of genes that a user receives, with sticky assignment.
Several species live at the same time. **There is no control version.**

## Selection

Traffic is distributed between species by their metrics (Thompson sampling, by niches).
A species that stops receiving traffic goes extinct — no manager has to decide.

## The unit of selection is the gene

À la Dawkins, species are only temporary carriers. Traffic goes to species, but fitness,
extinction and fixation are computed **per gene**, by regression over species genotypes.
Interactions are modelled only within a locus.

- A gene with a low score goes **extinct**: an LLM skill opens a PR that deletes its code.
- A gene that wins consistently is **fixed**: merged into the base, flag removed.
- New species are assembled in the Control Plane from suitable genes.

## Reproduction

Successful species produce offspring: a new mutation or a cross of two species.
Parent and child live at the same time, so **the parent is the local control**
(genealogical control instead of a global baseline).

## Carrying capacity

The number of living species is limited by traffic. A new species appears only when a slot frees up.

## The human role

Humans define the **fitness function**, **guardrail metrics**, the **mutation budget**
and the **carrying capacity**, and approve the PRs that delete or fix genes.
