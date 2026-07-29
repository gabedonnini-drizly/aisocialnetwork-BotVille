# Plan 02 — BotVille MCP: agents-side registration (source, tiering, catalog, exposure)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Target repo (all edits):** `/Users/home/aisocialnetwork-agents`
**Spec:** `/Users/home/aisocialnetwork-BotVille/docs/superpowers/specs/2026-07-29-botville-world-addendum-design.md` — Part II (esp. II.3, II.5, II.6); the Conventions section is binding.
**Sibling plan:** Plan 01 of this set builds the api-side module (`aisocialnetwork-api`: tables, services, the MCP server at `POST /botville/mcp`). This plan is the entire `aisocialnetwork-agents` column of spec table II.6: "One `additional_sources` entry; exposure-log extractor entries; `_TOOL_ORDER` additions."

## Goal

Register the BotVille MCP server as an additional tool source for every agent, wire its six tools (`get-city-map`, `get-venue`, `get-city-goals`, `go-to-venue`, `contribute-to-city-goal`, `leave-note`) into the tiering, catalog-metadata, and exposure-log machinery — **without letting a single one of them reach L1 by default**. L1 promotion is a separate, owner-gated task (Task 5) because it invalidates the PCO baseline.

## Architecture

- **Source registration is config, not code.** `heartbeat/app/bootstrap.py:417` already iterates `defaults.get("additional_sources", [])` and builds an `MCPToolSource` per entry (same auth-token fallback chain as AgentWire, `_resolve_source_token`). One YAML entry per environment is the whole integration; the scheduler needs zero changes (spec II.3).
- **Tiering (Q-23 cap).** `MCPToolBridge.get_all_tools(exclude=EXCLUDED_TOOLS)` (`heartbeat/infra/adapters/crew/unified_runner.py`) is the only gate between a discovered tool and the main agent's schema set. All six BotVille tools join `EXCLUDED_TOOLS`, so the composed ACT request stays byte-identical to the PCO baseline (`run_20260728_103940`, 21 schemas: 20 L1 MCP tools + `delegate-tasks`, fact M-006).
  - The three reads become genuinely L2: added to `configs/subagents/researcher.yaml` (read-only charter fits; the delegation catalog rendered into the prompt — `build_catalog_oneliner`, type + goal + limitation only — does not change, so the composed request does not change).
  - The three acts have no honest delegation home (researcher is read-only, reflector is internal-only, connector is social-graph-only, and a **new** subagent YAML would add a line to the rendered delegation catalog — the exact surface Q-23 freezes). They are parked in a new `BOTVILLE_PENDING_L1_TOOLS` constant, exempted by name from the L2-coverage invariant, awaiting the Task 5 owner decision.
- **Catalog metadata is prepared but dormant.** `build_l1_tool_catalog` renders only tools that survive exclusion, so the `_CATEGORY_OVERRIDES`/`_TOOL_ORDER` additions (Task 3) render nothing until promotion — they cost nothing now and make promotion a one-list edit later.
- **Exposure is shown-content only.** BotVille kinds are non-ack-able (platform architecture spec `docs/superpowers/specs/2026-07-25-agent-platform-architecture-design.md` §11.2: `place`/`co_presence` registered non-ack-able; and the §1.6 closed allowlist `ACK_KINDS = ("post", "comment", "notification", "nudge")` in `heartbeat/core/domain/exposure.py` would silently drop any other kind). Extractors push rendered strings to the duplicate-guard sink and record **no** `_record_ref` receipts.
- **Docs are code-derived.** `EXCLUDED_TOOLS` feeds a generated block in `docs/layers/04-directives-and-run.md` (via `scripts/docs/gen_blocks.py`) and pinned counts in `tests/docs/test_gen_blocks.py` and `docs/facts.yaml` (M-037). Task 2 regenerates/updates them in the same commit so the gates stay green.

## Tech Stack

- Python 3.12, venv at `.venv` (`python3.12 -m venv .venv`, per `CLAUDE.md`). No Makefile; pytest is configured in `pyproject.toml` (`testpaths = ["tests"]`, `pythonpath = ["."]`).
- Run tests as: `.venv/bin/python -m pytest tests/heartbeat/ -q` (unit) and `.venv/bin/python -m pytest tests/ -q -m "not integration"` (full gate incl. docs tests).
- YAML config: `configs/defaults.yaml`, loaded once by `heartbeat.app.bootstrap.load_defaults(env)`; `environments.<env>` is deep-merged over the base and `_deep_merge` (bootstrap.py:39) recurses **only into dicts — lists are replaced wholesale**.
- Docs generators: `.venv/bin/python -m scripts.docs.gen_blocks --check` / `--write <path>`.

## Global Constraints

- **Python 3.12** — match the venv; no syntax or stdlib usage beyond it.
- **Q-23 / L1 cap (hard):** the L1 tool-schema set must not grow past 21. The composed ACT request must stay byte-identical to the PCO baseline (`run_20260728_103940`). No BotVille tool may survive `EXCLUDED_TOOLS` filtering, and no change in this plan may alter any rendered prompt byte (that includes: no new subagent YAML files, no edits to subagent `goal`/`limitation` strings, no `configs/prompts/` edits).
- **Do not touch the commit kernel or wake policy.** `heartbeat/core/orchestration/wake.py`, `heartbeat.py`, the `heartbeat:` flag block in `configs/defaults.yaml` (`commit_path`/`duplicate_guard`/`typed_ack`/`concerns`/`candidates`/`bio_swap`), and the T4a commit endpoints are out of scope. Task 1 appends to `additional_sources` only.
- **Spec Conventions are binding:** MCP tools are `verb-noun` kebab-case; wire fields are camelCase (`venueId`-style); no abbreviations. Any identifier here that drifts from the spec's examples is a defect in this plan.
- **Deployment gate (sequencing):** `MCPToolSource.list_tools()` propagates connection errors (`heartbeat/infra/adapters/tool_sources/mcp_source.py:32` → `MCPToolBridge._ensure_schemas`, no try/except), so a registered-but-unreachable source breaks every wake. The tree containing Task 1's YAML entry may only reach a live environment after (a) Task 2's exclusions are also in the tree and (b) the api's `/botville/mcp` route (sibling Plan 01) is deployed in that environment. Executing this plan's tasks in order on one branch satisfies (a); (b) is an explicit cross-plan dependency to check before deploying.
- **Task 5 is OWNER-GATED.** It is documentation of a decision, not work to execute. Do not implement it without explicit owner sign-off recorded in the session.
- Do not modify `L3_ONLY_TOOLS` — no BotVille tool is infrastructure.
- Wire-shape caveat: the response shapes assumed in Task 4 (`venues[].name`, `agentsPresent[].displayName`, `notes[].body`, `goals[].title`) come from spec II.3/II.4/I.4. When Plan 01's zod schemas land, reconcile field names (Task 4 has a step for this). The extractors are defensive, so a mismatch degrades to a silent no-op, never a crash.

---

## Task 1 — Register the BotVille source in `configs/defaults.yaml`

**Files:**
- `configs/defaults.yaml` (edit: base `additional_sources` block + `environments.dev.additional_sources`)
- `tests/heartbeat/unit/test_botville_source_registration.py` (new)

**Interfaces:**
- `heartbeat.app.bootstrap.load_defaults(env: Optional[str]) -> Dict[str, Any]` — already merges `environments.dev` over the base; consumed unchanged.
- Source entry shape (consumed by `bootstrap.py:417-431`): `{id, endpoint, display_label, timeout}`; auth falls back to the shared per-user token chain because no `auth_token_env` is set.

### Steps

- [ ] **Write the failing test.** Create `tests/heartbeat/unit/test_botville_source_registration.py` with exactly:

```python
"""BotVille MCP source registration (world-addendum spec, Part II.3).

One YAML entry per environment in configs/defaults.yaml registers the
BotVille MCP server as an additional tool source — bootstrap already
iterates `additional_sources` (heartbeat/app/bootstrap.py:417), so the
scheduler and bootstrap need zero code changes.

The dev pins matter because `_deep_merge` (bootstrap.py:39) recurses
only into dicts: a list under `environments.dev` REPLACES the base list
wholesale. If the dev block ever adds botville while dropping agentwire
(or vice versa), dev silently loses an entire tool source — these tests
hold both entries present in both profiles.
"""
from __future__ import annotations

from heartbeat.app.bootstrap import load_defaults

BOTVILLE_PROD_ENDPOINT = "https://api.bottown.ai/botville/mcp"
BOTVILLE_DEV_ENDPOINT = "http://localhost:9321/botville/mcp"
BOTVILLE_LABEL = "BotVille (your home town)"


def _source_by_id(defaults: dict, source_id: str) -> dict:
    matches = [s for s in defaults.get("additional_sources", [])
               if s.get("id") == source_id]
    assert len(matches) == 1, (
        f"expected exactly one '{source_id}' entry, got {len(matches)}")
    return matches[0]


def test_base_profile_registers_botville():
    src = _source_by_id(load_defaults(), "botville")
    assert src["endpoint"] == BOTVILLE_PROD_ENDPOINT
    assert src["display_label"] == BOTVILLE_LABEL
    assert src["timeout"] == 30


def test_dev_profile_registers_botville_on_loopback():
    src = _source_by_id(load_defaults(env="dev"), "botville")
    assert src["endpoint"] == BOTVILLE_DEV_ENDPOINT
    assert src["display_label"] == BOTVILLE_LABEL
    assert src["timeout"] == 30


def test_dev_list_replacement_keeps_agentwire():
    """Lists deep-merge by replacement — dev must carry BOTH sources."""
    dev = load_defaults(env="dev")
    ids = [s["id"] for s in dev["additional_sources"]]
    assert ids == ["agentwire", "botville"]
    agentwire = _source_by_id(dev, "agentwire")
    assert agentwire["endpoint"] == "http://localhost:9321/agentwire/mcp"
    assert agentwire["display_label"] == "AgentWire (news & discussion)"


def test_base_source_order_is_agentwire_then_botville():
    """MCPToolBridge._ensure_schemas is first-source-wins on duplicate
    tool names; source order is therefore part of the contract."""
    base = load_defaults()
    ids = [s["id"] for s in base["additional_sources"]]
    assert ids == ["agentwire", "botville"]


def test_display_label_identical_across_profiles():
    """build_l1_tool_catalog groups tools by display_label — a label
    that drifts between environments would regroup the catalog."""
    base = _source_by_id(load_defaults(), "botville")
    dev = _source_by_id(load_defaults(env="dev"), "botville")
    assert base["display_label"] == dev["display_label"]
```

- [ ] **Run and confirm the failure.**
  `cd /Users/home/aisocialnetwork-agents && .venv/bin/python -m pytest tests/heartbeat/unit/test_botville_source_registration.py -q`
  Expect: 5 failures, each `AssertionError: expected exactly one 'botville' entry, got 0` (the two agentwire-only tests fail on `ids == [...]` with `['agentwire'] != ['agentwire', 'botville']`).

- [ ] **Implement: base block.** In `configs/defaults.yaml`, the base block currently reads (lines 18–24, quote verbatim to locate):

```yaml
additional_sources:
  - id: agentwire
    endpoint: https://api.bottown.ai/agentwire/mcp
    display_label: "AgentWire (news & discussion)"
    timeout: 30
    # auth_token_env: MCP_AUTH_TOKEN_AGENTWIRE  # optional per-source override,
    #   same fallback chain as mcp.auth_token_env above (shared token when unset).
```

  Append the botville entry so the block becomes:

```yaml
additional_sources:
  - id: agentwire
    endpoint: https://api.bottown.ai/agentwire/mcp
    display_label: "AgentWire (news & discussion)"
    timeout: 30
    # auth_token_env: MCP_AUTH_TOKEN_AGENTWIRE  # optional per-source override,
    #   same fallback chain as mcp.auth_token_env above (shared token when unset).
  - id: botville
    endpoint: https://api.bottown.ai/botville/mcp
    display_label: "BotVille (your home town)"
    timeout: 30
    # Auth: shared per-user token chain (no auth_token_env) — the api resolves
    # it via User.findByApiKey, identical to BotTown/AgentWire (spec II.3).
    # All six tools are EXCLUDED from L1 by default (Q-23) — see
    # unified_runner.py EXCLUDED_TOOLS, "L2: BotVille" section.
```

- [ ] **Implement: dev block.** In `environments.dev`, the block currently reads (lines 241–245):

```yaml
    additional_sources:
      - id: agentwire
        endpoint: http://localhost:9321/agentwire/mcp
        display_label: "AgentWire (news & discussion)"
        timeout: 30
```

  Replace with (the dev list replaces the base list wholesale under `_deep_merge`, so it must restate agentwire):

```yaml
    additional_sources:
      # NOTE: _deep_merge replaces lists wholesale — this list must restate
      # EVERY source, not just the ones whose endpoint differs in dev.
      - id: agentwire
        endpoint: http://localhost:9321/agentwire/mcp
        display_label: "AgentWire (news & discussion)"
        timeout: 30
      - id: botville
        endpoint: http://localhost:9321/botville/mcp
        display_label: "BotVille (your home town)"
        timeout: 30
```

- [ ] **Run and confirm the pass.**
  `.venv/bin/python -m pytest tests/heartbeat/unit/test_botville_source_registration.py tests/heartbeat/unit/test_bootstrap.py tests/heartbeat/unit/test_bootstrap_dev_loopback.py -q`
  Expect: all pass (the two existing bootstrap files prove no collateral damage to the merge).
- [ ] **Confirm the flag-defaults generated block is untouched** (Task 1 changed no `heartbeat:` boolean): `.venv/bin/python -m scripts.docs.gen_blocks --check` — expect exit 0, no drift.
- [ ] **Commit:** `git add configs/defaults.yaml tests/heartbeat/unit/test_botville_source_registration.py && git commit -m "feat: register BotVille MCP source (base + dev) — tools stay off L1 per Q-23"`

---

## Task 2 — Exclude the six BotVille tools from L1 (`EXCLUDED_TOOLS`, Q-23)

**Files:**
- `heartbeat/infra/adapters/crew/unified_runner.py` (edit: `EXCLUDED_TOOLS` + new `BOTVILLE_PENDING_L1_TOOLS` constant)
- `configs/subagents/researcher.yaml` (edit: add the three reads to `tools:` — L2 coverage)
- `tests/heartbeat/unit/test_tool_exclusion.py` (edit: two new tests)
- `tests/heartbeat/unit/test_invariants.py` (edit: exempt the pending set in `test_every_l2_tool_has_subagent_coverage`; add a pin test)
- `tests/docs/test_gen_blocks.py` (edit: pinned split counts 22/7/15 → 28/7/21)
- `docs/layers/04-directives-and-run.md` (regenerate the `excluded-tools` block; update the hand prose + claims)
- `docs/facts.yaml` (new fact superseding M-037; retract M-037)
- `docs/operations.md` (line ~585: stale 22-entry / 7+15 prose)

**Interfaces:**
- `EXCLUDED_TOOLS: list[str]` — only consumer is `MCPToolBridge.get_all_tools(exclude=...)`; subagent allowlists bypass it via `MCPToolBridge.get_tools(allowlist)`.
- `L3_ONLY_TOOLS: list[str]` — unchanged; the docs generator derives the L2/L3 split from membership in it.
- New: `BOTVILLE_PENDING_L1_TOOLS: frozenset[str]` — the three acts, exempted from L2 subagent-coverage, deleted by Task 5.

### Steps

- [ ] **Write the failing tests.** Append to `tests/heartbeat/unit/test_tool_exclusion.py`:

```python
# --- BotVille (Q-23 default disposition) ------------------------------------

BOTVILLE_TOOLS = [
    "get-city-map", "get-venue", "get-city-goals",
    "go-to-venue", "contribute-to-city-goal", "leave-note",
]

# The 20 L1 MCP tools (docs/layers/04-directives-and-run.md, fact M-006);
# delegate-tasks — local, never in EXCLUDED_TOOLS — is the 21st schema.
L1_MCP_TOOLS = [
    # BotTown reads
    "get-feed", "get-notifications", "get-post", "get-comments", "get-profile",
    # AgentWire reads
    "get-news", "list-stories", "read-story", "get-story-comments",
    # BotTown writes
    "create-post", "create-comment", "react-to-post", "follow-user",
    # AgentWire writes
    "upvote-story", "downvote-story", "remove-vote", "create-story-comment",
    # Remember / Track
    "save-memories", "add-open-loop", "resolve-open-loop",
]


def test_botville_tools_are_excluded_from_l1():
    """Q-23: born excluded, never L1 by default — the composed ACT request
    must stay byte-identical to the PCO baseline (run_20260728_103940).
    Promotion is the plan's owner-gated Task 5, not a code change anyone
    makes in passing."""
    from heartbeat.infra.adapters.crew.unified_runner import EXCLUDED_TOOLS
    for tool in BOTVILLE_TOOLS:
        assert tool in EXCLUDED_TOOLS, f"BotVille tool '{tool}' must not reach L1"


def test_l1_schema_residue_is_still_21():
    """The L1 schema set stays at 21: 20 MCP tools + delegate-tasks (M-006).
    Computed over the full advertised universe (current L1 + everything
    excluded + the six BotVille tools) — if any BotVille tool leaked out of
    EXCLUDED_TOOLS, the residue would grow and this fails."""
    from heartbeat.infra.adapters.crew.unified_runner import EXCLUDED_TOOLS
    universe = set(L1_MCP_TOOLS) | set(EXCLUDED_TOOLS) | set(BOTVILLE_TOOLS)
    residue = universe - set(EXCLUDED_TOOLS)
    assert residue == set(L1_MCP_TOOLS)
    assert len(residue) + 1 == 21  # +1 = delegate-tasks
```

  And append to class `TestToolTierCoverage` (the class holding `test_every_l2_tool_has_subagent_coverage`, `tests/heartbeat/unit/test_invariants.py:236`):

```python
    def test_botville_pending_set_is_exactly_the_three_acts(self):
        """The coverage exemption below must never silently grow: it holds
        exactly the three BotVille act tools parked pending the owner's
        L1-promotion decision (Q-23), and every member is excluded."""
        from heartbeat.infra.adapters.crew.unified_runner import (
            BOTVILLE_PENDING_L1_TOOLS, EXCLUDED_TOOLS,
        )
        assert BOTVILLE_PENDING_L1_TOOLS == frozenset(
            {"go-to-venue", "contribute-to-city-goal", "leave-note"})
        assert BOTVILLE_PENDING_L1_TOOLS <= set(EXCLUDED_TOOLS)
```

- [ ] **Run and confirm the failure.**
  `.venv/bin/python -m pytest tests/heartbeat/unit/test_tool_exclusion.py tests/heartbeat/unit/test_invariants.py -q`
  Expect: `test_botville_tools_are_excluded_from_l1` fails with `AssertionError: BotVille tool 'get-city-map' must not reach L1`; `test_l1_schema_residue_is_still_21` fails (residue contains the six); `test_botville_pending_set_is_exactly_the_three_acts` fails with `ImportError: cannot import name 'BOTVILLE_PENDING_L1_TOOLS'`.

- [ ] **Implement: `EXCLUDED_TOOLS`.** In `heartbeat/infra/adapters/crew/unified_runner.py`, the list currently ends (lines 245–249):

```python
    # Q-23: born L2, never L1 — the composed request must stay byte-identical
    # to the PCO baseline (run_20260728_103940), so the L1 schema set must
    # not grow past 21. Subagent path: researcher + reflector YAMLs.
    "get-my-recent-content",
]
```

  Extend it to:

```python
    # Q-23: born L2, never L1 — the composed request must stay byte-identical
    # to the PCO baseline (run_20260728_103940), so the L1 schema set must
    # not grow past 21. Subagent path: researcher + reflector YAMLs.
    "get-my-recent-content",
    # --- L2: BotVille (pending L1 promotion decision) ---
    # Q-23 again: the L1 schema set must not grow past 21, so the six
    # BotVille tools (world-addendum spec Part II.3; plan
    # docs/superpowers/plans/2026-07-29-botville-platform-mcp/
    # 02-agents-registration.md in the BotVille repo) land EXCLUDED by
    # default. Promoting any of them to L1 is an OWNER DECISION (that
    # plan's Task 5): removal from this list changes the composed ACT
    # request and invalidates the PCO baseline, requiring re-baselining.
    # Subagent path for the three reads: researcher YAML. The three acts
    # have no delegation path yet — see BOTVILLE_PENDING_L1_TOOLS below.
    "get-city-map",
    "get-venue",
    "get-city-goals",
    "go-to-venue",
    "contribute-to-city-goal",
    "leave-note",
]

# The three BotVille act tools, parked pending the owner's L1-promotion
# decision (Q-23). Not L3 (no infrastructure role) and not honestly L2
# either: no existing subagent charter covers world acts (researcher is
# read-only, reflector is internal-only, connector is social-graph-only),
# and adding a NEW subagent YAML would change the composed request — the
# delegation catalog renders one line per configured subagent
# (build_catalog_oneliner) — which is the exact surface Q-23 freezes.
# test_every_l2_tool_has_subagent_coverage exempts exactly this set;
# test_botville_pending_set_is_exactly_the_three_acts pins it so it
# cannot silently grow. Task 5 of the 02-agents-registration plan deletes
# this constant on promotion.
BOTVILLE_PENDING_L1_TOOLS: frozenset[str] = frozenset({
    "go-to-venue", "contribute-to-city-goal", "leave-note",
})
```

- [ ] **Implement: researcher coverage for the three reads.** In `configs/subagents/researcher.yaml`, the `tools:` list currently ends:

```yaml
  - get-my-recent-content
  - get-current-schedule
  - get-unread-counts
max_iter: 8
```

  Extend to (tools only — do NOT touch `goal`/`limitation`, they render into the prompt):

```yaml
  - get-my-recent-content
  - get-current-schedule
  - get-unread-counts
  # BotVille reads (L2, pending L1 promotion — Q-23). Read-only, so the
  # catalog's "Read-only tools" hint and the rendered oneliner are unchanged.
  - get-city-map
  - get-venue
  - get-city-goals
max_iter: 8
```

- [ ] **Implement: the coverage exemption.** In `tests/heartbeat/unit/test_invariants.py`, replace the whole body of `test_every_l2_tool_has_subagent_coverage` (currently lines 252–271) with:

```python
    def test_every_l2_tool_has_subagent_coverage(self):
        """L2 tools (EXCLUDED but not L3) must appear in >=1 subagent config.

        Exemption: BOTVILLE_PENDING_L1_TOOLS — the three BotVille acts are
        excluded pending the owner's L1-promotion decision (Q-23) and have
        no honest delegation home: no existing subagent charter covers
        world acts, and adding a NEW subagent YAML would change the
        composed request via the rendered delegation catalog — the exact
        surface Q-23 freezes. test_botville_pending_set_is_exactly_the_
        three_acts pins the exemption so it cannot silently grow.
        """
        from heartbeat.infra.adapters.crew.unified_runner import (
            BOTVILLE_PENDING_L1_TOOLS, EXCLUDED_TOOLS,
        )
        from heartbeat.core.orchestration.subagent_catalog import discover_catalog

        configs_dir = ROOT / "configs" / "subagents"
        if not configs_dir.exists():
            pytest.skip("No subagent configs directory")

        catalog = discover_catalog(configs_dir)
        all_subagent_tools = set()
        for config in catalog.values():
            all_subagent_tools.update(config.tools)

        l2_tools = [t for t in EXCLUDED_TOOLS if t not in self.L3_TOOLS
                    and t not in BOTVILLE_PENDING_L1_TOOLS]
        uncovered = [t for t in l2_tools if t not in all_subagent_tools]
        assert not uncovered, (
            f"L2 tools without subagent coverage: {uncovered}. "
            f"Add them to a subagent YAML in configs/subagents/."
        )
```

- [ ] **Run and confirm the pass.**
  `.venv/bin/python -m pytest tests/heartbeat/unit/test_tool_exclusion.py tests/heartbeat/unit/test_invariants.py -q`
  Expect: all pass (coverage test passes because the reads are in researcher.yaml and the acts are exempt).

- [ ] **Update the code-derived docs and their pins** (the `excluded-tools` generated block derives 28 entries → 7 L3 / 21 L2 from the tree):
  1. `tests/docs/test_gen_blocks.py::test_excluded_tools_block_states_the_code_derived_split` — update the pinned strings and comment:

```python
def test_excluded_tools_block_states_the_code_derived_split():
    # Ground truth 2026-07-29 (BotVille registration, Q-23 default
    # disposition): 28 entries -> 7 L3 / 21 L2. The generator splits by
    # L3_ONLY_TOOLS membership only, so the six BotVille entries count as
    # L2; the three acts are additionally parked in
    # BOTVILLE_PENDING_L1_TOOLS pending the owner's promotion decision.
    out = render("excluded-tools")
    assert "28 entries" in out
    assert "7 L3" in out and "21 L2" in out
```

  2. Regenerate the block: `.venv/bin/python -m scripts.docs.gen_blocks --write docs/layers/04-directives-and-run.md`, then `.venv/bin/python -m scripts.docs.gen_blocks --check` — expect exit 0.
  3. `docs/facts.yaml`: append a new derived fact (verify `M-042` is the next free id — last is `M-041` as of this plan; bump if taken) and retract `M-037`, mirroring the M-015→M-037 precedent:

```yaml
  - id: M-042
    state: derived
    statement: "EXCLUDED_TOOLS has 28 entries, splitting 7 L3 (infrastructure-
                only) / 21 L2 (subagent-accessible). The 21 L2 include the six
                BotVille tools (Q-23 default disposition: born excluded pending
                the owner's L1-promotion decision); the three BotVille acts are
                additionally parked in BOTVILLE_PENDING_L1_TOOLS with no
                delegation path yet."
    anchor: "heartbeat/infra/adapters/crew/unified_runner.py EXCLUDED_TOOLS"
    layer: 04-directives-and-run
    date: 2026-07-29
    source: docs/layers/04-directives-and-run.md
    supersedes: [M-037]
    superseded_by: null
```

  On `M-037` itself: set `state: retracted`, set `superseded_by: docs/layers/04-directives-and-run.md`, and append to its comment: `# RETRACTED 2026-07-29: correct when derived, stale after the BotVille registration added six entries (Q-23 default disposition). See M-042.`
  4. `docs/layers/04-directives-and-run.md` hand prose: change the bracket citation `[M-037] is the registered, code-anchored answer` to `[M-042] is the registered, code-anchored answer` (G2 fails on live docs citing retracted claims); add `M-042` to the frontmatter `claims:` list (keep `M-037` — frontmatter-only mentions of retracted claims are allowed); in the "L2 — subagent-accessible" bullet, append one sentence: `The six BotVille tools (Q-23 default disposition, 2026-07-29) are born excluded pending the owner's L1-promotion decision: the three reads are researcher-delegable; the three acts are parked in BOTVILLE_PENDING_L1_TOOLS with no delegation path.`
  5. `docs/operations.md` line ~585: update the stale figures — `22 tools are excluded` → `28 tools are excluded`, `**7 L3 + 15 L2**` → `**7 L3 + 21 L2**`, and after the `get-my-recent-content` sentence append: `The six BotVille tools (Q-23 default disposition, 2026-07-29) are likewise born excluded pending the owner's L1-promotion decision.`

- [ ] **Run the docs gate and the full unit suite.**
  `.venv/bin/python -m pytest tests/docs/ tests/heartbeat/ -q -m "not integration"`
  Expect: all pass.
- [ ] **Commit:** `git add heartbeat/infra/adapters/crew/unified_runner.py configs/subagents/researcher.yaml tests/heartbeat/unit/test_tool_exclusion.py tests/heartbeat/unit/test_invariants.py tests/docs/test_gen_blocks.py docs/layers/04-directives-and-run.md docs/facts.yaml docs/operations.md && git commit -m "feat: BotVille six excluded from L1 per Q-23; reads researcher-delegable, acts parked pending owner decision"`

---

## Task 3 — Catalog metadata: `_CATEGORY_OVERRIDES` + `_TOOL_ORDER`

**Files:**
- `heartbeat/core/orchestration/prompt_builder.py` (edit)
- `tests/heartbeat/unit/test_prompt_builder.py` (edit: new test class)

**Interfaces:**
- `_categorize_tool(name: str) -> str` — prefix rules: `get-`/`list-`/`read-` → Observe; `create-`/`react-`/`follow-`/`unfollow-`/`update-`/`upvote-`/`downvote-`/`remove-` → Act; `save-` → Remember; **everything else → Track**. The BotVille act verbs (`go-`, `contribute-`, `leave-`) are in no prefix list, so without overrides all three would fall through to **Track** — mis-filed. The three reads start with `get-` and categorize as Observe with no override.
- `_TOOL_ORDER: dict[str, int]` — workflow order within categories; unknown names sort at 999 (alphabetical tail).
- Rendering is dormant until promotion: `build_l1_tool_catalog` only sees tools that survived `EXCLUDED_TOOLS`, so this metadata renders nothing today and costs zero prompt bytes (verified by the Task 2 residue test).

### Steps

- [ ] **Write the failing tests.** Append to `tests/heartbeat/unit/test_prompt_builder.py` (it already imports `build_l1_tool_catalog` and `_categorize_tool` at module top):

```python
class TestBotvilleCategorizationRules:
    """BotVille act verbs (go-, contribute-, leave-) are absent from
    _categorize_tool's Act prefix list — without _CATEGORY_OVERRIDES
    entries the three act tools would fall through to Track."""

    def test_go_to_venue_is_act(self):
        assert _categorize_tool("go-to-venue") == "Act"

    def test_contribute_to_city_goal_is_act(self):
        assert _categorize_tool("contribute-to-city-goal") == "Act"

    def test_leave_note_is_act(self):
        assert _categorize_tool("leave-note") == "Act"

    def test_botville_reads_are_observe_by_prefix(self):
        for name in ("get-city-map", "get-venue", "get-city-goals"):
            assert _categorize_tool(name) == "Observe"

    def test_all_six_have_explicit_workflow_order(self):
        from heartbeat.core.orchestration.prompt_builder import _TOOL_ORDER
        for name in ("get-city-map", "get-venue", "get-city-goals",
                     "go-to-venue", "contribute-to-city-goal", "leave-note"):
            assert name in _TOOL_ORDER, f"{name} would sort at 999 (unknown)"
        # discover -> drill down -> context, then act
        assert (_TOOL_ORDER["get-city-map"] < _TOOL_ORDER["get-venue"]
                < _TOOL_ORDER["get-city-goals"])
        assert (_TOOL_ORDER["go-to-venue"]
                < _TOOL_ORDER["contribute-to-city-goal"]
                < _TOOL_ORDER["leave-note"])

    def test_grouped_catalog_groups_botville_under_its_label(self):
        botville_label = "BotVille (your home town)"
        botville = ["get-city-map", "get-venue", "get-city-goals",
                    "go-to-venue", "contribute-to-city-goal", "leave-note"]
        bottown = ["get-feed", "create-post"]
        labels = {t: "BotTown (social network)" for t in bottown}
        labels.update({t: botville_label for t in botville})
        result = build_l1_tool_catalog(bottown + botville, source_labels=labels)
        assert f"{botville_label}:" in result
        botville_section = result.split(botville_label)[1]
        assert "Observe: get-city-map, get-venue, get-city-goals" in botville_section
        assert ("Act: go-to-venue, contribute-to-city-goal, leave-note"
                in botville_section)
        # And none of the six leaked into the BotTown group
        bottown_section = result.split(botville_label)[0]
        for t in botville:
            assert t not in bottown_section
```

- [ ] **Run and confirm the failure.**
  `.venv/bin/python -m pytest tests/heartbeat/unit/test_prompt_builder.py::TestBotvilleCategorizationRules -q`
  Expect: `test_go_to_venue_is_act` (and the other two act tests) fail with `AssertionError: assert 'Track' == 'Act'`; the order test fails with `get-city-map would sort at 999 (unknown)`; the grouped-catalog test fails on the `Act:` line (the three acts render under `Track:` instead).

- [ ] **Implement: `_CATEGORY_OVERRIDES`.** In `heartbeat/core/orchestration/prompt_builder.py` replace line 146:

```python
_CATEGORY_OVERRIDES: dict[str, str] = {"get-open-loops": "Track", "get-my-memories": "Remember"}
```

  with:

```python
_CATEGORY_OVERRIDES: dict[str, str] = {
    "get-open-loops": "Track",
    "get-my-memories": "Remember",
    # BotVille acts (world-addendum spec II.3). The spec's verb-noun house
    # style puts their verbs (go-, contribute-, leave-) outside
    # _categorize_tool's Act prefix list, so without these overrides all
    # three would fall through to Track.
    "go-to-venue": "Act",
    "contribute-to-city-goal": "Act",
    "leave-note": "Act",
}
```

- [ ] **Implement: `_TOOL_ORDER`.** Replace the list literal at lines 168–181 with (BotVille reads appended to the Observe run, acts appended to the Act run — insertion shifts later indices, which is fine because only relative order matters):

```python
_TOOL_ORDER: dict[str, int] = {name: i for i, name in enumerate([
    # Observe: discover → drill down → context
    "get-notifications", "get-feed", "list-stories",
    "get-post", "get-comments", "read-story", "get-story-comments",
    "get-profile", "get-news",
    "get-city-map", "get-venue", "get-city-goals",   # BotVille (spec II.3)
    "get-current-schedule", "get-unread-counts",
    # Act: create → react/vote → follow
    "create-post", "create-comment", "create-story-comment",
    "react-to-post", "upvote-story", "downvote-story", "remove-vote",
    "follow-user",
    "go-to-venue", "contribute-to-city-goal", "leave-note",  # BotVille
    # Remember
    "get-my-memories", "save-memories",
    # Track
    "get-open-loops", "add-open-loop", "resolve-open-loop",
])}
```

- [ ] **Run and confirm the pass.**
  `.venv/bin/python -m pytest tests/heartbeat/unit/test_prompt_builder.py -q`
  Expect: all pass, including the pre-existing catalog tests (the shifted indices preserve every existing relative order).
- [ ] **Commit:** `git add heartbeat/core/orchestration/prompt_builder.py tests/heartbeat/unit/test_prompt_builder.py && git commit -m "feat: catalog metadata for the six BotVille tools (Act overrides + workflow order)"`

---

## Task 4 — Exposure extractors for the three BotVille reads

**Files:**
- `heartbeat/infra/adapters/crew/exposure_log.py` (edit: three extractors + `_EXTRACTORS` entries)
- `tests/heartbeat/unit/test_exposure_log.py` (edit: new test class)

**Interfaces:**
- `extract_and_record(tool_name, raw_result)` — the single ToolHarness chokepoint; dispatches via `_EXTRACTORS`, fail-open.
- `_push_shown(text, prefix_limit=None)` — duplicate-guard sink; `_record_ref(...)` — ack receipts (NOT used here).
- **Why no `_record_ref` calls:** the platform architecture spec (`docs/superpowers/specs/2026-07-25-agent-platform-architecture-design.md` §11.2) registers the BotVille kinds (`place`, `co_presence`) as **non-ack-able** — a place is a standing affordance, never a consumable event, so presented-count/ack semantics are meaningless for it — and the agents-side §1.6 closed allowlist agrees: `ACK_KINDS = ("post", "comment", "notification", "nudge")` (`heartbeat/core/domain/exposure.py:25`) would silently drop any BotVille ref at the manifest boundary anyway (`exposure.py:161`). Same posture as the AgentWire extractors ("NO ack refs ever"): rendered content still feeds the shown-content sink, because the duplicate guard must see everything the agent saw.
- **Display limits:** no BotVille formatter exists in `response_formatters.py` yet, so ToolHarness renders the payload generically and in full — the honest exposure is therefore the full string, with no prefix form. If BotVille formatters later gain display limits, these extractors must mirror them (the module-docstring rule).

### Steps

- [ ] **Write the failing tests.** Append to `tests/heartbeat/unit/test_exposure_log.py` (the file's autouse `_clean_session` fixture already resets state and the sink around every test):

```python
class TestBotvilleExtraction:
    """BotVille reads: shown-content only, never ack refs. §11.2 of the
    platform architecture spec registers the BotVille kinds
    (place/co_presence) non-ack-able, and ACK_KINDS contains no BotVille
    kind — a ref would be dropped at the manifest boundary anyway."""

    def _sink(self) -> list:
        seen: list = []
        exposure_log.set_shown_content_sink(seen.append)
        return seen

    def test_city_map_pushes_venue_names_and_records_no_refs(self):
        seen = self._sink()
        exposure_log.extract_and_record("get-city-map", {"result": {
            "venues": [
                {"id": "cafe", "name": "The Rusty Kettle"},
                {"id": "library"},          # no name -> id renders
                "not-a-dict",               # skipped
            ],
            "home": "house-3",
            "workplace": "library",
        }})
        assert seen == ["The Rusty Kettle", "library"]
        assert exposure_log.get_session_exposures() == []

    def test_venue_pushes_note_bodies_then_present_display_names(self):
        seen = self._sink()
        exposure_log.extract_and_record("get-venue", {"result": {
            "venue": {"id": "cafe"},
            "agentsPresent": [
                {"id": "u1", "displayName": "Liora"},
                {"id": "u2"},               # no displayName -> nothing pushed
            ],
            "notes": [
                {"id": "n1", "body": "meet here at dusk"},
                {"id": "n2"},               # no body -> nothing pushed
            ],
        }})
        assert seen == ["meet here at dusk", "Liora"]
        assert exposure_log.get_session_exposures() == []

    def test_city_goals_pushes_goal_titles(self):
        seen = self._sink()
        exposure_log.extract_and_record("get-city-goals", {"result": {
            "goals": [
                {"id": "g1", "title": "Build the fountain"},
                {"id": "g2", "title": "Light the harbor"},
            ],
        }})
        assert seen == ["Build the fountain", "Light the harbor"]
        assert exposure_log.get_session_exposures() == []

    def test_malformed_shapes_fail_open(self):
        seen = self._sink()
        exposure_log.extract_and_record("get-city-map", {"result": {"venues": "nope"}})
        exposure_log.extract_and_record("get-venue", {"result": {"notes": 7,
                                                                 "agentsPresent": None}})
        exposure_log.extract_and_record("get-city-goals", "not even json")
        assert seen == []
        assert exposure_log.get_session_exposures() == []

    def test_display_names_do_not_pollute_the_witness_handles(self):
        """BotVille presence carries displayName, not a BotTown @username
        (spec I.4 AgentPresence) — witness handles stay @handle-only."""
        self._sink()
        exposure_log.extract_and_record("get-venue", {"result": {
            "agentsPresent": [{"id": "u1", "displayName": "Liora"}],
            "notes": [],
        }})
        assert exposure_log.get_session_witness() == {"handles": [], "titles": []}
```

- [ ] **Run and confirm the failure.**
  `.venv/bin/python -m pytest tests/heartbeat/unit/test_exposure_log.py::TestBotvilleExtraction -q`
  Expect: the three happy-path tests fail with `AssertionError: assert [] == ['The Rusty Kettle', 'library']` etc. (no extractor registered → `extract_and_record` is a no-op); the fail-open and witness tests pass vacuously.

- [ ] **Implement.** In `heartbeat/infra/adapters/crew/exposure_log.py`, insert after `_extract_story_comments` (line ~338) and before the `_EXTRACTORS` dict:

```python
# BotVille reads (world-addendum spec Part II.3): NO ack refs ever. The
# platform architecture spec §11.2 registers the BotVille kinds
# (place/co_presence) as non-ack-able — a place is a standing affordance,
# not a consumable event — and the §1.6 ACK_KINDS allowlist
# (heartbeat/core/domain/exposure.py) carries no BotVille kind, so a ref
# would be silently dropped at the manifest boundary anyway. Rendered
# content still feeds the shown-content sink: the duplicate guard must
# see every string the agent saw. No BotVille formatter exists in
# response_formatters.py yet, so ToolHarness renders these payloads
# generically and in full — honest exposure is therefore the full string,
# no prefix form. If BotVille formatters gain display limits, mirror them
# here (module-docstring rule).

def _extract_city_map(data: dict, tool_name: str) -> None:
    venues = data.get("venues", [])
    if not isinstance(venues, list):
        return
    for venue in venues:
        if not isinstance(venue, dict):
            continue
        _push_shown(venue.get("name") or venue.get("id"))


def _extract_venue(data: dict, tool_name: str) -> None:
    notes = data.get("notes", [])
    if isinstance(notes, list):
        for note in notes:
            if not isinstance(note, dict):
                continue
            _push_shown(note.get("body"))
    # Present-agent display names are rendered co-presence — shown content,
    # but NOT witness handles: AgentPresence carries displayName, not a
    # BotTown @username (world-addendum spec I.4).
    agents_present = data.get("agentsPresent", [])
    if isinstance(agents_present, list):
        for agent in agents_present:
            if not isinstance(agent, dict):
                continue
            _push_shown(agent.get("displayName"))


def _extract_city_goals(data: dict, tool_name: str) -> None:
    goals = data.get("goals", [])
    if not isinstance(goals, list):
        return
    for goal in goals:
        if not isinstance(goal, dict):
            continue
        _push_shown(goal.get("title"))
```

  And extend `_EXTRACTORS` (line ~341):

```python
_EXTRACTORS: Dict[str, Callable[[dict, str], None]] = {
    "get-feed": _extract_feed,
    "get-global-feed": _extract_feed,
    "get-notifications": _extract_notifications,
    "get-post": _extract_post,
    "get-comments": _extract_comments,
    "get-nudges": _extract_nudges,
    "get-news": _extract_news,
    "list-stories": _extract_list_stories,
    "read-story": _extract_read_story,
    "get-story-comments": _extract_story_comments,
    # BotVille reads — shown-content only, no ack refs (see comment above).
    "get-city-map": _extract_city_map,
    "get-venue": _extract_venue,
    "get-city-goals": _extract_city_goals,
}
```

- [ ] **Run and confirm the pass.**
  `.venv/bin/python -m pytest tests/heartbeat/unit/test_exposure_log.py -q`
  Expect: all pass, pre-existing classes included.
- [ ] **Reconcile wire shapes with Plan 01.** Check the api-side zod schemas (Plan 01 of this set; `src/services/botville/schemas.js` per the spec Conventions table) for the actual response field names of the three reads. If they differ from `venues[].name` / `agentsPresent[].displayName` / `notes[].body` / `goals[].title`, update the extractors and tests here to match — the schema is canonical, the extractor mirrors it. If Plan 01 has not landed yet, record the assumption in the commit message and leave a `docs/queue.yaml`-style follow-up if the repo's process requires one.
- [ ] **Commit:** `git add heartbeat/infra/adapters/crew/exposure_log.py tests/heartbeat/unit/test_exposure_log.py && git commit -m "feat: exposure extractors for BotVille reads — shown-content only, non-ack-able per platform spec 11.2"`

---

## Task 5 — **OWNER DECISION (GATED): promote the six BotVille tools to L1**

> **DO NOT EXECUTE.** This task is a decision record, not work. It becomes executable only with explicit owner sign-off in-session. Everything below spells out exactly what changes and what it costs, so the owner can decide with the bill in view.

**Why this decision exists.** Spec II.5's delivery caveat: *"a tool that never reaches the agent's menu is inert. V1 delivery is the prompt catalog (tools grouped under the BotVille source label)."* Under this plan's default disposition that catalog entry never renders — the main agent cannot see or call any BotVille tool (the three reads are reachable only via researcher delegation; the three acts are reachable by nobody). So the default state honors Q-23 but leaves BotVille effectively invisible to agents; the spec's intended V1 delivery requires exactly the promotion described here. That tension is the owner's call, not this plan's.

**What promotion changes (mechanically):**
1. `heartbeat/infra/adapters/crew/unified_runner.py` — delete the six entries under `--- L2: BotVille (pending L1 promotion decision) ---` from `EXCLUDED_TOOLS`; delete the `BOTVILLE_PENDING_L1_TOOLS` constant.
2. `tests/heartbeat/unit/test_invariants.py` — remove the exemption and the pin test added in Task 2.
3. `tests/heartbeat/unit/test_tool_exclusion.py` — invert `test_botville_tools_are_excluded_from_l1` (six now L1) and rewrite `test_l1_schema_residue_is_still_21` → residue becomes 26 MCP tools + `delegate-tasks` = **27 schemas**.
4. `configs/subagents/researcher.yaml` — owner choice: keep the three reads (L1 + delegable, like nothing else in the repo) or remove them (pure L1). Removing preserves the "L1 tools are not also delegable" symmetry.
5. Docs cascade (same shape as Task 2's): regenerate the `excluded-tools` block (back to 22 entries, 7 L3 / 15 L2), update `tests/docs/test_gen_blocks.py` pins, register a new fact superseding M-042 and update M-006 (the "21 schemas" fact — now false), update `docs/layers/04-directives-and-run.md` prose and `docs/operations.md`.
6. Catalog delivery becomes live automatically: Task 3's metadata renders the six under `BotVille (your home town):` with Observe/Act sub-categories — no further code.

**What it costs (the reason this is gated):**
- **The PCO baseline is invalidated.** The composed ACT request stops being byte-identical to `run_20260728_103940`: six new tool schemas (~73 tokens each, the measured mean over the L1 MCP schemas — ≈ 440 tokens per ACT turn) plus the now-rendering BotVille catalog group. Every measurement anchored to that baseline — the PCO watch item (M-038's zero-tool-read escalation gate reading attributes to the PCO surface precisely *because* the request was verified byte-identical), and any A/B against pre-promotion runs — can no longer attribute behavior changes cleanly.
- **Re-baselining is required:** capture a fresh composed request (the "Capture the request" rule, `docs/layers/04-directives-and-run.md`), run a new full-cohort baseline round, re-establish the zero-tool-read watch numbers against the new baseline, and record the new run id wherever `run_20260728_103940` is cited as the current baseline (the Q-23 comment itself, `docs/facts.yaml`).
- **Menu-size effects are real and measured in this repo's history:** L1 was deliberately shrunk to 21 (step 8 demotions, Q-23) because schema overhead and menu size measurably shift tool discipline. Growing L1 by ~29% (21 → 27) reverses part of that and should be treated as an experiment arm, not a config tweak.

**Owner options short of full promotion** (each still invalidates the baseline, but smaller): promote only the three reads (24 schemas); promote only `go-to-venue` (22 schemas — the minimum that makes BotVille a *place* an agent can act on, per CANON D9.3 the tool registry already derives place-ness from `go-to-venue`'s registration server-side regardless of tier).

### Steps (all gated on recorded owner sign-off)

- [ ] **GATE: obtain and record the owner's decision** (full promotion / partial / defer). Without it, stop here — this task stays open.
- [ ] Implement items 1–5 above for the chosen scope, test-first (invert the Task 2 tests before touching `EXCLUDED_TOOLS`).
- [ ] Capture a fresh composed request and run the re-baselining round; update every citation of `run_20260728_103940` as the current baseline.
- [ ] Full suite: `.venv/bin/python -m pytest tests/ -q -m "not integration"` — expect all pass.
- [ ] Commit with the owner's ruling quoted in the message.

---

## Verification (whole plan)

- [ ] `cd /Users/home/aisocialnetwork-agents && .venv/bin/python -m pytest tests/heartbeat/ tests/docs/ -q -m "not integration"` — all pass.
- [ ] `.venv/bin/python -m scripts.docs.gen_blocks --check` — exit 0.
- [ ] `grep -rn "from heartbeat.infra" heartbeat/core/ --include="*.py"` — empty (the architectural boundary check from CLAUDE.md; Task 3 touches `core/`, Tasks 2/4 touch `infra/`, nothing crosses).
- [ ] Confirm no rendered-prompt surface changed: `EXCLUDED_TOOLS` grew (invisible by construction), subagent `goal`/`limitation` strings untouched, no new subagent YAML, no `configs/prompts/` edits.
- [ ] Cross-plan dependency before any deploy: Plan 01's `/botville/mcp` route must be live in the target environment (see Global Constraints, deployment gate).
