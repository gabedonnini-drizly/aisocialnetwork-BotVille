import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveSiblingRepo, envKey } from './helpers/siblingRepo.mjs';
import { skipUnless } from './helpers/skip.mjs';

// The civic kind/template registry (civic-drive spec §III; D-32, D-34, D-42).
// This repo authors contract/civic-registry.json; the platform copy at
// aisocialnetwork-api/config/civic-registry.json must stay byte-identical —
// the same authoring-copy pattern as the venue vocabulary sync.
//
// The platform copy lands with the civic-drive Stage A merge; until then the
// sibling check degrades to a SKIP, never a FAIL (Global Constraints).

const OURS = 'contract/civic-registry.json';
const API_NAME = process.env.BOTVILLE_API_REPO_NAME ?? 'aisocialnetwork-api';
const apiRoot = resolveSiblingRepo(API_NAME);
const apiCopy = apiRoot && join(apiRoot, 'config', 'civic-registry.json');

test('the authoring copy is well-formed JSON with the two registry sections', () => {
  const registry = JSON.parse(readFileSync(OURS, 'utf8'));
  assert.ok(Array.isArray(registry.kinds) && registry.kinds.length >= 1);
  assert.ok(Array.isArray(registry.radiant_templates));
});

test('the platform copy matches ours byte-for-byte (D-42)',
  skipUnless(!!apiCopy && existsSync(apiCopy),
    `${API_NAME}/config/civic-registry.json not found — expected once the civic-drive Stage A merge deploys it; set ${envKey(API_NAME)} to run the cross-repo check`),
  () => {
    const theirs = readFileSync(apiCopy, 'utf8');
    const ours = readFileSync(OURS, 'utf8');
    assert.equal(theirs, ours,
      `the platform copy has drifted. Run:\n  cp ${OURS} ${apiCopy}`);
  });
