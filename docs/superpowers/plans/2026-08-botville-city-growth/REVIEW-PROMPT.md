# ADVERSARIAL REVIEW — BotVille City Growth plan set

Paste into a fresh session. Your job is to break this plan set before it
executes.

The civic drive's review found **20+ real defects its author could not see**,
in a plan set written with the same care as this one. Assume the same of this
one. The author of these files has already been wrong about four load-bearing
premises in a single day (see `DECISIONS.md` § *Kickoff corrections*) and knows
of at least one unresolved gap it could not close (§0 below). Treat "the author
verified this" as a claim to re-verify, not a fact.

**Read in this order:** `DECISIONS.md` → the spec
(`docs/superpowers/specs/2026-08-01-botville-city-growth-design.md`) →
`00-INDEX.md` → `04-` → `01-` → `02-` → `03-`.

**Then verify every anchor before relying on it.** Several civic-drive anchors
rotted between writing and review *in a single day*. Every file path, line
number, table name, constant and measured number in this set is a claim.

---

## §0 — The gap the author knows about and did not close

**I-8 versus D-66: how does a built structure become a venue?**

I-8 says every place that can ever appear is **baked with art first**; growth
only flips state on baked content. D-66 says **any archetype that fits may be
built on any plot** — no zones.

Together these imply the bake must pre-stamp a venue for every
(plot × fitting-archetype) pair, because the venue must exist in the published
vocabulary before it can be unlocked. With 10 archetypes and N plots that is
combinatorial, and it would blow both the published vocabulary and the
`get-city-map` payload the plan is otherwise careful to cap.

The author's unverified hypothesis is that **footprint fit bounds this
naturally** — a school does not fit a house plot, so most plots admit one to
three archetypes and the combinatorics stay small. That hypothesis is **not
specified anywhere in the plan set, not tested, and not sized against the
actual plot footprints Plan `04-` Task 7 will author.**

Resolve this. Options the author considered and did not choose between:
pre-stamp per (plot × fitting archetype) and cap the published projection;
decouple venue identity from archetype (`plot_7` as the venue id, archetype
selecting the interior TMJ — but then `roles`/`affords` change on build, and
baked vocabulary stops being static); or constrain `allowedArchetypes` per plot
at authoring time and accept that the *author*, not the town, has pre-decided
what can stand where — which weakens D-66 to the point where it should be
re-ruled with the owner rather than quietly eroded.

**This is plausibly a MUST-FIX and it gates Plan `04-` Task 7 and Plan `01-`
Task 1.**

---

## §1 — Attack the foundations

1. **The whole set rests on ROUND (f).** If the `builder` specialist does not
   convert, every downstream round measures growth over a broken delegation
   path. That is *exactly* the error the kickoff's gate 1 was written to
   prevent — and this drive inherited it anyway, because gate 1 passed on its
   letter (M-055 exists) while failing on its substance (participation 0%). Is
   the plan's mitigation (stop and re-diagnose if the probe fails) actually
   enforced anywhere, or is it a sentence?

2. **The root-cause claim is a hypothesis dressed as a finding.** The author
   asserts that specialists made zero MCP calls *because* their `limitation`
   and `system_instructions` forbid acting. That is inferred from config text
   plus two round summaries. **Verify it from traces**: did the reflector
   actually hold callable tools in those episodes? Was there a schema error, a
   permission error, a timeout, a truncation, or an empty tool list? A
   plausible cause that happens to be legible is the most dangerous kind.

3. **Circular dependency in D-73.** Claims are free and uncapped; the brake is
   that unbuilt claims are *revocable by a civic act*. But civic acts are
   measured at 0%. If the town cannot act, it cannot revoke, so a day-one land
   grab is permanent in practice even though the plan says it is not. Does the
   design have a non-civic backstop, and should it?

4. **D-59 makes housing depend on a loop measured at zero.** If participation
   stays at 0%, no house is ever built and every agent is homeless forever.
   The plan calls this the intervention rather than the risk. Is the founding
   charter (D-64) genuinely sufficient to break the deadlock, given it seats a
   goal but cannot make anyone contribute to it?

---

## §2 — Attack the boundary and the data

5. **II.1.** Plan `01-` Task 3 moves home assignment into the module behind an
   interface. Does anything in core still read a `botville_*` table? Is the
   grep-based boundary test real, and can it be shown failing?

6. **The `dorm` role change is a behaviour change hiding in a data edit.**
   `deriveVenuesAffording` filters out everything with the `home` role, so
   adding `"home"` to the dorm **silently removes it from every agent's daytime
   candidate pool**. Plan `01-` flags this. Has it sized the effect? The dorm
   is one of only six public venues; removing it from daytime pools changes
   venue-visit distribution — which is *also* the thing a growth round might
   want to measure. Is that a confound?

7. **Promises grounding.** The civic drive grounds promises against "own
   home/workplace." Plan `01-` Task 3 changes what "home" resolves to, and
   under D-60 an agent's home may now be a **tent on a plot**. Does grounding
   still resolve? Does A-1 eligibility still hold? This is an extraction
   surface — trace it before believing the plan's claim that no extraction
   surface moves.

8. **Migration 041's no-cascade rule.** Verify it against how agents are
   actually deleted today. If deletion goes through a path that removes rows
   directly rather than via FK, D-72's guarantee is decorative.

9. **`get-city-map` must not disagree with stored routines.** The platform-MCP
   plan states this as an invariant. Home is moving from derived to stored.
   Does the invariant still hold at every point in the transition, including
   for agents with no assignment row?

---

## §3 — Attack the measurement

10. **Tasks 2–4 of Plan `02-` ship as one round.** Three string changes on one
    theme. Is that genuinely one change, or is it three changes whose
    individual effects will be unrecoverable from the analyzer output?

11. **The kill criterion is ≥1 organic civic write from ≥3 distinct agents.**
    Is that discriminating? What result would falsify the world-condition
    hypothesis rather than merely disappoint?

12. **Soul prompt bytes.** M-056 baselined median 1,849 chars. Plan `02-` adds
    housing state to the placement line and soul to a specialist context
    (D-69). What is the projected total, and at what point does the recorded
    "prompt length degrades 20B performance" finding bite?

13. **Round sequencing.** The set gates behind civic rounds (d) and (e), which
    have not run. If they slip indefinitely, does anything here have a
    defensible path to shipping, or is the whole set blocked on another drive?

14. **Facts numbering.** The set claims M-059 is spent and M-060 is next.
    Verify. Also verify that M-057/M-058 are genuinely reserved and not
    quietly used.

---

## §4 — Attack the game design

15. **Is the demand signal legible enough to act on?** The design assumes an
    agent that reads *"you sleep in a tent"* will contribute to a housing goal.
    Nothing in the measured record supports that inference. What is the
    weakest link in the chain from condition → candidate → delegation →
    builder → MCP call?

16. **Emergent zoning law (D-66) requires scarcity, attribution, externality,
    declaration, observation and no enforcement.** The plan ships four of six
    and defers externality to round (h) "if (g) earns it." Can emergent law
    happen at all without externality? If not, is D-66 shipping as a real
    mechanic or as an aspiration?

17. **The plot count in Plan `04-` Task 7 is a game-feel guess.** Too few and
    the town deadlocks; too many and there is no scarcity, hence no politics.
    Is there a defensible way to derive it rather than pick it?

18. **Demolition difficulty scales with civic investment (D-67).** Check the
    degenerate case: a building funded by one agent is trivially demolished by
    a majority. Is that griefing, or is it democracy? Homes are exempt — is
    anything else worth exempting?

---

## §5 — What to produce

A findings document in the style of
`2026-07-31-botville-drive/REVIEW-FINDINGS-2026-07-31.md`:

- Severity per finding (MUST-FIX / SHOULD-FIX / CONSIDER), with the evidence
  that establishes it — a file and line, a trace, a query, not an argument.
- **Rotted anchors listed separately.** Every one you find.
- **Owner calls surfaced separately** — decisions the review reveals as needing
  a ruling rather than a fix. §0 is likely one.
- A traceability section mapping each finding to the plan and task it amends.

Do not soften findings to be constructive. The author's judgement has been
wrong four times in this document set's own history, all four times with
complete confidence.
