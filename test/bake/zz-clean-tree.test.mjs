import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

/**
 * Running the tests must not modify the working tree. A test that bakes into
 * packages/client/src/ produces a green run and a dirty diff, and the diff is
 * what the next person commits by accident.
 *
 * It lives in the BAKE suite, beside the tests that actually write files, and
 * the zz- prefix sorts it last there. But --test-concurrency means file order
 * is a heuristic, not a guarantee — so the AUTHORITATIVE check is the
 * shell-level `git status --porcelain` at the end of `test:all` (Plan 1
 * Task 1 Step 6), which runs after every worker has exited. This in-suite
 * copy is a best-effort early warning that names the suite that dirtied
 * the tree.
 */
test('the test suite leaves the working tree clean', () => {
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    // Untracked plan/scratch files the author is mid-edit on are not our business;
    // anything TRACKED that changed is.
    .filter(l => !l.startsWith('??'));
  assert.deepEqual(dirty, [], `tests modified tracked files:\n${dirty.join('\n')}`);
});
