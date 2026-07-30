/**
 * Locating a sibling repo, without ever hardcoding a path.
 *
 * Resolution order, first hit wins:
 *   1. $BOTVILLE_<NAME>_REPO      explicit, e.g. BOTVILLE_API_REPO
 *   2. $BOTVILLE_REPOS_ROOT/<name> a directory holding all the repos
 *   3. <this repo>/../<name>       the conventional side-by-side checkout
 *
 * Returns null rather than guessing. Callers skip with a reason; nothing in
 * this repo may FAIL because another repo is absent (Global Constraints).
 */
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * In a linked git worktree (e.g. under .claude/worktrees/) REPO_ROOT/.. points
 * inside the worktrees dir, so the side-by-side convention would never find a
 * sibling. The shared git dir names the main checkout; fall back to REPO_ROOT
 * outside a repo or without git.
 */
function mainCheckoutRoot() {
  try {
    const common = execSync('git rev-parse --git-common-dir',
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return dirname(resolve(REPO_ROOT, common));
  } catch {
    return REPO_ROOT;
  }
}

const envKey = name => `BOTVILLE_${name.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}_REPO`;

export function resolveSiblingRepo(name) {
  const candidates = [
    process.env[envKey(name)],
    process.env.BOTVILLE_REPOS_ROOT && join(process.env.BOTVILLE_REPOS_ROOT, name),
    resolve(REPO_ROOT, '..', name),
    resolve(mainCheckoutRoot(), '..', name),
  ].filter(Boolean);
  return candidates.find(p => existsSync(p)) ?? null;
}

/** `test('...', skipUnlessSibling('aisocialnetwork-api'), () => {...})` */
export function skipUnlessSibling(name) {
  const path = resolveSiblingRepo(name);
  return path
    ? { skip: false }
    : { skip: `${name} not found — set ${envKey(name)} or check it out beside this repo` };
}
