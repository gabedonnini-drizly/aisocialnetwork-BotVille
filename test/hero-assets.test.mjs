import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';

const HERO = 'packages/client/public/hero';

test('every hero artifact exists and is non-trivial', () => {
  for (const f of ['district-night.png', 'district-night.gif', 'district-night.mp4', 'district-night.webm']) {
    const p = `${HERO}/${f}`;
    assert.ok(existsSync(p), p);
    assert.ok(statSync(p).size > 10_000, `${f} is only ${statSync(p).size} bytes`);
  }
});

test('the still is a PNG', async () => {
  const { readFileSync } = await import('node:fs');
  assert.equal(readFileSync(`${HERO}/district-night.png`).subarray(1, 4).toString('ascii'), 'PNG');
});
