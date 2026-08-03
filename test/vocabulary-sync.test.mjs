import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { venueRegistry } from '../packages/client/src/game/venueRegistry.ts';
import { resolveSiblingRepo } from './helpers/siblingRepo.mjs';
import { skipUnless } from './helpers/skip.mjs';
import { checkPlots, collectPlots } from './helpers/plotCoverage.mjs';

const OURS = 'packages/client/public/assets/venues.json';
const API_NAME = process.env.BOTVILLE_API_REPO_NAME ?? 'aisocialnetwork-api';
const apiRoot = resolveSiblingRepo(API_NAME);
const apiCopy = apiRoot && join(apiRoot, 'config', 'venues.json');

test('the published artifact is what the registry would publish', () => {
  const published = JSON.parse(readFileSync(OURS, 'utf8'));
  assert.deepEqual(published, venueRegistry.published(),
    'venues.json is stale — run npm run bake:world');
});

test('the lock matches the artifact it locks', () => {
  const raw = readFileSync(OURS, 'utf8');
  const lock = JSON.parse(readFileSync('packages/client/public/assets/venues.lock.json', 'utf8'));
  assert.equal(createHash('sha256').update(raw).digest('hex'), lock.sha256,
    'venues.lock.json is stale — run npm run bake:world');
});

test('the platform copy matches ours (I-8)',
  skipUnless(!!apiCopy && existsSync(apiCopy), `${API_NAME}/config/venues.json not found — set BOTVILLE_API_REPO to run the cross-repo check`),
  () => {
    const theirs = JSON.parse(readFileSync(apiCopy, 'utf8'));
    const ours = JSON.parse(readFileSync(OURS, 'utf8'));
    assert.deepEqual(theirs, ours,
      `the platform copy has drifted. Run:\n  cp ${OURS} ${apiCopy}\n  cp ${OURS.replace('.json', '.lock.json')} ${apiCopy.replace('.json', '.lock.json')}`);
  });

// ── the drift the `farm` case was ────────────────────────────────────────
//
// The client filtered on `a.location === 'farm'` for a year while `farm` was
// not, and had never been, in venues.json. Nothing failed: the branch was
// simply dead, and the two vocabularies had drifted by one with no test in a
// position to notice. Growth multiplies exactly this, which is why this is a
// guardrail rather than hygiene.

const CLIENT_SRC = 'packages/client/src';

/**
 * Blank out comments, preserving line structure so line numbers survive.
 *
 * Not decoration: the first run of this check fired on a COMMENT explaining
 * the branch it had just replaced. A filter quoted in prose is not a filter,
 * and a check that cannot tell the difference trains people to ignore it.
 * Character-wise rather than regex, so a `//` inside a string (a URL) does
 * not swallow the rest of the line.
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  let state = 'code';           // code | line | block | sq | dq | tpl
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; out += '  '; i += 2; continue; }
      if (c === '/' && d === '*') { state = 'block'; out += '  '; i += 2; continue; }
      if (c === "'") state = 'sq';
      else if (c === '"') state = 'dq';
      else if (c === '`') state = 'tpl';
      out += c; i++; continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c; i++; continue; }
      out += ' '; i++; continue;
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { state = 'code'; out += '  '; i += 2; continue; }
      out += c === '\n' ? c : ' '; i++; continue;
    }
    // inside a string literal
    if (c === '\\') { out += c + (d ?? ''); i += 2; continue; }
    if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"') || (state === 'tpl' && c === '`')) state = 'code';
    out += c; i++;
  }
  return out;
}

/**
 * Location strings the client compares against, with their file and line.
 *
 * Deliberately NOT a hand-kept list: the point is to find comparisons nobody
 * remembered writing. `typeof x !== 'string'` is excluded by capturing the
 * `typeof` and skipping it — a type guard is not a location filter.
 */
function clientLocationComparisons() {
  const PATTERN = /(typeof\s+)?((?:[\w$]+\.)*(?:location|newLoc|lastLoc|loc|from|venueId))\s*[!=]==\s*'([^']*)'/g;
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  const hits = [];
  for (const file of walk(CLIENT_SRC).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
    const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(PATTERN)) {
        if (m[1]) continue;                       // `typeof x === 'string'`
        hits.push({ file, line: i + 1, value: m[3] });
      }
    });
  }
  return hits;
}

test('every location string the client filters on exists in the published vocabulary', () => {
  const published = new Set(JSON.parse(readFileSync(OURS, 'utf8')).map(v => v.id));
  const hits = clientLocationComparisons();
  // A scanner that finds nothing passes for the wrong reason. Assert it works
  // before trusting what it says.
  assert.ok(hits.length > 0, `${CLIENT_SRC} yielded no location comparisons — the scanner is broken`);
  const unknown = hits.filter(h => !published.has(h.value));
  assert.deepEqual(unknown.map(h => `${h.file}:${h.line} -> '${h.value}'`), [],
    'the client filters on a location BotVille does not publish (the `farm` case). Either publish '
    + 'the venue or delete the branch — a filter on an id nobody can ever have is dead code that '
    + 'reads as a feature.');
});

// ── plot coverage ────────────────────────────────────────────────────────
//
// Task 7 authors the plots and is blocked on ⛔ O-1. These pass vacuously
// until it lands; the fixtures below are what prove they would fire.

const district = JSON.parse(readFileSync('venues/district/venue.json', 'utf8'));
const siblingPlots = existsSync('venues/district/plots.json')
  ? JSON.parse(readFileSync('venues/district/plots.json', 'utf8'))
  : null;
const declaredArchetypes = readdirSync('venues/_archetypes')
  .filter(f => f.endsWith('.json'))
  .map(f => f.replace(/\.json$/, ''));

test('every plot fits its district, overlaps no other, and allows only declared archetypes', () => {
  const plots = collectPlots(district, siblingPlots);
  const { problems } = checkPlots(plots, district, declaredArchetypes);
  assert.deepEqual(problems, []);
});

test('the plot checks fire — vacuously green is not the same as green', () => {
  const ok = { id: 'p1', at: [0, 0], size: [6, 5], allowedArchetypes: ['house'] };

  assert.deepEqual(checkPlots([ok], district, declaredArchetypes).problems, [],
    'a well-formed plot must pass, or the fixtures below prove nothing');

  // ⛔ an allowlist pointing at an undeclared archetype
  const undeclared = checkPlots(
    [{ ...ok, allowedArchetypes: ['ziggurat'] }], district, declaredArchetypes).problems;
  assert.ok(undeclared.some(p => /ziggurat/.test(p) && /not a declared archetype/.test(p)), undeclared.join('\n'));

  // ⛔ two plots overlapping
  const overlap = checkPlots(
    [ok, { ...ok, id: 'p2', at: [3, 2] }], district, declaredArchetypes).problems;
  assert.ok(overlap.some(p => /p1 and p2 overlap/.test(p)), overlap.join('\n'));

  // ...and touching edges are not an overlap, or every tiled layout would fail
  assert.deepEqual(
    checkPlots([ok, { ...ok, id: 'p2', at: [6, 0] }], district, declaredArchetypes).problems, []);

  // ⛔ a footprint hanging off the edge of the district
  const [DW] = district.sizeTiles;
  const outside = checkPlots(
    [{ ...ok, at: [DW - 2, 0] }], district, declaredArchetypes).problems;
  assert.ok(outside.some(p => /falls outside the district/.test(p)), outside.join('\n'));
});
