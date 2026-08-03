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

An archetype is a `venue.json` with two differences: `archetype` names the
family (and the id namespace), and `labelPrefix` is authoring metadata —
stripped from the instance, used to build `label` as `<labelPrefix> <n>`,
falling back to the archetype name. Everything else is copied to every
instance verbatim, so it must be true of all of them.
