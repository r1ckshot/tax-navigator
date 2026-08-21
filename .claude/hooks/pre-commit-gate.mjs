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

  if (!invocations.some((i) => i.sub === 'commit')) process.exit(0);

  const branch = currentBranch();
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

  const test = spawnSync('npm', ['test', '--silent'], { encoding: 'utf8' });
  if (test.status !== 0) {
    deny(`npm test впав — коміт заблоковано.\n${tail(test.stdout + test.stderr)}`);
    return;
  }

  const verify = spawnSync('npm', ['run', 'verify', '--silent'], { encoding: 'utf8' });
  if (verify.status !== 0) {
    deny(`npm run verify впав — коміт заблоковано.\n${tail(verify.stdout + verify.stderr)}`);
    return;
  }

  process.exit(0);
});

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

  for (const segment of command.split(/&&|\|\||;|\||\n/)) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    const gitAt = tokens.findIndex((t) => t === 'git' || t.endsWith('/git'));
    if (gitAt === -1) continue;

    for (let i = gitAt + 1; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token.startsWith('-')) {
        found.push({ sub: token, args: tokens.slice(i + 1) });
        break;
      }
      if (OPTIONS_WITH_VALUE.has(token)) i++;
    }
  }
  return found;
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
function currentBranch() {
  const r = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' });
  if (r.status === 0) return r.stdout.trim();

  // Репо без жодного коміта: `rev-parse` на НЕНАРОДЖЕНІЙ гілці падає, хоча гілка
  // вже названа — `symbolic-ref` її бачить. Без цього запасного шляху найперший
  // коміт у свіжому репо йшов повз гейт саме там, де гейт найпотрібніший.
  // Знайдено не локально, а в CI: там нема user.email, тестова фікстура не змогла
  // створити коміт — і кейс «коміт у master» раптом став зеленим.
  const symbolic = spawnSync('git', ['symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8' });
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
