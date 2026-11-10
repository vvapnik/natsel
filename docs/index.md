---
title: natsel — product evolution by natural selection
hide: [navigation, toc]
---

<div class="ns-hero" markdown>

# Let your product evolve.<br>LLMs breed the changes, traffic does the selecting.

<p class="ns-lead">natsel is an open source framework for continuous product evolution.
Small, isolated changes ("genes") compete for live traffic with no control version.
Losers have their code deleted, winners get merged. Humans set the goal and the limits.</p>

[Why your project needs it](why.md){ .md-button .md-button--primary }
[How it works](concept/model.md){ .md-button }

</div>

## The bottleneck has moved

LLMs write code. A big epic still costs a lot of human effort, but a small change
(a different empty state, another onboarding step, new copy on a button) now costs
almost nothing. Teams can produce far more ideas than they can test.

**The new bottleneck is traffic, verification and deleting dead code, not development.**
Classic A/B testing was built for the old world: a few hand-made experiments, each
against a control, each ending in a meeting. natsel is built for a stream of cheap changes.

## How it works, in four lines

<div class="ns-cards" markdown>

<div class="ns-card" markdown>
### :material-dna: Genes
A gene is one small change behind a flag, bound to one locus (a screen, a component,
a funnel step). It can be removed mechanically. Variants are alleles. Genes can nest:
a "favorites" banner gene may carry genes of the favorites view inside it.
</div>

<div class="ns-card" markdown>
### :material-account-group: Species
A species is a combination of genes a user gets, consistently. Several species live
at once. **There is no control version.**
</div>

<div class="ns-card" markdown>
### :material-scale-balance: Selection
Traffic flows to species by their metrics. Fitness is scored **per gene**, by regression
over species genotypes. A species nobody routes traffic to goes extinct on its own.
</div>

<div class="ns-card" markdown>
### :material-source-merge: Fixation & extinction
A gene that keeps winning is merged and its flag removed. A losing gene is deleted
by a PR from a skill. A human approves both.
</div>

</div>

## Watch a product evolve

<iframe class="ns-diagram" src="assets/diagrams/evolution.html" title="species evolution tree" loading="lazy"></iframe>

[Open full screen](assets/diagrams/evolution.html){ .md-button } — click a species to read its story.

## Not another A/B tool

| | Classic A/B testing | natsel |
|---|---|---|
| Unit of work | An experiment | A gene (a small change behind a flag) |
| Baseline | A fixed control version | None; a child is compared to its living parent |
| Who decides | A person reads the dashboard | Traffic weights; the human approves PRs and sets limits |
| End of life | Someone cleans up flags… eventually | Losers' code is deleted, winners are merged — by design |
| Scale | A handful of experiments at a time | A continuous stream of LLM-made changes |

[Full comparison →](concept/vs-ab.md)

## Architecture of the prototype

<iframe class="ns-diagram" src="assets/diagrams/architecture.html" title="natsel architecture diagram" loading="lazy"></iframe>

[Open full screen](assets/diagrams/architecture.html){ .md-button } — click a block to look inside.

[Architecture in detail →](concept/architecture.md)

## Status

natsel is a **concept**. Next: specs and LLM skills for genes, an open source
Control Plane you can start with one command, and a traffic emulation that will
give an honest go / no-go against a plain multi-armed bandit.
Free and self-hosted. [Follow on GitHub](https://github.com/vvapnik/natsel).
