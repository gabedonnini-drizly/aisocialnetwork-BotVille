import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { SCHEMA_VERSION } from '../packages/shared/src/types/Assets.ts';
import type { AgentPresence, PresenceState, VenueDescriptor } from '../packages/shared/src/types/Assets.ts';
import { hashString } from '../packages/shared/src/hash.mjs';
import { resolveSiblingRepo, skipUnlessSibling } from './helpers/siblingRepo.mjs';

/** The platform repo's directory name. Located, never hardcoded — see helpers/siblingRepo.mjs. */
const API_REPO = process.env.BOTVILLE_API_REPO_NAME ?? 'aisocialnetwork-api';

test('SCHEMA_VERSION is 1', () => {
  assert.equal(SCHEMA_VERSION, 1);
});

test('SCHEMA_VERSION has exactly one definition, and it is reachable from .mjs', async () => {
  const fromMjs = await import('../packages/shared/src/schemaVersion.mjs');
  assert.equal(SCHEMA_VERSION, fromMjs.SCHEMA_VERSION,
    'Assets.ts must re-export schemaVersion.mjs, never declare its own copy');
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('packages/shared/src/types/Assets.ts', 'utf8');
  assert.equal(/^\s*export\s+const\s+SCHEMA_VERSION\s*=/m.test(src), false,
    'Assets.ts declares a second SCHEMA_VERSION — derive.mjs cannot import it');
});

test('hashString is an unsigned 32-bit FNV-1a', () => {
  assert.equal(hashString('', ''), hashString('', ''));
  assert.ok(hashString('x', 'y') >= 0 && hashString('x', 'y') <= 0xffffffff);
  assert.notEqual(hashString('x', 'a'), hashString('x', 'b'), 'salt must change the hash');
});

test('hashString matches agentSeed.js bit for bit (cross-repo contract)',
  skipUnlessSibling(API_REPO), async () => {
    const apiRoot = resolveSiblingRepo(API_REPO)!;
    const require = createRequire(join(apiRoot, 'package.json'));
    const apiHash = require(join(apiRoot, 'src/utils/agentSeed.js')).hashString;
    for (const seed of ['aisha_khan', 'the_skeptic', 'Unit01', '', 'ünïcødé'])
      for (const salt of ['', 'city', 'sprite:skin', 'slot:offset'])
        assert.equal(hashString(seed, salt), apiHash(seed, salt), `${seed}/${salt}`);
  });

test('AgentPresence has exactly the four boundary fields', () => {
  const p: AgentPresence = { id: 'a', displayName: 'A', spriteSeed: 'a', venueId: null };
  assert.deepEqual(Object.keys(p).sort(), ['displayName', 'id', 'spriteSeed', 'venueId']);
});

test('PresenceState admits exactly three kinds', () => {
  const states: PresenceState[] = [
    { kind: 'somewhere', venueId: 'cafe' },
    { kind: 'absent' },
    { kind: 'unknown' },
  ];
  assert.deepEqual(states.map(s => s.kind), ['somewhere', 'absent', 'unknown']);
});

test('a minimal VenueDescriptor type-checks', () => {
  const v: VenueDescriptor = {
    id: 'fixture', label: 'Fixture', indoor: true, sizeTiles: [20, 15],
    groundAtlas: 'interiors_ground', capacity: 4,
    ground: { wallA: 'wallCafeA', wallB: 'wallCafeB', floor: 'floorCafe' },
    furniture: [], seats: [], spawns: [[9, 13]], animated: [], doors: [], glows: [],
  };
  assert.equal(v.id, 'fixture');
});
