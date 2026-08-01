# INTEGRATION PROMPT — fold the review findings into clean, single-voice plans

**Status:** written 2026-07-31, immediately after the adversarial review
session landed its fixes. Paste into a fresh session BEFORE execution
starts. The review left the plan set CORRECT but layered: original text +
`⚠ AMENDED (review 2026-07-31)` patch blocks + four post-review rulings
(D-53..D-56). An executor today must mentally merge three strata. Your
job: produce ONE coherent instruction stream per file — the amended
content rewritten as native text — then PROVE nothing was lost in the
merge. This is an editorial + verification pass: **you re-litigate
nothing, you re-derive everything you restate.**

**Why this pass exists:** patch-on-patch is how forks happen. The review
itself found a documentation fork (kickoff said the 27-schema baseline
was captured; facts.yaml said it wasn't) that grew in ONE DAY. Amendment
blocks that contradict the sentence directly above them are the same
incubator.

---

## 0. Inputs (read in this order)

1. `/Users/home/aisocialnetwork-agents/CLAUDE.md` — §5 evidence
   discipline. Every claim you carry from a finding into plan prose
   keeps its evidence tag or gets re-derived.
2. `REVIEW-FINDINGS-2026-07-31.md` (this directory) — the finding
   record. **Immutable**: you never edit it except §VI additions; it is
   the provenance the cleaned plans point back to.
3. `DECISIONS.md` — now D-30..**D-56** (four review-session rulings at
   the bottom with owner rationale verbatim).
4. The amended files (every `⚠ AMENDED` / `RULED` / `✅ RESOLVED`
   marker is a merge site):
   - `specs/2026-07-31-botville-civic-drive-design.md` (§I.2, §II DDL,
     §III registry seed, §IV, §V, §VI.1, §VI.2, §IX)
   - `01-api-civic-and-nudges.md` (Tasks 1, 2, 3, 4, 5, 7, 8, 9 +
     Global constraints)
   - `02-agents-affordance-and-ambient.md` (Tasks 0–8, every ROUND
     bullet)
   - `03-frontend-exposure.md` (Tasks 1, 3, 4)
   - `00-INDEX.md` (review banner), `00-KICKOFF-PROMPT.md` (extended
     §3 banner), `../../../CONTEXT.md` (D-41 fix)
5. `../2026-08-botville-city-growth/00-KICKOFF-PROMPT.md` — the gated
   follow-on drive (needed for step 4).

## 1. The merge (per file, mechanical rules)

For each amendment block, rewrite the surrounding task/section so the
amended content IS the text — one voice, imperative, house style — then
delete the patch scaffolding. Rules:

- **Provenance survives as a short tag, not a story.** Replace each
  block with inline tags like `[R: BC-4]` / `(D-55)` at the sentence
  that carries the finding's content, pointing at
  REVIEW-FINDINGS-2026-07-31.md / DECISIONS.md. Delete the narrative
  ("the original pin was FALSE and is replaced…") — the findings doc
  holds the history; the plan holds only the instruction.
- **Where amended text contradicts adjacent original text, the original
  goes.** Known sites: Plan 01 Task 7's steps still say the response is
  "deliberately UNWRAPPED … matches the locations endpoint" beside the
  D-56 config-auth amendment (reconcile: unwrapped stays true; auth
  flag is orthogonal — say both plainly); Plan 02 Task 3's original
  interface bullet vs the D-e/D-f ref-mechanism block; Plan 02 Task 8's
  praise bullet (the false pin's remnants); Plan 03 Task 1's
  `fetchAgentAffordances` bullet vs the D-56 revert.
- **Do not reflow untouched text.** Surgical merges only — a diff of a
  merged file should show amendment sites and nothing else (the C8
  lesson: never confound structure and content in one commit).
- **DDL is copy-verbatim territory**: Plan 01 Task 1 says "copy the DDL
  from spec §II" — after your merge, spec §II must read as ONE clean
  DDL block (template_id column and both partial indexes in place, no
  patch commentary inside the SQL).

## 2. The completeness proof (this is the deliverable's spine)

Build a traceability table and append it to
REVIEW-FINDINGS-2026-07-31.md as **§VII Integration record**:

- One row per finding id (F-1..F-5, A-1..A-12, BC-1..BC-12, D-a..D-j,
  Sweep E/F/G/H items) → the file+section where its content now lives
  natively, or an explicit disposition: `NOTE — no plan change` /
  `WON'T-DO because …`. **No row may read "see amendment block" after
  this pass.**
- One row per ruling D-53..D-56 → EVERY site its subject appears.
  Grep terms (run them, don't trust memory): `placement` +
  `md-gen` (D-53); `hard floor` + `llm_judge` (D-54); `praise` +
  `consum` + `pendingNudges` + `ack` (D-55); `affordances` + `public` +
  `auth` + `internal` (D-56). A ruling mentioned in one file and
  contradicted in another is exactly the F-1/F-2 class the review
  existed to catch.
- Known unfinished business to resolve while you're in there (found at
  review close, deliberately left to this pass):
  1. **D-54 has no implementation step.** The hard-floor change
     (`scripts/admin_tools/llm_judge.py` + the floors doc) currently
     lives only as a ROUND (b) bullet note in Plan 02 Task 5. Give it a
     real task step: file to edit, the city criterion's exact
     predicate (≥1 city action per engaged agent — define "engaged
     agent" and "city action" as `tool_calls` names, never
     `action_type`), a test, and the awareness rider stated.
  2. **SHOULD-severity findings without landed text**: BC-7 (pre-epoch
     `deriveSeasonId` guard test) — add to Plan 01 Task 3's test list
     or record won't-do; A-10's vitest-vs-root-suite note exists in
     Plan 03 — confirm Task 3's test step names the right suite.
  3. **Wishlist 15–17**: still untriaged (findings §IV). Either record
     the owner's disposition if one arrives, or carry the line into the
     integration record as open — do not silently drop it.
  4. **Deferred-items lists** (DECISIONS.md tail + INDEX "Deferred"):
     add the city-growth drive pointer —
     `../2026-08-botville-city-growth/00-KICKOFF-PROMPT.md`, gated on
     M-055 + owner art/bake inventory — so D-36 V2 / D-37 / housing
     seekers land on the kickoff, not on a dead "later" bullet.

## 3. Re-verify what you restate (anchors rot in days here)

Every `file:line` you carry into merged prose gets re-opened at merge
time. Minimum set (all verified 2026-07-31; treat as expired):
`EXCLUDED_TOOLS` count in `unified_runner.py`; `_own_intention` /
`_delegation_candidate` line refs; `exposure_log.py` extractor range
(INFRA path); `exposure.py:25` ACK_KINDS; `end_of_turn.py:227` promise
shape; `configs/defaults.yaml:31-32`; `boundary.test.js` allowlists;
`mdGenController.js` nudge comment; migration 038 columns; facts.yaml
tail (M-051 rider — if Plan 02 Task 0 already ran, M-052 exists and the
INDEX Gate-0 language must flip to past tense). Where a number appears
(22 = 7+15, 27→28, cap seeds, coefficients), it cites `[M-nnn]` or the
config constant — never a bare restated figure.

## 4. Gates (run, don't assert)

- Agents repo (only if you touched anything under
  `aisocialnetwork-agents/`, e.g. facts.yaml):
  `python scripts/docs/lint_docs.py` → 0 errors, and
  `python -m pytest tests/heartbeat/ -x -q --tb=line` unchanged-green.
- This repo: `npm test` at root still green (you touched only docs —
  prove it anyway; it is cheap).
- Grep the merged plan set for the strings `⚠ AMENDED`, `RULED D-5`,
  `pending owner`, `✅ RESOLVED` — post-merge, the plans/spec should
  contain NONE of them (provenance tags `[R: …]` and `(D-nn)` only);
  the findings doc and DECISIONS.md keep theirs.
- Read each merged task ONCE, top to bottom, as the fresh-engineer
  test: no sentence may require knowing what the text USED to say.

## 5. Deliverables

1. The merged spec + plans + INDEX/kickoff/CONTEXT (single-voice,
   provenance-tagged).
2. REVIEW-FINDINGS §VII Integration record (the traceability table +
   dispositions + gate outputs, corpus discipline in every counted
   row).
3. One commit per file-family with plain messages
   (`docs(drive): integrate review amendments into <file> — no
   semantic changes`), so the git record separates this editorial pass
   from any future semantic edit — the 6387b01 lesson.
4. A closing paragraph: is the set ready for Plan 02 Task 0 ∥ Plan 01
   Task 1 to start, and did the merge surface ANY new contradiction
   (if yes: finding, not fix — route it like the review did).

**Discipline riders:** read-only against the live world; no DB writes,
no agent-state writes, a live round may be running; you re-litigate no
D-30..D-56 ruling; where a document and a measured fact disagree, the
measurement wins and the document is what gets revised.
