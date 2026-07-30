# Owner decisions — platform-MCP plan set, staleness-review rulings, 2026-07-30

Rulings on the five owner-level items raised by the 2026-07-30 staleness review
(the plans were written 2026-07-29, before the visual-assets set merged).
Numbering continues from
`../2026-07-27-botville-visual-assets/DECISIONS.md` (last assigned: D-20).
Each decision below has been applied to the plan text in this directory in the
same amendment pass; the review's TEXT-FIX/COSMETIC re-anchors were applied
alongside them.

---

## Decided

| # | Decision |
|---|---|
| D-21 | **Venues: consume the shipped vocabulary — never a second registry.** The botville module reads `config/venues.json` through the shipped loader (`src/utils/venueVocabulary.js`); the module's zod `VenueSchema` validates the shipped 8-field shape (`id,label,indoor,capacity,archetype,roles,affords,hours`), **wrapping, not duplicating, the existing structural validator**. Venue↔agent assignment reuses `scheduleCoverage.js`'s `deriveHomeVenue`/`deriveWorkplaceVenue` (seeded via `agentSeed.pickFrom`, roster in creation order) so `get-city-map` always agrees with stored routines. **Extensibility requirement:** adding a venue to `venues.json` (+ BotVille sync) must flow through the module with **zero module code changes** — no hardcoded venue lists or counts anywhere in module code or tests; tests derive expectations from the registry. Owner rationale: *"modernize and design for the full feature — build from the solid foundation; it should be easy to add scope to BotVille and add more assets to map to the venue; that's next-phase work alongside what's planned."* |
| D-22 | **Slot overlap: keep the shipped ASC rule (earliest-start-wins).** `Schedule.getCurrentSlot`'s merged `ORDER BY users_schedules.start LIMIT 1` stands; Plan 01 Task 5 shrinks to characterizing it (venue passthrough + the deterministic tie-break), with no `DESC` flip. On the record: the deterministic schedule writer guarantees non-overlap (SC-1 green), so the tie-break is a **degenerate-case guard only**; any future Sims-style override layering must be an **explicit priority mechanism, never an `ORDER BY` accident**. Owner rationale: *"follow game-design best practice and what avoids race conditions and other conflicts."* |
| D-23 | **AgentPresence: addendum I.4 governs the shipped type.** `activity?: string` is added **in place** to the shipped `AgentPresence` in `packages/shared/src/types/Assets.ts` — single definition, no second declaration, no second `export *` (barrel breakage). The "Do not extend this interface" comment is updated to cite I.4's optional-additions rule (four required fields forever; additions optional-and-ignorable). The restated-I-11 test extends the **existing** `test/shared-types.test.ts` and the **existing** root `test` script — integrated with, never overwritten. Owner rationale: *"follow The Sims and gaming design best practices"* — activity visibility is core. |
| D-24 | **Endpoint path: `GET /api/public/botville/locations` is canonical.** Spec II.2's `GET /api/botville/locations` sentence is amended (owner-approved, marked in the spec citing this decision). Owner rationale: *"follow existing api structure, don't deviate — platform and infra stay consistent."* |
| D-25 | **Appearance (carried decision, not new):** platform agents render as **seed-derived premade humans** via the shipped `spriteSeed` → `AppearanceResolver` path (`AgentSprite`'s optional `identity` constructor arg). The hash-picked `avatarVariant` approach is removed from Plan 03 wherever it appeared; `avatarVariant` is a dead field for platform agents. Follows D-19 (all pack variants, derived appearance) and the F-3 runtime. |

### Applied in the same amendment pass (not separately numbered)

- Every TEXT-FIX/COSMETIC finding from the 2026-07-30 staleness review: line-number
  re-anchors across all three plans, `M-042` → `M-048` in Plan 02 (facts.yaml now
  ends at M-047), 037 recorded as merged (not "reserved/pending").
- Plan 03 Task 2 re-anchored to the shipped F-3 reality: `useGameSync` /
  `presenceModel` (`partition` / `warnUnknown` / `flattenSomewhere`) stays the
  presence authority; the task adds a tolerant parser + `PRESENCE_MODE` that
  **preserves** that authority; venue-knownness derives from the venue registry
  (houses included), never `AGENT_LOCATIONS`; `normalizeLocation` references
  removed (the symbol no longer exists).
- Plan 03 Task 4 re-anchored to `venueRegistry.sceneKeyFor` /
  `VenueScene:<venueId>` scene keys (`INTERIORS` is gone); coverage spans all
  interiors, not four.
- D-20 hygiene folded into Plan 03's repoint task: the stale Railway fallback URL
  at `packages/client/src/lib/api.ts` is replaced with the self-hosted default.
