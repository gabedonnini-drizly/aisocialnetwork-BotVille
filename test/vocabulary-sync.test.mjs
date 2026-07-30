import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { venueRegistry } from '../packages/client/src/game/venueRegistry.ts';
import { resolveSiblingRepo } from './helpers/siblingRepo.mjs';
import { skipUnless } from './helpers/skip.mjs';

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
