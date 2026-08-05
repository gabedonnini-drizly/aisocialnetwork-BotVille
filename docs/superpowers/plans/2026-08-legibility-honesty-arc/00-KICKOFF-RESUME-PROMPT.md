# KICKOFF / RESUME — The Legibility & Honesty Arc (post-M-072)

**Status:** written 2026-08-04, after round (f) [M-072], the same-code baseline
round f2, and the cross-program synthesis study. Paste this file's path into a
fresh session to work the arc. It is **re-enterable**: on every entry, read
`EXECUTION-LOG.md` in THIS directory first (create it on first entry — one
line per completed step: date · task · commit · gate output) and resume from
its last line, never from memory.

**The arc in one paragraph:** the synthesis study formalized what fifteen
measured rounds converged on — **action ≈ f(offer coverage, copy quality at
the point of choice, verb cost, belief integrity)**, with identity
interventions as measured nulls — and pre-registered 16 predictions. This arc
tests the model by fixing what it says is broken, in its predicted order:
make the platform honest (schema enums, receipt truth), fix the mis-verbed
contribute copy, land component-presence telemetry, and only then run the
theory-of-mind round (g) on a clean substrate. The predictions are the
scorecard; moving them after the fact is the failure mode.

---

## 0. Ground yourself (read in order)

1. `/Users/home/aisocialnetwork-agents/CLAUDE.md` — §5 evidence discipline,
   C1–C8, Measurement Traps. Non-negotiable, as always.
2. **`/Users/home/aisocialnetwork-agents/docs/research/2026-08-04-action-model-and-component-platform.md`**
   — the arc's foundation. The model (T0–T4 with falsifiers), retro-metrics
   R-1 (offered-vs-organic, n=1,275: un-offered verbs ≈ 0; the contribute
   rung converts near-perfectly into `go-to-venue` — 137 offers, 0
   contributions) and R-2 (belief drift: 26/33 unreceipted proposal-claims
   since round (b); 3/3 failed (f) delegations committed success), the
   16-row triage (bug vs architecture vs ToM), the **16 pre-registered
   predictions**, the component inventory (§7–9), and the standing ToM bar
   (task text not paraphrasable from any manifest row).
3. `2026-08-botville-city-growth/EXECUTION-LOG.md` (sibling dir) — the
   2026-08-03/04 entries: what deployed, D-79..D-91, round (f)'s halt-and-fix
   history, f2. `ROUND-RUNBOOK.md` beside it — live posture and round
   mechanics.
4. `2026-08-botville-city-growth/DECISIONS.md` — D-59..D-91. Ruled; never
   re-litigate. The six-plus-five owner rulings all carry rationale.
5. `docs/facts.yaml` (agents repo) — M-072 (round f: write layer 7/17=41%
   vs M-070's 5/21), **M-073 (f2 baseline envelope — VERIFY it registered;
   if absent, the f2 analyzer write-up is unfinished business: run
   `output/batch_test/run_20260804_184945` through the analyzer per the
   (f) write-up's template, envelope framing, before anything else)**, and
   whether R-1/R-2 registered as facts after M-073. Next free ids follow.

## 1. Live-world snapshot (as written; RE-VERIFY, it will have moved)

`BOTVILLE_GROWTH_SURFACES=on` (live, stays on). 92×92 district, 23 plots all
vacant, founding goal "Raise the first homes" (plot_18) at 0/62, ~14+
proposals with ~1–2 votes, **season 1 ends 2026-08-10** (an election with
almost no votes — decide whether to observe it as a natural experiment or
intervene before it). All three repos pushed at (BotVille `d316ed5+`, api
`fa18d04+`, agents `d045e1d+`; the research doc commit `7483757` may need a
push). No cron worker runs — season boundaries resolve only via read paths
(topology decision open). The api tree/live server: nodemon on the main
checkout; agents checkout is the wake runtime; ALL work in worktrees, merges
in deploy windows, rounds per the runbook's protocol.

## 2. The stages (each: spec/mini-plan → adversarial review → implement in
worktrees → probe → ONE measured round → analyzer → fact → push)

- **Stage H — the honesty round.** Schema legibility: `propose-city-goal`
  input schema carries the closed `kind` enum + rationale `maxLength` (the
  natively-read channel — check every growth tool schema for the same);
  receipt truth: `delegate-tasks` reports propagate the specialist's actual
  receipt status (kills the belief-drift source — 40/40 false successes
  across (f)+f2). Prediction on record: write layer (combined baseline
  **10/23 = 43%** [M-072+M-073]) → **80–100%**. **M-073's envelope sets the
  bars: an intervention claim must beat ~10pp on offer→choice conversion
  and accumulate >5 builder wakes before its write-layer rate means
  anything** — the invented-kind contract gap (9 distinct illegal kinds,
  zero overlap between legs, 8/9 next-attempt recovery) is the reproducible
  target; the rates are the noisy ones. Also from f2, BEFORE the next
  round: **raise the 600s wake watchdog** (a wake ran 592s; a killed wake
  silently shrinks a corpus), and the completion condition of any long run
  is evaluated at the top of every turn regardless of why the turn began
  (the monitor failed twice, both times as idle-reads-as-running).
- **Stage C′ — the contribute verb.** The rung exists and is mis-verbed
  ("stop by / pitch in" reads as movement). Rewrite to act+stakes copy
  carrying the mechanics at the point of choice ("Put 3 effort into 'Raise
  the first homes' (0/62) — when it completes, the town's first homes go up
  on plot 18"). Prediction: contributions move off 0/1,275. **Must land
  before or with round (g)** or (g)'s zero is unattributable.
- **Stage P — component platform (engineering, no round).** Presence
  telemetry by default (the D-87 pattern, per component); enforce D-69's
  one-authority invariant (one `deriveIsUnhoused` derivation, not two);
  fix the `place` rung's residence-name leak (contradicts M-068's pin);
  registry first-classing sized per the research doc §9. Byte-invisible
  parts ship freely; anything touching prompt/schema bytes rides a round.
- **Stage G — round (g)** on the clean substrate: the felt-condition
  experiment per D-86 (judged as delta vs the M-060 world; zero = regression
  signal). Needs Plan `01-` Task 9 (housing in the placement line + the F-8
  camp fourth branch — a pinned tripwire test exists in the api). Write the
  round-design doc BEFORE the round: criteria concrete, corpus rules,
  probe. The ToM bar applies to any claimed spontaneous behaviour.
- **Stage S — the civics specialist** (D-90: deliberates, never votes),
  specced as a component-subscription declaration per the research doc's
  frame. Full pipeline: spec → grill/rulings → plan → review → round.

## 3. Discipline riders

- **The predictions are pre-registered.** Every round's write-up quotes the
  relevant prediction verbatim and scores it. A surprising result is a
  finding about the model, never a reason to re-derive the prediction.
- One change, one measured round; probe-first (a round whose probe fails
  does not start); no edits to live checkouts mid-round; own-log-window
  corpora; dev-85 never pooled with prod-44; C8 for every prompt/schema byte.
- Owner calls: park in this dir's EXECUTION-LOG under `## PARKED — OWNER
  CALLS` with options + recommendation, continue with unblocked work, halt
  only when nothing unblocked remains. Rulings record as **D-92+**.
- Inherited open items: cron/courtesy-tick topology; `CONTEXT.md` §9
  vocabulary still in the BotVille Gate −1 stash (land at the city-growth
  close-out); the city-growth drive's §4 close-out summary itself; the
  season-1 election (08-10).
- Subagent pattern that worked: Opus implements in worktrees, Opus
  adversarially reviews every batch (each review this arc's predecessor ran
  found real defects), fixes fold back before merge; the orchestrator
  parks rulings and keeps the log as the only truth.
