import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

// ── D-20: Vercel and Railway are retired. Docker is the deployment ───────
// (self-hosting two Node apps, same as the platform's own api/frontend
// pair) — not just local parity. These are structural guards against
// quietly reintroducing the retired config.

test('the retired hosting configs do not come back', () => {
  for (const f of ['vercel.json', 'railway.toml', 'scripts/deploy-server.mjs'])
    assert.equal(existsSync(f), false, `${f} was retired by D-20 — self-hosting via Docker replaced it`);
});

test('package.json carries no deploy:client/deploy:server script', () => {
  assert.equal(pkg.scripts['deploy:client'], undefined);
  assert.equal(pkg.scripts['deploy:server'], undefined);
});

test('vercel is not a dependency anywhere in package.json', () => {
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.equal(Object.hasOwn(all, 'vercel'), false);
});

// ── Docker: the deployment packaging (self-host, two Node apps) ──────────

test('the container files exist', () => {
  for (const f of ['Dockerfile.client', 'Dockerfile.server', 'docker-compose.yml', '.dockerignore'])
    assert.ok(existsSync(f), f);
});

test('there is exactly one compose file — the pack is a build arg, not a fork', () => {
  assert.equal(existsSync('docker-compose.public.yml'), false,
    'a second compose file duplicates the deploy story; PACK/SRC_ROOT already express the fork');
});

test('compose declares the baked-artifact volume (spec §7.2)', () => {
  const c = readFileSync('docker-compose.yml', 'utf8');
  assert.match(c, /botville-baked/);
  assert.match(c, /assets\/baked/);
});

test('the future Postgres seam is declared but inactive (R-6)', () => {
  const c = readFileSync('docker-compose.yml', 'utf8');
  assert.match(c, /#\s*BOTVILLE_PLATFORM_DB_URL/);
  assert.equal(/^\s*BOTVILLE_PLATFORM_DB_URL\s*[:=]/m.test(c), false,
    'the DB connection must stay commented out');
});

// Single source of truth for "every path on disk that can hold licensed
// pixels or pack-derived data, gitignored, and therefore invisible to a
// `git archive`-based check but NOT invisible to a Docker build context
// (docker-compose's agent-bake service builds Dockerfile.client's
// intermediate `build` stage via COPY . . and keeps it as a runnable,
// taggable image — the review that added this list found `contact/` and
// `sources/*.index.json` riding along into exactly that stage, missed by
// the first pass of this guard). Drift here — a new gitignored,
// art-bearing path added without a matching .dockerignore rule — must fail
// this test loudly, not get discovered by opening a built image by hand.
const LICENCE_CRITICAL_DOCKERIGNORE_ENTRIES = [
  'assets-src',
  'packages/client/public/assets/tilesets/pack',
  'packages/client/public/assets/sprites/pack',
  'packages/client/public/assets/baked',
  // The frozen legacy pipeline (scripts/capture-golden-baseline.mjs) writes
  // REAL licensed pixels straight from assets-src/ to these vendor-named
  // paths (see .gitignore) on every `npm run golden:capture`.
  'packages/client/public/assets/tilesets/limezu',
  'packages/client/public/assets/sprites/limezu',
  'packages/client/public/assets/ui/limezu',
  // Contact sheets (npm run contact) — real licensed pixel crops rendered
  // straight off assets-src/ for pack-QA review (Task 3 Step 6).
  'contact',
  // Per-cell pack inventory (npm run pack:index) — sources/limezu.index.json
  // is hundreds of MB of hashes/palettes derived from the real pack.
  'sources/*.index.json',
];

// Actual pattern lines only — comments (which name these same paths in
// prose, e.g. "npm run contact") must not be able to satisfy this check.
// A naive whole-file `.includes()` passed even with the real `contact` rule
// line deleted, because the word still appeared in a comment above it —
// caught by manually deleting the rule line and re-running this test.
function dockerignoreRules() {
  return readFileSync('.dockerignore', 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
}

test('.dockerignore excludes every licence-critical path from every build context (I-12)', () => {
  const rules = dockerignoreRules();
  for (const p of LICENCE_CRITICAL_DOCKERIGNORE_ENTRIES)
    assert.ok(rules.includes(p), `.dockerignore has no rule line for ${p}`);
});

// Secrets/data class, not licence class (Plan 6 final review, Important
// finding 1 + Minor 2): root-only patterns (no leading `**/`) match ONLY at
// the build-context root, so `.env`/`*.db` without the nested form never
// caught `packages/server/.env` or `packages/server/botville.db` — verified
// byte-present in the agent-bake build-stage image before this fix. Every
// entry here MUST use the nested (`**/…`) form; a root-only sibling doesn't
// count, so this checks the exact pattern, not just "some rule mentions it".
const SECRETS_CRITICAL_DOCKERIGNORE_ENTRIES = [
  '**/.env',
  '**/.env.*',
  '**/*.db',
  '**/*.db-shm',
  '**/*.db-wal',
  // User-authored agent roster — dead weight plus a small privacy ride-along
  // in the same build stage; the running container mounts it at runtime.
  'roster/*.json',
];

test('.dockerignore excludes secrets and local data from every build context, in nested form', () => {
  const rules = dockerignoreRules();
  for (const p of SECRETS_CRITICAL_DOCKERIGNORE_ENTRIES)
    assert.ok(rules.includes(p), `.dockerignore has no (nested-form) rule line for ${p}`);
});

test('.dockerignore also keeps the ordinary build-hygiene excludes', () => {
  assert.ok(dockerignoreRules().includes('node_modules'));
});

test('the images pin the same Node major as the rest of the repo', () => {
  const engines = pkg.engines.node.replace(/[^\d]/g, '').slice(0, 2);
  for (const f of ['Dockerfile.client', 'Dockerfile.server'])
    assert.match(readFileSync(f, 'utf8'), new RegExp(`FROM node:${engines}`), f);
});
