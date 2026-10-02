# Способи звірки — rules-change-monitor

Кожне правило `rules.2026.json` → як автозвірка його перевіряє. Джерело правди —
код: [`methods.mjs`](../../../scripts/rules-change-monitor/methods.mjs) (спосіб і
причина), [`pages.mjs`](../../../scripts/rules-change-monitor/pages.mjs) (де на
сторінці лежить кожне поле) і [`laws.mjs`](../../../scripts/rules-change-monitor/laws.mjs)
(які закони тримають правило). Таблиця нижче згенерована з них 2026-10-01, а
`methods.test.mjs` звіряє, що вона називає для кожного правила той самий спосіб,
що й код.

Рішення — DECISIONS 2026-10-01 (автозвірка покриває всі правила; сесія 03 —
закони, модель, `manual`-листи); сесії 02–03 ROADMAP.

## П'ять способів

| Спосіб | Що доводить | «Збігається» означає |
|---|---|---|
| `page` | число чи опорна фраза стоїть на державній сторінці дослівно | число те саме |
| `act` | текст акта не змінювався після `verified_at` (ELI API Сейму, `api.sejm.gov.pl`) | закон не мінявся; число не порівнювалось |
| `edition` | дата чинної редакції закону не пізніша за `verified_at` (zakon.rada.gov.ua); для документа без редакцій — той самий файл (sha256) | те саме для законів України й документів |
| `llm` | модель дістає значення з тексту, скрипт перевіряє цитату дослівно, а число — у цитаті | значення з дослівною цитатою, цитата у звіті |
| `manual` | лише з причиною й записом у DECISIONS | цикл не звіряє |

**Підсумок правил:** `page` — 20, `act` — 5, `edition` — 1, `llm` — 0, `manual` — 0.
Усі 26 виходять із циклу з автоматичним станом (`cycle.test.mjs`, прогін на фікстурах).

**Листи, які цикл не звіряє:** лише `derived` (тримає тест інваріанта або форма
таблиці). `manual`-листів нуль із сесії 04: ціни абонементу `incubator.kup` звіряються
сторінками самих інкубаторів — єдиними недержавними джерелами циклу. «Ефективних ставок»
PIT інкубатора більше немає: 13,6% виявилось ставкою до 2022 року, і податок тепер
рахує движок (DECISIONS 2026-10-01). Звіт називає `manual`-листи поіменно.

Інтерпретація KAS звіряється змінами ustawy o ryczałcie (документ з датою сам не
змінюється), Objaśnienia MF — відбитком PDF на gov.pl.

## Де живе реєстр і чому

У моніторі, а не службовим полем у правилі: спосіб `page` — це код (маркери й
регулярки), у JSON його не покладеш, а одне рішення у двох файлах дало б дві копії,
що розходяться. Guard у `npm test` (`methods.test.mjs`) читає **всі**
`app/lib/rules/rules.*.json`, тож правило будь-якої країни без способу — червоний
тест. Перевірено поломкою: прибраний запис `uop.pit` валить тест із назвою правила;
прибрані закони `residency.special_norm_52zr` — так само.

## Правило з кількома числами

Спосіб `page` звіряє правило по полях. Кожен лист `params` або має поле на сторінці,
або записаний в `elsewhere` зі способом і причиною. Третього немає, і guard ловить
загублений лист (перевірено: прибраний `taxFreeAmount` → червоний тест). Листи
`elsewhere` на `act` і `llm` звіряються в тому ж циклі, і стан правила — найгірший
з усіх його листів. `act`/`edition`-правило покрите своїми законами цілком, крім
листів у `except` (`manual` або `derived`), — інакше «закон не мінявся» читалось би
як підтвердження ринкової ціни абонементу.

Види полів сторінки: **число** (за ланцюжком маркерів у вікні, `scale` для ставок у %),
**дата** (польська дата словами → ISO), **цитата** (дослівна опорна фраза
твердження; зникла — `unavailable`, твердження перечитати очима).

`derived` — не спосіб звірки, а позначка похідного числа (`taxFreeAmount = 3 600 / 12%`):
його тримає тест інваріанта, як вимагає `evidence-numbers.md`.

## `act` і `edition`: що вважається зміною

Зміна закону після звірки — стан `needs_confirmation` («потребує підтвердження»), а
не «розбіжність»: число не порівнювалось.

- **ELI.** Рахуються зміни акта («Akty zmieniające»), офіційні виправлення тексту
  («Sprostowanie») і рішення TK, якщо опубліковані після `verified_at` або набрали
  чинності між `verified_at` і сьогодні. Зміна, опублікована до звірки й чинна
  колись потім, не рахується: людина її бачила, і повторна звірка має знімати сигнал.
- **Рівень — акт, не стаття.** Текст jednolity ELI віддає лише PDF, а `text.html`
  базового акта — первісна публікація (в ustawie o sus 1998 року немає art. 18a).
  Тому зміна PIT у чужій статті теж просить перечитати; звіт друкує назву кожної
  зміни раз на акт, щоб відсіяти її було справою хвилини.
- **zakon.rada.gov.ua.** Дата з «поточна редакція — Редакція від DD.MM.YYYY». Сайт має
  антиDDoS (`403` після кількох запитів поспіль), тож кожна сторінка — раз на цикл.

## `llm`: модель як читач, не джерело

Відповідь приймається, лише коли цитата є в тексті сторінки дослівно (≥ 20 символів),
а число — у цитаті; бюджет — 60 000 символів тексту, одна відповідь на лист, виклик
`claude -p` без інструментів. Живий прогін 2026-10-01 на семи колишніх `llm`-листах:
для трьох модель знайшла дослівну фразу — вони стали `quote`; двох тверджень
сторінка не каже — вони стали `act`; на двох модель чесно дала «ні», бо сторінка
00115 формулює звільнення через «pełny wymiar», а не мінімалку, — їх звіряє фраза
biznes.gov.pl/001785. Тож `llm`-листів зараз нуль.

## Таблиця

| Правило | Спосіб | Сторінка або закони | Полів | Листи на іншому способі | Чому |
|---|---|---|---|---|---|
| `residency.days_threshold` | `act` | ustawa o podatku dochodowym od osób fizycznych, art. 3 ust. 2a; Objaśnienia podatkowe MF z 29.04.2021 (rezydencja), PDF, с. 7–8, лічба днів: кожна частина дня — день | — | — | 183 дні — art. 3 ust. 2a ustawy o PIT; objaśnienia MF на gov.pl лежать PDF-вкладенням, у HTML сторінки числа немає |
| `residency.special_norm_52zr` | `act` | ustawa o podatku dochodowym od osób fizycznych, art. 52zr | — | — | строк дії — art. 52zr ustawy o PIT (оновлено ustawą z 23.01.2026); source_url веде на druk Сейму (orka, за Imperva), а продовження строку — це нова зміна ustawy o PIT |
| `residency.treaty_tiebreakers` | `act` | Konwencja PL-UA o unikaniu podwójnego opodatkowania, art. 4 ust. 2 | — | — | порядок критеріїв — art. 4 umowy PL-UA (Dz.U. 1994 nr 63 poz. 269); isap за Imperva, ELI віддає той самий акт |
| `common.minimum_wage` | `page` | zus.pl/wysokosc-skladek-na-ubezpieczenia-spoleczne | 1 | — | zus.pl, таблиця складок 2026 |
| `common.projected_average_wage` | `page` | zus.pl/wysokosc-skladek-na-ubezpieczenia-spoleczne | 1 | — | zus.pl, розділ про ліміт річної бази |
| `jdg.ryczalt.rate` | `page` | podatki.gov.pl/stawki-i-limity | 3 | — | podatki.gov.pl/stawki-i-limity: ставки 12% і 8,5% та ліміт 8 517 200 zł |
| `jdg.zdrowotna.ryczalt` | `page` | zus.pl/wysokosc-skladek-na-ubezpieczenia-spoleczne | 6 | tiers.2.annualRevenueUpTo (derived), deductibleShareOfRevenue (act: art. 11 ust. 1c) | zus.pl: база 9 228,64 і три ставки по порогах; stat.gov.pl із source_url тепер редіректить на new.stat.gov.pl поза allowlist |
| `jdg.liniowy` | `page` | podatki.gov.pl/stawki-i-limity + zus.pl/wysokosc-skladek-na-ubezpieczenia-spoleczne | 2 | zdrowotnaRate (act: art. 79 ust. 6), zdrowotnaAnnualDeductionCap (act: art. 30c ust. 2) | ставка 19% — podatki.gov.pl/stawki-i-limity, мінімальна zdrowotna — zus.pl; ставка 4,9% і ліміт 14 100 — act |
| `jdg.skala` | `page` | podatki.gov.pl/stawki-i-limity + zus.pl/wysokosc-skladek-na-ubezpieczenia-spoleczne | 5 | taxFreeAmount (derived), zdrowotnaRate (act: art. 79) | шкала 12/32%, поріг 120 000 і kwota zmniejszająca — podatki.gov.pl/stawki-i-limity |
| `jdg.zus.stages` | `page` | zus.pl/wysokosc-skladek-na-ubezpieczenia-spoleczne | 5 | ulgaNaStartMonths (act: art. 18 ust. 1), preferencyjnyMonths (act: art. 18a ust. 1), priorBusinessLookbackMonths (act: art. 18a ust. 2 pkt 1) | zus.pl: бази й суми preferencyjnego та dużego ZUS; строки 6/24/60 місяців — act |
| `jdg.byly_pracodawca` | `act` | ustawa o zryczałtowanym podatku dochodowym, art. 8 ust. 2; Prawo przedsiębiorców, art. 18 ust. 1; ustawa o systemie ubezpieczeń społecznych, art. 18a ust. 2 pkt 2 | — | — | втрата ryczałtu при послугах колишньому роботодавцю — art. 8 ust. 2 ustawy o ryczałcie (ust. 1 pkt 6 uchylony); пільги ZUS — art. 18 Prawa przedsiębiorców і art. 18a ustawy o sus |
| `incubator.kup` | `page` | bizky.ai/cennik-bizky-prime + fba.ink/en | 2 | kupStandard (act: art. 22 ust. 9 pkt 4), kupCopyright (act: art. 22 ust. 9 pkt 3), copyrightAnnualCap (act: art. 22 ust. 9a), hasZus (act: art. 6 ust. 1 (umowa o dzieło не тytuł)), isEstimate (derived) | ціни абонементу — сторінки самих інкубаторів (Bizky Prime — нижня межа, FBA.ink — верхня); KUP 20/50%, ліміт 120 000 і відсутність ZUS — act |
| `uop.employer_contributions` | `page` | biznes.gov.pl/00274 | 5 | — | biznes.gov.pl/00274: таблиця розподілу складок 2026 |
| `uop.employee_contributions` | `page` | biznes.gov.pl/00274 | 4 | zdrowotnaDeductibleFromTax (act: art. 27b (uchylony)) | biznes.gov.pl/00274: таблиця розподілу складок 2026 |
| `uop.pit` | `page` | podatki.gov.pl/koszty-uzyskania-przychodow + podatki.gov.pl/stawki-i-limity | 2 | — | podatki.gov.pl: KUP 250 zł/міс; kwota zmniejszająca 300 = 3 600 / 12 зі stawki-i-limity |
| `uop.annual_contribution_cap` | `page` | zus.pl/wysokosc-skladek-na-ubezpieczenia-spoleczne | 2 | — | zus.pl: річна база 282 600 zł на emerytalne і rentowe |
| `fop.zaklad_in_pl` | `act` | Konwencja PL-UA o unikaniu podwójnego opodatkowania, art. 5, 7 і 24; Податковий кодекс України, ст. 293 (ставка ЄП 3 групи); ustawa o zryczałtowanym podatku dochodowym, підстава відмови в інтерпретації KAS 0112-KDIL2-2.4011.234.2023.5.IM | — | numericRangeAvailable (derived), unverifiedComponents (derived) | zakład і незарахування ЄП — art. 5 і 7 umowy PL-UA; eureka.mf.gov.pl — застосунок без тексту в HTML |
| `fop.esv_vz` | `edition` | Закон № 2464-VI про ЄСВ, ст. 8 ч. 5 і ст. 1 ч. 1 п. 5; Закон № 4695-IX про Державний бюджет-2026, ст. 8, ст. 32 і п. 3 Прикінцевих положень; Податковий кодекс України, п. 16-1 підрозд. 10 розд. XX | — | esvMinMonthlyUah (derived) | ЄСВ 22% і ВЗ 1% — закони на zakon.rada.gov.ua з датою чинної редакції; мінзарплата — щорічний закон про бюджет |
| `zlecenie.contributions` | `page` | biznes.gov.pl/0098 | 9 | employee.zdrowotnaRate (act: art. 79), employee.zdrowotnaDeductibleFromTax (act: art. 27b (uchylony)) | biznes.gov.pl/0098: приклад розрахунку складок із ставками |
| `zlecenie.kup` | `page` | podatki.gov.pl/dochody-z-umowy-zlecenia-lub-o-dzielo | 2 | kupCopyright (act: art. 22 ust. 9 pkt 3), copyrightAnnualCap (act: art. 22 ust. 9a) | podatki.gov.pl: KUP 20% і база після складок; 50% і 120 000 — act |
| `zlecenie.zbieg_z_etatem` | `page` | biznes.gov.pl/001785 | 3 | — | biznes.gov.pl/001785: мінімалка 4806 і дві опорні фрази |
| `zlecenie.przekwalifikowanie` | `page` | gov.pl/rodzina/reforma-panstwowej-inspekcji-pracy | 2 | — | gov.pl: дата набрання чинності реформи PIP і фраза про стосунок праці за фактами |
| `nierejestrowana.limit` | `page` | biznes.gov.pl/00115 | 6 | — | biznes.gov.pl/00115: ліміт, частка мінімалки, строки й опорна фраза про przychody należne |
| `nierejestrowana.zus` | `page` | biznes.gov.pl/00115 + biznes.gov.pl/001785 | 5 | — | biznes.gov.pl/00115: три опорні фрази; поріг мінімалки й zdrowotna — фрази biznes.gov.pl/001785 |
| `nierejestrowana.pit` | `page` | podatki.gov.pl/dochody-z-dzialalnosci-nierejestrowanej | 3 | lumpSumKupAvailable (act: art. 22 ust. 9), monthlyAdvancesRequired (act: art. 44 ust. 1) | podatki.gov.pl: три опорні фрази; ryczałtowe KUP і zaliczki — act |
| `nierejestrowana.cudzoziemcy` | `page` | biznes.gov.pl/00115 | 3 | — | biznes.gov.pl/00115: дата обмеження, вимога tytułu pobytowego і фраза про PESEL зі статусом UKR |

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
- **zakon.rada.gov.ua не з'єднується приблизно раз на чотири спроби** (сесія 03). Збій
  TCP-з'єднання повторюється один раз через 3 с (`sources.mjs`); відповідь сервера —
  ніколи. Без повтору спосіб `edition` двічі з трьох прогонів давав «недоступне».

## Відкрите

- `jdg.zdrowotna.ryczalt`: `source_url` веде на `stat.gov.pl`, який редіректить на
  `new.stat.gov.pl` поза allowlist; число звіряється з zus.pl, посилання для людини
  варто оновити при наступній ручній звірці.
- Сигнал `act` на рівні статті: з сесії 04 це робить агент `investigate` за розкладом —
  читає текст змін (PDF з ELI → `pdftotext`) і чинну редакцію законів України
  (`zakon.rada.gov.ua/laws/show/<id>.txt`) і пропонує нову дату чернеткою PR. Перший
  прогін 2026-10-02 перезвірив так 9 правил із 11 (чернетка #120).
- ~~Ціни абонементу інкубаторів~~ — закрито в сесії 04: смуга 349–500 (Bizky Prime і
  FBA.ink), обидві межі звіряє `page`.
