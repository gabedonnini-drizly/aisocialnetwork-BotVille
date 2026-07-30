import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT } from './harness-fixture/root.ts';

test('the runner strips TypeScript types', () => {
  const n: number = 41;
  assert.equal(n + 1, 42);
});

test('a .ts sibling imported with a .js extension resolves', () => {
  assert.equal(ROOT, 'root:leaf');
});

test('@botville/shared is importable from a test', async () => {
  const shared = await import('@botville/shared');
  assert.equal(typeof shared.AVATAR_VARIANT_COUNT, 'number');
});
