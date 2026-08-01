# KICKOFF — BotVille City Growth: world expansion, housing, districts

**Status:** written 2026-07-31, at the close of the drive-review session,
BEFORE its own grilling. Paste into a fresh session to (a) grill the §3
open questions one-at-a-time with the owner and record rulings as
**D-57+** in a new `DECISIONS.md` here, then (b) produce the spec + plan
set specified in §4, mirroring `2026-07-31-botville-drive/`.

> ⚠ **GATED — do not execute (or even grill) until ALL THREE hold:**
> 1. **Round (b) of the civic drive has shipped and M-055 exists** —
>    the F-3 offered/chosen data. Expansion rewards are worthless if the
>    base civic loop doesn't pull; the coefficients and selection rates
>    from that round are inputs to every economy question below.
> 2. **The owner has done an art/bake inventory pass** — I-8 ("places
>    exist because art exists for them") makes art the rate limiter for
>    ALL growth; §3's first question cannot be answered without knowing
>    what can be baked dormant.
> 3. **You know the status of civic rounds (c)–(e)** — this drive's
>    changes must not interleave with their re-baselines (one change,
>    one measured round).

---

## 0. Your task in one paragraph

The civic drive (D-30..D-56) gives goals a democracy and the town a
reason to be touched — but completion effects stop at plaques (D-36 V1),
and the city itself is static: 18 baked venues (`cafe`, `district`,
`dorm`, `house_1`..`house_13`, `library`, `office` — verified in
`venues.json` 2026-07-31), no way for the map to grow, and housing that
exists as ART but not as MECHANICS (nothing rules how a home is
assigned, whether an agent can move, or whether housing is scarce or
earnable). Your job: turn the owner's ruled direction — *"a building is
built, new tiles are added, city is expanded… a real WORLD that can grow
— like the sims, sim city"* (D-36 rationale) — into a decision record
and plan set for goal-driven world growth: `venue_unlock` execution
(V2, already designed), housing mechanics, district/map expansion, and
the growth cadence, without breaking I-8, the boundary rules, or the
measurement discipline.

## 1. Ground yourself first (read in this order)

1. `/Users/home/aisocialnetwork-agents/CLAUDE.md` — §5 evidence
   discipline, C1–C8, measurement traps. Non-negotiable.
2. `/Users/home/aisocialnetwork-BotVille/CONTEXT.md` — the city
   glossary. New growth vocabulary you coin (district? plot? home?)
   must be ADDED there in the same style, or not used.
3. `2026-07-31-botville-drive/` in full: `DECISIONS.md` (D-30..D-56),
   `REVIEW-FINDINGS-2026-07-31.md`, the spec
   (`specs/2026-07-31-botville-civic-drive-design.md`), and the three
   plans — this drive builds ON those rails (registry kinds, seasons,
   affordances seam, `CityStatePort`). ⚠ Amended text overrides
   original wherever they disagree.
4. `specs/2026-07-29-botville-world-addendum-design.md` Part II —
   II.1 boundary rules and I-8 remain binding on every surface here.
5. The bake pipeline (verify anchors — they rot):
   `packages/client/src/game/venueRegistry.ts` + the `venues/` source
   dir (`_archetypes`, per-venue dirs), `npm run bake:world` →
   `packages/client/public/assets/venues.json` (+ `.lock.json` sha256),
   sync-tested against the api copy by `test/vocabulary-sync.test.mjs`
   and `aisocialnetwork-api/tests/venueVocabularySync.test.js`. Growth
   = changes to THIS pipeline; understand it before proposing.
6. How "home" works today (verify in-tree, this is load-bearing for
   housing): `aisocialnetwork-api/src/services/botville/presenceService.js`
   (`resolvePresence`, `Schedule.getCurrentSlot`, town timezone) — where
   does an agent's home venue actually come from, and what would an
   assignment change touch? The civic drive's promises ground against
   "own home/workplace" (spec §VII) — housing changes move that surface.
7. `aisocialnetwork-agents/docs/facts.yaml` — the M-052..M-058 tail as
   it stands when you run (M-055 is your round-(b) input). Reserve
   M-059+ for this drive.

## 2. Settled — imported rulings, binding, do not re-ask

1. **I-8 stands absolutely**: runtime never invents venues; every place
   that can ever appear is baked with art first. Growth mechanics flip
   state on baked-dormant content; they never create content.
2. **D-36 is the mechanism and its consistency rule is ruled**:
   `world_effect: venue_unlock` — venues bake with art + a
   `locked_by_goal` marker; completion flips unlock state in the DB;
   API vocabulary and client map evaluate unlock **at boot** — a
   building appears at the first world-boot after completion,
   everywhere at once ("buildings appear with the dawn"; the WoW
   daily-restart rhythm). Plaques/credits stay instant (D-35).
3. **D-42/D-34**: growth arrives as registry DATA (new kinds, new
   `world_effect` values at most) — never a new tool per content kind;
   the L1 surface stays frozen unless a round-gated promotion says
   otherwise.
4. **D-40**: any growth economy is population-indexed and config-driven,
   snapshotted at instantiation, re-derived from measured rounds.
5. **D-31/D-32**: no backfill, no timers — growth triggers are
   world-state-driven; a town that never completes goals never grows,
   and that is legitimate and legible.
6. **D-37**: the noticeboard venue is already owed to the next art/bake
   pass — fold it into this drive's first bake, zero new mechanics.
7. **C8 + one-change-one-round**: if "home" enters the soul prompt or
   placement line, soul bytes move → own round, re-baseline; promises
   grounding (home/workplace set) is an extraction surface — trace
   before editing. Prompt length degrades 20B performance (recorded
   finding) — every growth token in any prompt must earn its place.
8. **II.1 boundary rules**: only `src/services/botville/**` (+ module
   MCP server + its migrations) touch `botville_*`; core reads via
   `User`/`Schedule` interfaces only.

## 3. Open questions — grill BEFORE writing plans (one at a time,
recommended answer per question; rulings land as D-57+ with owner
rationale verbatim)

**Growth triggers & cadence**
- What fires expansion: goal completion only (D-36's design), or also
  `active_population` thresholds (D-40's machinery generalizes — "the
  town earned a new district by growing"), or both? (Recommend: both as
  registry trigger types; completion for buildings, population for
  districts.)
- Pacing: max unlocks per season? Can two goals unlock two venues in
  one boot? Is there a growth budget the way agents have effort
  budgets? (The Sims/SimCity pull is real, but so is the confound —
  every unlock is an exposure change.)
- Reversal: can anything ever close, decay, or fail (unfinished goal →
  ruin?), or is growth monotonic? (Recommend: monotonic in V1 — decay
  is a new emotion-adjacent mechanic; grill it to a named deferred
  item, don't leave it unruled.)

**Housing**
- Where does "home" come from today (from §1.6's verified answer), and
  what is the V1 housing mechanic: assigned (system allocates),
  chosen (agent picks a vacant house via a tool/candidate), or earned
  (goal reward / tenure)? (Recommend: chosen-from-vacant as a
  candidate, effort-priced — agency without an economy rewrite.)
- Scarcity: 13 houses + dorm at dev-85 — is the dorm the default and
  houses the aspiration? Do two agents share (roommates → standing
  co-presence → relationship fuel)? What happens when houses run out —
  is THAT the natural district-unlock trigger?
- Records: is home an assignment row (DB state, who writes it, which
  module owns it) or derived? It cannot be derived if agents choose —
  name the table and the boundary rule consequence.
- Identity: does "my home" enter the soul prompt / placement line
  ("You're at home" already renders — D-48)? If home becomes
  *particular* ("your house on the north side"), that is soul bytes →
  C8 rider → own round. Does moving house deserve a memory/exposure
  fact the agent can metabolize (the D-47/D-50 pattern: expose the
  fact, let the agent write the feeling)?
- Privacy: is who-lives-where public (it is physical and observable —
  recommend public, consistent with notes/contributions) or owner-only?

**Districts & map**
- Unit of growth: one venue at a time, or district SETS (a district
  bakes as a group with its own tiles and unlocks as a unit)? What does
  the client need — can the current map render a hidden/dormant venue
  cheaply (greyed? absent?), and does unlocking mid-session require the
  boot-time rule only, or also a client asset-version bump
  (`venues.lock.json` semantics at runtime)?
- Camera/nav: do new districts need nav-mesh/scene work in the client
  (`navigation.ts`, scene per district?) — is that art-pass work or
  code work? (This decides whether district growth is "bake + flip" or
  a real client feature.)
- Does the affordances payload / `get-city-map` grow with the city, and
  what is the token cost at 2× venues? (The §V payload-cap lesson from
  the review applies — cap and summarize from birth, don't retrofit.)

**Goal kinds for growth**
- A `build` kind (contributions → venue_unlock) is the obvious V1 —
  what accrual, what coefficient, and does building SHOW progress
  in-world before completion (scaffolding art? or chronicle-only)?
- Do growth goals get system-proposed via Radiant templates
  (houses-full → propose-district template), agent-proposed, or both?
  (D-41 stands: humans nudge, never author.)

**Measurement & QA**
- Which behavioral question does the first growth round answer, and
  what is its capability probe? (Recommend: "does a visible new
  building change venue-visit distribution?" — probe: one dev
  completion flips one unlock, appears at boot, one agent visits.)
- New QA checks with proof-they-can-fire: unlock-integrity (every
  unlocked venue has a completing-goal receipt), home-assignment
  integrity (every agent resolves to exactly one home), map/vocabulary
  sync across the bake (extend the existing sync tests).
- Facts: M-059+ reserved; every round re-baselines what it moves.

**Hygiene to fold in** (tasks, not questions): the noticeboard bake
(D-37); wishlist items 15–17 from the previous drive if still untriaged
(venue-notes re-poll, human browser pass, dev signup 500); CONTEXT.md
additions for any coined vocabulary.

## 4. Deliverable — the plan set

Create under `docs/superpowers/plans/2026-08-botville-city-growth/`
(this directory), mirroring the civic-drive set:

- `DECISIONS.md` — D-57+ with owner rationale verbatim.
- A design spec in `docs/superpowers/specs/` (extends the civic-drive
  spec §III's `world_effect` and the world-addendum's bake pipeline;
  CONTEXT.md terms exactly, plus its own vocabulary additions).
- `00-INDEX.md` with the round schedule — every agent-facing change
  round-gated, every round with the three-step behavioral loop (probe /
  no-edits round / analyzer with declared corpus) the civic INDEX uses.
- Per-repo plans: `01-` api (migrations, unlock state, housing records,
  registry kinds), `02-` agents (only if prompt/extraction surfaces
  move — C8 riders inline), `03-` frontend/client (bake, map, dormant
  rendering, chronicle), splitting `04-` for the BotVille repo if the
  bake work is large.
- Planning-mode QA sections per plan (blast radius where agents-repo
  surfaces move; checks bracketing each rollout; new checks with
  fire-proofs).
- An adversarial REVIEW-PROMPT.md written by the authoring session, in
  the style of `2026-07-31-botville-drive/REVIEW-PROMPT.md` — the civic
  drive's review found 20+ real defects the author could not see;
  assume the same of yourself.

**Discipline reminders**: one change, one measured round; segment by
`episode.decision`, count `tool_calls`; dev-85 and prod-44 never pool;
no edits to live checkouts during a round (nodemon deploys on write;
the agents checkout IS the live runtime — worktrees); verify every
anchor in this document before relying on it — several of the civic
drive's anchors rotted between writing and review in a single day.
