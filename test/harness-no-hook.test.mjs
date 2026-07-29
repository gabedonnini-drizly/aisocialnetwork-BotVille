import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Modules that must load under BARE node and under Vite — i.e. without
 * test/ts-resolve.mjs. Tasks append to this list as they create them.
 */
const NO_HOOK_MODULES = [
  'packages/shared/src/schemaVersion.mjs',
  'packages/shared/src/hash.mjs',
  'packages/shared/src/appearance/derive.mjs',
  'scripts/png-lib.mjs',
];

for (const mod of NO_HOOK_MODULES) {
  test(`${mod} loads under bare node (no resolve hook)`, { skip: existsSync(mod) ? false : `${mod} not created yet` }, () => {
    // No --import: if this module reaches a .ts file it throws ERR_MODULE_NOT_FOUND.
    const out = execFileSync(process.execPath,
      ['-e', `import(${JSON.stringify('./' + mod)}).then(() => console.log('ok'))`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.match(out, /ok/);
  });
}
