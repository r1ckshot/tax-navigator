// Способи звірки `act` і `edition`: які закони тримають правило і як дізнатись,
// що закон змінився після ручної звірки.
//
// Число тут не порівнюється. Обидва способи відповідають на одне питання: чи
// текст норми, який людина читала в `verified_at`, досі той самий. Змінився —
// `needs_confirmation` («потребує підтвердження» з AC-03): цифра могла лишитись
// тією самою, тож це не «розбіжність», але й «збігається» вже не доведено.
//
// `act` — ELI API Сейму (`api.sejm.gov.pl`): у метаданих акта є список змін
// («Akty zmieniające») з датою набрання чинності, поруч — виправлення тексту
// й рішення TK (`TEXT_CHANGES`); у кожного — дата публікації (`promulgation`). Текст jednolity ELI віддає лише PDF, а `text.html`
// базового акта — це первісна публікація 1991/1998 року, тож порівнювати текст
// статті через ELI не можна; сигнал іде за змінами, а не за текстом.
//
// `edition` — zakon.rada.gov.ua: на сторінці закону стоїть «поточна редакція —
// Редакція від DD.MM.YYYY». Сайт має антиDDoS: за кілька запитів поспіль віддає
// `403`, тож сторінка тягнеться раз на цикл і з паузою на домен (`cycle.mjs`).

import { STATES } from "./states.mjs";

export const ELI_API = "https://api.sejm.gov.pl/eli/acts";
export const RADA = "https://zakon.rada.gov.ua/laws/show";

/** Акти Сейму за ELI. `name` — для звіту людині. */
export const ACTS = Object.freeze({
  pit: { eli: "DU/1991/350", name: "ustawa o podatku dochodowym od osób fizycznych" },
  ryczalt: { eli: "DU/1998/930", name: "ustawa o zryczałtowanym podatku dochodowym" },
  umowaPlUa: { eli: "DU/1994/269", name: "Konwencja PL-UA o unikaniu podwójnego opodatkowania" },
  swiadczenia: { eli: "DU/2004/2135", name: "ustawa o świadczeniach opieki zdrowotnej" },
  prawoPrzedsiebiorcow: { eli: "DU/2018/646", name: "Prawo przedsiębiorców" },
  sus: { eli: "DU/1998/887", name: "ustawa o systemie ubezpieczeń społecznych" },
});

/**
 * Редакції: закони України на zakon.rada.gov.ua (`rada` — дата редакції на
 * сторінці) і документи без редакцій, лише файлом (`url` + `sha256` — відбиток
 * файла в день звірки). Документ не має дати редакції, тож «змінився» для нього
 * означає «файл за тим самим посиланням уже інший».
 */
export const EDITIONS = Object.freeze({
  pku: { rada: "2755-17", name: "Податковий кодекс України" },
  esv: { rada: "2464-17", name: "Закон № 2464-VI про ЄСВ" },
  budget2026: { rada: "4695-20", name: "Закон № 4695-IX про Державний бюджет-2026" },
  objasnieniaRezydencja: {
    url: "https://www.gov.pl/attachment/8f2d0cf1-ee3c-49a4-ae8e-e41c4fb19df7",
    // Знято 2026-10-01; с. 7–8: «każdą część dnia, nawet bardzo krótką, […] należy
    // zaliczyć jako dzień obecności» (EVIDENCE, резидентство).
    sha256: "4899455f188676f4934047a2f56338f86ccb9066393291a6e62c88b2089351c2",
    name: "Objaśnienia podatkowe MF z 29.04.2021 (rezydencja), PDF",
  },
});

/** Посилання на норму: який акт і яке місце в ньому перечитати, якщо акт змінився. */
export const act = (key, where) => ({ method: "act", key, where });
export const edition = (key, where) => ({ method: "edition", key, where });

/** URL, який цикл реально відкриває для посилання. */
export function lawUrl(law) {
  if (law.method === "act") return `${ELI_API}/${ACTS[law.key].eli}`;
  const entry = EDITIONS[law.key];
  return entry.rada ? `${RADA}/${entry.rada}` : entry.url;
}

/** Чи посилання — документ, що звіряється відбитком файла, а не датою редакції. */
export function isDocument(law) {
  return law.method === "edition" && typeof EDITIONS[law.key]?.sha256 === "string";
}

/** Людська назва посилання: «ustawa o PIT, art. 3 ust. 2a». */
export function lawLabel(law) {
  const registry = law.method === "act" ? ACTS : EDITIONS;
  return `${registry[law.key].name}, ${law.where}`;
}

/**
 * Правила, чий спосіб звірки — `act` або `edition` цілим правилом (без сторінки).
 *
 * `laws` — усі закони, з яких складено правило; стан правила — найгірший з них.
 * `except` — листи, яких ці закони не підтверджують. Без нього «акт без змін»
 * читався б як підтвердження ринкової ціни абонементу чи оцінки ставки. Решта
 * листів правила вважається покритою законами — guard (`methods.test.mjs`)
 * перевіряє, що кожен названий у `except` лист справді існує.
 */
export const RULE_LAWS = Object.freeze({
  "residency.days_threshold": {
    laws: [act("pit", "art. 3 ust. 2a"), edition("objasnieniaRezydencja", "с. 7–8, лічба днів: кожна частина дня — день")],
  },
  "residency.special_norm_52zr": { laws: [act("pit", "art. 52zr")] },
  "residency.treaty_tiebreakers": { laws: [act("umowaPlUa", "art. 4 ust. 2")] },
  "jdg.byly_pracodawca": {
    laws: [
      act("ryczalt", "art. 8 ust. 2"),
      act("prawoPrzedsiebiorcow", "art. 18 ust. 1"),
      act("sus", "art. 18a ust. 2 pkt 2"),
    ],
  },
  "incubator.kup": {
    laws: [act("pit", "art. 22 ust. 9 pkt 3–4 і ust. 9a"), act("sus", "art. 6 ust. 1 (umowa o dzieło не тytuł)")],
    except: {
      subscriptionMonthlyMin: { method: "manual", why: "тимчасово: ціна зі сторінок самих інкубаторів, їхні домени поза allowlist; page/llm — сесія 04" },
      subscriptionMonthlyMax: { method: "manual", why: "тимчасово: ціна зі сторінок самих інкубаторів, їхні домени поза allowlist; page/llm — сесія 04" },
      effectivePitStandardEstimate: { method: "manual", why: "тимчасово: інваріант 12% × (1 − 20%) = 9,6% падає на нинішніх 13,6%; спершу виправлення числа (BACKLOG), потім derived" },
      effectivePitCopyrightEstimate: { method: "derived", why: "6% = 12% (jdg.skala.lowerRate) × (1 − 50% KUP); тримає тест інваріанта в rules.test.ts" },
      isEstimate: { method: "derived", why: "позначка продукту: правило — оцінка" },
    },
  },
  "fop.zaklad_in_pl": {
    laws: [
      act("umowaPlUa", "art. 5, 7 і 24"),
      edition("pku", "ст. 293 (ставка ЄП 3 групи)"),
      // Відмова в ryczałcie — індивідуальна інтерпретація KAS. Документ з датою
      // сам не змінюється; висновок ламає лише зміна закону, на якому він стоїть.
      act("ryczalt", "підстава відмови в інтерпретації KAS 0112-KDIL2-2.4011.234.2023.5.IM"),
    ],
    except: {
      numericRangeAvailable: { method: "derived", why: "позначка продукту: виводиться з unverifiedComponents" },
      unverifiedComponents: { method: "derived", why: "позначка продукту: що лишилось не звіреним" },
    },
  },
  "fop.esv_vz": {
    laws: [
      edition("esv", "ст. 8 ч. 5 і ст. 1 ч. 1 п. 5"),
      edition("budget2026", "ст. 8, ст. 32 і п. 3 Прикінцевих положень"),
      edition("pku", "п. 16-1 підрозд. 10 розд. XX"),
    ],
    except: {
      esvMinMonthlyUah: { method: "derived", why: "1 902,34 = 22% × 8 647; тримає тест інваріанта" },
    },
  },
});

/** ISO-дата (YYYY-MM-DD) з будь-якого рядка з датою на початку, або null. */
function isoDay(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

/**
 * Що в метаданих ELI змінює текст норми: зміна акта, офіційне виправлення
 * тексту (так у 2020 році правили конвенцію PL-UA) і рішення Трибуналу.
 * Ключ — дослівно як в ELI, значення — назва для звіту.
 */
export const TEXT_CHANGES = Object.freeze({
  "Akty zmieniające": "зміна",
  Sprostowanie: "виправлення тексту",
  "Orzeczenie TK": "рішення TK",
});

/**
 * Зміни тексту акта з метаданих ELI: `[{ id, kind, effective }]`. Дата є лише
 * у змін (набрання чинності); у виправлень і рішень TK її немає — `null`.
 *
 * Акт, який ніколи не змінювали (конвенція PL-UA), приходить з `references`,
 * але без ключа змін — це порожній список. А відповідь без `references`
 * узагалі — інша форма, і вона дає null: не має читатись як «змін немає».
 */
export function amendmentsOf(meta) {
  const refs = meta?.references;
  if (refs === null || typeof refs !== "object" || Array.isArray(refs)) return null;
  const out = [];
  for (const [key, kind] of Object.entries(TEXT_CHANGES)) {
    const list = refs[key] ?? [];
    if (!Array.isArray(list)) return null;
    out.push(...list.map((a) => ({ id: a.id, kind, effective: isoDay(a.date) })));
  }
  return out;
}

/**
 * Чи варто питати метадані зміни. З датою чинності не пізніше `verified_at` —
 * ні: опублікована вона ще раніше. Без дати — рік видно з ELI-id
 * (`DU/2023/353`): опублікована в році, що закінчився до року звірки, вона
 * не може бути новою. Інакше 26 рішень TK до ustawy o PIT коштували б 26
 * запитів щоциклу.
 */
export function isCandidate(a, verifiedAt) {
  if (a.effective !== null) return a.effective > verifiedAt;
  const year = Number(/^[A-Z]+\/(\d{4})\//.exec(a.id ?? "")?.[1]);
  return !Number.isFinite(year) || year >= Number(verifiedAt.slice(0, 4));
}

/**
 * Зміни, після яких звірка `verified_at` уже не доводить чинний текст:
 *   - опубліковані після `verified_at` — людина їх не могла бачити;
 *   - опубліковані раніше, але чинні з дня між `verified_at` і сьогодні —
 *     людина їх бачила як майбутні, а тепер текст у силі інший.
 * Зміна, що набуде чинності колись потім і була відома при звірці, не
 * рахується: інакше правило висіло б «потребує підтвердження» роками, і
 * повторна звірка цього не знімала б.
 *
 * Зміна без дати публікації (метадані не віддались) рахується: невідоме не
 * читаємо як «старе».
 *
 * @param {{ id: string, effective: string|null, promulgation?: string|null }[]} amendments
 */
export function relevantAmendments(amendments, verifiedAt, today) {
  return amendments.filter((a) => {
    if (a.effective !== null && a.effective <= verifiedAt) return false;
    if (a.promulgation === null || a.promulgation === undefined) return true;
    if (a.promulgation > verifiedAt) return true;
    return a.effective !== null && a.effective <= today;
  });
}

/**
 * Дата поточної редакції зі сторінки zakon.rada.gov.ua (уже текст, без тегів):
 * «поточна редакція — Редакція від 17.09.2026». null — маркера немає.
 */
export function currentEdition(text) {
  const m = /поточна редакція\s*[—–-]\s*Редакція від (\d{2})\.(\d{2})\.(\d{4})/.exec(text ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Запис звірки одного закону. `param` — мітка закону, щоб зведення правила
 * (`aggregateFields`) назвало, який саме закон визначив стан.
 */
function lawCheck(rule, law, url, state, extra) {
  return {
    rule_id: rule.rule_id,
    param: extra.param ?? lawLabel(law),
    method: law.method,
    law: lawLabel(law),
    // Число цим способом не порівнюється ніколи. Прапорець стоїть у самому
    // записі, а не лише в тексті звіту: хто читає `match` з історії циклу,
    // інакше прочитав би «джерело віддало те саме число» (рев'ю звіту 2026-10).
    compared: false,
    state,
    matrix_value: null,
    fetched_value: null,
    diff_percent: null,
    failure_reason: null,
    fetched_from: url,
    source_url: rule.source_url ?? null,
    verified_at: rule.verified_at ?? null,
    ...extra,
  };
}

/**
 * Звірка `act` для правила чи листа.
 *
 * @param {object} input
 * @param {{ meta: object|null, failure_reason: string|null }} input.act  метадані акта
 * @param {(id: string) => Promise<{ promulgation: string|null, title: string|null }>} input.amendment  метадані зміни
 */
export async function checkAct({ rule, law, param, act: source, amendment, today }) {
  const url = lawUrl(law);
  if (source.failure_reason) {
    return lawCheck(rule, law, url, STATES.UNAVAILABLE, { param, failure_reason: source.failure_reason });
  }
  const all = amendmentsOf(source.meta);
  if (all === null) {
    return lawCheck(rule, law, url, STATES.UNAVAILABLE, { param, failure_reason: "ELI не віддав списку змін акта — форма відповіді інша" });
  }
  const candidates = all.filter((a) => isCandidate(a, rule.verified_at));
  const detailed = [];
  for (const a of candidates) {
    const info = await amendment(a.id);
    detailed.push({ ...a, promulgation: info.promulgation, title: info.title });
  }
  const amended = relevantAmendments(detailed, rule.verified_at, today);
  if (amended.length === 0) {
    return lawCheck(rule, law, url, STATES.MATCH, { param });
  }
  return lawCheck(rule, law, url, STATES.NEEDS_CONFIRMATION, {
    param,
    amended,
    failure_reason: `текст акта змінився після verified_at (${summarizeKinds(amended)}) — перечитати ${law.where}`,
  });
}

/** «зміна — 3, рішення TK — 1»: що саме сталось з актом, без повтору кожного запису. */
function summarizeKinds(amended) {
  const counts = new Map();
  for (const a of amended) counts.set(a.kind, (counts.get(a.kind) ?? 0) + 1);
  return [...counts].map(([kind, n]) => `${kind} — ${n}`).join(", ");
}

/**
 * Звірка документа відбитком: файл за посиланням той самий, що в день звірки.
 * Інший відбиток — не «розбіжність», а «потребує підтвердження»: документ
 * переклали чи виправили, і що саме змінилось, скаже лише прочитання.
 */
export function checkDocument({ rule, law, param, sha256, failure_reason }) {
  const url = lawUrl(law);
  if (failure_reason) {
    return lawCheck(rule, law, url, STATES.UNAVAILABLE, { param, failure_reason });
  }
  if (sha256 === EDITIONS[law.key].sha256) {
    return lawCheck(rule, law, url, STATES.MATCH, { param });
  }
  return lawCheck(rule, law, url, STATES.NEEDS_CONFIRMATION, {
    param,
    edition: `sha256 ${String(sha256).slice(0, 12)}…`,
    failure_reason: `файл документа змінився після звірки — перечитати ${law.where}`,
  });
}

/** Звірка `edition`: дата чинної редакції проти `verified_at`. */
export function checkEdition({ rule, law, param, text, failure_reason }) {
  const url = lawUrl(law);
  if (failure_reason) {
    return lawCheck(rule, law, url, STATES.UNAVAILABLE, { param, failure_reason });
  }
  const current = currentEdition(text);
  if (current === null) {
    return lawCheck(rule, law, url, STATES.UNAVAILABLE, {
      param,
      failure_reason: "дати поточної редакції на сторінці не знайдено — сторінку перебудовано",
    });
  }
  // Дата редакції — не значення правила, тож у `fetched_value` її не кладемо:
  // поруч із `matrix_value: null` вона читалась би як розбіжність.
  if (current <= rule.verified_at) {
    return lawCheck(rule, law, url, STATES.MATCH, { param, edition: current });
  }
  return lawCheck(rule, law, url, STATES.NEEDS_CONFIRMATION, {
    param,
    edition: current,
    failure_reason: `нова редакція від ${current} після verified_at — перечитати ${law.where}`,
  });
}
