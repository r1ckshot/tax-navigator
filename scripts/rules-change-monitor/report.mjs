// Markdown-звіт циклу звірки для людини.
//
// Порядок секцій навмисно жорсткий (не алфавітний, не порядок `STATES`):
// заблоковані входи перші — вони ставлять під сумнів увесь решту звіту;
// divergence — єдине, що вимагає продуктового рішення людини, і має стояти
// одразу за ними, щоб його не довелось шукати під сотнею рядків «усе гаразд».
// Далі непідтверджені
// стани (кожен — окрема причина, чому звірки не сталось), і аж тоді
// match/cosmetic — згорнуті в один рядок-лічильник, бо саме вони й є «усе
// гаразд».
//
// Звіт інформує, а не радить: жодного рядка виду «онови ставку» —
// `.claude/rules/product-safety.md`. Кожне число розбіжності несе
// `source_url` + `verified_at` — `.claude/rules/evidence-numbers.md`.

import { STATES, UNCONFIRMED_STATES } from './states.mjs';

const STATE_LABELS = Object.freeze({
  [STATES.UNAVAILABLE]: 'Джерело недоступне',
  [STATES.OUT_OF_SCOPE]: 'Поза скоупом автозвірки',
  [STATES.NOT_VERIFIED]: 'Немає ручної верифікації',
  [STATES.NEEDS_CONFIRMATION]: 'Потребує підтвердження людини',
});

function fmt(value) {
  return value === null || value === undefined ? '—' : String(value);
}

/**
 * Заблоковані входи стоять ПЕРЕД розбіжностями, хоча розбіжність — єдине, що
 * вимагає продуктового рішення. Причина в тому, що відхилений вхід ставить під
 * сумнів увесь інший вміст звіту: якщо державна сторінка несла звернення до
 * агента, питання вже не в ставці, а в тому, що з джерелом.
 *
 * Друкуємо `failure_reason` (назва патерна, без жодного символу зі сторінки) і
 * не друкуємо нічого з самого входу. Звіт читає модель, і процитований наказ
 * доїхав би до неї рівно тим каналом, який ми щойно перекрили.
 */
function renderBlockedSection(checks) {
  const blocked = checks.filter((c) => c.blocked === true);
  if (blocked.length === 0) {
    return '## Заблоковані входи\n\nНемає.\n';
  }

  const lines = blocked.map((c) =>
    [
      `### ${c.rule_id}`,
      `- сторінка: ${fmt(c.fetched_from)}`,
      `- причина: ${fmt(c.failure_reason)}`,
      '- цифру з цієї сторінки не взято: вхід відхилено до витягу значення',
    ].join('\n'),
  );

  return `## Заблоковані входи\n\n${lines.join('\n\n')}\n`;
}

function renderDivergenceSection(checks) {
  const divergent = checks.filter((c) => c.state === STATES.DIVERGENCE);
  if (divergent.length === 0) {
    return '## Розбіжності\n\nНемає.\n';
  }

  const lines = divergent.map((c) => {
    return [
      `### ${c.rule_id}`,
      `- матриця: ${fmt(c.matrix_value)}`,
      `- джерело: ${fmt(c.fetched_value)}`,
      `- різниця: ${fmt(c.diff_percent)}%`,
      // Дві різні речі, і плутати їх не можна: `fetched_from` — сторінка, яку
      // читав скрипт цього циклу, `source_url` — посилання, записане в
      // матриці при ручній звірці. Друкувати число лише під другим означало б
      // атрибутувати його джерелу, якого скрипт не відкривав.
      `- взято зі сторінки: ${fmt(c.fetched_from)}`,
      `- source_url матриці: ${fmt(c.source_url)}`,
      `- verified_at матриці: ${fmt(c.verified_at)}`,
    ].join('\n');
  });

  return `## Розбіжності\n\n${lines.join('\n\n')}\n`;
}

function renderUnconfirmedSection(checks) {
  const parts = ['## Непідтверджені стани\n'];

  for (const state of UNCONFIRMED_STATES) {
    const inState = checks.filter((c) => c.state === state);
    parts.push(`### ${STATE_LABELS[state]} (${inState.length})\n`);
    if (inState.length === 0) {
      parts.push('Немає.\n');
      continue;
    }
    const lines = inState.map((c) => `- ${c.rule_id}: ${fmt(c.failure_reason)}`);
    parts.push(`${lines.join('\n')}\n`);
  }

  return parts.join('\n');
}

function renderConfirmedLine(checks) {
  const confirmed = checks.filter((c) => c.state === STATES.MATCH || c.state === STATES.COSMETIC).length;
  return `## Підтверджено\n\n${confirmed} правил збігаються з джерелом (match/cosmetic).\n`;
}

/**
 * Markdown-звіт одного циклу.
 *
 * Порожній цикл (без `checks` або з порожнім масивом) не падає — рендериться
 * як звіт без жодного пункту в кожній секції, а не як помилка: цикл, що не
 * перевірив жодного правила, це легітимний стан (наприклад усі поза скоупом),
 * не аварія рендера.
 *
 * @param {object} cycle
 * @returns {string}
 */
export function renderReport(cycle) {
  const checks = Array.isArray(cycle.checks) ? cycle.checks : [];

  // Статус циклу стоїть у шапці, а не лише в історії: цикл, де впали всі
  // джерела, інакше дав би звіт із заголовком «Розбіжності: немає» і жодного
  // слова про те, що картина неповна. Тиша знову читалась би як підтвердження.
  const BANNERS = {
    partial:
      '> Цикл неповний: частина джерел не відповіла. Порожній розділ розбіжностей ще не означає, що змін немає.\n',
    blocked:
      '> Цикл відхилив щонайменше одне джерело: сторінка містила звернення до агента, а не лише текст для людини. Вміст до моделі не потрапив, цифру з неї не взято.\n',
  };
  const banner = BANNERS[cycle.status] ?? '';

  return [
    `# Звірка правил — ${fmt(cycle.month)}\n`,
    banner,
    renderBlockedSection(checks),
    renderDivergenceSection(checks),
    renderUnconfirmedSection(checks),
    renderConfirmedLine(checks),
  ].join('\n');
}

/**
 * Один рядок-підсумок циклу: місяць, скільки перевірено, скільки
 * розбіжностей, скільки непідтверджених.
 *
 * @param {object} cycle
 * @returns {string}
 */
export function summaryLine(cycle) {
  const checks = Array.isArray(cycle.checks) ? cycle.checks : [];
  const divergences = checks.filter((c) => c.state === STATES.DIVERGENCE).length;
  const unconfirmed = checks.filter((c) => UNCONFIRMED_STATES.includes(c.state)).length;

  return `${fmt(cycle.month)}: перевірено ${checks.length}, розбіжностей ${divergences}, непідтверджених ${unconfirmed}`;
}
