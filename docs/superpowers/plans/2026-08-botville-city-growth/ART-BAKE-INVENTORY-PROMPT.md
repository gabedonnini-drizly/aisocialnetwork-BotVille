# PROMPT — Art/bake inventory pass (city-growth kickoff gate 2)

**Paste this into a fresh session with cwd = `/Users/home/aisocialnetwork-BotVille`.**
Written 2026-08-01, immediately after the BotVille Civic Drive closed
out. This pass is **gate 2 of the city-growth kickoff**
(`00-KICKOFF-PROMPT.md` in this directory; gate 1, M-055, is already
satisfied). Its deliverable is a report, not code: what art the owner's
licensed packs can actually build, so growth planning starts from the
world's real budget (I-8: *places exist because art exists for them*).

## Hard constraints (license — read before anything else)

- LimeZu packs may be USED, never REDISTRIBUTED. `assets-src/` and every
  `pack/` output directory are gitignored — **never commit, stage, or
  copy licensed art anywhere tracked**. The repo ships code + fixture
  art only (`test/asset-index.test.ts` enforces the fixture pack in
  git; owner-local trees run the suite as `BOTVILLE_PACK=limezu npm
  test`).
- The working tree currently carries a DELIBERATE uncommitted limezu
  bake diff (19 tracked files: `.tmj` maps + `assets.generated.ts`) —
  see DEPLOY.md "Owner-local LimeZu art". Do not commit it; do not
  revert it without asking.

## Ground yourself (read in order)

1. `README.md` — the "Serving the real art" / bake section (~line
   140–180): the four required 16x16 packs, the `assets-src/` layout
   rule, the three-command pipeline.
2. `docs/ASSETS.md` — the exact subtree each pack unpacks to, and the
   license record.
3. `DEPLOY.md` — "Integrated-mode dev town" + "Owner-local LimeZu art"
   (added 2026-08-01).
4. Scripts you will drive: `scripts/inspect-assets.mjs` (the inventory
   truth), `scripts/sync-assets.mjs`, `scripts/world-bake.mjs`
   (`npm run bake:world -- limezu assets-src`), the agent bake
   (`docker compose --profile bake run --rm agent-bake`;
   `agents.json` is its batch input), `scripts/contact-sheet.mjs`
   (visual QC output), `scripts/index-pack.mjs` / `gen-variant-manifest.mjs`
   (what the packs contain).
5. State as of 2026-08-01, so you don't rediscover it: the world bake
   HAS run with limezu on this machine (2 atlases, 68 props, 18 venues;
   `venues.json` md5 byte-stable across packs — re-verify that
   stability after every re-bake, it is what keeps the api sync test
   honest). Agent sprites exist in `sprites/pack/`.
   **`inspect-assets.mjs` reports 8 MISSING source groups**: premade
   characters · UI · Room Builder interiors · Room Builder office ·
   **exterior themes (needed for district)** · interior themes ·
   animated interiors · animated exteriors. The zips sit in
   `assets-src/` partially unextracted, and `Modern_Interiors_RPG_Maker_Version.zip`
   looks like the WRONG VARIANT (the bake reads the 16x16 version's
   folder layout). A fifth pack (`Serene_Village_revamped_v1.9.zip`)
   is present but not referenced by `sources/limezu.json` — inventory
   it as possible growth material, do not wire it in.

## The work

1. **Reconcile the 8 missing groups.** For each: which zip should
   provide it (per `docs/ASSETS.md` + `sources/limezu.json`'s `files`
   block), extract into the exact expected subtree, re-run
   `inspect-assets.mjs`, repeat until the missing count is 0 or every
   remainder is attributable to a pack variant the owner must download
   (the RPG-Maker-vs-16x16 question — STOP AND ASK the owner for those;
   never guess at purchases).
2. **Re-bake**: `node scripts/sync-assets.mjs limezu assets-src` →
   `npm run bake:world -- limezu assets-src` → agent bake if character
   sources changed. Gates: `venues.json` md5 unchanged;
   `BOTVILLE_PACK=limezu npm test` fully green; the dev town at :5173
   still renders (it hot-serves `public/assets`).
3. **Contact sheet** (`scripts/contact-sheet.mjs`) → tell the owner
   where the output is; the visual eyeball is theirs.
4. **The deliverable — write
   `docs/superpowers/plans/2026-08-botville-city-growth/ART-INVENTORY-REPORT.md`:**
   - the missing-groups table: group → zip/variant → resolved/blocked-on-owner;
   - the growth-venue capability list: for each growth candidate the
     kickoff names (noticeboard/town-hall board [D-37], housing
     variety, district themes, `venue_unlock` dormant venues), what the
     NOW-extracted packs can build — named sheets/tiles as evidence,
     not vibes;
   - anything Serene Village adds to the budget;
   - open owner actions (purchases/variants, the eyeball pass).
   Commit the report (docs only — never art). It satisfies gate 2;
   note that in the report header and in the city-growth kickoff's gate
   list.

## Stop and ask the owner

Any purchase or variant download; any license ambiguity; anything that
would put licensed bytes in a tracked path; reverting the standing
limezu working-tree diff.
