// Спосіб звірки `page`: де на державній сторінці лежить кожне число правила.
//
// Одне правило — одна основна сторінка й поля по листах `params`. Кожен лист
// правила або має тут поле, або записаний в `elsewhere` зі способом і причиною.
// Третього немає: guard-тест (`methods.test.mjs`) ламає `npm test`, якщо лист
// загубився. Інакше «збігається» означало б «збіглась одна цифра з семи», а
// `verified_at` за таким збігом (DECISIONS 2026-10-01) підтверджував би неперевірене.
//
// Сторінка в полі може відрізнятись від `source_url` правила: `source_url` —
// посилання для людини, а тут — місце, де число стоїть у тексті. Звіт друкує
// обидва (`fetched_from` і `source_url`), тож атрибуція не плутається.
//
// Маркери — фрагменти тексту, знятого 2026-10-01 (фікстури `__fixtures__/pages/`).

import { AMOUNT, INTEGER, PERCENT, PL_DATE } from "./extract.mjs";
import { act } from "./laws.mjs";

export const URLS = Object.freeze({
  zus: "https://www.zus.pl/baza-wiedzy/skladki-wskazniki-odsetki/skladki/wysokosc-skladek-na-ubezpieczenia-spoleczne",
  stawki: "https://www.podatki.gov.pl/podatki-firmowe/pit/stawki-i-limity",
  kupEtat: "https://www.podatki.gov.pl/twoj-e-pit/pytania-i-odpowiedzi/koszty-uzyskania-przychodow",
  zleceniePit: "https://www.podatki.gov.pl/podatki-osobiste/pit/informacje-podstawowe/co-jest-opodatkowane/dochody-z-umowy-zlecenia-lub-o-dzielo",
  nierejPit: "https://www.podatki.gov.pl/podatki-osobiste/pit/informacje-podstawowe/co-jest-opodatkowane/dochody-z-dzialalnosci-nierejestrowanej",
  uop: "https://www.biznes.gov.pl/pl/portal/00274",
  zlecenieZus: "https://www.biznes.gov.pl/pl/portal/0098",
  zbieg: "https://www.biznes.gov.pl/pl/portal/001785",
  nierej: "https://www.biznes.gov.pl/pl/portal/00115",
  pip: "https://www.gov.pl/web/rodzina/reforma-panstwowej-inspekcji-pracy",
  // Ціну абонементу називає лише сам інкубатор — держджерела в неї немає.
  bizkyPrime: "https://bizky.ai/cennik-bizky-prime/",
  fbaInk: "https://fba.ink/en/",
});

/**
 * Вид поля визначає, як порівнювати:
 *   - `number` — `pick` за маркерами, далі `normalize` + `diff` (стани match /
 *     cosmetic / divergence). `scale` — у скільки разів число на сторінці більше
 *     за матричне: ставка 0.0976 стоїть на сторінці як `9,76%` (scale 100).
 *   - `date` — польська дата словами проти ISO в матриці; лише match / divergence.
 *   - `quote` — дослівна опорна фраза, на якій стоїть твердження матриці (true чи
 *     false). Фраза зникла — `unavailable` з причиною: сторінку переписано, і
 *     твердження треба перечитати очима, а не вважати підтвердженим.
 *
 * `elsewhere[лист] = { method, why }` — лист, якого на цій сторінці немає.
 * `act` несе `law` (акт і місце в ньому, `laws.mjs`); `llm` несе
 * `ask: { type: "boolean"|"number", question }` — питання до тексту сторінки
 * правила, відповідь перевіряє `llm.mjs`. На 2026-10-01 `llm`-листів немає: усі
 * три твердження, для яких модель знайшла фразу, стали `quote`.
 * `derived` — не спосіб звірки, а позначка похідного числа: його тримає тест
 * інваріанта в `app/lib/**` (evidence-numbers: похідні звіряти між собою).
 */
const num = (spec) => ({ kind: "number", value: AMOUNT, ...spec });
const pct = (spec) => ({ kind: "number", value: PERCENT, scale: 100, ...spec });
const int = (spec) => ({ kind: "number", value: INTEGER, ...spec });
const date = (spec) => ({ kind: "date", value: PL_DATE, ...spec });
const quote = (re) => ({ kind: "quote", quote: re });
const via = (method, why, extra = {}) => ({ method, why, ...extra });
/** Лист на акті: `law` — який акт і яке місце перечитати, якщо акт змінився (`laws.mjs`). */
const onAct = (why, law) => via("act", why, { law });

const ZDROWOTNA_RATE_ACT = onAct("ставка zdrowotnej — art. 79 ustawy o świadczeniach opieki zdrowotnej; сторінки з самою ставкою по цій формі немає", act("swiadczenia", "art. 79"));
const NOT_FROM_TAX_ACT = onAct("відрахування zdrowotnej від податку скасоване з 2022 (uchylony art. 27b ustawy o PIT) — це відсутність норми, на сторінці її не процитуєш", act("pit", "art. 27b (uchylony)"));
/** Мінімальна zdrowotna стоїть перед періодом, до якого відноситься; поруч — ставка за січень. */
const ZDROWOTNA_MIN = num({ url: URLS.zus, before: /\(za miesiące od lutego 2026 r\. do stycznia 2027 r\./, within: 14 });
const PREF_TABLE = /Rodzaj ubezpieczenia: Emerytalne Rentowe Wypadkowe Chorobowe Podstawa wymiaru/;
const UOP_TABLE = /Rodzaj składki Finansowana przez pracownika Finansowana przez pracodawcę Razem/;

/** @type {Record<string, { url: string, fields: Record<string, object>, elsewhere?: Record<string, { method: string, why: string }> }>} */
export const PAGES = Object.freeze({
  "common.minimum_wage": {
    url: URLS.zus,
    fields: {
      monthly: num({ after: [/Od 1 stycznia do grudnia 2026 r\. minimalne wynagrodzenie za pracę wynosi/], within: 20 }),
    },
  },

  "common.projected_average_wage": {
    url: URLS.zus,
    fields: {
      monthly: num({ after: [/Kwota prognozowanego przeciętnego wynagrodzenia w 2026 roku wynosi/], within: 20 }),
    },
  },

  "uop.annual_contribution_cap": {
    url: URLS.zus,
    fields: {
      annualBaseCap: num({ after: [/Roczna podstawa wymiaru na ubezpieczenia emerytalne i rentowe w 2026 roku może wynosić maksymalnie/], within: 20 }),
      appliesTo: quote(/Roczna podstawa wymiaru na ubezpieczenia emerytalne i rentowe/),
    },
  },

  "jdg.zus.stages": {
    url: URLS.zus,
    fields: {
      // Таблиця preferencyjnych має чотири колонки без FP, таблиця dużego — п'ять,
      // з «FP i FS». Шапка таблиці і є маркером: «Podstawa wymiaru» сам по собі
      // трапляється на сторінці десятки разів.
      preferencyjnyBase: num({ after: [PREF_TABLE], within: 20 }),
      preferencyjnyWithSickness: num({ after: [PREF_TABLE, /Suma składek do zapłaty/], within: 20 }),
      preferencyjnyWithoutSickness: num({ after: [PREF_TABLE, /jeśli nie korzystasz z dobrowolnego ubezpieczenia chorobowego/], within: 20 }),
      duzyBase: num({ after: [/Emerytalne Rentowe Wypadkowe Chorobowe FP i FS Podstawa wymiaru/], within: 20 }),
      duzyMonthly: num({ after: [/Emerytalne Rentowe Wypadkowe Chorobowe FP i FS Podstawa wymiaru/, /Suma składek do zapłaty/], within: 20 }),
    },
    elsewhere: {
      ulgaNaStartMonths: onAct("6 місяців — art. 18 ustawy Prawo przedsiębiorców; на сторінці складок строку немає", act("prawoPrzedsiebiorcow", "art. 18 ust. 1")),
      preferencyjnyMonths: onAct("24 місяці — art. 18a ustawy o systemie ubezpieczeń społecznych", act("sus", "art. 18a ust. 1")),
      priorBusinessLookbackMonths: onAct("60 місяців — art. 18 Prawa przedsiębiorców і art. 18a ustawy o sus", act("sus", "art. 18a ust. 2 pkt 1")),
    },
  },

  "jdg.zdrowotna.ryczalt": {
    url: URLS.zus,
    fields: {
      base: num({ after: [/w czwartym kwartale 2025 r\. wyniosło/], within: 20 }),
      "tiers.0.annualRevenueUpTo": num({ after: [/od początku roku kalendarzowego, nie przekroczyły kwoty/], within: 20 }),
      "tiers.0.monthly": num({ after: [/od początku roku kalendarzowego, nie przekroczyły kwoty/, /Składka na ubezpieczenie zdrowotne wynosi/], within: 20 }),
      "tiers.1.annualRevenueUpTo": num({ after: [/przekroczyły kwotę [\d ]+ zł i nie przekroczyły kwoty/], within: 20 }),
      "tiers.1.monthly": num({ after: [/przekroczyły kwotę [\d ]+ zł i nie przekroczyły kwoty/, /Składka na ubezpieczenie zdrowotne wynosi/], within: 20 }),
      "tiers.2.monthly": num({ after: [/przekroczyły kwotę [\d ]+ zł\. Składka na ubezpieczenie zdrowotne wynosi/], within: 20 }),
    },
    elsewhere: {
      "tiers.2.annualRevenueUpTo": via("derived", "null — у верхнього порогу немає межі; це форма таблиці, а не число з джерела"),
      deductibleShareOfRevenue: onAct("50% сплаченої zdrowotnej від przychodu — art. 11 ust. 1c ustawy o zryczałtowanym podatku", act("ryczalt", "art. 11 ust. 1c")),
    },
  },

  "jdg.liniowy": {
    url: URLS.stawki,
    fields: {
      rate: pct({ before: /- od dochodów z pozarolniczej działalności gospodarczej lub z działów specjalnych produkcji rolnej, gdy podatnik wybrał tę formę/, within: 8 }),
      zdrowotnaMinMonthly: ZDROWOTNA_MIN,
    },
    elsewhere: {
      zdrowotnaRate: onAct("4,9% — art. 79 ust. 6 ustawy o świadczeniach; на сторінках zus.pl і podatki.gov.pl ставки liniowej zdrowotnej немає", act("swiadczenia", "art. 79 ust. 6")),
      zdrowotnaAnnualDeductionCap: onAct("14 100 zł — art. 30c ust. 2 ustawy o PIT, ліміт на 2026 рік оголошує komunikat MF", act("pit", "art. 30c ust. 2")),
    },
  },

  "jdg.skala": {
    url: URLS.stawki,
    fields: {
      bracketThreshold: int({ after: [/Skala podatkowa od 2022 roku: Podstawa obliczenia podatku \(zł\) Podatek wynosi: ponad do/], within: 12 }),
      lowerRate: pct({ after: [/Skala podatkowa od 2022 roku: Podstawa obliczenia podatku \(zł\) Podatek wynosi: ponad do/], within: 20 }),
      kwotaZmniejszajacaAnnual: num({ after: [/Skala podatkowa od 2022 roku:/, /minus kwota zmniejszająca podatek/], within: 20 }),
      upperRate: pct({ after: [/Skala podatkowa od 2022 roku:/, /10 800 zł \+/], within: 8 }),
      zdrowotnaMinMonthly: ZDROWOTNA_MIN,
    },
    elsewhere: {
      taxFreeAmount: via("derived", "30 000 = kwota zmniejszająca 3 600 / 12%; тримає тест інваріанта skala"),
      zdrowotnaRate: ZDROWOTNA_RATE_ACT,
    },
  },

  "jdg.ryczalt.rate": {
    url: URLS.stawki,
    fields: {
      rateProgramming: pct({ before: /- od przychodów ze świadczenia niektórych usług informatycznych/, within: 8 }),
      rateNarrowSupport: pct({ before: /- od przychodów m\.in\.: z działalności usługowej, dla której nie została przewidziana inna stawka/, within: 8 }),
      // Поруч стоїть 8 517 000 zł — ліміт małego podatnika, округлений до 1000.
      // Маркер прив'язаний до слів «opodatkowania ryczałtem», щоб не взяти його.
      annualLimit: num({ after: [/uprawniający do opodatkowania ryczałtem ewidencjonowanym w 2026 r\. 2 000 000 euro/], within: 20 }),
    },
  },

  "uop.employee_contributions": {
    url: URLS.uop,
    fields: {
      emerytalne: pct({ after: [UOP_TABLE, /Emerytalna/], within: 30 }),
      rentowe: pct({ after: [UOP_TABLE, /Rentowa/], within: 30 }),
      zdrowotnaRate: pct({ after: [UOP_TABLE, /Zdrowotna/], within: 30 }),
      chorobowe: pct({ after: [UOP_TABLE, /Chorobowa/], within: 30 }),
    },
    elsewhere: {
      zdrowotnaDeductibleFromTax: NOT_FROM_TAX_ACT,
    },
  },

  "uop.employer_contributions": {
    url: URLS.uop,
    fields: {
      // Колонки «працівник · роботодавець · разом»: у роботодавця — друга сума.
      emerytalne: pct({ after: [UOP_TABLE, /Emerytalna/], within: 30, nth: 1 }),
      rentowe: pct({ after: [UOP_TABLE, /Rentowa/], within: 30, nth: 1 }),
      wypadkowe: pct({ after: [/Składka na ubezpieczenie wypadkowe dla firmy, zatrudniającej do 9 osób wynosi/], within: 12 }),
      // У рядках FP і FGŚP колонка працівника — «-», тож перша сума вже роботодавця.
      fpFs: pct({ after: [UOP_TABLE, /Fundusz Pracy -/], within: 20 }),
      fgsp: pct({ after: [UOP_TABLE, /FGŚP -/], within: 20 }),
    },
  },

  "uop.pit": {
    url: URLS.kupEtat,
    fields: {
      kupMonthly: num({ after: [/nie mogą przekroczyć: 3 000 zł \(/], within: 12 }),
      // Пастка: на цій же сторінці стоїть «3 600 zł (300 zł miesięcznie)» — це
      // підвищені KUP для того, хто їздить на роботу з іншого міста, а не kwota
      // zmniejszająca. Тому 300 звіряється як 3 600 / 12 зі шкали на stawki.
      kwotaZmniejszajacaMonthly: num({ url: URLS.stawki, after: [/Skala podatkowa od 2022 roku:/, /minus kwota zmniejszająca podatek/], within: 20, scale: 12 }),
    },
  },

  "zlecenie.contributions": {
    url: URLS.zlecenieZus,
    fields: {
      "employer.emerytalne": pct({ after: [/finansowana przez zleceniodawcę składka emerytalna/], within: 12 }),
      "employer.rentowe": pct({ after: [/finansowana przez zleceniodawcę składka rentowa/], within: 12 }),
      "employer.wypadkowe": pct({ after: [/finansowana przez zleceniodawcę składka na ubezpieczenie wypadkowe/], within: 12 }),
      "employer.fpFs": pct({ after: [/finansowana przez zleceniodawcę składka na Fundusz Pracy/], within: 12 }),
      "employer.fgsp": pct({ after: [/składka na Fundusz Gwarantowanych Świadczeń Pracowniczych/], within: 12 }),
      "employee.emerytalne": pct({ after: [/Finansowana przez zleceniobiorcę składka emerytalna/], within: 12 }),
      "employee.rentowe": pct({ after: [/Finansowana przez zleceniobiorcę składka rentowa/], within: 12 }),
      "employee.chorobowe": pct({ after: [/Wyjątkiem jest składka na ubezpieczenie chorobowe od zleceniobiorcy \(/], within: 12 }),
      choroboweVoluntary: quote(/Ubezpieczenie chorobowe jest dobrowolne/),
    },
    elsewhere: {
      "employee.zdrowotnaRate": ZDROWOTNA_RATE_ACT,
      "employee.zdrowotnaDeductibleFromTax": NOT_FROM_TAX_ACT,
    },
  },

  "zlecenie.kup": {
    url: URLS.zleceniePit,
    fields: {
      kupStandard: pct({ after: [/Do przychodów z umowy zlecenia lub o dzieło możesz zastosować/], within: 8 }),
      appliedAfterSocialContributions: quote(/Oblicza się je od przychodu pomniejszonego o składki na ubezpieczenia społeczne/),
    },
    elsewhere: {
      kupCopyright: onAct("50% — art. 22 ust. 9 pkt 3 ustawy o PIT; сторінка podatki про zlecenie авторських KUP не називає", act("pit", "art. 22 ust. 9 pkt 3")),
      copyrightAnnualCap: onAct("120 000 zł — art. 22 ust. 9a ustawy o PIT", act("pit", "art. 22 ust. 9a")),
    },
  },

  // Смуга абонементу — від найдешевшого до найдорожчого з названих інкубаторів
  // (EVIDENCE, сценарій E). Стартова акція FBA («Instead of 500 zł only 350 zł»)
  // стоїть на тій самій сторінці, тож маркер — речення з FAQ про постійну ціну.
  "incubator.kup": {
    url: URLS.bizkyPrime,
    fields: {
      subscriptionMonthlyMin: int({ after: [/Miesięczny Koszt Podstawowy/], within: 12 }),
      subscriptionMonthlyMax: int({ url: URLS.fbaInk, after: [/The cost of incubator services is/], within: 12 }),
    },
    elsewhere: {
      kupStandard: onAct("20% — art. 22 ust. 9 pkt 4 ustawy o PIT; сторінки інкубаторів норми не цитують", act("pit", "art. 22 ust. 9 pkt 4")),
      kupCopyright: onAct("50% — art. 22 ust. 9 pkt 3 ustawy o PIT", act("pit", "art. 22 ust. 9 pkt 3")),
      copyrightAnnualCap: onAct("120 000 zł — art. 22 ust. 9a ustawy o PIT", act("pit", "art. 22 ust. 9a")),
      hasZus: onAct("umowa o dzieło не є тytułem do ubezpieczeń — art. 6 ust. 1 ustawy o sus; це відсутність норми, на сторінці її не процитуєш", act("sus", "art. 6 ust. 1 (umowa o dzieło не тytuł)")),
      isEstimate: via("derived", "позначка продукту: правило — оцінка"),
    },
  },

  "zlecenie.zbieg_z_etatem": {
    url: URLS.zbieg,
    fields: {
      socialWaivedWhenUopAtLeastMinimumWage: quote(/W takiej sytuacji pracownik może dobrowolnie przystąpić do ubezpieczenia społecznego z tytułu umowy-zlecenia/),
      minimumWageMonthly: num({ after: [/Wynagrodzenie minimalne w 2026 roku wynosi/], within: 12 }),
      zdrowotnaAlwaysDue: quote(/Niezależnie od wysokości wynagrodzenia, które otrzymujesz z tytułu pracy na etacie, składki na ubezpieczenie zdrowotne płacisz/),
    },
  },

  "zlecenie.przekwalifikowanie": {
    url: URLS.pip,
    fields: {
      pipDecisionPowerFrom: date({ after: [/Nowe przepisy obowiązują od/], within: 20 }),
      // Фразу знайшла модель (сесія 03, спосіб `llm`), але вона стоїть дослівно,
      // тож звіряється без моделі: дешевше і без судження в циклі.
      testIsFactsNotContractName: quote(/nie wolno zastępować umów o pracę umowami cywilnoprawnymi, jeżeli pomiędzy pracodawcą i pracownikiem zachodzi stosunek pracy/),
    },
  },


  "nierejestrowana.limit": {
    url: URLS.nierej,
    fields: {
      quarterlyLimit: num({ after: [/Limit kwartalnych przychodów dla działalności nierejestrowej w 2026 roku wynosi/], within: 16 }),
      shareOfMinimumWage: pct({ after: [/Limit kwartalnych przychodów dla działalności nierejestrowej w 2026 roku wynosi/, /co odpowiada/], within: 8 }),
      settledQuarterlyFrom: date({ before: /roku limit uprawniający do prowad/, within: 16 }),
      priorBusinessLookbackMonths: int({ after: [/w okresie ostatnich/], within: 6 }),
      daysToRegisterAfterExceeding: int({ before: /dni na zarejestrowanie działalności gospodarczej w CEIDG/, within: 4 }),
      countsAccruedNotReceived: quote(/wliczasz przychody należne z danego miesiąca, wynikające z wystawionych rachunków lub faktur , nawet jeśli faktycznie ich nie otrzymałeś/),
    },
  },

  "nierejestrowana.zus": {
    url: URLS.nierej,
    fields: {
      servicesAreZlecenieTitle: quote(/zawierane umowy o świadczenie usług stanowią umowy zlecenia/),
      payerIsClient: quote(/Od tych umów twój zleceniodawca odprowadza za ciebie składki do ZUS/),
      goodsSaleIsNoTitle: quote(/Nie będziesz mieć obowiązku opłacania składek na ubezpieczenia społeczne ani ubezpieczenie zdrowotne, jeśli w ramach działalności nierejestrowanej sprzedajesz towary/),
      // Сторінка 00115 описує звільнення через «pełny wymiar czasu pracy», а не
      // через мінімалку, і модель на ній чесно дала «ні». Поріг мінімалки
      // дослівно стоїть на сторінці про zbieg — тією ж фразою, що й у
      // `zlecenie.zbieg_z_etatem`.
      socialWaivedWhenUopAtLeastMinimumWage: { ...quote(/W takiej sytuacji pracownik może dobrowolnie przystąpić do ubezpieczenia społecznego z tytułu umowy-zlecenia/), url: URLS.zbieg },
      zdrowotnaAlwaysDue: { ...quote(/Niezależnie od wysokości wynagrodzenia, które otrzymujesz z tytułu pracy na etacie, składki na ubezpieczenie zdrowotne płacisz/), url: URLS.zbieg },
    },
  },


  "nierejestrowana.pit": {
    url: URLS.nierejPit,
    fields: {
      taxedBySkala: quote(/Do wyliczenia podatku od dochodu ustalonego według zasad ogólnych stosowana jest skala podatkowa/),
      actualDocumentedCostsOnly: quote(/Koszty te powinny być udokumentowane/),
      cashBasis: quote(/Koszty uzyskania przychodów rozpoznajesz kasowo/),
    },
    elsewhere: {
      // Модель на сторінці цього не знайшла (сесія 03): сторінка мовчить, а
      // мовчання не цитується. Обидва твердження — з тексту ustawy.
      lumpSumKupAvailable: onAct("ryczałtowe KUP — лише для титулів з art. 22 ust. 9; działalności nierejestrowanej серед них немає", act("pit", "art. 22 ust. 9")),
      monthlyAdvancesRequired: onAct("zaliczki — лише з джерел, перелічених в art. 44 ust. 1; dochód z działalności nierejestrowanej — «inne źródła»", act("pit", "art. 44 ust. 1")),
    },
  },

  "nierejestrowana.cudzoziemcy": {
    url: URLS.nierej,
    fields: {
      restrictedFrom: date({ after: [/Cudzoziemcy Od/], within: 20 }),
      residencePermitRequired: quote(/posiada tytuł pobytowy umożliwiający rejestrację tej działalności/),
      ukrPeselEligible: quote(/obywatele Ukrainy, którzy przebywają w Polsce legalnie i posiadają numer PESEL ze statusem UKR/),
    },
  },
});
