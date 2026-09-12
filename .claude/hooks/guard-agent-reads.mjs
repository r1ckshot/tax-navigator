#!/usr/bin/env node
import { readdirSync } from 'node:fs';

/**
 * PreToolUse + matcher `Read|Grep|Glob` → забороняє суб-агентам читати `.env`,
 * а рецензенту чужого матеріалу — ще й `.claude/**`.
 *
 * Навіщо, якщо `readonly-bash.mjs` уже боронить `.env`: той хук дивиться на
 * ВМІСТ команди `Bash`, а `drift-reviewer` має `tools: Read, Grep, Glob` і
 * `Bash` у нього немає взагалі. Тобто дірка тут не в команді, а в інструменті:
 * `Read` з абсолютним шляхом до `.env` не проходить повз жоден наявний хук.
 *
 * ── Чому саме цей агент і саме `.claude/**` ───────────────────────────────
 * `drift-reviewer` — єдиний агент репо, чий ВХІД походить не з репо. Звіт, який
 * він читає, зібрано з чужих сторінок (`scripts/rules-change-monitor/`), і ці
 * сторінки пише не Mike. Тому саме тут прохання в промпті замало: текст, що
 * доїхав до моделі, може містити рівно те прохання, яке скасовує попереднє.
 *
 * `.claude/**` для нього закрито не тому, що там секрети, а тому, що там
 * лежить сам захист: правила агентів, хуки, дозволи. Перепише — послабить
 * власні межі на наступний прогін. Читання тут — перший крок до цього, і
 * рецензенту звіту ця тека не потрібна для роботи взагалі.
 *
 * Інші read-only агенти (`ro-reviewer`, `rules-auditor`, `diff-reviewer`)
 * `.claude/**` читають легітимно: їхня робота — звіряти діф із правилом репо.
 * Забрати в них теку означало б зламати роботу заради симетрії.
 *
 * ── Межа, яку треба знати ─────────────────────────────────────────────────
 * Хук звужується по полю `agent_type`, як `readonly-bash.mjs`. Payload БЕЗ
 * цього поля (головний тред) пропускається: інакше хук рубав би роботу самої
 * сесії. Гарантія умовна рівно доти, доки харнес передає поле.
 */

/** Агенти, яким закрито `.claude/**`. Причина — у шапці, не в симетрії. */
const FOREIGN_INPUT_AGENTS = new Set(['drift-reviewer']);

/**
 * Теки, у яких рецензентові чужого входу дозволено ШУКАТИ. Позитивний список, а
 * не заборонний, і це виправлення реального дефекту: `Grep` з `path` на корінь
 * репо не містить слова `.claude` у payload узагалі, тож перевірка шляхів його
 * не бачила, а ripgrep сканує `.claude/` за замовчуванням (тека не в
 * `.gitignore`). Заборонний список тут програє за конструкцією: він мусить
 * вгадати кожен спосіб НЕ назвати теку, а позитивний вимагає назвати ту, яку
 * дозволено.
 *
 * Перелік дослівно повторює те, що агент читає за своєю роллю
 * (`.claude/agents/drift-reviewer.md` §Що ти читаєш).
 */
const SEARCH_ROOTS = ['scripts/rules-change-monitor', 'app/lib/rules'];

/**
 * Ключі `tool_input`, що несуть ШЛЯХ. `Grep.pattern` свідомо не тут: це текст
 * пошуку, і заборона на нього зробила б хибнопозитив із запиту «знайди згадки
 * .env у коді». `Grep.glob` і `Glob.pattern` — навпаки шлях, тож перевіряються:
 * `Grep(glob: "**\/.env", output_mode: "content")` віддає ті самі рядки, що
 * `Read`, і повз перевірку лише `path` проходив цілком.
 */
const PATH_KEYS = ['file_path', 'path', 'notebook_path', 'glob'];

/** Інструменти, що вміють шукати рекурсивно від теки. */
const SEARCH_TOOLS = new Set(['Grep', 'Glob']);

/** Сепаратор перед іменем не лише `/` — той самий набір, що в readonly-bash.mjs. */
const ENV_TOKEN = /(?:^|[/:])\.env\b/;
const ENV_PUBLIC = /(?:^|[/:])\.env\.(?:example|sample|template)$/;
const CLAUDE_DIR = /(?:^|[/:])\.claude(?:[/:]|$)/;

/**
 * Імена суб-агентів репо — файли `.claude/agents/*.md`. Теки немає або її не
 * прочитати — повертаємо порожній набір, і хук пропускає все: він не має права
 * ні падати, ні блокувати наосліп.
 */
function subAgentNames() {
  try {
    return new Set(
      readdirSync(new URL('../agents/', import.meta.url))
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.slice(0, -3)),
    );
  } catch {
    return new Set();
  }
}

/** Шлях під однією з дозволених тек. Порівняння після нормалізації розділювачів. */
function underSearchRoot(value) {
  const path = value.replace(/\\/g, '/').replace(/^\.\//, '');
  return SEARCH_ROOTS.some((root) => path.includes(root));
}

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    // Битий payload — не наша справа: хук не падає й не блокує незрозуміле.
    process.exit(0);
  }

  const agent = payload.agent_type || '';
  // Гейт по СПИСКУ імен, а не по непорожності поля. Непорожність була
  // припущенням («порожнє = головний тред»), і сусідній `readonly-bash.mjs`
  // документує зворотнє: головний тред кладе туди `mainThreadAgentType()`.
  // При непорожньому значенні хук відібрав би в сесії Mike `Read` на
  // `.env.local`, який наявний deny `Read(**/.env)` не покриває.
  // Список береться з теки агентів, а не дублюється тут: розходження двох
  // копій нічим не ловиться.
  if (!agent || !subAgentNames().has(agent)) process.exit(0);

  const input = payload.tool_input || {};
  const candidates = [];
  for (const key of PATH_KEYS) {
    if (typeof input[key] === 'string' && input[key]) candidates.push(input[key]);
  }
  if (payload.tool_name === 'Glob' && typeof input.pattern === 'string' && input.pattern) {
    candidates.push(input.pattern);
  }

  const block = (target, why) => {
    process.stderr.write(
      `ЗАБЛОКОВАНО для агента ${agent}: читання ${target}.\n` +
        `${why}\n` +
        `Ця межа стоїть у хуку, не в промпті: вхід цього агента приходить ззовні репо, ` +
        `і прохання в промпті скасовується таким самим проханням у вхідних даних.\n`,
    );
    process.exit(2);
  };

  for (const value of candidates) {
    const arg = value.replace(/^['"]+|['"]+$/g, '');
    if (ENV_TOKEN.test(arg) && !ENV_PUBLIC.test(arg)) {
      block(`«${arg}»`, 'Файли .env недоступні жодному суб-агенту; дозволений лише .env.example.');
    }
    if (FOREIGN_INPUT_AGENTS.has(agent) && CLAUDE_DIR.test(arg)) {
      block(
        `«${arg}»`,
        'У .claude/ лежить сам захист — правила агентів, хуки, дозволи. Рецензенту звіту ця тека не потрібна.',
      );
    }
  }

  // Рекурсивний пошук окремо від імен: `Grep(path: "/workspace")` не містить
  // слова `.claude` узагалі, а ripgrep зайде туди сам. Тому для рецензента
  // чужого входу пошук дозволений лише в явно названій теці зі списку.
  if (FOREIGN_INPUT_AGENTS.has(agent) && SEARCH_TOOLS.has(payload.tool_name)) {
    const roots = candidates.filter((c) => !ENV_PUBLIC.test(c));
    if (roots.length === 0 || !roots.every(underSearchRoot)) {
      block(
        'пошуку поза дозволеними теками',
        `Шукати можна лише в явно названій теці: ${SEARCH_ROOTS.join(', ')}. ` +
          'Пошук від кореня репо зайшов би в .claude/ сам, не назвавши її.',
      );
    }
  }

  process.exit(0);
});
