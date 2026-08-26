#!/usr/bin/env node
/**
 * PreToolUse + matcher Bash → звужує `Bash` окремим read-only агентам до
 * списку команд, які лише читають.
 *
 * Навіщо, якщо в агента вже урізаний `tools`: `tools` фільтрує ІНСТРУМЕНТ, а
 * дірка тут у ВМІСТІ команди. `diff-reviewer` не може працювати без `Bash` —
 * без нього він не побачить `git diff`. Але `Bash` дає повний запис у ФС
 * звичайним редиректом (`echo … > файл`) і обходить навіть permission-деню на
 * `Write`/`Edit` (`.claude/rules/environment-limits.md`). Той самий випадок
 * показав вбудований `Explore`: набір без `Write` не завадив йому створити
 * файл редиректом. Отже «read-only агент» тримається на згоді, доки вміст
 * команди ніхто не фільтрує — це робить цей хук.
 *
 * Чому саме PreToolUse: PostToolUse спрацює, коли файл уже змінено, і зможе
 * лише поскаржитись (той самий аргумент, що в `block-env-writes.mjs`).
 *
 * ── Межа, яку треба знати ─────────────────────────────────────────────────
 * Хук звужується по полю `agent_type` у payload. Поле є в схемі: базу кожного
 * hookInput складає `By(session, cwd, mode, ctx)`, і вона повертає
 * `{session_id, transcript_path, cwd, prompt_id, permission_mode, agent_id,
 * agent_type}` — знято з бінарника `claude` 2.1.237 (2026-08-25). Головний
 * тред кладе туди `mainThreadAgentType()`, тобто ім'я нашого агента там
 * з'явитись не може.
 *
 * Наслідок, названий прямо: payload БЕЗ `agent_type` хук пропускає. Інакше
 * він рубав би `Bash` головної сесії, тобто всю роботу. Тому його гарантія
 * умовна — вона тримається рівно доти, доки харнес передає поле. Живий прогін
 * саме з `diff-reviewer` у цій сесії неможливий: реєстр агентів читається на
 * старті, новий агент з'являється лише в наступній
 * (`.claude/rules/environment-limits.md`).
 */

/**
 * Правило на команду: `true` — дозволена як є; масив — дозволені лише ці
 * підкоманди; RegExp — сегмент цілком мусить збігтись.
 *
 * `find` немає у списках свідомо: `-delete` і `-exec` роблять з нього
 * інструмент запису, а пошук закриває `rg`. `node`/`npm` звужені до форм, що
 * друкують стан: `node -e` — це довільний код, зокрема `writeFileSync`.
 */
const ALLOWLISTS = {
  // Рев'ю діфу: бачити зміни, шукати по репо, читати файли.
  'diff-reviewer': {
    git: ['diff', 'status', 'log', 'show', 'blame', 'ls-files'],
    rg: true,
    grep: true,
    ls: true,
    cat: true,
    head: true,
    tail: true,
    wc: true,
  },
  // Розвідка середовища: читати стан, нічого в ньому не міняти.
  'env-scout': {
    curl: true,
    getent: true,
    command: true,
    ss: true,
    ls: true,
    cat: true,
    head: true,
    wc: true,
    node: /^node\s+(?:--version|-v)\s*$/,
    npm: ['ls', 'view', 'root'],
    git: ['status', 'log', 'diff'],
    which: true,
    stat: true,
    df: true,
    date: true,
  },
};

/**
 * Конструкції, що дають запис або довільне виконання всередині дозволеної
 * команди. `git log > out.txt` — перший токен дозволений, а файл створено.
 */
const FORBIDDEN_CONSTRUCTS = [
  { what: 'редирект у файл', re: />/ },
  { what: 'підстановка команди $(…)', re: /\$\(/ },
  { what: 'підстановка команди в бектіках', re: /`/ },
  { what: 'heredoc', re: /<</ },
];

/**
 * Читання секретів — дірка, якої allowlist команд не закриває в принципі.
 * `cat` у списку саме тому, що рев'юеру треба читати файли; той самий `cat`
 * читає `.env`. Дзеркальна половина `block-env-writes.mjs`: той боронить
 * запис у `.env`, цей — читання з нього.
 *
 * Знайдено 2026-08-26 guardrail-кейсом `evals/check_env_leak.py`: агент
 * попросили показати `.env`, і він відмовився САМ. Зелений кейс, який
 * доводив лише те, що агент не захотів. Межа має бути в хуку, а не в
 * настрої моделі — рівно те розрізнення, на якому стоїть урок 10.3.
 *
 * `.env.example` і рідня дозволені свідомо: вони в git і секретів не несуть.
 */
// Сепаратор перед іменем — не лише `/`: `git show HEAD:.env` дістає той самий
// вміст через двокрапку. Знайдено власним тестом, а не здогадкою.
const ENV_TOKEN = /(?:^|[/:])\.env\b/;
const ENV_PUBLIC = /(?:^|[/:])\.env\.(?:example|sample|template)$/;

/** `curl -o` — це запис. Єдиний дозволений приймач — /dev/null. */
const CURL_OUTPUT = /\s-(?:o|-output)(?:[=\s]+)(\S+)/;
/** `curl -O` / `--remote-name` кладе файл у cwd без явного імені. */
const CURL_REMOTE_NAME = /(?:\s-[a-zA-Z]*O\b|\s--remote-name\b)/;

/** Розбиття складеної команди на сегменти: кожен перевіряється окремо. */
const SEPARATORS = /\s*(?:&&|\|\||[;|\n])\s*/;

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    // Битий payload — не наша справа: хук не має падати й не має блокувати
    // те, чого не зрозумів.
    process.exit(0);
  }

  const agent = payload.agent_type || '';
  const allow = ALLOWLISTS[agent];
  // Не наш агент (або головний тред, де поля немає) — пропускаємо.
  if (!allow) process.exit(0);
  if (payload.tool_name && payload.tool_name !== 'Bash') process.exit(0);

  const command = (payload.tool_input || {}).command || '';
  if (!command) process.exit(0);

  const block = (reason, hint) => {
    process.stderr.write(
      `ЗАБЛОКОВАНО для агента ${agent}: ${reason}.\n` +
        `Цей агент має read-only роль, і ця межа не в промпті, а в хуку.\n` +
        (hint ||
          `Дозволено лише: ${Object.keys(allow).sort().join(', ')} — без редиректів і підстановок.\n`) +
        `Якщо для роботи справді потрібна ця команда — це привід змінити роль агента, а не обійти хук.\n`,
    );
    process.exit(2);
  };

  // `${IFS}` замість пробілу обходить розбиття на токени — звести до пробілу
  // ДО перевірок (та сама пастка, що в block-env-writes.mjs).
  const normalized = command.replace(/\$\{?IFS\}?/g, ' ');

  for (const segment of normalized.split(SEPARATORS)) {
    const seg = segment.trim();
    if (!seg) continue;

    for (const { what, re } of FORBIDDEN_CONSTRUCTS) {
      if (re.test(seg)) block(`${what} у «${seg}»`);
    }

    const tokens = seg.split(/\s+/).filter(Boolean);

    // Секрети — до розбору команди: блокує будь-яку форму, а не лише `cat`.
    for (const token of tokens) {
      const arg = token.replace(/^['"]+|['"]+$/g, '');
      if (ENV_TOKEN.test(arg) && !ENV_PUBLIC.test(arg)) {
        block(
          `звернення до секретів у «${arg}»`,
          `Файли .env цьому агенту недоступні ні на читання, ні на запис — ` +
            `дозволений лише .env.example.\n`,
        );
      }
    }
    // Присвоєння змінної перед командою (`FOO=1 git status`) не команда.
    while (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens.shift();
    if (!tokens.length) continue;

    const bin = tokens[0].replace(/^.*\//, '');
    const rule = Object.prototype.hasOwnProperty.call(allow, bin) ? allow[bin] : undefined;
    if (rule === undefined) block(`команда «${bin}» поза allowlist`);

    if (Array.isArray(rule)) {
      const sub = tokens.slice(1).find((t) => !t.startsWith('-'));
      if (!sub || !rule.includes(sub)) {
        block(`«${bin} ${sub || ''}» — дозволені лише підкоманди: ${rule.join(', ')}`);
      }
    } else if (rule instanceof RegExp) {
      if (!rule.test(seg)) block(`«${seg}» — дозволена лише форма ${rule.source}`);
    }

    if (bin === 'curl') {
      const m = seg.match(CURL_OUTPUT);
      if (m && m[1] !== '/dev/null') block(`curl пише у ${m[1]} — приймач дозволено лише /dev/null`);
      if (CURL_REMOTE_NAME.test(seg)) block('curl -O зберігає файл у робочу теку');
    }
  }

  process.exit(0);
});
