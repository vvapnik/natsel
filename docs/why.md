# Why your project needs natsel

natsel is not for everyone. This page helps you decide if it is for you.

## Signs you are the target

- **Your team (or your LLM) produces more small ideas than you can test.**
  The backlog of "let's try…" grows faster than the experiment calendar.
- **You already have feature flags — and a flag graveyard.** Flags from experiments
  finished a year ago still sit in the code because nobody owns the cleanup.
- **Experiments end in meetings.** Someone has to read a dashboard, argue about
  significance and decide. This doesn't scale to dozens of changes a week.
- **You have steady traffic, but not Google-scale traffic.** You can't afford to give
  every idea its own 50/50 split for two weeks.
- **You care about the long run.** You want the product to keep improving, not
  to win one test and freeze.

## What you get

| Problem today | With natsel |
|---|---|
| Cheap ideas wait in line for expensive experiments | Every idea becomes a gene and enters the pool right away |
| Each test needs its own share of traffic | Independent genes share traffic factorially; only alleles of one gene split it |
| A fixed control ages and drifts | No control: each child is compared to its living parent |
| Dead flags pile up | Extinction deletes the code; fixation merges it and removes the flag |
| A human decides each experiment | Traffic weights decide; humans set goals, guardrails and approve PRs |
| "Did this idea help?" is lost after the test | Each gene's contribution to the metric is visible and goes back to the ticket |

## What you keep

natsel does not replace your process. Ideas still start in your tracker, code still goes
through tests, review and stage. natsel sits **on top of** your feature flags and your
analytics (warehouse-native), and the whole system is open source and self-hosted.

## When it is *not* for you

- Very low traffic: selection needs signal. natsel trades traffic for time, but there are limits.
- Big, coupled changes (a redesign, a pricing model): those are epics, not genes.
  Run them as classic experiments.
- Regulated flows where every variant needs separate sign-off.

!!! note "Honest status"
    natsel is a concept today. The emulation stage (TASK-70.4) exists precisely to
    check, before anyone adopts it, whether gene-level selection beats a plain
    multi-armed bandit on realistic traffic.
