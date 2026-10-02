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
    // Правило з полями (`pages.mjs`) може розійтись у кількох місцях одразу;
    // показати лише перше означало б, що решту людина знайде вже після рішення.
    const fields = (c.fields ?? [c]).filter((f) => f.state === STATES.DIVERGENCE);
    const values = fields.flatMap((f) => [
      ...(f.param ? [`- параметр: ${f.param}${f.scale ? ` (на сторінці ×${f.scale})` : ''}`] : []),
      `- матриця: ${fmt(f.matrix_value)}`,
      `- джерело: ${fmt(f.fetched_value)}`,
      `- різниця: ${fmt(f.diff_percent)}%`,
      // Значення моделі без цитати — лише її слово. Цитату вже звірено з
      // текстом сторінки дослівно (`llm.mjs`), тож друкуємо саме її.
      ...(f.method === 'llm' && f.quote ? [`- цитата (модель, звірено дослівно): «${f.quote}»`] : []),
    ]);
    return [
      `### ${c.rule_id}`,
      ...values,
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
    const lines = inState.map((c) => (state === STATES.NEEDS_CONFIRMATION ? renderConfirmationLine(c) : `- ${c.rule_id}: ${fmt(c.failure_reason)}`));
    parts.push(`${lines.join('\n')}\n`);
    if (state === STATES.NEEDS_CONFIRMATION) {
      const amendments = renderAmendmentsByAct(inState);
      if (amendments) parts.push(amendments);
    }
  }

  return parts.join('\n');
}

/**
 * Ветована цифра вимагає рішення людини так само, як розбіжність, тож несе ті
 * самі поля: без них Хранитель пішов би збирати дані заново (AC-06). Плюс
 * звідки відомо про veto — інакше «потребує підтвердження» нічим не доведене.
 */
function renderVetoLine(c) {
  return [
    `- ${c.rule_id}: ${fmt(c.failure_reason)}`,
    `  - матриця: ${fmt(c.matrix_value)}`,
    `  - джерело: ${fmt(c.fetched_value)}`,
    `  - veto задокументовано: ${fmt(c.veto?.source)}`,
    `  - взято зі сторінки: ${fmt(c.fetched_from)}`,
    `  - source_url матриці: ${fmt(c.source_url)}`,
    `  - verified_at матриці: ${fmt(c.verified_at)}`,
  ].join('\n');
}

/**
 * «Потребує підтвердження» має дві причини, і людині потрібні різні поля:
 * ветована цифра несе veto й обидва числа, змінений закон — перелік змін і
 * місце, яке перечитати. Правило може нести обидві, тож друкуються всі.
 */
function renderConfirmationLine(c) {
  const fields = (c.fields ?? [c]).filter((f) => f.state === STATES.NEEDS_CONFIRMATION);
  const lawFields = fields.filter((f) => f.amended || f.edition);
  if (lawFields.length === 0) return renderVetoLine(c);

  const parts = c.veto ? [renderVetoLine(c)] : [`- ${c.rule_id}:`];
  for (const f of lawFields) {
    parts.push(`  - ${fmt(f.param)}: ${fmt(f.failure_reason)}`, `    - звідки відомо: ${fmt(f.fetched_from)}`);
  }
  // Акт не покриває manual-листів: після перечитання закону їх усе одно
  // звіряє людина, і це варто знати до того, як братись за правило.
  if (Array.isArray(c.manual) && c.manual.length > 0) {
    parts.push(`  - не звіряються циклом (manual): ${c.manual.join(', ')}`);
  }
  parts.push(`  - source_url матриці: ${fmt(c.source_url)}`, `  - verified_at матриці: ${fmt(c.verified_at)}`);
  return parts.join('\n');
}

/**
 * Перелік змін — один раз на акт, а не в кожному правилі: ustawa o PIT тримає
 * вісім правил, і чотири її зміни, повторені вісім разів, ховали б решту
 * розділу. Правило вище каже, що перечитати; тут — що саме змінилось.
 */
function renderAmendmentsByAct(checks) {
  const byAct = new Map();
  for (const c of checks) {
    for (const f of c.fields ?? [c]) {
      if (!Array.isArray(f.amended) || f.amended.length === 0) continue;
      const known = byAct.get(f.fetched_from) ?? { law: f.law, list: new Map() };
      for (const a of f.amended) known.list.set(a.id, a);
      byAct.set(f.fetched_from, known);
    }
  }
  if (byAct.size === 0) return '';
  const blocks = [...byAct.entries()].map(([url, { law, list }]) =>
    [
      `- ${fmt(law?.split(',')[0])} (${url})`,
      // Назва зміни — з метаданих Сейму, не зі сторінки: друкуємо як є.
      ...[...list.values()].map((a) => `  - ${a.kind ?? 'зміна'} ${a.id}: опубліковано ${fmt(a.promulgation)}, чинна з ${fmt(a.effective)} — ${fmt(a.title)}`),
    ].join('\n'),
  );
  return `Що змінилось в актах після звірки:\n\n${blocks.join('\n')}\n`;
}

const METHOD_LABELS = Object.freeze({ page: 'сторінкою', act: 'актом без змін', edition: 'редакцією без змін', llm: 'моделлю з цитатою' });

/**
 * «Збігається» означає різне залежно від способу: сторінка підтвердила число,
 * а акт — лише те, що текст норми не змінювався після ручної звірки. Тому
 * лічильник розкладено за способом, і різниця названа прямо.
 *
 * Листи `manual` і `derived` цикл не звіряв: вони названі поіменно, щоб
 * «збігається» не читалось ширше, ніж його довело джерело.
 */
function renderConfirmedLine(checks, cycleDay) {
  const confirmed = checks.filter((c) => c.state === STATES.MATCH || c.state === STATES.COSMETIC);
  // Правило, звірене вручну в день циклу, акт нічим не підтвердив: між звіркою
  // і циклом нуль днів, змін бути не могло. Лічиться окремо (рев'ю звіту 2026-10).
  const freshByHand = (c) => (c.method === 'act' || c.method === 'edition') && cycleDay !== null && c.verified_at >= cycleDay;
  const byMethod = [
    ...Object.entries(METHOD_LABELS).map(([method, label]) => [label, confirmed.filter((c) => c.method === method && !freshByHand(c)).length]),
    ['звірено вручну в день циклу', confirmed.filter(freshByHand).length],
  ]
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${label} — ${n}`);
  const head = `## Підтверджено\n\n${confirmed.length} правил збігаються з джерелом (match/cosmetic)${byMethod.length ? `: ${byMethod.join(', ')}` : ''}.\n`;
  const parts = [head];
  if (confirmed.some((c) => c.method === 'act' || c.method === 'edition')) {
    parts.push('«Актом» і «редакцією» означає: закон не змінювався після verified_at. Число при цьому не порівнювалось.\n');
  }
  // Правило на сторінці може мати листи, які підтвердив лише незмінений акт:
  // лічильник «сторінкою» їх не має ховати (рев'ю звіту 2026-10).
  const actLeaves = confirmed
    .filter((c) => c.method === 'page')
    .map((c) => [c.rule_id, (c.fields ?? []).filter((f) => f.compared === false).map((f) => f.param)])
    .filter(([, leaves]) => leaves.length > 0);
  if (actLeaves.length > 0) {
    const lines = actLeaves.map(([id, leaves]) => `- ${id}: ${leaves.join(', ')}`);
    parts.push(`Листи page-правил, які підтвердив лише незмінений закон (число не порівнювалось):\n\n${lines.join('\n')}\n`);
  }
  const partial = confirmed.filter((c) => Array.isArray(c.manual) && c.manual.length > 0);
  if (partial.length > 0) {
    const lines = partial.map((c) => `- ${c.rule_id}: ${c.manual.join(', ')}`);
    parts.push(`З них ${partial.length} — лише в частині, яку несе джерело; ці листи цикл не звіряє, їх звіряє людина (manual):\n\n${lines.join('\n')}\n`);
  }
  const derived = confirmed.filter((c) => Array.isArray(c.derived) && c.derived.length > 0);
  if (derived.length > 0) {
    const lines = derived.map((c) => `- ${c.rule_id}: ${c.derived.join(', ')}`);
    parts.push(`Виведено, не звірено з джерела (тримає тест інваріанта або форма таблиці):\n\n${lines.join('\n')}\n`);
  }
  return parts.join('\n');
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
    renderConfirmedLine(checks, typeof cycle.started_at === 'string' ? cycle.started_at.slice(0, 10) : null),
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

  // «Записів», а не «перевірено»: записи `out_of_scope` ніхто не звіряв, і
  // дієслово на всі N завищувало б покриття (рев'ю звіту 2026-10).
  const compared = checks.filter((c) => [STATES.MATCH, STATES.COSMETIC, STATES.DIVERGENCE, STATES.NEEDS_CONFIRMATION].includes(c.state)).length;
  return `${fmt(cycle.month)}: записів ${checks.length}, звірено з джерелом ${compared}, розбіжностей ${divergences}, непідтверджених ${unconfirmed}`;
}
