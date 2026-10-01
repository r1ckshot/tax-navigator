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
 * `derived` — не спосіб звірки, а позначка похідного числа: його тримає тест
 * інваріанта в `app/lib/**` (evidence-numbers: похідні звіряти між собою).
 */
const num = (spec) => ({ kind: "number", value: AMOUNT, ...spec });
const pct = (spec) => ({ kind: "number", value: PERCENT, scale: 100, ...spec });
const int = (spec) => ({ kind: "number", value: INTEGER, ...spec });
const date = (spec) => ({ kind: "date", value: PL_DATE, ...spec });
const quote = (re) => ({ kind: "quote", quote: re });
const via = (method, why) => ({ method, why });

const ZDROWOTNA_RATE_ACT = via("act", "ставка zdrowotnej — art. 79 ustawy o świadczeniach opieki zdrowotnej; сторінки з самою ставкою по цій формі немає");
const NOT_FROM_TAX_ACT = via("act", "відрахування zdrowotnej від податку скасоване з 2022 (uchylony art. 27b ustawy o PIT) — це відсутність норми, на сторінці її не процитуєш");
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
      ulgaNaStartMonths: via("act", "6 місяців — art. 18 ustawy Prawo przedsiębiorców; на сторінці складок строку немає"),
      preferencyjnyMonths: via("act", "24 місяці — art. 18a ustawy o systemie ubezpieczeń społecznych"),
      priorBusinessLookbackMonths: via("act", "60 місяців — art. 18 Prawa przedsiębiorców і art. 18a ustawy o sus"),
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
      deductibleShareOfRevenue: via("act", "50% сплаченої zdrowotnej від przychodu — art. 11 ust. 1c ustawy o zryczałtowanym podatku"),
    },
  },

  "jdg.liniowy": {
    url: URLS.stawki,
    fields: {
      rate: pct({ before: /- od dochodów z pozarolniczej działalności gospodarczej lub z działów specjalnych produkcji rolnej, gdy podatnik wybrał tę formę/, within: 8 }),
      zdrowotnaMinMonthly: ZDROWOTNA_MIN,
    },
    elsewhere: {
      zdrowotnaRate: via("act", "4,9% — art. 79 ust. 6 ustawy o świadczeniach; на сторінках zus.pl і podatki.gov.pl ставки liniowej zdrowotnej немає"),
      zdrowotnaAnnualDeductionCap: via("act", "14 100 zł — art. 30c ust. 2 ustawy o PIT, ліміт на 2026 рік оголошує komunikat MF"),
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
      kupCopyright: via("act", "50% — art. 22 ust. 9 pkt 3 ustawy o PIT; сторінка podatki про zlecenie авторських KUP не називає"),
      copyrightAnnualCap: via("act", "120 000 zł — art. 22 ust. 9a ustawy o PIT"),
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
    },
    elsewhere: {
      testIsFactsNotContractName: via("llm", "що вирішують факти, а не назва umowy, сторінка каже описом процедури, а не одним реченням — потрібен витяг із тексту ustawy o PIP"),
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
    },
    elsewhere: {
      goodsSaleIsNoTitle: via("llm", "що продаж товарів не дає титулу до ZUS, сторінка не каже одним реченням — висновок з art. 6 ustawy o sus"),
      socialWaivedWhenUopAtLeastMinimumWage: via("llm", "звільнення при etacie ≥ мінімалки — у розділі про zlecenie сторінки описом, без опорної фрази"),
      zdrowotnaAlwaysDue: via("llm", "zdrowotna з кожного zlecenia — у сторінці лише непрямо"),
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
      lumpSumKupAvailable: via("llm", "відсутність ryczałtowych KUP — сторінка не заперечує прямо, висновок з art. 22 ustawy o PIT"),
      monthlyAdvancesRequired: via("llm", "без zaliczek — art. 44 ust. 1 pkt 1 ustawy o PIT; сторінка podatki цього не формулює"),
    },
  },

  "nierejestrowana.cudzoziemcy": {
    url: URLS.nierej,
    fields: {
      restrictedFrom: date({ after: [/Cudzoziemcy Od/], within: 20 }),
      residencePermitRequired: quote(/posiada tytuł pobytowy umożliwiający rejestrację tej działalności/),
    },
    elsewhere: {
      ukrPeselEligible: via("llm", "статус UKR як підстава — у сторінці загально («objęci ochroną czasową»); точне формулювання в ustawie o pomocy obywatelom Ukrainy"),
    },
  },
});
