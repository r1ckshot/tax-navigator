# Способи звірки — rules-change-monitor

Кожне правило `rules.2026.json` → як автозвірка його перевіряє. Джерело правди —
код: [`methods.mjs`](../../../scripts/rules-change-monitor/methods.mjs) (спосіб і
причина) і [`pages.mjs`](../../../scripts/rules-change-monitor/pages.mjs) (де на
сторінці лежить кожне поле). Таблиця нижче згенерована з них 2026-10-01, а
`methods.test.mjs` звіряє, що вона називає для кожного правила той самий спосіб,
що й код.

Рішення — DECISIONS 2026-10-01 (автозвірка покриває всі правила); сесія 02 ROADMAP.

## П'ять способів

| Спосіб | Що доводить | Стан |
|---|---|---|
| `page` | число чи опорна фраза стоїть на державній сторінці дослівно | виконується циклом |
| `act` | акт не змінювався після `verified_at` (ELI API Сейму, `api.sejm.gov.pl`) | сесія 03 |
| `edition` | дата чинної редакції закону не пізніша за `verified_at` (zakon.rada.gov.ua) | сесія 03 |
| `llm` | модель дістає значення з тексту, скрипт перевіряє його дослівно в тому ж тексті | сесія 03 |
| `manual` | лише з причиною | **0 правил** |

**Підсумок:** `page` — 19, `act` — 6, `edition` — 1, `llm` — 0 як основний, `manual` — 0.

## Де живе реєстр і чому

У моніторі, а не службовим полем у правилі: спосіб `page` — це код (маркери й
регулярки), у JSON його не покладеш, а одне рішення у двох файлах дало б дві копії,
що розходяться. Guard у `npm test` (`methods.test.mjs`) читає **всі**
`app/lib/rules/rules.*.json`, тож правило будь-якої країни без способу — червоний
тест. Перевірено поломкою: прибраний запис `uop.pit` валить тест із назвою правила.

## Правило з кількома числами

Спосіб `page` звіряє правило по полях. Кожен лист `params` або має поле на сторінці,
або записаний в `elsewhere` зі способом і причиною. Третього немає, і guard ловить
загублений лист (перевірено: прибраний `taxFreeAmount` → червоний тест). Стан
правила — найгірший зі станів полів. Листи з `elsewhere` (крім `derived`) їдуть у
запис циклу як `pending`, і звіт називає їх поіменно під «Підтверджено»: збіг
сторінки не видається за підтвердження всього правила.

Види полів: **число** (за ланцюжком маркерів у вікні, `scale` для ставок у %),
**дата** (польська дата словами → ISO), **цитата** (дослівна опорна фраза
твердження; зникла — `unavailable`, твердження перечитати очима).

`derived` — не спосіб звірки, а позначка похідного числа (`taxFreeAmount = 3 600 / 12%`):
його тримає тест інваріанта, як вимагає `evidence-numbers.md`.

## Таблиця

| Правило | Спосіб | Сторінка | Полів | Листи на іншому способі | Чому |
|---|---|---|---|---|---|
| `residency.days_threshold` | `act` | — | — | — | 183 дні — art. 3 ust. 2a ustawy o PIT; objaśnienia MF на gov.pl лежать PDF-вкладенням, у HTML сторінки числа немає |
| `residency.special_norm_52zr` | `act` | — | — | — | строк дії art. 52zr — у specustawie ukraińskiej; source_url веде на druk Сейму (orka, за Imperva), а продовження строку — це нова зміна акта |
| `residency.treaty_tiebreakers` | `act` | — | — | — | порядок критеріїв — art. 4 umowy PL-UA (Dz.U. 1994 nr 63 poz. 269); isap за Imperva, ELI віддає той самий акт |
| `common.minimum_wage` | `page` | zus.pl/wysokosc-skladek-na-ubezpieczenia-spoleczne | 1 | — | zus.pl, таблиця складок 2026 |
| `common.projected_average_wage` | `page` | zus.pl/wysokosc-skladek-na-ubezpieczenia-spoleczne | 1 | — | zus.pl, розділ про ліміт річної бази |
| `jdg.ryczalt.rate` | `page` | podatki.gov.pl/stawki-i-limity | 3 | — | podatki.gov.pl/stawki-i-limity: ставки 12% і 8,5% та ліміт 8 517 200 zł; sip.lex.pl із source_url — комерційна база, свідомо не відкрита |
| `jdg.zdrowotna.ryczalt` | `page` | zus.pl/wysokosc-skladek-na-ubezpieczenia-spoleczne | 6 | tiers.2.annualRevenueUpTo (derived), deductibleShareOfRevenue (act) | zus.pl: база 9 228,64 і три ставки по порогах; stat.gov.pl із source_url тепер редіректить на new.stat.gov.pl поза allowlist |
| `jdg.liniowy` | `page` | podatki.gov.pl/stawki-i-limity + zus.pl/wysokosc-skladek-na-ubezpieczenia-spoleczne | 2 | zdrowotnaRate (act), zdrowotnaAnnualDeductionCap (act) | ставка 19% — podatki.gov.pl/stawki-i-limity, мінімальна zdrowotna — zus.pl; ставка 4,9% і ліміт 14 100 — act |
| `jdg.skala` | `page` | podatki.gov.pl/stawki-i-limity + zus.pl/wysokosc-skladek-na-ubezpieczenia-spoleczne | 5 | taxFreeAmount (derived), zdrowotnaRate (act) | шкала 12/32%, поріг 120 000 і kwota zmniejszająca — podatki.gov.pl/stawki-i-limity |
| `jdg.zus.stages` | `page` | zus.pl/wysokosc-skladek-na-ubezpieczenia-spoleczne | 5 | ulgaNaStartMonths (act), preferencyjnyMonths (act), priorBusinessLookbackMonths (act) | zus.pl: бази й суми preferencyjnego та dużego ZUS; строки 6/24/60 місяців — act |
| `jdg.byly_pracodawca` | `act` | — | — | — | заборона ryczałtu для послуг колишньому роботодавцю — art. 8 ust. 1 pkt 6 ustawy o ryczałcie; source_url — sip.lex.pl (комерційна база) |
| `incubator.kup` | `act` | — | — | — | KUP 20/50% і ліміт 120 000 — art. 22 ust. 9 і 9a ustawy o PIT; ціни абонементу інкубаторів — ринкові, не норма, і акт їх не підтверджує (сесія 03) |
| `uop.employer_contributions` | `page` | biznes.gov.pl/00274 | 5 | — | biznes.gov.pl/00274: таблиця розподілу складок 2026 |
| `uop.employee_contributions` | `page` | biznes.gov.pl/00274 | 4 | zdrowotnaDeductibleFromTax (act) | biznes.gov.pl/00274: таблиця розподілу складок 2026 |
| `uop.pit` | `page` | podatki.gov.pl/koszty-uzyskania-przychodow + podatki.gov.pl/stawki-i-limity | 2 | — | podatki.gov.pl: KUP 250 zł/міс; kwota zmniejszająca 300 = 3 600 / 12 зі stawki-i-limity |
| `uop.annual_contribution_cap` | `page` | zus.pl/wysokosc-skladek-na-ubezpieczenia-spoleczne | 2 | — | zus.pl: річна база 282 600 zł на emerytalne і rentowe |
| `fop.zaklad_in_pl` | `act` | — | — | — | zakład і незарахування ЄП — art. 5 і 7 umowy PL-UA; eureka.mf.gov.pl — застосунок без тексту в HTML |
| `fop.esv_vz` | `edition` | — | — | — | ЄСВ 22% і ВЗ 1% — закони на zakon.rada.gov.ua з датою чинної редакції; мінзарплата — щорічний закон про бюджет |
| `zlecenie.contributions` | `page` | biznes.gov.pl/0098 | 9 | employee.zdrowotnaRate (act), employee.zdrowotnaDeductibleFromTax (act) | biznes.gov.pl/0098: приклад розрахунку складок із ставками |
| `zlecenie.kup` | `page` | podatki.gov.pl/dochody-z-umowy-zlecenia-lub-o-dzielo | 2 | kupCopyright (act), copyrightAnnualCap (act) | podatki.gov.pl: KUP 20% і база після складок; 50% і 120 000 — act |
| `zlecenie.zbieg_z_etatem` | `page` | biznes.gov.pl/001785 | 3 | — | biznes.gov.pl/001785: мінімалка 4806 і дві опорні фрази |
| `zlecenie.przekwalifikowanie` | `page` | gov.pl/rodzina/reforma-panstwowej-inspekcji-pracy | 1 | testIsFactsNotContractName (llm) | gov.pl: дата набрання чинності реформи PIP |
| `nierejestrowana.limit` | `page` | biznes.gov.pl/00115 | 6 | — | biznes.gov.pl/00115: ліміт, частка мінімалки, строки й опорна фраза про przychody należne |
| `nierejestrowana.zus` | `page` | biznes.gov.pl/00115 | 2 | goodsSaleIsNoTitle (llm), socialWaivedWhenUopAtLeastMinimumWage (llm), zdrowotnaAlwaysDue (llm) | biznes.gov.pl/00115: дві опорні фрази; решта тверджень — llm |
| `nierejestrowana.pit` | `page` | podatki.gov.pl/dochody-z-dzialalnosci-nierejestrowanej | 3 | lumpSumKupAvailable (llm), monthlyAdvancesRequired (llm) | podatki.gov.pl: три опорні фрази; решта тверджень — llm |
| `nierejestrowana.cudzoziemcy` | `page` | biznes.gov.pl/00115 | 2 | ukrPeselEligible (llm) | biznes.gov.pl/00115: дата обмеження і вимога tytułu pobytowego |

## Пастки, знайдені на сторінках 2026-10-01

Усі тримає анти-регрес у `pages.test.mjs`.

- **8 517 200 проти 8 517 000.** На `stawki-i-limity` ліміт ryczałtu стоїть поруч із
  лімітом małego podatnika, округленим до 1000 zł.
- **«300 zł miesięcznie» — не kwota zmniejszająca.** На сторінці KUP це підвищені
  KUP для доїзду з іншого міста. Kwota zmniejszająca звіряється як 3 600 / 12 зі шкали.
- **`1441,80 zł` без пробілу тисяч.** Стара регулярка суми матчила з другої цифри і
  давала `441,80` — тисяча зникала мовчки.
- **podatki.gov.pl вшиває скрипт Incapsula у справжні сторінки.** Сигнатура
  challenge звужена до iframe `SWUDNSAI`; інакше всі правила podatki ставали б
  «заблокованими».
- **biznes.gov.pl/00115 відповідає за ~17 с.** Таймаут запиту піднято з 15 до 30 с.

## Відкрите для сесії 03

- `incubator.kup`: ціни абонементу інкубаторів — ринкові, а не норма, і `act` їх не
  підтверджує. Або сторінка інкубатора (новий домен — крок Mike), або явний `manual`
  з причиною.
- `jdg.zdrowotna.ryczalt`: `source_url` веде на `stat.gov.pl`, який тепер редіректить
  на `new.stat.gov.pl` поза allowlist; число звіряється з zus.pl, посилання для
  людини варто оновити при наступній ручній звірці.
