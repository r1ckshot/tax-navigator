#!/usr/bin/env node
/**
 * PreToolUse + matcher Bash — гейт на git-операції перед комітом.
 *
 * Замінює інлайн `npm test` у settings.json. Чеки ловлять проблему ДО коміту, не
 * після: стейджинг `.env*` (`git add -f .env` обходив і deny-правила, і
 * `block-env-writes` — той дивиться на запис у файл, не на індекс), гілка
 * (правило "у master напряму не комітимо" протекло 2026-08-04 — вісім файлів
 * були застейджені просто в master), кирилиця в message (правило CLAUDE.md
 * "коміти англійською" протекло в subject 2026-07-31), трейлер атрибуції і
 * `npm test` + `npm run verify` (той самий клас, що й check-docs.mjs, лишень
 * рівнем раніше).
 *
 * Порядок чеків = від найдешевшого: усі, крім останніх двох, відповідають
 * миттєво, тож на заблокованому коміті не витрачається півхвилини на тести.
 * Стейджинг стоїть найпершим ще й тому, що він єдиний спрацьовує не на
 * `git commit`, а на `git add`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Записи ПРО роботу, не сама робота. Спільні для 5-го і 6-го чеків. */
const RECORDS = [
  /^docs\/STATE\.md$/,
  /^docs\/BACKLOG\.md$/,
  /^docs\/JOURNAL\.md$/,
  /^docs\/DECISIONS\.md$/,
  /^docs\/capstones\//,
  /^README\.md$/,
  /^CHANGELOG\.md$/,
];

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let command = '';
  try {
    command = (JSON.parse(raw || '{}').tool_input || {}).command || '';
  } catch {
    process.exit(0);
  }
  if (!command) process.exit(0);

  // Власний гейт замість покладання на `if: Bash(git commit*)` у settings.json:
  // поле `if` фактично не фільтрує — хук отримував КОЖНУ Bash-команду і ганяв на
  // ній повний `npm test` + `verify`, а кирилиця в будь-якому echo читалась як
  // кирилиця в commit message. Перевірено 2026-08-03 живими викликами.
  const invocations = gitInvocations(command);

  const staging = envStaging(invocations);
  if (staging) {
    deny(
      staging.wildcard
        ? `\`git add ${staging.target}\` із --force — форс знімає .gitignore, а під ним лежать ` +
            '.env, .env.local і решта секретів (CLAUDE.md, розділ Git).\n' +
            'Стейджити файли за іменем: git add <шлях> без -f.'
        : `Стейджинг \`${staging.target}\` — .env ніколи в git, тільки .env.example ` +
            '(CLAUDE.md, розділ Git).\n' +
            'Якщо треба показати змінну — додай її в .env.example без значення.'
    );
    return;
  }

  const ceremony = recordOnlyBranch(command, invocations);
  if (ceremony) {
    deny(
      `Гілка \`${ceremony.branch}\` не містить нічого, крім записів: ${ceremony.files.join(', ')}.\n` +
        'CLAUDE.md, розділ Pull requests: один PR на робочий шматок, не на знахідку. ' +
        'STATE.md, BACKLOG.md, JOURNAL.md, DECISIONS.md і здача — це записи ПРО шматок, ' +
        'вони їдуть у його ж PR.\n' +
        'Шматок уже злитий — правка лишається в робочому дереві до наступного, ' +
        'а не отримує власну гілку.'
    );
    return;
  }

  const second = secondPrForSameChunk(command);
  if (second) {
    deny(
      `Ця гілка чіпає файли, які щойно поїхали в master іншим PR (${second.subject}): ` +
        `${second.shared.join(', ')}.\n` +
        'CLAUDE.md, розділ Pull requests: один PR на робочий шматок, не на знахідку — ' +
        'гілка живе, поки шматок не закінчено, і merge один раз, наприкінці.\n' +
        'Якщо це продовження того шматка — його не слід було мержити; правка лишається ' +
        'в дереві до наступного шматка.\n' +
        'Якщо це справді новий шматок — перетин випадковий, і виняток дописується ' +
        'у comparable() у .claude/hooks/pre-commit-gate.mjs.'
    );
    return;
  }

  const commit = invocations.find((i) => i.sub === 'commit');
  if (!commit) process.exit(0);

  // Каталог, у якому коміт справді відбудеться. Хук завжди стартує в корені
  // сесії (/workspace), а з М9 коміти йдуть із worktree — і гейт бачив гілку
  // кореня (master) замість гілки worktree, тобто відмовляв КОЖНОМУ комітові
  // з worktree і при цьому ганяв тести не на тому дереві.
  const dir = commit.dir;
  const branch = currentBranch(dir);
  if (branch === 'master' || branch === 'main') {
    deny(
      `Коміт напряму в \`${branch}\` — CLAUDE.md, розділ Git: гілка на фічу, ` +
        'у master тільки merge після підтвердження Mike.\n' +
        'Застейджене нікуди не дінеться: git checkout -b <type>/<slug> і комітити там.'
    );
    return;
  }

  const CYRILLIC = /[Ѐ-ӿ]/;
  if (CYRILLIC.test(command)) {
    deny('Кирилиця в git commit — коміти строго англійською (CLAUDE.md, розділ Git).');
    return;
  }

  // Трейлер атрибуції. Ключ `attribution` у settings.json цього НЕ гарантує: він
  // лише кладе інструкцію в контекст, а інструкцію можна проґавити — 2026-08-05
  // два коміти пішли без трейлера саме так. Перевіряється сам ФАКТ трейлера, не
  // імʼя моделі: Mike перемикає Opus/Sonnet/Fable під задачу, і дефолтний текст
  // щоразу інший.
  if (messageIsInCommand(command) && !/Co-Authored-By:\s*\S+.*@anthropic\.com/i.test(command)) {
    deny(
      'Коміт без трейлера Co-Authored-By — CLAUDE.md, розділ Git.\n' +
        'Дописати останнім рядком тіла: Co-Authored-By: Claude <модель> <noreply@anthropic.com>'
    );
    return;
  }

  const test = spawnSync('npm', ['test', '--silent'], { encoding: 'utf8', cwd: dir });
  if (test.status !== 0) {
    deny(`npm test впав — коміт заблоковано.\n${tail(test.stdout + test.stderr)}`);
    return;
  }

  const verify = spawnSync('npm', ['run', 'verify', '--silent'], { encoding: 'utf8', cwd: dir });
  if (verify.status !== 0) {
    deny(`npm run verify впав — коміт заблоковано.\n${tail(verify.stdout + verify.stderr)}`);
    return;
  }

  process.exit(0);
});

/**
 * П'ятий чек: церемонія навколо записів.
 *
 * Патерн, який ловимо, тримався весь M9 і M10 і не піддався ні правилу в
 * CLAUDE.md, ні памʼятці: шматок роботи зливається, а `STATE.md`/`BACKLOG.md`,
 * знахідка чи здача їдуть слідом ОКРЕМОЮ гілкою й окремим PR. За шість днів так
 * вийшло дев'ять docs-only PR (#13, #16, #17, #24, #28, #31, #32, #33, #42).
 * Правило вже було написане — механічної перевірки не було, тож і не діяло; той
 * самий висновок, що з трейлером атрибуції (`attribution` у settings.json нічого
 * не гарантує, гарантує хук).
 *
 * Межа проходить по ТИПУ файлів, не по теці. `docs/features/<slug>/PRD.md` —
 * самостійна робота (SDLC-стадія), її docs-only гілка законна. `STATE.md`,
 * `BACKLOG.md`, `JOURNAL.md`, `DECISIONS.md`, `capstones/`, `README`,
 * `CHANGELOG` — записи ПРО роботу, вони належать її ж PR.
 *
 * Коміт із записами ВСЕРЕДИНІ гілки шматка проходить: там уже лежить справжня
 * робота, тобто це фінальний коміт того самого PR, а не другий PR.
 */
function recordOnlyBranch(command, invocations) {
  const isPrCreate = /\bgh\s+pr\s+create\b/.test(command);
  const commit = invocations.find((i) => i.sub === 'commit');
  if (!isPrCreate && !commit) return null;

  const dir = commit ? commit.dir : process.cwd();
  const branch = currentBranch(dir);
  if (!branch || branch === 'master' || branch === 'main') return null;

  const git = (args) => {
    const r = spawnSync('git', args, { encoding: 'utf8', cwd: dir });
    return r.status === 0 ? r.stdout.trim() : null;
  };
  const base = git(['rev-parse', '--verify', '--quiet', 'origin/master']) ? 'origin/master' : 'master';
  if (!git(['rev-parse', '--verify', '--quiet', base])) return null;

  const onBranch = (git(['diff', '--name-only', `${base}...HEAD`]) || '').split('\n').filter(Boolean);
  const staged = commit ? (git(['diff', '--cached', '--name-only']) || '').split('\n').filter(Boolean) : [];
  const files = [...new Set([...onBranch, ...staged])];
  if (!files.length) return null;

  if (!files.every((f) => RECORDS.some((re) => re.test(f)))) return null;

  return { branch, files };
}

/**
 * Шостий чек: другий PR на той самий шматок.
 *
 * CLAUDE.md, розділ Pull requests, каже прямо: «Один PR на робочий шматок, не на
 * знахідку… Merge один раз, наприкінці». Правило протекло 2026-08-22 (три гілки
 * за сесію) і ще раз 2026-09-16 (три PR на урок 11.6) — тобто текст його не
 * тримає, рівно як не тримав трейлер атрибуції.
 *
 * Механічний слід у того, що шматок продовжується: гілка чіпає файл, який щойно
 * поїхав у master ІНШИМ PR. Свіжий шматок так робить рідко — а от «забув
 * дописати» повертається саме в той самий файл.
 *
 * Два звуження, обидва зняті з реальної історії репо, не вгадані:
 *  - вікно 6 годин. #66 чіпав ті самі файли, що #64, але через 19 годин — це
 *    новий шматок, і ширше вікно дало б хибне спрацювання;
 *  - файли-записи й карта архітектури не рахуються: їх чіпає майже кожен PR,
 *    тож на них перетин означав би лише «сьогодні вже щось зливали».
 * На 11 мержах за три дні: три спрацювання (#68, #70, #58), жодного хибного.
 *
 * Спрацювало хибно — розширювати список винятків нижче, а не знімати чек. Той
 * самий шлях, що з винятком пісочниць у `scripts/check-anchors.mjs`.
 */
function secondPrForSameChunk(command) {
  if (!/\bgh\s+pr\s+create\b/.test(command)) return null;

  const dir = process.cwd();
  const git = (args) => {
    const r = spawnSync('git', args, { encoding: 'utf8', cwd: dir });
    return r.status === 0 ? r.stdout.trim() : null;
  };
  const base = git(['rev-parse', '--verify', '--quiet', 'origin/master']) ? 'origin/master' : 'master';
  if (!git(['rev-parse', '--verify', '--quiet', base])) return null;

  const mine = comparable((git(['diff', '--name-only', `${base}...HEAD`]) || '').split('\n'));
  if (!mine.length) return null;

  const merges = (git(['log', base, '--merges', '--since=6 hours ago', '--format=%H']) || '')
    .split('\n')
    .filter(Boolean);

  for (const sha of merges) {
    const theirs = comparable((git(['diff', '--name-only', `${sha}^1`, sha]) || '').split('\n'));
    const shared = mine.filter((f) => theirs.includes(f));
    if (shared.length) return { subject: git(['log', '-1', '--format=%s', sha]) || sha, shared };
  }
  return null;
}

/**
 * Файли, на яких перетин щось означає: без записів, без КАРТ і без точки входу пайплайна.
 *
 * Карта — документ, який описує репо цілком, тож її чіпає майже кожен шматок, і
 * перетин по ній означає лише «сьогодні вже щось зливали». `TEAM-CONTOUR.md`
 * потрапив сюди на власному прикладі: гілка, що додала цей-таки 6-й чек, була
 * ним же й заблокована — карта оновлювалась тому, що документує сам хук.
 *
 * Ціна названа, а не схована: випадок #68 (2026-09-16) після цього винятку
 * проходив би, бо карта була єдиним його файлом.
 */
function comparable(files) {
  const MAPS = [
    /^docs\/architecture-map\.md$/,
    /^docs\/architecture-map\.anchors\.json$/,
    /^docs\/TEAM-CONTOUR\.md$/,
    // Точка входу лінійного пайплайна: кожна story S-1…S-4 реєструє в ній свій
    // модуль, тож наступна story за мерж попередньої чіпає її неминуче.
    // Знайдено на S-4 (2026-09-16), що дописала команду `report` за годину після S-3.
    /^research\/tg-assistant\/main\.ts$/,
  ];
  const IGNORED = [...RECORDS, ...MAPS];
  return files.filter(Boolean).filter((f) => !IGNORED.some((re) => re.test(f)));
}

/**
 * Усі git-виклики в команді: `{ sub, args }` на кожен сегмент шелла. Регексом це
 * не робиться надійно: між `git` і підкомандою стоять глобальні опції, і частина
 * з них має ОКРЕМИМ токеном значення (`git -c user.name=x commit`). Тому — розбір
 * токенів: пропускаємо прапорці, перший непрапорцевий токен і є підкоманда. Так
 * `git commit-tree` і `grep commit` лишаються поза гейтом, а `npm test && git
 * commit -m …` — усередині.
 *
 * Збирається САМЕ список, а не перше влучання: попередня версія віддавала вердикт
 * по першому ж git-сегменті й на `git log --oneline && git commit -m …` казала
 * "це не коміт" — гейт мовчки пропускав усе, що йшло другою git-командою.
 */
function gitInvocations(command) {
  const OPTIONS_WITH_VALUE = new Set(['-c', '-C', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
  const found = [];
  // Каталог, у якому опиниться git: `cd <dir> &&` тягнеться на наступні
  // сегменти, `git -C <dir>` діє лише на свій виклик. Без цього гейт судив про
  // гілку й ганяв тести в корені сесії, хоч коміт ішов у worktree.
  let chdir = null;

  for (const segment of command.split(/&&|\|\||;|\||\n/)) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);

    if (tokens[0] === 'cd' && tokens[1] && !tokens[1].startsWith('-')) {
      chdir = unquote(tokens[1]);
      continue;
    }

    const gitAt = tokens.findIndex((t) => t === 'git' || t.endsWith('/git'));
    if (gitAt === -1) continue;

    let dir = chdir;
    for (let i = gitAt + 1; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token.startsWith('-')) {
        found.push({ sub: token, args: tokens.slice(i + 1), dir: resolveDir(dir) });
        break;
      }
      if (token === '-C' && tokens[i + 1]) dir = unquote(tokens[i + 1]);
      if (OPTIONS_WITH_VALUE.has(token)) i++;
    }
  }
  return found;
}

function unquote(token) {
  return token.replace(/^['"]|['"]$/g, '');
}

/**
 * Каталог із команди — лише якщо він справді існує. Неіснуючий шлях означає, що
 * розбір промахнувся (змінна, підстановка шелла); тоді чесніше судити по кореню
 * сесії, ніж мовчки пропустити коміт, бо `git rev-parse` не мав де відпрацювати.
 */
function resolveDir(dir) {
  if (!dir) return process.cwd();
  const resolved = resolve(process.cwd(), dir);
  return existsSync(resolved) ? resolved : process.cwd();
}

/**
 * Спроба застейджити секрет. Два різні вектори, обидва повз наявні запобіжники:
 * пряме `git add .env` (deny-правила в settings.json дивляться на Read/Edit, а
 * `block-env-writes` — на запис у файл; індекс не бачить ні той, ні той) і
 * `git add -f .` — форс знімає `.gitignore`, тож `.env` їде разом з усім каталогом,
 * жодного разу не названий у команді.
 *
 * `.env.example` лишається дозволеним: він у git за задумом, на нього спирається
 * onboarding — і саме на ньому ламається наївний патерн `*.env*`.
 */
function envStaging(invocations) {
  const ENV_TARGET = /^(?:[^/]*\/)*\.env(?:\.[A-Za-z0-9_-]+)*$/;
  const IS_TEMPLATE = /\.(example|sample|template|dist)$/;
  const FORCE = /^(?:-f|--force)$/;
  // Цілі, що розкриваються в набір файлів: під форсом кожна тягне ігнороване.
  const WILDCARD = /^(?:\.|\.\/|\*|-A|--all|(?:[^\s]*\/)?\*)$/;

  for (const { sub, args } of invocations) {
    if (sub !== 'add' && sub !== 'stage') continue;

    const forced = args.some((a) => FORCE.test(a));
    for (const arg of args) {
      const target = arg.replace(/^['"]|['"]$/g, '');
      if (ENV_TARGET.test(target) && !IS_TEMPLATE.test(target)) return { target, forced };
      if (forced && WILDCARD.test(target)) return { target, forced, wildcard: true };
    }
  }
  return null;
}

/**
 * Чи видно текст повідомлення прямо в команді. `git commit` без прапорця відкриває
 * редактор, `--amend --no-edit` і `-C HEAD` переносять старе повідомлення — у всіх
 * трьох трейлера в команді нема ЗА ПОБУДОВОЮ, і блокувати їх означало б ловити не
 * те. Гейт спрацьовує лише там, де повідомлення справді складається зараз.
 */
function messageIsInCommand(command) {
  return /(^|\s)(-m\b|--message\b|-F\s*-|--file[= ]-)/.test(command);
}

/**
 * Гілка, на якій стоїть HEAD. Відірваний HEAD (`rebase`, `cherry-pick`, `bisect`)
 * віддає рядок "HEAD" — і це свідомо НЕ блокується: лінеаризація власної історії
 * перед вливанням у master дозволена (DECISIONS 2026-07-29), а коміти всередині
 * rebase взагалі не проходять через цей хук.
 */
function currentBranch(dir = process.cwd()) {
  const r = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8', cwd: dir });
  if (r.status === 0) return r.stdout.trim();

  // Репо без жодного коміта: `rev-parse` на НЕНАРОДЖЕНІЙ гілці падає, хоча гілка
  // вже названа — `symbolic-ref` її бачить. Без цього запасного шляху найперший
  // коміт у свіжому репо йшов повз гейт саме там, де гейт найпотрібніший.
  // Знайдено не локально, а в CI: там нема user.email, тестова фікстура не змогла
  // створити коміт — і кейс «коміт у master» раптом став зеленим.
  const symbolic = spawnSync('git', ['symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8', cwd: dir });
  return symbolic.status === 0 ? symbolic.stdout.trim() : '';
}

function tail(s, n = 20) {
  return s.trim().split('\n').slice(-n).join('\n');
}

function deny(reason) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}
