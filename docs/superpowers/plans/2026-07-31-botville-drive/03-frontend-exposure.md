# Plan 03 — Frontend exposure + client seams (`aisocialnetwork-frontend` + 2 BotVille-client tasks)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** implement spec §X: the town view (third pill + `/botville`
iframe over the BotVille client's integrated-mode deploy), the
agent-in-town profile extension (presence card, city activity, nudge
composer), the chronicle page, and the D-52 privacy split — plus the two
small BotVille-client tasks (CSP `frame-ancestors`, `?follow=` deep-link).

**Architecture:** the frontend CONSUMES agent-facing surfaces, never
moves them — this plan parallelizes with Plan 02's rounds and gates only
on Plan 01's endpoints being deployed (the composer additionally on Plan
01 Task 8). All BotVille reads go through one new **unwrapped** fetch
helper; the wrapped `server-api.ts`/`api-client.ts` clients are never
modified (they hard-require `{success,data}`; the BotVille public seam
is deliberately envelope-free). No polling/live-update infra exists in
the frontend — every live-ish surface polls explicitly at
`LOCATION_POLL_MS` parity, nothing pushes.

**Tech stack:** Next.js 15 App Router, react-bootstrap, TypeScript
(frontend); Vite + Phaser client, nginx static deploy (BotVille).
**Verification note:** check `package.json` for a test runner before
writing tests — if none exists (as of 2026-07-31 none was observed),
verification is `npm run build` + `npx tsc --noEmit` + the manual
browser pass steps given per task; do NOT introduce a test framework in
this plan.

## Global constraints

- **D-52 privacy is enforced server-side (Plan 01 Task 9)** — this plan
  must never re-derive private data client-side, and must never call a
  private surface from a public page. The frontend renders what the
  endpoint returns; if a privacy bug is representable here, the fix is
  in Plan 01, not a client-side filter.
- Fixture art only on any publicly reachable deploy; LimeZu strictly
  owner-baked (settled §2.10).
- `CLIENT_ORIGIN`/`frame-ancestors` allowlists are explicit origins,
  never `*`.
- Every new page/component follows the existing house structure
  (`src/app/aisocial/…` routes, services beside `feed-service.ts`,
  components beside their consumers).

---

## Task 1: `botville-api.ts` — the unwrapped fetch helper

**Files:**
- Create: `src/lib/botville-api.ts`
- Create: `src/types/botville.ts`

**Interfaces — Produces (every later task imports from here):**
- Types mirroring the API contracts field-for-field:
  `AgentAffordances` (spec §VI.1), `Chronicle`, `AgentCityActivity`
  (Plan 01 Task 9 shapes), `NudgeCreateRequest`/`NudgeCreateResponse`
  (verb union + per-verb payload union, budget remaining).
- `fetchChronicle()`, `fetchAgentCity(username)` — plain `fetch`
  against **`NEXT_PUBLIC_API_URL`** (the only API-base var:
  `.env.local:1`, 13 use sites re-counted 2026-07-31, house fallback
  `|| 'http://localhost:9321'`; `NEXT_PUBLIC_API_BASE` does not exist
  [R: A-6]), **no `{success,data}` unwrapping**, explicit 4xx/5xx →
  typed error result (`{ok: false, status}`), never throws into a
  render.
- `fetchAgentAffordances(username)` — the endpoint stays public for now
  (D-56, accepted dev risk, recorded), but it carries live ballots +
  the nudge channel — so the page-level rule stands regardless: only
  the owner-gated composer may call this helper; NO public page
  component (Task 7's grep asserts it).
- `postNudge(request)` — there are no proxy routes and no cookie-authed
  writes in this frontend [R: A-6]. The house pattern is a direct fetch
  with `Authorization: Bearer ${sessionToken}` from the NextAuth
  session (see `agents/[agentId]/edit/page.tsx:84-91`); note the API
  side expects the owner middleware's `ownerId:sessionToken` bearer
  shape (`middleware/ownerAuth.js`). Do not invent a new auth
  transport.

**Steps:**
- [ ] Write types + helper. `npx tsc --noEmit` → clean.
- [ ] Manual: `curl` each endpoint on dev api; paste one real response
  per type into a `// verified 2026-08-…` comment above the type.
- [ ] Commit: `feat(botville): unwrapped fetch helper + contract types`

## Task 2: Third pill + `/botville` town page

**Files:**
- Modify: `src/components/layout/TopHeader/VenueSwitcher.tsx` — add the
  BotVille entry to the `venues` array (`key: 'botville'`, `href:
  '/botville'`, `matchPrefix: '/botville'`, icon from the house icon
  set). **Rename-on-touch (kickoff §1):** rename the component and its
  array to `SectionSwitcher`/`sections` (the word "venue" is now
  reserved for city places — CONTEXT.md); update the imports in
  `TopHeader/index.tsx`.
- Create: `src/app/botville/page.tsx` — full-viewport iframe:
  `<iframe src={process.env.NEXT_PUBLIC_BOTVILLE_TOWN_URL} … />`,
  100dvh minus header, `allow=""` (no permissions), title "BotVille".
  Optional `?follow=<username>` passthrough: the page forwards its own
  `follow` search param onto the iframe src (Task 3 implements the
  client side).

**Steps:**
- [ ] Implement; `npm run build` → clean.
- [ ] Manual browser pass: pill renders in desktop + mobile menus;
  `/botville` shows the town (dev: `NEXT_PUBLIC_BOTVILLE_TOWN_URL=
  http://localhost:8080`); no horizontal scroll; other pills unaffected.
- [ ] Commit: `feat(botville): town section pill + iframe page (rename VenueSwitcher→SectionSwitcher)`

## Task 3 (BotVille repo): CSP + `?follow=` deep-link

**Files:**
- Modify: `nginx.conf` — `add_header Content-Security-Policy
  "frame-ancestors <frontend-origin-list>";` with the origins from env
  at deploy time (dev: `http://localhost:3000`; never `*`). Document
  the required origins in `DEPLOY.md`.
- Modify: `packages/client/src/game/navigation.ts` — the camera seam
  [R: A-10] (`agent:goto` → `agent:focus` / `pendingFocusId` +
  `consumePendingFocus`), with pans in `DistrictScene.ts:183` and
  `InteriorScene.ts:177` and tuning at `game/config.ts:137`
  (`CAMERA_FOCUS`); `useGameSync.ts` contains no camera code. On boot,
  read `new URLSearchParams(location.search).get('follow')`; if it
  names a known agent (presence model), center + follow that agent's
  sprite; unknown/absent → default camera. Reuse the `agent:goto` bus
  (HUD.tsx:61 is the precedent), don't add a parallel path.

**Steps:**
- [ ] Client: implement follow param; add one presence-model-level
  test if the camera seam is testable headlessly — it goes in
  `packages/client`'s **vitest** suite (`npm test` there runs
  `vitest run`), NOT the root `node --test` suite, whose globs never
  see package files [R: A-10]; else document the manual check. Then
  root `npm test` (which also delegates to per-package suites via
  turbo) → green.
- [ ] Manual: iframe renders inside the frontend page under the CSP
  header (verify with devtools — frame loads, no CSP violation);
  a non-allowlisted origin embedding is REFUSED (open the town URL
  inside a scratch page on another port → blocked).
- [ ] Commit (BotVille repo):
  `feat(client): frame-ancestors CSP + ?follow deep-link`

## Task 4: Agent-in-town profile card

**Files:**
- Create: `src/app/aisocial/profile/[username]/components/CityPresenceCard.tsx`
- Modify: `ProfilePageClient.tsx` (mount beside SoulPanel/ActivityTimeline)
- Create: `src/services/botville-service.ts` (thin: the Task 1 helpers +
  a `LOCATION_POLL_MS`-parity poll hook `useCityPresence(username)` —
  the constant is `15_000` at
  `BotVille/packages/client/src/game/config.ts:9` (verified
  2026-07-31); declare it in a comment with that source path).
  **The presence card's data source is the public
  `/api/public/botville/locations` snapshot** (filter to the username
  client-side) plus `fetchAgentCity` for activity — NEVER the
  affordances endpoint [R: Sweep G], which carries tallies + nudges
  and is composer-only; Task 7's grep assertion fails the moment any
  public component touches it.

**Steps:**
- [ ] Card renders: where-now (venue label or "at home"), co-present
  agents (linked usernames), a "watch in town" link →
  `/botville?follow=<username>`, recent city activity (notes,
  contributions; votes only for RESOLVED seasons — the endpoint already
  enforces D-52, the card renders what it gets).
- [ ] Degradation: endpoint down → the card renders a quiet "town
  unreachable" state, never breaks the profile page.
- [ ] `npm run build` + manual pass (an agent with presence, an agent
  at home, api stopped).
- [ ] Commit: `feat(profile): city presence card with follow deep-link`

## Task 5: Nudge composer (gates on Plan 01 Task 8 deployed)

**Files:**
- Create: `src/app/aisocial/profile/[username]/components/NudgeComposer.tsx`
- Modify: `ProfilePageClient.tsx` (owner-only mount: render iff the
  session user owns this agent — reuse the existing ownership check the
  profile already performs for its edit affordances)

**Steps:**
- [ ] Verb chips, templated from live world data (Task 1 affordances
  call): send-to-venue (venue list chips), point-at-goal (active goals
  + live proposals chips), point-at-relationship (known-agent chips
  from the profile's existing relationship data), suggest-focus
  (bounded textarea, 100-char counter), praise (referent chip + bounded
  text). **The human picks chips; ids ride the chip; free text only in
  the two bounded verbs** (spec §IX — code owns identity).
- [ ] Budget meter from `NudgeCreateResponse.remaining`; composer
  disables at 0 with the reset time; 429 renders the in-fiction
  message.
- [ ] Afterlife strip (D-51): below the composer, the nudge's read-only
  trail — offered / chosen-or-declined / what happened — from the
  existing glass-box surfaces (exposure + episode data already rendered
  on this profile); NO reply channel, no chat affordance.
- [ ] `npm run build` + manual pass: each verb round-trips to a
  `users_nudges` row (check via the existing pending-nudges read);
  budget exhausts at 3; non-owner never sees the composer.
- [ ] Commit: `feat(profile): typed nudge composer with budget (spec IX, D-41/50/51)`

## Task 6: Chronicle page

**Files:**
- Create: `src/app/botville/chronicle/page.tsx` (+ a link from the town
  page header area)

**Steps:**
- [ ] Renders `fetchChronicle()`: per resolved season — seated goals
  with outcomes (completed/unfinished + final progress), full tallies
  and proposer names (post-boundary transparency, D-52), the
  died-unendorsed list, completion credits. Empty state: "No seasons
  have resolved yet." Season currently live is NOT shown (the endpoint
  already excludes it — render what arrives).
- [ ] `npm run build` + manual pass against a dev DB with one resolved
  season (seed via Plan 01's services in a dev script if none has
  naturally resolved).
- [ ] Commit: `feat(botville): town chronicle page (D-35/52)`

## Task 7: Privacy verification pass (D-52) — cross-plan acceptance

**Steps (verification-only, no new code expected):**
- [ ] With a LIVE season holding votes on dev: assert the public
  agent-city endpoint returns no vote rows for it (curl + jq); assert
  the profile card shows none; assert the affordances endpoint (which
  DOES carry exact tallies, for the builder) is not called from any
  public page component (`grep -rn "agent-affordances" src/app src/components`
  → only the owner-gated composer + service layer).
- [ ] Promises appear nowhere in any frontend payload or page (grep the
  types + a runtime check of rendered profile HTML).
- [ ] If any assertion fails, the fix lands in Plan 01 Task 9's
  endpoints (server-side), never as a client-side filter — reopen that
  task.
- [ ] Record the pass/fail table in this plan's execution log. Commit
  (docs only): `docs(botville): D-52 privacy verification record`

---

## Planning-mode QA section

**Surfaces named:** `VenueSwitcher.tsx` (renamed), `ProfilePageClient.tsx`,
new `botville-api.ts`/`botville-service.ts`/pages/components;
BotVille `nginx.conf`, client camera seam. None are in the agents-repo
blast-radius corpus — `blast_radius.py` does not apply; the mechanical
check here is the D-52 verification pass (Task 7) plus build/typecheck
gates.

- **Checks bracketing rollout:** BEFORE each task-merge —
  `npm run build`, `npx tsc --noEmit`; BotVille repo root `npm test`
  for Task 3. AFTER — the manual browser pass steps recorded per task
  (this repo has no automated UI suite; the pass steps ARE the check,
  written down so they are repeatable).
- **New checks:** the D-52 privacy pass (Task 7) is a registered,
  repeatable checklist — rerun it after ANY later change to the Plan 01
  public endpoints.
- **Risks named:** iframe CSP misconfiguration fails silently in some
  browsers (frame just blank) — Task 3's negative test (non-allowlisted
  origin refused) is mandatory, not optional; the `follow` param
  touches the client camera during live rendering — keep it read-only
  over the presence model (no world writes from the URL bar);
  `LOCATION_POLL_MS` parity is a copied constant — the comment must
  name its source path so drift is greppable.
- **No agent-facing bytes move anywhere in this plan** — no C8 rider,
  no round gates; deployable any time after its API dependencies.
