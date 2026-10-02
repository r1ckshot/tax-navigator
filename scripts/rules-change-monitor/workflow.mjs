#!/usr/bin/env node
// Рішення, які приймає `.github/workflows/rules-verify.yml`, — тут, з тестами, а
// не в YAML. Workflow лише запускає команди й виконує те, що вони надрукували.
//
//   plan       — який прогін сьогодні: full / laws-only / skip (розклад sad.md §розклад)
//   year-ahead — пошук в ELI оголошень на наступний рік (мережа, без моделі)
//   outcome    — розкладка циклу: бот-PR, issue людині, повтор; тексти issue
//   evidence   — PDF змін актів для агента investigate (мережа, без моделі)
//
// Кожна команда друкує `ключ=значення` для `$GITHUB_OUTPUT` і пише файли в --dir.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ELI_API } from "./laws.mjs";
import { classifyOutcome, fingerprint, updateStreaks, RETRY_DAYS } from "./outcome.mjs";
import { STATES } from "./states.mjs";
import { findYearAhead, futureAmendments } from "./year-ahead.mjs";

/**
 * Місяці, коли виходять числа нового року. Виведено з ELI (фікстури
 * `__fixtures__/eli-search/`, 2026-10-01), не з пам'яті:
 *   - мінімалка — rozporządzenie, оголошене 13–15 вересня п'ять років поспіль;
 *   - 30-krotność і прогнозована середня — obwieszczenie MRPiPS: 27.10.2022,
 *     06.12.2023, 11.12.2024, 25.11.2025 (EVIDENCE: «z 19.11.2025»);
 *   - база zdrowotnej ryczałtu — obwieszczenie GUS за IV квартал, 22–24 січня.
 * Тест `workflow.test.mjs` тримає це: публікація поза вікном валить `npm test`.
 */
export const HOT_MONTHS = Object.freeze([9, 10, 11, 12, 1]);

const isMonday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay() === 1;
const monthOfDate = (date) => Number(date.slice(5, 7));

/**
 * Який прогін сьогодні. Розклад щоденний, а рішення — тут:
 *   1-ше число — повний (щомісячний);
 *   є джерела, що мовчать менше трьох днів, — повний (повтор);
 *   понеділок у гарячий місяць — повний;
 *   понеділок — легкий (лише закони; змінився закон → workflow ескалює до повного);
 *   інакше — нічого.
 * Ручний запуск (`workflow_dispatch`, `push` на гілку навчання) бере режим із вводу.
 */
export function planRun({ date, event, requested = "auto", pendingRetries = 0 }) {
  if (requested && requested !== "auto") return { mode: requested, reason: `запит вручну (${event})` };
  if (event !== "schedule") return { mode: "full", reason: `${event} без режиму — повний` };
  if (date.slice(8, 10) === "01") return { mode: "full", reason: "щомісячний повний прогін" };
  if (pendingRetries > 0) return { mode: "full", reason: `повтор: джерел, що мовчать, — ${pendingRetries}` };
  if (isMonday(date) && HOT_MONTHS.includes(monthOfDate(date))) return { mode: "full", reason: "гарячий місяць, щотижневий повний прогін" };
  if (isMonday(date)) return { mode: "laws-only", reason: "щотижневий легкий прогін законів" };
  return { mode: "skip", reason: "сьогодні прогону немає" };
}

/** Комірка таблиці: без `|` і переносів, щоб рядок не розвалив markdown. */
const cell = (v) => (v === null || v === undefined || v === "" ? "—" : String(v).replace(/\|/g, "\\|").replace(/\s+/g, " "));

const STATE_LABEL = Object.freeze({
  [STATES.DIVERGENCE]: "розбіжність",
  [STATES.NEEDS_CONFIRMATION]: "закон змінився",
  [STATES.UNAVAILABLE]: "джерело недоступне",
  [STATES.OUT_OF_SCOPE]: "поза автозвіркою",
  [STATES.NOT_VERIFIED]: "не верифіковано",
  [STATES.MATCH]: "збігається",
  [STATES.COSMETIC]: "збігається (формат)",
});

/** Рядки таблиці по листах, що не збіглись; правило без полів — одним рядком. */
function rowsOf(check) {
  const leaves = (check.fields ?? []).filter((f) => f.state !== STATES.MATCH && f.state !== STATES.COSMETIC);
  const items = leaves.length > 0 ? leaves : [check];
  return items.map((f) => {
    const changes = (f.amended ?? []).map((a) => `${a.id} (чинна з ${a.effective ?? "?"})`).join(", ");
    return `| \`${check.rule_id}\` | ${cell(f.param)} | ${STATE_LABEL[f.state] ?? f.state}${check.blocked ? " (вхід відхилено)" : ""} | ${cell(f.fetched_value)} | ${cell(f.matrix_value)} | ${cell(f.fetched_from)} | ${cell(changes || f.failure_reason)} | ${cell(check.verified_at)} |`;
  });
}

const TABLE_HEAD = [
  "| Правило | Лист | Стан | Значення джерела | Матриця | Звідки | Зміни / причина | verified_at |",
  "|---|---|---|---|---|---|---|---|",
];

export const marker = (fp) => `<!-- rules-verify fingerprint: ${fp} -->`;

/**
 * Запис для агента: лише те, на чому стоїть рішення. Повний запис циклу на 10
 * правил — ~1500 рядків (зміни акта повторюються в кожному листі), і перший живий
 * прогін дочитав його до 1167-го.
 */
export function compactCheck(check) {
  const leaf = (f) => ({
    param: f.param ?? null,
    state: f.state,
    ...(f.law ? { law: f.law } : {}),
    matrix_value: f.matrix_value ?? null,
    fetched_value: f.fetched_value ?? null,
    fetched_from: f.fetched_from ?? null,
    ...(f.amended?.length ? { amended: f.amended.map((a) => a.id) } : {}),
    ...(f.failure_reason ? { failure_reason: f.failure_reason } : {}),
  });
  const leaves = (check.fields ?? []).filter((f) => f.state !== STATES.MATCH && f.state !== STATES.COSMETIC);
  return {
    rule_id: check.rule_id,
    state: check.state,
    verified_at: check.verified_at ?? null,
    source_url: check.source_url ?? null,
    ...(check.blocked ? { blocked: true } : {}),
    fields: (leaves.length ? leaves : [check]).map(leaf),
  };
}

/** Зміни актів раз на всі записи: id → назва й дата чинності. */
export function amendmentIndex(checks) {
  const index = {};
  const visit = (c) => {
    for (const a of c.amended ?? []) index[a.id] = { title: a.title ?? null, effective: a.effective ?? null, promulgation: a.promulgation ?? null };
    for (const f of c.fields ?? []) visit(f);
  };
  checks.forEach(visit);
  return index;
}

/** Тіло issue «потребує людини». Відбиток — у прихованому маркері для дедуплікації. */
export function attentionIssue({ checks, date, runUrl, drill }) {
  const fp = fingerprint(checks);
  const body = [
    marker(fp),
    drill ? "> **Навчання.** Розбіжність підмінена навмисно (`--drill`), цифр у матриці не змінювати. Закрити після перевірки шляху.\n" : "",
    `Автозвірка ${date} знайшла правила, яким потрібне рішення людини. Агент \`investigate\` перечитує джерела і, якщо доказів досить, відкриває чернетку PR; без чернетки — лише його нотатки в артефакті прогону.`,
    "",
    ...TABLE_HEAD,
    ...checks.flatMap(rowsOf),
    "",
    `Прогін: ${runUrl}`,
  ].join("\n");
  return { fingerprint: fp, title: drill ? "rules-verify (навчання): розбіжність мінімалки" : `rules-verify: потребує людини (${checks.length})`, body };
}

/** Тіло issue «перевір руками»: джерело мовчить три дні поспіль. */
export function overdueIssue({ checks, streaks, date, runUrl }) {
  const fp = fingerprint(checks.map((c) => ({ rule_id: c.rule_id, state: c.state })));
  const body = [
    marker(fp),
    `Ці джерела не відповідали автозвірці ${RETRY_DAYS} дні поспіль (станом на ${date}). Звір руками за посиланням або перевір межу середовища (\`.claude/rules/environment-limits.md\`).`,
    "",
    "| Правило | Звідки | Причина | Мовчить з |",
    "|---|---|---|---|",
    ...checks.map((c) => `| \`${c.rule_id}\` | ${cell(c.fetched_from ?? c.source_url)} | ${cell(c.failure_reason)} | ${cell(streaks[c.rule_id]?.since)} |`),
    "",
    `Прогін: ${runUrl}`,
  ].join("\n");
  return { fingerprint: fp, title: `rules-verify: перевір руками (${checks.length})`, body };
}

/** Тіло issue `rules-2027`: тригер теми П.1 ROADMAP. */
export function nextYearIssue({ announcements, amendments, taxYear, runUrl }) {
  const fp = fingerprint([
    ...announcements.map((a) => ({ rule_id: a.eli, state: String(a.year) })),
    ...amendments.map((a) => ({ rule_id: a.id, state: a.effective })),
  ]);
  const next = taxYear + 1;
  const body = [
    marker(fp),
    `Правила ${next} вже існують — тригер теми П.1 «Правила ${next}» у \`docs/ROADMAP.md\`. Матриця ${taxYear} з 01.01.${next} показуватиме минулорічні цифри.`,
    "",
    "### Опубліковані значення наступного року",
    "",
    ...(announcements.length ? announcements.map((a) => `- ${a.label}: [${a.eli}](https://api.sejm.gov.pl/eli/acts/${a.eli}) на ${a.year}, опубліковано ${a.promulgation ?? "?"} — правила ${a.rules.map((r) => `\`${r}\``).join(", ")}`) : ["Немає."]),
    "",
    "### Ухвалені зміни актів, чинні з наступного року",
    "",
    ...(amendments.length ? amendments.map((a) => `- [${a.id}](https://api.sejm.gov.pl/eli/acts/${a.id}) — чинна з ${a.effective}: ${cell(a.title)} — правила ${a.rules.map((r) => `\`${r}\``).join(", ")}`) : ["Немає."]),
    "",
    `Прогін: ${runUrl}`,
  ].join("\n");
  return { fingerprint: fp, title: `rules-${next}: значення й закони ${next} опубліковано`, body };
}

/**
 * Повна розкладка одного прогону у файли для workflow. Повертає пари для
 * `$GITHUB_OUTPUT`. Легкий прогін бот-PR не відкриває (`reverify` порожній), а
 * issue «перевір руками» рахує лише повний — легкий сторінок не відкривав.
 */
export function writeOutcome({ cycle, yearAhead, stateIn = {}, date, taxYear, runUrl, dir }) {
  const streaksIn = stateIn.streaks ?? {};
  mkdirSync(dir, { recursive: true });
  const outcome = classifyOutcome(cycle);
  const light = cycle.mode === "laws-only";
  const drill = Boolean(cycle.drill);
  const out = {};

  const reverify = light || drill ? [] : outcome.reverify;
  writeFileSync(join(dir, "reverify.txt"), reverify.map((id) => `${id}\n`).join(""), "utf8");
  out.reverify = String(reverify.length);

  const attention = drill ? outcome.attention.filter((c) => c.rule_id === cycle.drill.rule_id) : outcome.attention;
  if (attention.length > 0) {
    const issue = attentionIssue({ checks: attention, date, runUrl, drill });
    writeFileSync(join(dir, "attention.md"), issue.body, "utf8");
    // Повний запис — для `evidence` (там зміни з назвами), стислий — для агента.
    writeFileSync(join(dir, "attention-full.json"), JSON.stringify(attention, null, 2), "utf8");
    writeFileSync(join(dir, "attention.json"), JSON.stringify({ rules: attention.map(compactCheck), amendments: amendmentIndex(attention) }, null, 2), "utf8");
    writeFileSync(join(dir, "attention-title.txt"), issue.title, "utf8");
    out.attention_fp = issue.fingerprint;
  }
  out.attention = String(attention.length);

  // Легкий прогін сторінок не відкривав, навчання — не справжній стан джерел: обидва лічильник не чіпають.
  const { streaks, overdue } = light || drill ? { streaks: streaksIn ?? {}, overdue: [] } : updateStreaks(streaksIn ?? {}, outcome.unavailable.map((c) => c.rule_id), date);
  // Навчання стан не пише взагалі: підмінена сторінка не має зсунути відбиток законів.
  const lawsFp = drill ? (stateIn.laws_fp ?? null) : lawsFingerprint(cycle);
  writeFileSync(join(dir, "state.json"), JSON.stringify({ streaks, laws_fp: lawsFp }, null, 2), "utf8");
  // Легкий прогін побачив нові зміни законів — workflow одразу ж запускає повний.
  out.escalate = String(light && lawsFp !== (stateIn.laws_fp ?? null));
  out.pending_retries = String(Object.keys(streaks).length - overdue.length);
  if (overdue.length > 0) {
    const issue = overdueIssue({ checks: outcome.unavailable.filter((c) => overdue.includes(c.rule_id)), streaks, date, runUrl });
    writeFileSync(join(dir, "overdue.md"), issue.body, "utf8");
    writeFileSync(join(dir, "overdue-title.txt"), issue.title, "utf8");
    out.overdue_fp = issue.fingerprint;
  }
  out.overdue = String(overdue.length);

  // Навчання перевіряє лише шлях розбіжності; сигнал наступного року — справа справжнього прогону.
  const announcements = drill ? [] : (yearAhead?.found ?? []);
  const amendments = drill ? [] : futureAmendments(cycle, taxYear);
  if (announcements.length + amendments.length > 0) {
    const issue = nextYearIssue({ announcements, amendments, taxYear, runUrl });
    writeFileSync(join(dir, "next-year.md"), issue.body, "utf8");
    writeFileSync(join(dir, "next-year-title.txt"), issue.title, "utf8");
    out.next_year_fp = issue.fingerprint;
  }
  out.next_year = String(announcements.length + amendments.length);
  return out;
}

/**
 * Відбиток змін законів: які правила стоять на яких змінах актів. Однаковий у
 * легкому й повному прогоні (обидва звіряють закони тим самим `checkLaw`), тож
 * легкий прогін порівнює його з минулим і, якщо з'явилось нове, просить повний.
 */
export function lawsFingerprint(cycle) {
  const pairs = new Set();
  const visit = (ruleId, c) => {
    if (c.state === STATES.NEEDS_CONFIRMATION) for (const a of c.amended ?? []) pairs.add(`${ruleId}:${a.id}`);
    for (const f of c.fields ?? []) visit(ruleId, f);
  };
  for (const c of cycle.checks) visit(c.rule_id, c);
  return fingerprint([...pairs].map((p) => ({ rule_id: p })));
}

/** Ідентифікатори змін актів із записів, що йдуть людині, — для `evidence`. */
export function amendmentIds(checks) {
  const ids = new Set();
  const visit = (c) => {
    for (const a of c.amended ?? []) ids.add(a.id);
    for (const f of c.fields ?? []) visit(f);
  };
  checks.forEach(visit);
  return [...ids].sort();
}

/** Стеля на PDF змін: агент читає їх цілком, і велика пачка з'їла б бюджет. */
export const MAX_EVIDENCE_FILES = 12;

/** Більший PDF агент однаково не прочитає за бюджет одного прогону. */
export const MAX_EVIDENCE_BYTES = 15_000_000;

/**
 * Один PDF зміни акта на диск. Кладемо лише справжній PDF (сигнатура `%PDF`):
 * сторінка WAF чи помилки під іменем .pdf читалась би агентом як текст закону.
 *
 * @returns {Promise<string|null>} причина, якщо файл не збережено
 */
async function savePdf(url, path) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) return `ELI відповів ${response.status}`;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.subarray(0, 4).toString("latin1") !== "%PDF") return "відповідь не PDF";
    if (bytes.length > MAX_EVIDENCE_BYTES) return `PDF більший за ${MAX_EVIDENCE_BYTES} байт`;
    writeFileSync(path, bytes);
    return null;
  } catch (error) {
    return `запит не вдався: ${error?.message ?? error}`;
  }
}

function arg(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
}
const emit = (pairs) => Object.entries(pairs).forEach(([k, v]) => console.log(`${k}=${v}`));
const readJson = (path, fallback) => (path && existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback);

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const dir = arg(args, "dir", ".");
  if (command === "plan") {
    const state = readJson(arg(args, "state"), {});
    emit(planRun({ date: arg(args, "date"), event: arg(args, "event"), requested: arg(args, "requested", "auto"), pendingRetries: Object.keys(state.streaks ?? {}).length }));
    return;
  }
  if (command === "year-ahead") {
    const result = await findYearAhead({ taxYear: Number(arg(args, "tax-year")) });
    writeFileSync(join(dir, "year-ahead.json"), JSON.stringify(result, null, 2), "utf8");
    emit({ found: result.found.length, unavailable: result.unavailable.length });
    return;
  }
  if (command === "outcome") {
    emit(
      writeOutcome({
        cycle: readJson(arg(args, "cycle")),
        yearAhead: readJson(arg(args, "year-ahead"), null),
        stateIn: readJson(arg(args, "state"), {}),
        date: arg(args, "date"),
        taxYear: Number(arg(args, "tax-year")),
        runUrl: arg(args, "run-url", "—"),
        dir,
      }),
    );
    return;
  }
  if (command === "evidence") {
    const checks = readJson(arg(args, "attention"), []);
    const ids = amendmentIds(checks).slice(0, MAX_EVIDENCE_FILES);
    mkdirSync(dir, { recursive: true });
    let saved = 0;
    for (const id of ids) {
      const reason = await savePdf(`${ELI_API}/${id}/text.pdf`, join(dir, `${id.replaceAll("/", "-")}.pdf`));
      if (reason) {
        console.error(`evidence: ${id}: ${reason}`);
        continue;
      }
      saved += 1;
    }
    emit({ amendments: ids.length, saved });
    return;
  }
  console.error("usage: workflow.mjs plan|year-ahead|outcome|evidence [--dir DIR] …");
  process.exitCode = 2;
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`workflow.mjs впав: ${error.message}`);
    process.exit(1);
  });
}
