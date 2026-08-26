#!/usr/bin/env node
/**
 * TaskCompleted → ворота на закриття задачі тіммейтом (Agent Teams, 10.4).
 *
 * Навіщо: у команді пірів лід не читає роботу кожного тіммейта — тіммейт сам
 * знімає задачу зі спільного списку і сам оголошує її закритою. Оголошення —
 * це текст. Головна знахідка 10.3 саме про це: перевірка, яку виконавець може
 * задовольнити власною згодою, не доводить нічого. Тому гейт дивиться на СТАН
 * репо (git + прогін тестів володіння), а не на слова в задачі.
 *
 * Три перевірки, усі проти `.claude/team-plan.json`:
 *   1. Тема задачі мусить лягти рівно на один запис плану. Немає збігу або їх
 *      два — закриття не відбувається. Fail-closed навмисне: інакше тіммейт
 *      обходив би ворота, назвавши задачу довільно.
 *   2. Територія. Жоден брудний шлях у репо не сміє лежати поза оголошеними
 *      `owns` і `neutral`; для задачі з `mode: read-only` власна територія
 *      мусить лишитись чистою взагалі.
 *   3. `verify` задачі мусить пройти — саме її, не весь сьют (див. «Ціна»).
 *
 * ── Межа, яку треба знати ────────────────────────────────────────────────
 * Гейт енфорсить ПЛАН, а не авторство. У незакомічених змінах git не тримає
 * автора, тож «хто саме написав цей файл» тут недоступно в принципі: якщо
 * тіммейт A залишив брудним свою територію, а закривається задача B, шлях A
 * пройде — він оголошений. Ловиться інше і головне: запис у територію, якої
 * в плані немає взагалі (`app/components/`, `package.json`, `settings.json`).
 * Точніша атрибуція — це вже окремі worktree на тіммейта (9.2), не хук.
 *
 * ── Ідемпотентність ──────────────────────────────────────────────────────
 * `TaskCompleted` приходить кілька разів на ту саму задачу (у прогоні автора
 * кіта — 12 подій на 4 задачі). Прогін `verify` на кожну подію коштував би
 * повторних хвилин, тому вердикт кешується під ключем «задача + відбиток
 * дерева». Не змінилось дерево — не запускаємо нічого. Змінилось —
 * перевіряємо заново, бо старий PASS уже нічого не доводить.
 *
 * Ціна (заміряно 2026-08-26, wall):
 *   npm test (193) + test:arch  8,3 с   ← весь сьют на кожну подію: ~100 с
 *   npx vitest run app/lib/calc 2,9 с   ← володіння audit-calc
 *   bash .claude/hooks/test-*.sh 15,2 с ← володіння audit-hooks
 *   npm test --prefix mcp/…     25,5 с  ← володіння audit-mcp
 * Весь сьют не покриває ні хуки, ні MCP — тобто дорожчий і вужчий одночасно.
 * Звідси маршрутизація по `task_subject` замість одного гейта на все.
 *
 * Ізольований тест: bash .claude/hooks/test-task-completed-gate.sh
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CWD = process.env.TASK_GATE_CWD || process.cwd();
const PLAN_PATH = process.env.TASK_GATE_PLAN || join(CWD, '.claude', 'team-plan.json');
const CACHE_DIR = process.env.TASK_GATE_CACHE || join(CWD, '.claude', '.cache', 'task-gate');
/** Ліміт на одну команду `verify`: MCP-сьют на 9p іде 25 с, запас — до 5 хв. */
const VERIFY_TIMEOUT_MS = Number(process.env.TASK_GATE_TIMEOUT_MS || 300_000);

/** exit 2 — задача не закривається, stderr стає фідбеком тіммейту. */
function block(lines) {
  process.stderr.write(`ЗАКРИТТЯ ЗАДАЧІ ЗУПИНЕНО\n${lines.join('\n')}\n`);
  process.exit(2);
}

function git(args) {
  return execSync(`git ${args}`, { cwd: CWD, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/**
 * Брудні шляхи через `--porcelain -z -uall`: `-z` знімає питання екранування
 * імен (`core.quotepath`), `-uall` розгортає нову теку до окремих файлів —
 * інакше `app/components/` виглядав би одним записом і сховав би вміст.
 */
function dirtyPaths() {
  const raw = git('status --porcelain=v1 -z -uall');
  const records = raw.split('\0').filter(Boolean);
  const paths = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const status = record.slice(0, 2);
    paths.push(record.slice(3));
    // Rename/copy: слідом окремим записом іде шлях-джерело, і він теж змінений.
    if (status.includes('R') || status.includes('C')) {
      i += 1;
      if (records[i]) paths.push(records[i]);
    }
  }
  return paths;
}

const under = (path, prefixes) =>
  prefixes.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p || path.startsWith(`${p}/`)));

/**
 * Відбиток дерева для кешу: HEAD + повний список брудних шляхів + діф проти
 * HEAD + вміст untracked-файлів у межах оголошених територій. Untracked окремо
 * тому, що `git diff` їх не бачить — рівно та пастка, через яку read-only
 * рев'юер із `src/hotfix.js` пройшов би повз diff-тест (10.3).
 */
function treeFingerprint(declared, dirty) {
  const h = createHash('sha256');
  h.update(git('rev-parse HEAD').trim());
  h.update(dirty.join('\n'));
  h.update(git('diff HEAD'));
  for (const p of dirty) {
    if (!under(p, declared)) continue;
    const abs = resolve(CWD, p);
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (!st.isFile()) continue;
    h.update(p);
    h.update(st.size > 1_000_000 ? `${st.size}:${st.mtimeMs}` : readFileSync(abs));
  }
  return h.digest('hex');
}

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    // Битий payload — не привід валити чужу роботу (той самий вибір, що в
    // readonly-bash.mjs): хук не блокує того, чого не зрозумів.
    process.exit(0);
  }

  if (payload.hook_event_name && payload.hook_event_name !== 'TaskCompleted') process.exit(0);
  // Порожній payload — це не подія закриття задачі, а виклик ні про що.
  // Реальний `TaskCompleted` завжди несе `task_id` і `task_subject` (обидва
  // обов'язкові в схемі харнесу), тож fail-closed нижче стосується лише
  // справжніх подій — не порожнього stdin у тесті чи в чужому конвеєрі.
  if (!payload.hook_event_name && !payload.task_id && !payload.task_subject) process.exit(0);

  const subject = payload.task_subject || '';
  const taskId = String(payload.task_id || 'unknown');
  const who = payload.teammate_name ? ` (${payload.teammate_name})` : '';

  let plan;
  try {
    plan = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
  } catch (e) {
    block([
      `План команди не читається: ${PLAN_PATH}`,
      `${e.message}`,
      'Без плану ворота не знають меж володіння, тому задача лишається відкритою.',
    ]);
  }

  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const matched = tasks.filter((t) => new RegExp(t.subject_match, 'i').test(subject));
  if (matched.length !== 1) {
    block([
      matched.length === 0
        ? `Тема «${subject}» не лягає на жодну задачу плану${who}.`
        : `Тема «${subject}» лягає одразу на ${matched.length} задачі: ${matched.map((t) => t.id).join(', ')}.`,
      `Задачі плану: ${tasks.map((t) => `${t.id} (${t.subject_match})`).join(', ')}.`,
      'Перейменуй задачу під одне володіння або допиши план — ворота стоять на плані, не на темі.',
    ]);
  }

  const task = matched[0];
  const owns = task.owns || [];
  const neutral = plan.neutral || [];
  const declared = tasks.flatMap((t) => t.owns || []);
  const dirty = dirtyPaths();

  const foreign = dirty.filter((p) => !under(p, declared) && !under(p, neutral));
  if (foreign.length) {
    block([
      `Змінені файли поза оголошеними територіями${who}:`,
      ...foreign.slice(0, 20).map((p) => `  ${p}`),
      foreign.length > 20 ? `  … ще ${foreign.length - 20}` : '',
      `Задача ${task.id} володіє: ${owns.join(', ')}.`,
      'Або поверни ці файли, або територія має бути в плані до початку роботи.',
    ].filter(Boolean));
  }

  if (task.mode === 'read-only') {
    const written = dirty.filter((p) => under(p, owns));
    if (written.length) {
      block([
        `Задача ${task.id} оголошена read-only, а її територія змінена${who}:`,
        ...written.slice(0, 20).map((p) => `  ${p}`),
        'Рев\'ю не пише. Поверни файли до стану HEAD і закривай задачу знову.',
      ]);
    }
  }

  const verify = task.verify || [];
  if (!verify.length) {
    block([`Задача ${task.id} не має жодної команди verify — закривати нема чим.`]);
  }

  // Кеш: та сама задача на тому самому дереві не платить за verify двічі.
  const fingerprint = treeFingerprint(declared, dirty);
  const cacheFile = join(CACHE_DIR, `${taskId.replace(/[^\w.-]/g, '_')}.json`);
  let cached = null;
  try {
    cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
  } catch {
    cached = null;
  }
  const fires = (cached?.fires || 0) + 1;
  if (cached && cached.fingerprint === fingerprint && cached.verdict === 'pass') {
    try {
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(cacheFile, JSON.stringify({ ...cached, fires, skipped: (cached.skipped || 0) + 1 }, null, 2));
    } catch {
      /* кеш — оптимізація, а не умова проходження */
    }
    process.exit(0);
  }

  for (const cmd of verify) {
    try {
      execSync(cmd, {
        cwd: CWD,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: VERIFY_TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch (e) {
      const out = `${e.stdout || ''}${e.stderr || ''}`.trimEnd().split('\n').slice(-15).join('\n');
      block([
        `Перевірка володіння не пройшла${who}: ${cmd}`,
        out || `${e.message}`,
        `Задача ${task.id} лишається відкритою, поки ця команда червона.`,
      ]);
    }
  }

  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(
      cacheFile,
      JSON.stringify(
        { task: task.id, subject, fingerprint, verdict: 'pass', fires, skipped: cached?.skipped || 0, at: new Date().toISOString() },
        null,
        2,
      ),
    );
  } catch {
    /* див. вище: кеш не умова */
  }
  process.exit(0);
});
