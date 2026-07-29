#!/usr/bin/env node
/**
 * deploy-server.mjs — publishes the server code to the private GitHub repo
 * `botville-app`, from which Railway builds prod (push-to-deploy).
 *
 * What it does:
 *   1. Builds a clean snapshot of HEAD of the working folder in a temporary
 *      directory (`git archive` — i.e. only what is in git; the LimeZu assets
 *      and .env are absent by design, but we still check explicitly).
 *   2. Strips the strategy docs (the entire `docs/`), any `.env` files
 *      (except `*.example`) and the paid-asset folders from the snapshot.
 *   3. Runs a safety-gate: if even one forbidden file remains in the
 *      snapshot — it fails and pushes NOTHING.
 *   4. Prints a preview (file list + summary) and waits for confirmation.
 *   5. Clones `botville-app`, replaces its contents with the snapshot,
 *      commits and pushes to `main`. Railway picks up the push-to-deploy itself.
 *
 * The working folder is NOT modified: all work happens in mkdtemp directories,
 * which are removed at the end. Re-running with no changes = "nothing to
 * deploy", exit 0.
 *
 * Usage:
 *   node scripts/deploy-server.mjs --dry-run     # build and show, don't push
 *   node scripts/deploy-server.mjs               # with confirmation
 *   node scripts/deploy-server.mjs --yes         # without confirmation (CI)
 *   node scripts/deploy-server.mjs --remote=<url>  # set/save the remote
 *
 * The remote is taken from (in priority order): --remote=<url> → the
 * BOTVILLE_APP_REMOTE environment variable → the .deploy-server.json file in
 * the repo root (created by the first run with --remote and not committed).
 */

import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = path.join(ROOT, '.deploy-server.json');
const TARGET_BRANCH = 'main';

// ─── arguments ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const DRY_RUN = has('--dry-run');
const ASSUME_YES = has('--yes') || has('-y');
const KEEP_TMP = has('--keep');
const REMOTE_ARG = valueOf('remote');

// ─── output ───────────────────────────────────────────────────────────────────

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

const log = (...a) => console.log(...a);
const step = (n, title) => log(`\n${bold(`[${n}]`)} ${bold(title)}`);

function die(message, hint) {
  log(`\n${red('✗ STOPPED')} — ${message}`);
  if (hint) log(`\n${hint}\n`);
  process.exit(1);
}

// ─── exclusion rules ──────────────────────────────────────────────────────────

/**
 * Paths that get cut out of the snapshot. Returns a reason or null.
 * Operates on posix paths relative to the snapshot root.
 */
function excludeReason(relPath) {
  const base = path.posix.basename(relPath);

  // Strategy docs — the repo may become public, they must not go there.
  if (relPath === 'docs' || relPath.startsWith('docs/')) return 'strategy docs';

  // Secrets. `*.example` are value-free templates, we keep those.
  if (/(^|\.)env($|\.)/.test(base) && !base.endsWith('.example')) return 'secret (.env)';

  // Paid LimeZu assets (the license forbids redistribution).
  if (relPath === 'assets-src' || relPath.startsWith('assets-src/')) return 'paid assets';
  if (/^packages\/[^/]+\/public\/assets\/(tilesets|sprites|ui)\/limezu(\/|$)/.test(relPath)) {
    return 'paid assets';
  }

  // Internal development machinery.
  if (relPath === '.claude' || relPath.startsWith('.claude/')) return 'internal settings';

  return null;
}

/**
 * Safety-gate: patterns that must not remain in the final snapshot AT ALL.
 * This is a second line of defense — independent of excludeReason.
 */
const FORBIDDEN = [
  { label: '.env file with secrets', test: (p) => /(^|\/)\.?[^/]*\.env(\.|$)|(^|\/)\.env$/.test(p) && !p.endsWith('.example') },
  { label: 'strategy doc', test: (p) => p.startsWith('docs/') },
  { label: 'screenshot', test: (p) => /\.(png|jpe?g|gif|webm|mp4)$/i.test(p) && !p.startsWith('packages/client/public/hero/') },
  { label: 'paid LimeZu asset', test: (p) => /limezu/i.test(p) || p.startsWith('assets-src/') },
  { label: 'archive/zip', test: (p) => /\.zip$/i.test(p) },
  { label: 'database', test: (p) => /\.db(-shm|-wal)?$/i.test(p) },
];

/** Files without which Railway cannot build the server. */
const REQUIRED = [
  'package.json',
  'package-lock.json',
  'railway.toml',
  'turbo.json',
  'tsconfig.base.json',
  '.nvmrc',
  'packages/server/package.json',
  'packages/server/src/index.ts',
  'packages/shared/package.json',
];

// ─── utilities ────────────────────────────────────────────────────────────────

function git(args, opts = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  }).trim();
}

function listFiles(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function resolveRemote() {
  if (REMOTE_ARG) {
    fs.writeFileSync(CONFIG_FILE, `${JSON.stringify({ remote: REMOTE_ARG }, null, 2)}\n`);
    log(dim(`  remote saved to ${path.basename(CONFIG_FILE)}`));
    return REMOTE_ARG;
  }
  if (process.env.BOTVILLE_APP_REMOTE) return process.env.BOTVILLE_APP_REMOTE;
  if (fs.existsSync(CONFIG_FILE)) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (cfg.remote) return cfg.remote;
  }
  return null;
}

async function confirm(question) {
  if (!process.stdin.isTTY) {
    die(
      'confirmation is required, but the terminal is non-interactive.',
      `Run with the ${bold('--yes')} flag if you are sure.`,
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return /^(y|yes)$/i.test(answer.trim());
}

// ─── steps ────────────────────────────────────────────────────────────────────

/** Step 1: snapshot HEAD into a temporary folder. */
function buildSnapshot() {
  const headSha = git(['rev-parse', 'HEAD'], { cwd: ROOT });
  const headShort = git(['rev-parse', '--short', 'HEAD'], { cwd: ROOT });
  const headSubject = git(['log', '-1', '--pretty=%s'], { cwd: ROOT });

  const dirty = git(['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT });
  if (dirty) {
    log(yellow('  ⚠ the working folder has uncommitted changes — they will NOT ship:'));
    for (const line of dirty.split('\n')) log(dim(`     ${line}`));
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'botville-snapshot-'));
  const tarball = path.join(dir, '..', `${path.basename(dir)}.tar`);
  execFileSync('git', ['archive', '--format=tar', '-o', tarball, 'HEAD'], { cwd: ROOT });
  execFileSync('tar', ['-xf', tarball, '-C', dir]);
  fs.rmSync(tarball);

  log(`  HEAD ${bold(headShort)} — ${headSubject}`);
  log(`  snapshot: ${dim(dir)}`);
  return { dir, headSha, headShort, headSubject };
}

/** Step 2: cut out everything that must not be in the published snapshot. */
function pruneSnapshot(dir) {
  const removed = [];
  // Walk all files; directories are cleaned afterwards (tar doesn't store empty dirs).
  for (const rel of listFiles(dir)) {
    const reason = excludeReason(rel);
    if (reason) {
      fs.rmSync(path.join(dir, rel));
      removed.push({ rel, reason });
    }
  }
  // Remove directories that became empty.
  const dropEmpty = (abs) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.isDirectory()) dropEmpty(path.join(abs, entry.name));
    }
    if (abs !== dir && fs.readdirSync(abs).length === 0) fs.rmdirSync(abs);
  };
  dropEmpty(dir);

  const byReason = new Map();
  for (const { reason } of removed) byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
  if (removed.length === 0) log(dim('  nothing to cut'));
  for (const [reason, count] of byReason) log(`  cut ${bold(String(count))} — ${reason}`);
  return removed;
}

/** Step 3: safety-gate. Fail if anything forbidden remains. */
function verifySnapshot(dir) {
  const files = listFiles(dir);
  const violations = [];
  for (const rel of files) {
    for (const rule of FORBIDDEN) {
      if (rule.test(rel)) violations.push(`${rel}  ${dim(`← ${rule.label}`)}`);
    }
  }
  if (violations.length) {
    log(red('\n  Forbidden files remain in the snapshot:'));
    for (const v of violations) log(`    ${v}`);
    die('safety-gate failed, nothing was pushed.');
  }

  const missing = REQUIRED.filter((rel) => !files.includes(rel));
  if (missing.length) {
    die(
      `the snapshot is missing files Railway cannot build without: ${missing.join(', ')}`,
      'Looks like the exclusion rules caught something needed. Check excludeReason() in this script.',
    );
  }

  for (const rule of FORBIDDEN) log(`  ${green('✓')} none: ${rule.label}`);
  log(`  ${green('✓')} present: ${REQUIRED.length} files needed for the build`);
  return files;
}

/** Step 4: preview for the human. */
function printPreview(dir, files) {
  const totalBytes = files.reduce((sum, rel) => sum + fs.statSync(path.join(dir, rel)).size, 0);

  // Group by directory: expand `packages/*` to the package level,
  // everything else by top-level directory; root files go into "(root)".
  const groups = new Map();
  for (const rel of files) {
    const parts = rel.split('/');
    let group = '(root)';
    if (parts.length > 1) {
      const depth = parts[0] === 'packages' && parts.length > 2 ? 2 : 1;
      group = `${parts.slice(0, depth).join('/')}/`;
    }
    groups.set(group, (groups.get(group) ?? 0) + 1);
  }

  log(`\n  ${bold('Shipping to botville-app:')} ${files.length} files, ${humanSize(totalBytes)}\n`);
  for (const [group, count] of [...groups].sort()) {
    log(`    ${group.padEnd(34)} ${dim(`${count} file(s)`)}`);
  }
  log(`\n  ${dim('Full list:')}`);
  for (const rel of files) log(dim(`    ${rel}`));
}

/** Step 5: publish. */
function publish(snapshotDir, remote, head) {
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'botville-app-'));
  log(dim(`  clone: ${clone}`));

  try {
    git(['clone', '--branch', TARGET_BRANCH, '--depth', '1', remote, clone], { cwd: os.tmpdir() });
  } catch (err) {
    die(
      `failed to clone ${remote} (branch ${TARGET_BRANCH}).`,
      `${dim(String(err.stderr ?? err.message).trim())}\n\n` +
        'Check: the repo exists, the branch is named main, and git has access\n' +
        '(GitHub login configured, SSH key or token in the keychain).',
    );
  }

  // Full content replacement: delete everything except .git and put the snapshot in.
  for (const entry of fs.readdirSync(clone)) {
    if (entry === '.git') continue;
    fs.rmSync(path.join(clone, entry), { recursive: true, force: true });
  }
  for (const entry of fs.readdirSync(snapshotDir)) {
    fs.cpSync(path.join(snapshotDir, entry), path.join(clone, entry), { recursive: true });
  }

  git(['add', '--all'], { cwd: clone });
  const staged = git(['status', '--porcelain'], { cwd: clone });
  if (!staged) {
    log(`  ${green('✓')} botville-app already has exactly this code — nothing to deploy.`);
    log(dim('    (No Railway rebuild needed; if prod is still stale — see the runbook.)'));
    return { pushed: false, clone };
  }

  log(`  changes vs GitHub: ${bold(String(staged.split('\n').length))} file(s)`);
  const message = `deploy: server snapshot from the working folder (${head.headShort})\n\nSource: ${head.headSha}\n${head.headSubject}`;
  git(['commit', '-m', message], { cwd: clone });
  git(['push', 'origin', TARGET_BRANCH], { cwd: clone });

  log(`  ${green('✓')} pushed to ${TARGET_BRANCH} — Railway will start the build on its own.`);
  return { pushed: true, clone };
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(bold('\nBotVille — server deploy to botville-app (Railway push-to-deploy)'));
  if (DRY_RUN) log(yellow('--dry-run MODE: the snapshot will be built, but NOTHING will go to GitHub.'));

  const remote = resolveRemote();
  if (!remote && !DRY_RUN) {
    die(
      'the botville-app repository address is not set.',
      'Set it once (it will be remembered):\n\n' +
        `  ${bold('npm run deploy:server -- --remote=git@github.com:<owner>/botville-app.git')}\n\n` +
        'The address is on the repo page on GitHub → green Code button → SSH/HTTPS.',
    );
  }

  const tmpDirs = [];
  try {
    step(1, 'Building a snapshot of the current code');
    const head = buildSnapshot();
    tmpDirs.push(head.dir);

    step(2, 'Cutting out assets, secrets and docs');
    pruneSnapshot(head.dir);

    step(3, 'Verifying the snapshot (safety-gate)');
    const files = verifySnapshot(head.dir);

    step(4, 'Preview');
    printPreview(head.dir, files);

    if (DRY_RUN) {
      log(`\n${green('✓ Dry run finished.')} The snapshot is here:\n  ${head.dir}`);
      log(dim('  (the folder was not deleted so it can be inspected by eye)'));
      tmpDirs.length = 0; // don't clean up — let them take a look
      return;
    }

    log(`\n  ${bold('Destination:')} ${remote} → branch ${TARGET_BRANCH}`);
    if (!ASSUME_YES) {
      const ok = await confirm(`\n${bold('Push?')} [y/N] `);
      if (!ok) {
        log('\nCancelled. Nothing was sent.');
        return;
      }
    }

    step(5, 'Publishing to GitHub');
    const { clone, pushed } = publish(head.dir, remote, head);
    tmpDirs.push(clone);

    if (pushed) {
      log(`\n${green('Done.')} Next: Railway → project → Deployments → a new build should appear.`);
      log(dim('The post-build verification checklist is in docs/DEPLOY-SERVER.md.'));
    } else {
      log(`\n${green('Done.')} Nothing was sent — GitHub already has the up-to-date code.`);
    }
  } finally {
    if (!KEEP_TMP) for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    else if (tmpDirs.length) log(dim(`\nTemporary folders kept: ${tmpDirs.join(', ')}`));
  }
}

await main();
