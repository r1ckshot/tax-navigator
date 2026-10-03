// Реєстр способів звірки: кожне правило матриці → як саме автозвірка його
// перевіряє. DECISIONS 2026-10-01: автозвірка покриває всі правила, і нове
// правило без способу ламає `npm test` (`methods.test.mjs` читає всі
// `app/lib/rules/rules.*.json`, тож це діє для будь-якої країни).
//
// Чому реєстр тут, а не службовим полем у самому правилі: спосіб `page` — це
// код (маркери й регулярки `pages.mjs`), у JSON його не покладеш, а розносити
// одне рішення по двох файлах означало б дві копії, що розходяться. Матриця
// лишається даними продукту, без знань про монітор.
//
// Пояснення по кожному правилу для людини —
// `docs/features/rules-change-monitor/verification-methods.md`.

export const METHODS = Object.freeze({
  /** Число з державної сторінки за маркерами (`pages.mjs`). */
  PAGE: "page",
  /** Акт змінено після `verified_at` (ELI API Сейму) — сигнал перечитати норму. */
  ACT: "act",
  /** Дата чинної редакції закону (zakon.rada.gov.ua) пізніша за `verified_at`. */
  EDITION: "edition",
  /** Модель дістає значення з тексту, скрипт перевіряє його дослівно в тому ж тексті. */
  LLM: "llm",
  /** Лише з причиною. Ціль — жодного. */
  MANUAL: "manual",
});

/** Позначка листа, який не звіряється з джерелом, бо виводиться з інших (`pages.mjs`). */
export const DERIVED = "derived";

/** Способи, які цикл виконує. `manual` — ні: його суть у тому, що звіряє людина. */
export const IMPLEMENTED = Object.freeze([METHODS.PAGE, METHODS.ACT, METHODS.EDITION, METHODS.LLM]);

const page = (why) => ({ method: METHODS.PAGE, why });

/** @type {Record<string, { method: string, why: string }>} */
export const VERIFICATION = Object.freeze({
  "residency.days_threshold": {
    method: METHODS.ACT,
    why: "183 дні — art. 3 ust. 2a ustawy o PIT; objaśnienia MF на gov.pl лежать PDF-вкладенням, у HTML сторінки числа немає",
  },
  "residency.special_norm_52zr": {
    method: METHODS.ACT,
    why: "строк дії — art. 52zr ustawy o PIT (оновлено ustawą z 23.01.2026); source_url веде на druk Сейму (orka, за Imperva), а продовження строку — це нова зміна ustawy o PIT",
  },
  "residency.treaty_tiebreakers": {
    method: METHODS.ACT,
    why: "порядок критеріїв — art. 4 umowy PL-UA (Dz.U. 1994 nr 63 poz. 269); isap за Imperva, ELI віддає той самий акт",
  },
  "common.minimum_wage": page("zus.pl, таблиця складок 2026"),
  "common.projected_average_wage": page("zus.pl, розділ про ліміт річної бази"),
  "jdg.ryczalt.rate": page("podatki.gov.pl/stawki-i-limity: ставки 12% і 8,5% та ліміт 8 517 200 zł"),
  "jdg.zdrowotna.ryczalt": page("zus.pl: база 9 228,64 і три ставки по порогах; stat.gov.pl із source_url тепер редіректить на new.stat.gov.pl поза allowlist"),
  "jdg.liniowy": page("ставка 19% — podatki.gov.pl/stawki-i-limity, мінімальна zdrowotna — zus.pl; ставка 4,9% і ліміт 14 100 — act"),
  "jdg.skala": page("шкала 12/32%, поріг 120 000 і kwota zmniejszająca — podatki.gov.pl/stawki-i-limity"),
  "jdg.zus.stages": page("zus.pl: бази й суми preferencyjnego та dużego ZUS; строки 6/24/60 місяців — act"),
  "jdg.byly_pracodawca": {
    method: METHODS.ACT,
    why: "втрата ryczałtu при послугах колишньому роботодавцю — art. 8 ust. 2 ustawy o ryczałcie (ust. 1 pkt 6 uchylony); пільги ZUS — art. 18 Prawa przedsiębiorców і art. 18a ustawy o sus",
  },
  "incubator.kup": page("ціни абонементу — сторінки самих інкубаторів (Bizky Prime — нижня межа, FBA.ink — верхня); KUP 20/50%, ліміт 120 000 і відсутність ZUS — act"),
  "uop.employer_contributions": page("biznes.gov.pl/00274: таблиця розподілу складок 2026"),
  "uop.employee_contributions": page("biznes.gov.pl/00274: таблиця розподілу складок 2026"),
  "uop.pit": page("podatki.gov.pl: KUP 250 zł/міс; kwota zmniejszająca 300 = 3 600 / 12 зі stawki-i-limity"),
  "uop.annual_contribution_cap": page("zus.pl: річна база 282 600 zł на emerytalne і rentowe"),
  "fop.zaklad_in_pl": {
    method: METHODS.ACT,
    why: "zakład і незарахування ЄП — art. 5 і 7 umowy PL-UA; eureka.mf.gov.pl — застосунок без тексту в HTML",
  },
  "fop.esv_vz": {
    method: METHODS.EDITION,
    why: "ЄСВ 22% і ВЗ 1% — закони на zakon.rada.gov.ua з датою чинної редакції; мінзарплата — щорічний закон про бюджет",
  },
  "zlecenie.contributions": page("biznes.gov.pl/0098: приклад розрахунку складок із ставками"),
  "zlecenie.kup": page("podatki.gov.pl: KUP 20% і база після складок; 50% і 120 000 — act"),
  "zlecenie.zbieg_z_etatem": page("biznes.gov.pl/001785: мінімалка 4806 і дві опорні фрази"),
  "zlecenie.przekwalifikowanie": page("gov.pl: дата набрання чинності реформи PIP і фраза про стосунок праці за фактами"),
  "nierejestrowana.limit": page("biznes.gov.pl/00115: ліміт, частка мінімалки, строки й опорна фраза про przychody należne"),
  "nierejestrowana.zus": page("biznes.gov.pl/00115: три опорні фрази; поріг мінімалки й zdrowotna — фрази biznes.gov.pl/001785"),
  "nierejestrowana.pit": page("podatki.gov.pl: три опорні фрази; ryczałtowe KUP і zaliczki — act"),
  "nierejestrowana.cudzoziemcy": page("biznes.gov.pl/00115: дата обмеження, вимога tytułu pobytowego і фраза про PESEL зі статусом UKR"),
  "status.business_right": {
    method: METHODS.ACT,
    why: "перелік підстав — art. 4 ust. 1–2 ustawy o przedsiębiorcach zagranicznych, CUKR — art. 42w specustawy; biznes.gov.pl/00806 дає перелік таблицею документів, без фрази на кожну підставу",
  },
  "status.work_right": {
    method: METHODS.ACT,
    why: "swobodny dostęp і повідомлення — art. 3 і 5a ustawy z 20.03.2025 o powierzaniu pracy cudzoziemcom; державної сторінки з чинним переліком після 05.03.2026 немає",
  },
  "status.ukr_protection": page("gov.pl/udsc: строк захисту за рішенням Ради ЄС і дата умови військового обліку; втрата статусу — act (art. 106 і 109b ustawy o ochronie)"),
  "jdg.przekwalifikowanie": page("gov.pl/rodzina: дата реформи PIP, B2B серед договорів, припис перед рішенням; дія рішення в часі — act (ustawa o PIP і art. 14 ustawy zmieniającej)"),
});

/**
 * Листи `params`: шляхи до значень, які людина бачить як окремі цифри чи
 * твердження. Масив простих значень — один лист (`appliesTo`), масив об'єктів
 * розкривається за індексом (`tiers.0.monthly`).
 *
 * @param {unknown} params
 * @returns {string[]}
 */
export function leafPaths(params, prefix = "") {
  if (params === null || typeof params !== "object") return prefix ? [prefix] : [];
  if (Array.isArray(params) && params.every((v) => v === null || typeof v !== "object")) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(params).flatMap(([key, value]) => leafPaths(value, prefix ? `${prefix}.${key}` : key));
}

/** Значення за шляхом із `leafPaths`. */
export function valueAt(params, path) {
  return path.split(".").reduce((node, key) => (node === null || node === undefined ? undefined : node[key]), params);
}
