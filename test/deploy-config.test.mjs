import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));

// ── The real deploy paths ────────────────────────────────────────────────

test('the Vercel build bakes the world before building the client', () => {
  assert.match(vercel.buildCommand, /bake:world/,
    'a Vercel build without a bake ships a client with no maps');
  assert.ok(vercel.buildCommand.indexOf('bake:world') < vercel.buildCommand.indexOf('build'),
    'the bake has to run first — vite copies public/ at build time');
});

test('a Vercel Git build cannot contain licensed art (I-12)', () => {
  // assets-src/ is gitignored, so a Git-triggered build has no packs and the
  // bake falls back to the fixture. Belt and braces: the command must not
  // name the licensed pack.
  assert.equal(/limezu/.test(vercel.buildCommand), false,
    'the public build command names the licensed pack — a Git build must be art-free');
});

test('deploy:client bakes with the real pack before uploading prebuilt output', () => {
  const cmd = pkg.scripts['deploy:client'];
  // Every stage must name the real pack. A bare sync-assets.mjs would copy
  // the FIXTURE character sheets next to real tiles, silently.
  assert.match(cmd, /sync-assets\.mjs limezu assets-src/);
  assert.match(cmd, /bake:world -- limezu assets-src/);
  assert.match(cmd, /bake:agents -- --pack limezu --src assets-src/);
  assert.match(cmd, /--prebuilt/, 'prebuilt is what makes the local bake reach production');
  assert.equal(/\.\.\./.test(cmd), false, 'a literal "..." means a plan placeholder leaked into package.json');
});

test('the Railway server build is untouched by the art pipeline', () => {
  const railway = readFileSync('railway.toml', 'utf8');
  assert.match(railway, /turbo build --filter=@botville\/server/);
  assert.equal(/bake:world/.test(railway), false,
    'the server serves no art; baking in its build is wasted time and a licence risk');
});

test('the server deploy snapshot still strips every art directory (I-12)', () => {
  const src = readFileSync('scripts/deploy-server.mjs', 'utf8');
  for (const p of ['assets-src', 'baked'])
    assert.ok(src.includes(p), `deploy-server.mjs no longer strips ${p}`);
});

// ── Docker: parity, not a second deployment ──────────────────────────────

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

test('the images pin the same Node major as the rest of the repo', () => {
  const engines = pkg.engines.node.replace(/[^\d]/g, '').slice(0, 2);
  for (const f of ['Dockerfile.client', 'Dockerfile.server'])
    assert.match(readFileSync(f, 'utf8'), new RegExp(`FROM node:${engines}`), f);
});
