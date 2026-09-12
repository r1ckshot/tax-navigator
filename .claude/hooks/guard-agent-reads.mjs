#!/usr/bin/env node
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
 * Ключі `tool_input`, що несуть ШЛЯХ. `Grep.pattern` свідомо не тут: це текст
 * пошуку, і заборона на нього зробила б хибнопозитив із запиту «знайди згадки
 * .env у коді». `Glob.pattern` — навпаки шлях, тож перевіряється.
 */
const PATH_KEYS = ['file_path', 'path', 'notebook_path'];

/** Сепаратор перед іменем не лише `/` — той самий набір, що в readonly-bash.mjs. */
const ENV_TOKEN = /(?:^|[/:])\.env\b/;
const ENV_PUBLIC = /(?:^|[/:])\.env\.(?:example|sample|template)$/;
const CLAUDE_DIR = /(?:^|[/:])\.claude(?:[/:]|$)/;

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
  if (!agent) process.exit(0);

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

  process.exit(0);
});
