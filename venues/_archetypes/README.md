# Archetypes

An **archetype** is a venue template. A **generator** decides how many
instances of it the town gets and stamps them out through
`deriveInstances(archetype, count, opts)`
(`scripts/lib/archetypes.mjs`). `deriveResidenceInstances`
(`scripts/lib/residences.mjs`) is the first generator: its count is
`ceil(population / RESIDENCE_OCCUPANCY_TARGET_AGENTS)`, derived from
`town/town.json` — no residence count is authored anywhere.

The `_` prefix on this directory is load-bearing: `scripts/world-bake.mjs`
treats `_`-prefixed entries under `venues/` as archetypes, not as venues, so
nothing here bakes on its own.

## The generator registry — absence is zero

`scripts/lib/generators.mjs` maps an archetype name to the function that
counts it. **An archetype with no entry there stamps nothing.** That is the
whole of "declared, not instantiated": the art is declared, the contract
names resolve, the template is authored and checked against the contract —
and the town gets zero of them until a generator says otherwise.

Absence rather than an explicit `0` is deliberate. If dormancy had to be
written down, forgetting to write it would put a NEW venue into the published
vocabulary, which for a residence is a home-reassignment event (below). With
absence-is-zero, forgetting does nothing.

`house` is the only archetype with a generator today. `mobile_home`, `villa`
and `condo` (D-76) are declared and dormant; instantiating them is plan
`01-`'s business.

## The `home` role is withheld from every new residence tier

`deriveResidenceVenues` on the platform side selects `roles.includes('home')`
and orders by numeric id; `deriveHomeVenue` fills that list to published
capacity with zero stored rows. **Publishing any new `home`-role venue
therefore re-homes every agent that holds no stored assignment** — simulated
against the shipped vocabulary, adding one moves 73 of 85.

So the ladder tiers ship with `"roles": []`. The role lands in a follow-up
bake, *after* plan `01-` backfills one stored home assignment per agent
against this pre-role vocabulary. `test/archetype-registry.test.mjs` is the
tripwire; `house` is exempt because it is the shipped residence, not a new
one.

## The three-file rule

Adding a building is three files and no new code:

1. **`contract/assets.contract.json`** — a name and its `maxSize`. The
   contract names things and their shape; *it never names a file or a
   coordinate* (I-1).
2. **`sources/<pack>.json`** — a `rects` entry for that name (plus a `files`
   entry if it comes from a new sheet). Variant pools live beside it in
   `sources/<pack>.variants.json`.
3. **`venues/<id>/venue.json`**, or **`venues/_archetypes/<name>.json`** if
   the place is stamped rather than authored — only if it is enterable.

I-2 is the guardrail: an unresolved name **fails the build**, never renders
as a missing texture.

**The third file is not the last step for an archetype.** An authored
`venue.json` bakes because it exists; an archetype file does not. Writing
`venues/_archetypes/<name>.json` declares a template and nothing else — it
needs an entry in the generator registry before the town gets a count, and
**a file with no generator instantiates nothing at all.** That is not an
oversight to work around; it *is* the dormant mechanism D-76 asks for, and
it is why declaring the housing ladder and the six civic archetypes left
`venues.json` byte-identical. To actually stamp instances, add the fourth
thing: a generator (see above).

## The append-only invariant

**The instance list is append-only.** Ids are `<archetype>_1..N` in
provisioning order; raising the count appends, never reshuffles. The api
assigns agents to residences by roster creation order against this stable
prefix, which is what makes "my agent's home" a durable fact with zero
stored rows — so a change that renumbered or reordered instances would
silently rehome the town.

Two consequences for anyone editing an archetype:

- **Ids are namespaced by the `archetype` field**, which is what lets a
  second archetype stamp alongside the first without colliding. A collision
  with an *authored* venue id is still possible, and fails the bake
  (`world-bake.mjs`'s duplicate check).
- **Every instance is an independent `structuredClone`** of the template.
  Mutating one instance can never reach another, or the archetype.

## Fields

**An archetype is a `VenueDescriptor` minus `id` and `label`, plus
`labelPrefix`.**

- `id` and `label` are **per-instance facts, stamped by `deriveInstances`** —
  `<archetype>_<n>` and `<labelPrefix> <n>`. A template has no business
  carrying either, and if it does they are overridden rather than copied:
  thirteen venues sharing one authored id is not a thing the bake can
  represent.
- `archetype` names the family, **and the id namespace with it**. That is
  what lets a second archetype stamp alongside the first without colliding,
  and it is the only thing that decides an instance's id — no option to
  `deriveInstances` changes it.
- `labelPrefix` is authoring metadata: stripped from the instance, used to
  build `label`, falling back to the archetype name.

Everything else is copied to every instance verbatim, so it must be true of
all of them.
