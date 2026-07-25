#!/usr/bin/env node
/**
 * deploy-server.mjs — публикация серверного кода в приватный GitHub-репо
 * `botville-app`, из которого Railway собирает прод (push-to-deploy).
 *
 * Что делает:
 *   1. Собирает чистый снапшот HEAD рабочей папки во временной директории
 *      (`git archive` — то есть только то, что в git; ассетов LimeZu и .env там
 *      нет by design, но мы всё равно проверяем явно).
 *   2. Вырезает из снапшота стратегические доки (весь `docs/`), любые `.env`
 *      (кроме `*.example`) и папки платных ассетов.
 *   3. Прогоняет safety-gate: если в снапшоте остался хоть один запрещённый
 *      файл — падает и НИЧЕГО не пушит.
 *   4. Печатает превью (список файлов + сводка) и ждёт подтверждения.
 *   5. Клонирует `botville-app`, заменяет его содержимое снапшотом, коммитит
 *      и пушит в `main`. Railway подхватывает push-to-deploy сам.
 *
 * Рабочая папка НЕ меняется: вся работа идёт в mkdtemp-директориях, которые
 * удаляются в конце. Повторный запуск без изменений = «нечего деплоить», exit 0.
 *
 * Использование:
 *   node scripts/deploy-server.mjs --dry-run     # собрать и показать, не пушить
 *   node scripts/deploy-server.mjs               # с подтверждением
 *   node scripts/deploy-server.mjs --yes         # без подтверждения (CI)
 *   node scripts/deploy-server.mjs --remote=<url>  # задать/сохранить remote
 *
 * Remote берётся (в порядке приоритета): --remote=<url> → переменная окружения
 * BOTVILLE_APP_REMOTE → файл .deploy-server.json в корне (создаётся первым
 * запуском с --remote и не коммитится).
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

// ─── аргументы ────────────────────────────────────────────────────────────────

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

// ─── вывод ────────────────────────────────────────────────────────────────────

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

const log = (...a) => console.log(...a);
const step = (n, title) => log(`\n${bold(`[${n}]`)} ${bold(title)}`);

function die(message, hint) {
  log(`\n${red('✗ ОСТАНОВЛЕНО')} — ${message}`);
  if (hint) log(`\n${hint}\n`);
  process.exit(1);
}

// ─── правила исключения ───────────────────────────────────────────────────────

/**
 * Пути, которые вырезаются из снапшота. Возвращает причину или null.
 * Работает по posix-путям относительно корня снапшота.
 */
function excludeReason(relPath) {
  const base = path.posix.basename(relPath);

  // Стратегические доки — репо может стать публичным, туда им нельзя.
  if (relPath === 'docs' || relPath.startsWith('docs/')) return 'стратегические доки';

  // Секреты. `*.example` — шаблоны без значений, их оставляем.
  if (/(^|\.)env($|\.)/.test(base) && !base.endsWith('.example')) return 'секрет (.env)';

  // Платные ассеты LimeZu (лицензия запрещает распространение).
  if (relPath === 'assets-src' || relPath.startsWith('assets-src/')) return 'платные ассеты';
  if (/^packages\/[^/]+\/public\/assets\/(tilesets|sprites|ui)\/limezu(\/|$)/.test(relPath)) {
    return 'платные ассеты';
  }

  // Внутренняя кухня разработки.
  if (relPath === '.claude' || relPath.startsWith('.claude/')) return 'внутренние настройки';

  return null;
}

/**
 * Safety-gate: паттерны, которых в готовом снапшоте не должно остаться ВООБЩЕ.
 * Это вторая линия защиты — независимая от excludeReason.
 */
const FORBIDDEN = [
  { label: 'файл .env с секретами', test: (p) => /(^|\/)\.?[^/]*\.env(\.|$)|(^|\/)\.env$/.test(p) && !p.endsWith('.example') },
  { label: 'стратегический док', test: (p) => p.startsWith('docs/') },
  { label: 'скриншот', test: (p) => /\.(png|jpe?g|gif|webm|mp4)$/i.test(p) && !p.startsWith('packages/client/public/hero/') },
  { label: 'платный ассет LimeZu', test: (p) => /limezu/i.test(p) || p.startsWith('assets-src/') },
  { label: 'архив/зип', test: (p) => /\.zip$/i.test(p) },
  { label: 'база данных', test: (p) => /\.db(-shm|-wal)?$/i.test(p) },
];

/** Файлы, без которых Railway не соберёт сервер. */
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

// ─── утилиты ──────────────────────────────────────────────────────────────────

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
    log(dim(`  remote сохранён в ${path.basename(CONFIG_FILE)}`));
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
      'нужно подтверждение, но терминал неинтерактивный.',
      `Запусти с флагом ${bold('--yes')}, если уверен.`,
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return /^(y|yes|д|да)$/i.test(answer.trim());
}

// ─── шаги ─────────────────────────────────────────────────────────────────────

/** Шаг 1: снапшот HEAD во временной папке. */
function buildSnapshot() {
  const headSha = git(['rev-parse', 'HEAD'], { cwd: ROOT });
  const headShort = git(['rev-parse', '--short', 'HEAD'], { cwd: ROOT });
  const headSubject = git(['log', '-1', '--pretty=%s'], { cwd: ROOT });

  const dirty = git(['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT });
  if (dirty) {
    log(yellow('  ⚠ в рабочей папке есть незакоммиченные правки — они НЕ уедут:'));
    for (const line of dirty.split('\n')) log(dim(`     ${line}`));
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'botville-snapshot-'));
  const tarball = path.join(dir, '..', `${path.basename(dir)}.tar`);
  execFileSync('git', ['archive', '--format=tar', '-o', tarball, 'HEAD'], { cwd: ROOT });
  execFileSync('tar', ['-xf', tarball, '-C', dir]);
  fs.rmSync(tarball);

  log(`  HEAD ${bold(headShort)} — ${headSubject}`);
  log(`  снапшот: ${dim(dir)}`);
  return { dir, headSha, headShort, headSubject };
}

/** Шаг 2: вырезать всё, чего в публикуемом снапшоте быть не должно. */
function pruneSnapshot(dir) {
  const removed = [];
  // Идём по всем файлам; директории чистим после (пустые каталоги tar не хранит).
  for (const rel of listFiles(dir)) {
    const reason = excludeReason(rel);
    if (reason) {
      fs.rmSync(path.join(dir, rel));
      removed.push({ rel, reason });
    }
  }
  // Убрать опустевшие каталоги.
  const dropEmpty = (abs) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.isDirectory()) dropEmpty(path.join(abs, entry.name));
    }
    if (abs !== dir && fs.readdirSync(abs).length === 0) fs.rmdirSync(abs);
  };
  dropEmpty(dir);

  const byReason = new Map();
  for (const { reason } of removed) byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
  if (removed.length === 0) log(dim('  нечего вырезать'));
  for (const [reason, count] of byReason) log(`  вырезано ${bold(String(count))} — ${reason}`);
  return removed;
}

/** Шаг 3: safety-gate. Падаем, если хоть что-то запрещённое осталось. */
function verifySnapshot(dir) {
  const files = listFiles(dir);
  const violations = [];
  for (const rel of files) {
    for (const rule of FORBIDDEN) {
      if (rule.test(rel)) violations.push(`${rel}  ${dim(`← ${rule.label}`)}`);
    }
  }
  if (violations.length) {
    log(red('\n  В снапшоте остались запрещённые файлы:'));
    for (const v of violations) log(`    ${v}`);
    die('safety-gate не пройден, ничего не запушено.');
  }

  const missing = REQUIRED.filter((rel) => !files.includes(rel));
  if (missing.length) {
    die(
      `в снапшоте нет файлов, без которых Railway не соберётся: ${missing.join(', ')}`,
      'Похоже, правила исключения задели что-то нужное. Проверь excludeReason() в этом скрипте.',
    );
  }

  for (const rule of FORBIDDEN) log(`  ${green('✓')} нет: ${rule.label}`);
  log(`  ${green('✓')} на месте: ${REQUIRED.length} файлов, нужных сборке`);
  return files;
}

/** Шаг 4: превью для человека. */
function printPreview(dir, files) {
  const totalBytes = files.reduce((sum, rel) => sum + fs.statSync(path.join(dir, rel)).size, 0);

  // Группируем по каталогу: `packages/*` разворачиваем на уровень пакета,
  // остальное — по верхнему каталогу; файлы корня — в «(корень)».
  const groups = new Map();
  for (const rel of files) {
    const parts = rel.split('/');
    let group = '(корень)';
    if (parts.length > 1) {
      const depth = parts[0] === 'packages' && parts.length > 2 ? 2 : 1;
      group = `${parts.slice(0, depth).join('/')}/`;
    }
    groups.set(group, (groups.get(group) ?? 0) + 1);
  }

  log(`\n  ${bold('Уедет в botville-app:')} ${files.length} файлов, ${humanSize(totalBytes)}\n`);
  for (const [group, count] of [...groups].sort()) {
    log(`    ${group.padEnd(34)} ${dim(`${count} файл(ов)`)}`);
  }
  log(`\n  ${dim('Полный список:')}`);
  for (const rel of files) log(dim(`    ${rel}`));
}

/** Шаг 5: публикация. */
function publish(snapshotDir, remote, head) {
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'botville-app-'));
  log(dim(`  клон: ${clone}`));

  try {
    git(['clone', '--branch', TARGET_BRANCH, '--depth', '1', remote, clone], { cwd: os.tmpdir() });
  } catch (err) {
    die(
      `не удалось склонировать ${remote} (ветка ${TARGET_BRANCH}).`,
      `${dim(String(err.stderr ?? err.message).trim())}\n\n` +
        'Проверь: репо существует, ветка называется main, и у git есть доступ\n' +
        '(GitHub-логин настроен, SSH-ключ или token в keychain).',
    );
  }

  // Полная замена содержимого: всё, кроме .git, удаляем и кладём снапшот.
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
    log(`  ${green('✓')} в botville-app уже ровно этот код — деплоить нечего.`);
    log(dim('    (Railway пересобирать не нужно; если прод всё же старый — смотри runbook.)'));
    return { pushed: false, clone };
  }

  log(`  изменений против GitHub: ${bold(String(staged.split('\n').length))} файл(ов)`);
  const message = `deploy: снапшот сервера из рабочей папки (${head.headShort})\n\nИсточник: ${head.headSha}\n${head.headSubject}`;
  git(['commit', '-m', message], { cwd: clone });
  git(['push', 'origin', TARGET_BRANCH], { cwd: clone });

  log(`  ${green('✓')} запушено в ${TARGET_BRANCH} — Railway начнёт сборку сам.`);
  return { pushed: true, clone };
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(bold('\nBotVille — деплой сервера в botville-app (Railway push-to-deploy)'));
  if (DRY_RUN) log(yellow('РЕЖИМ --dry-run: снапшот соберётся, но в GitHub НИЧЕГО не уедет.'));

  const remote = resolveRemote();
  if (!remote && !DRY_RUN) {
    die(
      'не задан адрес репозитория botville-app.',
      'Задай его один раз (потом запомнится):\n\n' +
        `  ${bold('npm run deploy:server -- --remote=git@github.com:<owner>/botville-app.git')}\n\n` +
        'Адрес видно на странице репо на GitHub → зелёная кнопка Code → SSH/HTTPS.',
    );
  }

  const tmpDirs = [];
  try {
    step(1, 'Собираю снапшот текущего кода');
    const head = buildSnapshot();
    tmpDirs.push(head.dir);

    step(2, 'Вырезаю ассеты, секреты и доки');
    pruneSnapshot(head.dir);

    step(3, 'Проверяю снапшот (safety-gate)');
    const files = verifySnapshot(head.dir);

    step(4, 'Превью');
    printPreview(head.dir, files);

    if (DRY_RUN) {
      log(`\n${green('✓ Сухой прогон завершён.')} Снапшот лежит тут:\n  ${head.dir}`);
      log(dim('  (папка не удалена, чтобы её можно было посмотреть глазами)'));
      tmpDirs.length = 0; // не чистим — пусть посмотрят
      return;
    }

    log(`\n  ${bold('Куда:')} ${remote} → ветка ${TARGET_BRANCH}`);
    if (!ASSUME_YES) {
      const ok = await confirm(`\n${bold('Пушим?')} [y/N] `);
      if (!ok) {
        log('\nОтменено. Ничего не отправлено.');
        return;
      }
    }

    step(5, 'Публикую в GitHub');
    const { clone, pushed } = publish(head.dir, remote, head);
    tmpDirs.push(clone);

    if (pushed) {
      log(`\n${green('Готово.')} Дальше: Railway → проект → Deployments → должен появиться новый build.`);
      log(dim('Чеклист проверки после сборки — в docs/DEPLOY-SERVER.md.'));
    } else {
      log(`\n${green('Готово.')} Ничего не отправлено — на GitHub уже актуальный код.`);
    }
  } finally {
    if (!KEEP_TMP) for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    else if (tmpDirs.length) log(dim(`\nВременные папки оставлены: ${tmpDirs.join(', ')}`));
  }
}

await main();
