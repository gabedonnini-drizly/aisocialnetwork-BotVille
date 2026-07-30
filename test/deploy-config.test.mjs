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

test('.dockerignore excludes the licensed art from every build context (I-12)', () => {
  const d = readFileSync('.dockerignore', 'utf8');
  for (const p of ['assets-src', 'node_modules', 'packages/client/public/assets/baked'])
    assert.ok(d.includes(p), `missing ${p}`);
});

test('.dockerignore also excludes the frozen legacy pipeline\'s vendor-named output (I-12)', () => {
  // scripts/capture-golden-baseline.mjs writes REAL licensed pixels to these
  // paths when run against assets-src (npm run golden:capture). They are
  // gitignored, but a Docker build context reads the working tree directly —
  // verified during this task: without this rule, stray residue on disk
  // gets copied straight into the image.
  const d = readFileSync('.dockerignore', 'utf8');
  for (const p of ['sprites/limezu', 'tilesets/limezu', 'ui/limezu'])
    assert.ok(d.includes(p), `missing ${p}`);
});

test('the images pin the same Node major as the rest of the repo', () => {
  const engines = pkg.engines.node.replace(/[^\d]/g, '').slice(0, 2);
  for (const f of ['Dockerfile.client', 'Dockerfile.server'])
    assert.match(readFileSync(f, 'utf8'), new RegExp(`FROM node:${engines}`), f);
});
