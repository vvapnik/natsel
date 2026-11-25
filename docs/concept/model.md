# Model

natsel borrows the vocabulary of evolution because the mechanics really match.

## A tree of species

Like a phylogenetic tree in biology: species branch by mutation and crossing, some go extinct, the fittest spread.

<iframe class="ns-diagram" src="../../assets/diagrams/evolution.html" title="species evolution tree" loading="lazy"></iframe>

[Open full screen](../assets/diagrams/evolution.html){ .md-button } — click a species to read its story.

## Allele, gene, gene pool

An **allele** is one value of a flag: variant A, B, C… of one A/B test. A gene can have two or more.

A **gene** is the A/B test itself: a minimal change point behind a flag. Its contract:

- it is bound to one **locus** (a screen, a component, a funnel step);
- it depends on other genes **only through nesting** (see below), never sideways;
- it can be **removed mechanically** (a codemod can delete it without a human reading the code).

The **gene pool** holds all genes of an environment with all their alleles. Four genes with
2, 2, 3 and 2 alleles give 9 alleles and 24 possible combinations.

Genes and alleles never split traffic themselves: **traffic is split only between species**.
An allele is measured across all the species that carry it.

## Nested genes

A gene can live **inside** another gene. The gene "show a favorites banner" opens the favorites
view, and that view can carry genes of its own: a different sort order, a compact layout.
The inner genes are expressed only when the outer gene is on — biologists call this
**epistasis**: one gene masks the effect of others.

Genes form a **tree**, and it shapes everything else:

- **Code.** A nested gene sits inside its parent's flag. The SDK registers the parent of every gene,
  and a nested gene's flag is read only when the parent is on.
- **Species.** The Control Plane composes only valid genotypes: a nested gene is switched on
  only together with its parent. Species that differ only in genes hidden by an off parent are
  the same species and are not built.
- **Statistics.** A nested gene's fitness is measured only on users whose parent gene is on,
  and compared with its siblings inside that parent.
- **Extinction.** When a parent goes extinct, its nested genes go with it: they had no way to be expressed.
- **Fixation.** When a parent is fixed, its flag is removed and its nested genes become
  top-level genes of the locus.

!!! warning "Hidden genes need traffic"
    A nested gene only sees the traffic of its parent. Deep nesting starves the inner genes,
    so nesting depth is limited and an inner gene waits for its parent to prove itself first.


## Species, population, environment

A **species** carries **one allele of every gene** in the pool, and a user receives it with sticky
assignment. (Strictly, this is a genotype; "species" is shorthand.) Several species live at the
same time. **There is no control version.**

Every species always carries **every gene**: once deployed, the code branches on the new flag.
A new gene therefore enters all living species at once with its **control allele A**, so nothing
changes for their users; its other alleles are tried in new species.

A **population** is the gene pool plus the species built from it, competing for the traffic of
one niche (a user segment). A population runs a few species instead of every combination, but
**every allele is carried by at least one species**, so every allele gets measured.

An **environment** is a fully isolated product or business line (say, a cashback app in the EU and
a coupons site in the US). Each has its own traffic, gene pool and fitness function (e.g.
conversion + guardrails); genes and species never cross between environments.

## The cycle

1. **Mutation.** A team ships a change with the natsel skill; the new gene joins the gene pool.
2. **Combination.** A new species is assembled automatically (or by hand), passes an automated
   **smoke test** and an **optional manual approval**, and only then is released into the
   population with a small share of traffic. No species reaches users unchecked.
3. **Population.** Species compete; each one's traffic share follows its metric. Nobody dies here.
4. **Selection.** A species that keeps losing stops receiving traffic and dies out on its own.

**Statistics** run all the time, outside the cycle: an allele leaderboard, alleles that win
together, winners per segment, the history of every species, results per team, and hints on
where to look next.

## Selection

Traffic is distributed between species by their metrics (Thompson sampling, by niches).
A species that stops receiving traffic goes extinct — no manager has to decide.

## The unit of selection is the gene

À la Dawkins, species are only temporary carriers. Traffic goes to species, but fitness,
extinction and fixation are computed **per gene**, by regression over species genotypes.
Interactions are modelled within a locus and along the nesting tree (a nested gene is scored only where its parent is on).

- A gene with a low score goes **extinct**: the Control Plane opens a merge request from a
  deterministic codemod (no AI) that keeps the winning allele's branch and deletes the rest.
- A gene that wins consistently is **fixed**: merged into the base, flag removed.
- New species are assembled in the Control Plane from suitable genes.

## Reproduction

Successful species produce offspring: a new allele or a cross of two species.
Middling alleles are not thrown away: they stay in the gene pool and are remixed into new species.
Parent and child live at the same time, so **the parent is the local control**
(genealogical control instead of a global baseline).

## Carrying capacity

The number of living species is limited by traffic. A new species appears only when a slot frees up.

## The human role

Humans define the **fitness function**, **guardrail metrics**, the **mutation budget**
and the **carrying capacity**. They can create and approve species by hand, and they review the
codemod merge requests that remove extinct genes.
