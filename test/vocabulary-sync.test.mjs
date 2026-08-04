import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  venueRegistry, CLIENT_INTERNAL_LOCATIONS, CLIENT_INTERNAL_LOCATION_IDS, DISTRICT_SCENE_KEY,
  districtForLocation, sceneForLocation, sceneKeyFor,
} from '../packages/client/src/game/venueRegistry.ts';
import { drawnByDistrict } from '../packages/client/src/game/districtPresence.ts';
import { plotRegistry } from '../packages/client/src/game/plotRegistry.ts';
import { AGENT_LOCATIONS } from '../packages/shared/src/types/Agent.ts';
import { resolveSiblingRepo, envKey } from './helpers/siblingRepo.mjs';
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
  skipUnless(!!apiCopy && existsSync(apiCopy), `${API_NAME}/config/venues.json not found — set ${envKey(API_NAME)} to run the cross-repo check`),
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
  // `[\w$]+\??\.` so optional chaining is part of the LHS: without it,
  // `typeof entry?.id !== 'string'` parses as a bare `id` comparison and the
  // `typeof` guard never fires.
  const PATTERN = /(typeof\s+)?((?:[\w$]+\??\.)*(?:location|newLoc|lastLoc|loc|from|venueId|id))\s*[!=]==\s*([A-Z][\w$]*|'[^']*')/g;
  // `const FARM = 'farm';` … `id === FARM`. Indirection through a
  // single-assignment const is the obvious way to write this filter and the
  // scanner used to be blind to it — presence.ts was written exactly that way.
  const CONST_PATTERN = /\bconst\s+([A-Z][\w$]*)\s*=\s*'([^']*)'\s*;/g;
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  const hits = [];
  const sources = walk(CLIENT_SRC).filter(f =>
    (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
  for (const file of sources) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const consts = new Map([...src.matchAll(CONST_PATTERN)].map(m => [m[1], m[2]]));
    src.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(PATTERN)) {
        if (m[1]) continue;                       // `typeof x === 'string'`
        const rhs = m[3];
        const value = rhs.startsWith("'") ? rhs.slice(1, -1) : consts.get(rhs);
        if (value === undefined) continue;        // an identifier we cannot resolve
        hits.push({ file, line: i + 1, value });
      }
    });
  }
  return { hits, fileCount: sources.length };
}

/**
 * `farm` is the exemption, and it is a DOCUMENTED one rather than a hole:
 * CLIENT_INTERNAL_LOCATIONS in venueRegistry.ts is the single list, read by
 * the runtime lookup, by `sceneForLocation`, and here. See that file for why
 * the farm is district geography rather than drift.
 */
const KNOWN_LOCATIONS = () => new Set([
  ...JSON.parse(readFileSync(OURS, 'utf8')).map(v => v.id),
  ...CLIENT_INTERNAL_LOCATION_IDS,
]);

test('every location string the client filters on is published or documented client-internal', () => {
  const known = KNOWN_LOCATIONS();
  const { hits, fileCount } = clientLocationComparisons();
  // A scanner that finds nothing passes for the wrong reason. Assert it works
  // before trusting what it says.
  assert.ok(fileCount > 0, `${CLIENT_SRC} yielded no source files — the scanner is broken`);
  assert.ok(hits.length > 0, `${CLIENT_SRC} yielded no location comparisons — the scanner is broken`);
  const unknown = hits.filter(h => !known.has(h.value));
  assert.deepEqual(unknown.map(h => `${h.file}:${h.line} -> '${h.value}'`), [],
    'the client filters on a location that is neither published nor a documented client-internal '
    + 'location. Either publish the venue, add it to CLIENT_INTERNAL_LOCATIONS with the reason, or '
    + 'delete the branch.');
});

/**
 * The scanner above is a heuristic over source text; these two are CLOSED
 * LISTS, which is what actually makes the coverage exhaustive. Every location
 * the client can be told about, and every location it can render a label for,
 * must be a place it knows how to draw.
 *
 * This is the check that would have caught the regression the `farm` ruling
 * caused: AGENT_LOCATIONS carries 'farm' because the fixture server emits it
 * (agentLife.ts:37/38/100 — D-28, the default dev runtime), so removing the
 * client's handling of it without removing it here leaves a location that is
 * announced and never drawn.
 */
test('every location the client can be told about is published or documented client-internal', () => {
  const known = KNOWN_LOCATIONS();
  const orphans = AGENT_LOCATIONS.filter(l => !known.has(l));
  assert.deepEqual(orphans, [],
    'AGENT_LOCATIONS names a location that is neither a published venue nor a documented '
    + 'client-internal location — the server can emit it and nothing will draw it.');
});

/**
 * LOCATION_KEYS is read from SOURCE, not imported: packages/client/src/i18n
 * touches `document` at module scope, so it cannot load under node --test.
 * The map is a static object literal, so parsing it is exact — and the parse
 * asserts it found the map and some keys, so a rename cannot turn this into a
 * check of nothing.
 */
function locationLabelKeys() {
  const src = readFileSync('packages/client/src/i18n/index.ts', 'utf8');
  const block = src.match(/LOCATION_KEYS[^=]*=\s*\{([\s\S]*?)\n\};/);
  assert.ok(block, 'LOCATION_KEYS not found in i18n/index.ts — this check has gone blind');
  const keys = [...block[1].matchAll(/^\s*([a-z_][\w]*)\s*:/gm)].map(m => m[1]);
  assert.ok(keys.length > 0, 'LOCATION_KEYS parsed to no keys — the parser is broken');
  return keys;
}

test('every location label key is published or documented client-internal', () => {
  const known = KNOWN_LOCATIONS();
  const orphans = locationLabelKeys().filter(l => !known.has(l));
  assert.deepEqual(orphans, [],
    'i18n LOCATION_KEYS labels a location the client cannot place');
});

/**
 * A client-internal location has no scene of its own — that is what makes it
 * internal. Route one through `sceneKeyFor` and you get a key no scene is
 * registered under: `transitionTo` fades out into a black screen that never
 * returns, reachable from a HUD click and from a ?follow= deep link.
 */
test('every client-internal location maps to a registered scene, not a venue key', () => {
  const sceneKeys = new Set([
    DISTRICT_SCENE_KEY,
    ...venueRegistry.all().map(v => sceneKeyFor(v.id)),
  ]);
  for (const loc of CLIENT_INTERNAL_LOCATION_IDS) {
    assert.equal(sceneForLocation(loc), DISTRICT_SCENE_KEY,
      `${loc} is client-internal, so it must be drawn by the scene that owns its geography`);
    assert.ok(sceneKeys.has(sceneForLocation(loc)));
    assert.equal(sceneKeys.has(sceneKeyFor(loc)), false,
      `sceneKeyFor('${loc}') is not a registered scene — that is exactly why sceneForLocation exists`);
  }
  // ...and the mapping is not a blanket redirect: real venues still route to
  // their own scenes.
  assert.equal(sceneForLocation('cafe'), 'VenueScene:cafe');
  assert.equal(sceneForLocation('district'), 'DistrictScene');
});

/**
 * The regression this file's own earlier version caused, pinned.
 *
 * A location can be "known" to presence, correctly mapped to DistrictScene,
 * and STILL never drawn — because DistrictScene decides who it draws with its
 * own `present` filter. Narrow that filter to 'district' alone and every
 * animal falls out of it nightly (agentLife.ts:100 sends them all to the pen),
 * gets removeSprite'd, and updateNightBehavior loses its subjects.
 *
 * It used to read the filter line out of DistrictScene.ts as text, because
 * syncAgents needs Phaser. The decision now lives in game/districtPresence.ts,
 * which does not — so this asks the real function instead of a regex.
 */
test('the outdoor scene draws every client-internal location, not just the district', () => {
  for (const [loc, districtId] of Object.entries(CLIENT_INTERNAL_LOCATIONS)) {
    assert.ok(drawnByDistrict(loc, districtId),
      `the outdoor scene's present filter drops '${loc}'. It is drawn by that district's scene `
      + 'and by no other, so anyone the server puts there stops being rendered — nightly, for '
      + 'every animal.');
  }
  for (const district of venueRegistry.districts()) {
    assert.ok(drawnByDistrict(district.id, district.id), 'a district must still draw itself');
    assert.equal(drawnByDistrict('cafe', district.id), false,
      'an interior is not drawn by the outdoor scene');
  }
  // A parcel is drawn by its district and by no other. D-89 publishes vacant
  // plots as roles:['home'] / affords:['sleep'], so the api WILL place sleepers
  // in Camp N — drop them from this filter and the whole tent camp is invisible
  // at exactly the hour it exists to be seen.
  for (const plot of plotRegistry.all()) {
    assert.ok(drawnByDistrict(plot.id, plot.districtId),
      `the outdoor scene's present filter drops '${plot.id}' — everyone sleeping in that camp `
      + 'stops being rendered');
    assert.equal(drawnByDistrict(plot.id, plot.id), false,
      'a parcel is not a district: nothing draws "the plot_N scene"');
  }
  // ...and the filter is derived, not enumerated: it says yes to a location it
  // was never told about, as long as the registry calls that location outdoors.
  assert.equal(districtForLocation('cafe'), undefined);
});

// ── plot coverage ────────────────────────────────────────────────────────
//
// Task 7 authors the plots and is blocked on ⛔ O-1. These pass vacuously
// until it lands; the fixtures below are what prove they would fire.

const district = JSON.parse(readFileSync('venues/district/venue.json', 'utf8'));
const PLOTS_FILE = 'venues/district/plots.json';
const declaredArchetypes = readdirSync('venues/_archetypes')
  .filter(f => f.endsWith('.json'))
  .map(f => f.replace(/\.json$/, ''));

/**
 * Three outcomes, deliberately distinguished — "no plots authored yet" and
 * "the plots file is not what this check thinks it is" must not look the
 * same, or the check quietly stops checking the day the shape changes.
 */
function plotSource() {
  if (!existsSync(PLOTS_FILE)) {
    return { plots: collectPlots(district, null), where: 'venues/district/venue.json' };
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(PLOTS_FILE, 'utf8'));
  } catch (e) {
    return { malformed: `${PLOTS_FILE} is not valid JSON: ${e.message}` };
  }
  if (!Array.isArray(parsed?.plots)) {
    return { malformed: `${PLOTS_FILE} exists but has no \`plots\` array — this check reads a shape it no longer recognises` };
  }
  return { plots: collectPlots(district, parsed), where: PLOTS_FILE };
}

test('every plot fits its district, overlaps no other, and allows only declared archetypes', () => {
  const source = plotSource();
  // A plots file in a shape this check cannot read is a HARD failure. Silence
  // from a check that has stopped reading its input is the failure mode the
  // whole plot-coverage exercise exists to avoid.
  assert.equal(source.malformed, undefined, source.malformed);

  const { problems, count } = checkPlots(source.plots, district, declaredArchetypes);
  assert.deepEqual(problems, []);

  // O-1 is ruled (D-79) and Task 7 has authored the plots, so this check is
  // no longer vacuous and must never quietly become so again: a plots file
  // that stopped being read would otherwise look exactly like a clean run.
  assert.ok(count > 0,
    `no plots found in ${source.where} — the plots are authored now (D-79), so zero means this `
    + 'check has stopped reading its input, not that the town has no land');
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
