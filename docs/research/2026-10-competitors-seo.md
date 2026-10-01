# Конкуренти й SEO-ландшафт: Tax Navigator (UA↔PL → Європа)

Дата збору: 2026-09-29 – 2026-10-01. Метод: лише WebSearch, 22 запити; WebFetch не використовувався. Пошук зупинено на вимогу координатора раніше, ніж планувалось, тож частина SEO-запитів **не прогнана**. Вони перелічені в розділі «Прогалини дослідження». Усі описи сервісів узято з пошукових сніпетів, сторінок ніхто не відкривав. Ціни й мови варто вважати **ймовірними, не перевіреними**, доки хтось не відкриє сайт.

Позначки: **[підтв.]** означає, що факт є прямо в сніпеті з URL. **[невизн.]** означає, що джерела розходяться, дані застарілі або це мій висновок.

---

## A. Міжкраїнні порівняння податків для фрілансерів, remote-працівників і експатів

### A1. Калькулятори net-доходу з кількома країнами

| Продукт | URL | Що робить | Модель оплати | Мови | Глибина | Звідки цифри |
|---|---|---|---|---|---|---|
| **SalariesCalc (SalaryCalc)** | https://salariescalc.com/ , https://salariescalc.com/salary-comparison/ | Один брутто-вхід дає net у 13 країнах поруч. Є **режим self-employed**, де для кожної країни взято спрощений режим: **JDG (PL), FOP 3 група (UA)**, OSVČ, ZZP, Forfettario, Micro-Entrepreneur, Selbstständig. Є зворотний режим net→gross | безкоштовно [невизн.: монетизацію не видно] | EN [невизн.: інші мови не перевірені] | Повний розрахунок податку й внесків, але **один режим на країну**. Яка форма JDG (skala, liniowy чи ryczałt) і який етап ZUS закладені, зі сніпета не видно. Сам сайт заявляє точність ±1–2% «для типових випадків» | «2026 rates from national tax authorities», курси з open.er-api.com. Посилань на конкретні норми в сніпеті немає [підтв.] |
| **SelfEmployedTax.eu** | https://selfemployedtax.eu/ , /poland/ | Хаб окремих калькуляторів самозайнятих по країнах. Для PL є skala, liniowy і ryczałt | безкоштовно [невизн.] | EN | Середня. Сайт прямо пише, що **не враховує** Mały ZUS Plus, ulga na start, IP Box і всіх ставок ryczałt [підтв.] | «local rules», без посилань на статті законів [невизн.] |
| **SalaryAfterTax.eu** | https://www.salaryaftertax.eu/en , гайд https://www.salaryaftertax.eu/en/guides/best-countries-europe-freelancers-tax-2026 | 18 країн, працівники. Окремий гайд порівнює фриланс у DE, ES і PT на рівнях €50k та €80k | безкоштовно, розрахунок у браузері | EN (+ інші?) [невизн.] | Повний розрахунок для найму, фриланс подано статтею | «official 2026 tax brackets» [підтв.] |
| **EuroDuty** | https://euroduty.eu/en/calculadora , хаб https://euroduty.eu/hub/salary-taxes | Net для всіх ЄС-27. Є крос-бордер калькулятор (живеш в одній країні, працюєш в іншій), симулятор переїзду і чатбот з трудового права | безкоштовно [невизн.] | Заявлено 19 мов. **Української не знайдено** [невизн.] | Найм — повний. Фриланс — лише блог-порівняння 6 країн, у якому EN-сніпет містить застарілу цифру по NL [невизн.] | «official 2026 data» |
| **TaxRavens** | https://taxravens.com/en | 50+ країн, спецрежими (NHR, Beckham, Non-Dom, flat tax) | безкоштовно [невизн.] | EN | Розрахунок із режимами | н/д |
| **NomadTaxCalc** | https://nomadtaxcalc.com/ | 178 країн. Податок плюс **визначення резидентства (183 дні, «fiscal limbo»)**, 1300+ угод про уникнення подвійного оподаткування, 87+ nomad-віз, порівняння двох країн | безкоштовно. Для збереження й шерингу потрібен акаунт [підтв.] | EN | Ширина замість глибини. Заявляє, що дає «estimates, not tax advice» | н/д. Сторінку-порівняння конкурентів сайт пише сам про себе |
| **CountryTaxCalc** | https://www.countrytaxcalc.com/ | Гайди й калькулятори, «best countries for freelancers» | **партнерські комісії** (reader-supported) [підтв.] | EN | Головним чином headline-діапазони («Germany 47–65%») | н/д |
| **NettoCalc / FinanceTools.eu / iCalculator / Apify EU Salary** | https://nettocalc.com/ , https://www.financetools.eu/ , https://tax.icalculator.com/europe-tax-calculators.html , https://apify.com/trovevault/eu-salary-calculator | Gross→net для найму в 15–27 країнах | безкоштовно. Apify — платна платформа (pay-per-run) | EN | Найм. **Самозайнятих немає** [невизн.] | NettoCalc посилається на відомства (BMF, HMRC) |
| **Pexpats** | https://pexpats.com/calculators/digital-nomad-tax-calculator-czech-eu | Nomad-калькулятор EU/CZ | лідогенерація для чеської релокаційної та податкової фірми [підтв.] | EN | CZ глибоко, решта поверхнево [невизн.] | н/д |

### A2. Релокаційні «куди переїхати» з податками

| Продукт | URL | Що робить | Глибина податків |
|---|---|---|---|
| Rewire Abroad | https://rewireabroad.com/compare-countries | Пара країн: податки, візи, вартість життя | headline [невизн.] |
| RelocateLab | https://relocatelab.com/ | Вводиш дохід і бачиш net, оренду, заощадження. Фокус на британцях | net для найму |
| MovingCal | https://www.movingcal.com/country-comparison | Набір калькуляторів на спільних даних 2026 | income tax + внески працівника, без спецрежимів |
| ShouldIMove | https://shouldimove.co/guides/relocating-to-europe-tax-guide | Net-зарплата в 45+ країнах, 320+ міст, правила резидентства | найм |
| Taxminator | https://taxminator.com/ | «AI-планувальник» для 30+ країн | змодельовано лише 7 країн, для решти — «custom rate» [підтв.] |
| ExpatLife.ai | https://expatlife.ai/rankings/best-eu-countries-for-expats | Рейтинги, AI-гайди | headline |

**Висновок по A.** Ринок англомовних калькуляторів «net по країнах» у 2026 переповнений. Більшість сайтів схожі на згенеровані SEO-продукти з однотипними назвами й «2026» у title. Їх спільні риси:
1. **Жодного українського інтерфейсу не знайдено.** SalariesCalc рахує FOP, але мова сайту англійська.
2. **Немає зв'язки «резидентство → яка країна оподатковує → форми роботи».** Резидентство рахує лише NomadTaxCalc, і то для nomad-сценарію без UA-специфіки (ФОП + військовий збір, ЄСВ, статус UKR/CUKR).
3. **Один режим на країну.** Ніхто не показує 6 форм роботи в одній країні діапазонами.
4. **Джерела задекларовані загально** («official data»). Посилання на конкретну норму біля кожної цифри не знайдено в жодного.
5. Помилки трапляються: EuroDuty має застарілий відрахунок по NL, FinanceTools — підозрілий приклад по DE (зауваження зробив сам пошуковий асистент, це **[невизн.]**).

---

## B. Податкова й правова інформація для українців за кордоном (UA/RU)

### B1. Офіційні державні джерела українською (Польща)
- **Податковий портал MF українською:** https://podatki-arch.mf.gov.pl/uk/ (архівний домен) і живі сторінки на www.podatki.gov.pl/uk/…, наприклад «Ставки податку на доходи фізичних осіб»: https://www.podatki.gov.pl/uk/zhitel-v/stavki-podatku-na-dokhodi-f-zichnikh-os-b/ . **Ця сторінка ранжується за запитом «податки B2B Польща скільки на руки»** (див. D). Є UA-брошури по Twój e-PIT: https://podatki-arch.mf.gov.pl/pit/twoj-e-pit/informacje-w-jezyku-ukrainskim/ . Мобільний застосунок podatki.gov.pl має українську мову (грудень 2025): https://www.podatki.gov.pl/odin-zastosunok-bagato-mozhlivostei [підтв.]
- **ZUS українською:** https://www.zus.pl/en/ua/holovna-storinka . Є UA-консультації телефоном і відео з перекладачем [підтв.; телефон зі статті 2023 — **невизн.**]
- **biznes.gov.pl/Ukraina:** https://www.biznes.gov.pl/pl/portal/031503 . Реєстрація бізнесу, вибір форми й форми оподаткування, незареєстрована діяльність [підтв.]
- **gov.pl/web/ua:** https://www.gov.pl/web/ua/uslugi
- **UNHCR Польща про CUKR:** https://help.unhcr.org/poland/uk/карта-побиту-cukr/

Сильна сторона держджерел — первинність. Слабка — розірваність: податок, ZUS і легалізація лежать на трьох порталах, калькулятора «скільки на руки» в жодного немає. Калькулятори є лише точкові, наприклад MDG на zus.pl: https://www.zus.pl/en/firmy/przedsiebiorco-przeczytaj-wazne/maly-zus-mdg-/kalkulator-mdg

### B2. Україномовні медіа й портали для мігрантів
| Сайт | URL | Тип контенту |
|---|---|---|
| Ukrainian in Poland | https://www.ukrainianinpoland.pl/uk/tax-liability-in-poland-uk/ | Довгі гайди (PIT-37, зарплата, фриланс), оновлюються у 2026 |
| Наш вибір | https://naszwybir.pl/pit-37-2023/ | Гайди PIT, офлайн-зустрічі. Частина старих статей (2021) застаріла [підтв.] |
| Poland-Consult | https://poland-consult.com/uk/europa/polska/podatki/podatki-jdg.html | Комерційна консалтингова компанія з великим UA-контентом. Ранжується в кількох кластерах |
| ЮА Мігрант | https://ua-migrant.pl/ | Гайди: ZUS, інкубатори, фриланс |
| europortal.biz.ua / migrant.biz.ua | https://europortal.biz.ua/evropa/polshha/opodatkuvannia-v-polshchi.html | SEO-портали по країнах ЄС, свіжі «2026» статті. Найближчий формат до «роутера країн» українською [невизн.: глибина] |
| Sestry.eu | https://www.sestry.eu/statti/na-rozdorizhzhi-yak-ukrayinci-mayut-splachuvati-podatki-yakshcho-prozhivayut-u-polshchi | Журналістика про резидентство |
| lawyer-catalog.com.ua | (див. D) | Довгі юридичні статті-лонгріди 2026: ФОП+Польща, JDG-заборони, umowa zlecenie |
| DOU (dou.ua) | https://dou.ua/forums/topic/41302/ , https://dou.ua/lenta/articles/business-incubator-poland/ | **Форумні треди з реальними цифрами від ІТ-шників.** Ранжуються першими в кількох кластерах |
| Дебет-Кредит, СОТА, M.E.Doc | https://news.dtkt.ua/... , https://sota-buh.com.ua/news/chy-zvilniaietsia-vid-pdfo-ta-vz-dokhid-ukraintsia-za-polskym-fop-jdg | Українська бухгалтерська преса. Розбирає UA-сторону: ПДФО, ВЗ на дохід від JDG |
| Wise / ZEN.COM (UA-блоги) | https://wise.com/ua/blog/podatky-v-polshchi , https://www.zen.com/ua/blog/taxes-in-poland-for-ukrainians/ | Фінтех-блоги українською, загальний рівень |

### B3. Інші країни, українською (з двох останніх запитів)
- **Іспанія:** Radar Fiscal https://radarfiscal.es/uk/guias/autonomo-para-ucranianos/ (гайд «Autónomo для українців 2026», є розділ про закриття ФОП); UCBI https://ucbi.es/ (резидентство українців, autónomo); itautonomos.com/ua https://itautonomos.com/ua/ (довідник плюс **каталог gestor-ів**, зокрема тих, хто знає і UA-податки); НАШІ ЛЮДИ; Laudis (UA-юрфірма, digital nomad); RU — Habr-кейс https://habr.com/ru/amp/publications/737308 .
- **Німеччина:** Handbook Germany UA https://handbookgermany.de/uk/self-employment (некомерційне джерело, ймовірно найсильніше) [невизн.]; Ukrainian in Germany https://ukrainianingermany.de/uk/self-employment-germany-ukrainians-2026-uk/ (той самий видавець, що й Ukrainian in Poland — **мережа «Ukrainian in X»**); finber.de/uk https://finber.de/uk/freelancer-guide/ (комерційний податковий сервіс з UA-гайдом); heidelberg-hilft-ukraine.de.
- **Грузія, Чехія, Португалія:** **не досліджено**, запити не прогнано.

### B4. Боти й застосунки
**Не досліджено.** Пошук Telegram-ботів не проводився. Чи є UA-боти з податків Польщі — **невідомо**.

---

## C. Польща: калькулятори B2B/JDG/«na rękę», бухгалтерії, інкубатори

### C1. Онлайн-бухгалтерії
| Сервіс | UA-контент | Безкоштовно | Платно |
|---|---|---|---|
| **inFakt** https://www.infakt.pl/kalkulatory/zmiany-podatkowe/ | Інтерфейс PL/EN. Є **бухгалтери з українською**, їх шукають фільтром «Obsługa w języku obcym»: https://pomoc.infakt.pl/hc/pl/articles/22106804481682 [підтв.] | Калькулятор B2B 2026 (PL) | Бухгалтерія. Ціни в джерелах розходяться: «від 100 zł/міс» і «30–50 PLN» [невизн.]. Відгук на DOU — 246 zł/міс [застаріле] |
| **ifirma** | App Store-опис українською (https://apps.apple.com/ua/app/.../id6752647263?l=uk). Блог про українців лише польською, зокрема про резидентство: https://www.ifirma.pl/blog/rezydencja-podatkowa-obywatela-ukrainy-uproszczenia-w-jej-ustalaniu/ [підтв.] | Статті | Бухгалтерія, ціни не знайдено [невизн.] |
| **wFirma** | Українського інтерфейсу не знайдено. Є двомовні фактури POL-UKR: https://pomoc.wfirma.pl/-faktura-w-jezyku-obcym-jak-wystawic [підтв.] | — | https://wfirma.pl/cennik (не відкривали) |
| **Fakturownia** | **Повний український інтерфейс** і шаблони: https://fakturownia.pl/po-ukrainsku-ua [підтв.] | План Micro — до 3 фактур на місяць | Решта планів [невизн.] |
| **CashDirector** https://cashdirector.pl/2025/05/27/jdg-dla-obywateli-ukrainy-co-trzeba-wiedziec/ | UA-бухгалтери, безкоштовна допомога з реєстрацією JDG [підтв. зі сніпета] | Реєстрація | Бухгалтерія |
| UA-бюро: buchalter-online.pl, latwy-start.pl (UA-статті про онлайн-бухгалтерії), firmove.pl, mm-biuro.pl/uk, buhgalter-militina.com (**платний відеокурс «Бухгалтерія ФОП в Польщі»**) | українською | статті | послуги, курс |

### C2. Калькулятори JDG/B2B із UA/RU-мовою
- **KalkulatorZUS.pl/ua** https://www.kalkulatorzus.pl/ua/jdg-dlya-ukraintsiv — **єдиний знайдений калькулятор із розділом українською**, присвяченим JDG для українців: ZUS, етапи, форми оподаткування, «на руки». Безкоштовний. Дані «станом на червень 2026» [підтв.]
- **podatki.wtf** https://www.podatki.wtf/ — у видачі є UA-title «Калькулятор податків Польща 2026 - B2B Зарплата». Порівнює ryczałt, liniowy і skala, рахує ZUS і VAT [невизн.: чи повний UA-інтерфейс]
- **Polskie Netto (RU)** https://polskienetto.pl/ru/ — JDG, UoP, погодинна ставка навпаки [підтв.]
- **b2bpodatki.pl (RU)** https://b2bpodatki.pl/kalkulator-dla-jdg/ ; **sobolevbel.github.io/jdg (RU)** — «JDG — ИП в Польше»; **ukdn.pl/ru** — вибір форми 2026; **gryphongroup.pl/ru**
- EN: nettome.pl (включно з IP Box і sp. z o.o.), ladnepodatki.pl/en, englishwizards.org, podnik.io
- PL (десятки): kalkulatorb2b.pl, policzb2b.pl, dobrykalkulator.pl, solid.jobs, kalkula.pl тощо. **Ніхто з них не моделює український бік** (ФОП, ЄСВ, ВЗ) і резидентство.
- Між калькуляторами є розбіжності методики (відрахування складки zdrowotnej), про це пишуть самі результати пошуку [невизн.]. Це аргумент на користь підходу «кожна цифра з джерелом».

### C3. Інкубатори й «фриланс без JDG»
| Сервіс | Ціна (2026) | UA-контент |
|---|---|---|
| **Useme** https://useme.com/en/ | 7,8% від замовлення (мін. 29 zł, макс. 349 zł, платить клієнт); Useme Plus — 499 або 599 zł (джерела розходяться) [невизн.] | Сайт PL/EN. Безкоштовна акція для українців діяла до кінця 2022 [підтв.] |
| **Bizky (колишній AIP / Fundacja AIP)** https://bizky.ai/ | Prime 349 zł/міс; UA-огляд 07.2026 називає 399 zł [невизн.] | **Блог українською й російською** (bizky.ai/blog/бізнес-інкубатор-у-польщі…) [підтв.] |
| Twój StartUp | 350 zł netto/міс; українці й білоруси — до 90% резидентів (за даними оператора) [невизн.] | н/д |
| Łatwy Start https://latwy-start.pl/en/ | 400–500 zł/міс, у частині пакетів +5–10% [невизн.] | UA-контент |
| BIZ UP https://www.bizup.ink/ | 349 zł/міс (самореклама) | українською |
| biznesexpert.eu/ua | н/д | українською |

Ризик для всіх цих моделей: з **8 липня 2026** діють правила перекваліфікації цивільних договорів у трудові (https://www.lawyer-catalog.com.ua/post/перекваліфікація-umowa-zlecenie-...) [невизн.: дату не звірено з першоджерелом].

---

## D. SEO-ландшафт (видача WebSearch, US-регіон, тож порядок у Google.pl/.ua може відрізнятись)

| # | Запит | Хто ранжується (у порядку видачі) | Тип контенту, що виграє |
|---|---|---|---|
| 1 | **ФОП чи JDG** | DOU-форум (Інкубатор чи JDG; ФОП в Україні + угода в Польщі), YouTube, poland-consult.com (×2), journal.ostapp.com.ua, euconlaw.com, lawyer-catalog.com.ua, poland.pruchay.com. Друга хвиля: news.dtkt.ua, DOU, sota-buh, **mof.gov.ua (PDF відповіді компетентного органу Польщі)**, sestry.eu, rates.fm, KPMG UA | Форуми з досвідом + юр/консалтинг-лонгріди. **Порівняльного інструмента немає.** Блог pruchay ще наводить ставку 18% (застаріле) |
| 2 | **податки B2B Польща скільки на руки** | DOU, **podatki.gov.pl/uk (ставки PIT)**, Forbes.ua (гід 2022), poland-consult, podatki.gov.pl/uk (ще одна сторінка), europortal.biz.ua, podatki.wtf, MDDP (EN), Habr | Офіційні ставки + старі гіди. **Конкретної відповіді «скільки на руки» українською з розрахунком немає**, калькулятори польськомовні |
| 3 | **JDG українець карта побиту 2026** | UNHCR, DOU, ZEN.COM, tk-smart-legal.pl, uaspilnota.net, wcrs.wroclaw.pl, skilldocs.pl, visia.com.ua, lawyer-catalog; PL — biznes.gov.pl, воєводства | Свіжі новинні та юридичні роз'яснення змін від 5.03.2026. Висока плинність. Приватні сайти суперечать одне одному (navimigrant.pl проти воєводства Люблін) |
| 4 | **CUKR JDG** | multi-viza.com.ua (RU+UA), startruck.pl, vavsynergy.com/ru, woborders.agency, gryphongroup.pl/ru, ds.solutions (EN), siiami.pl/ru | **Російськомовні сторінки візових і юридичних агенцій домінують.** Лідогенерація. Податкового виміру немає |
| 5 | **податки фрілансера в Іспанії українцю / autónomo українець податки** | radarfiscal.es/uk, ucbi.es (×3), itautonomos.com/ua, torrolengua.com, nashi-ludy.com, laudis.ua, habr (RU) | Нішеві UA-сайти газторій і консультантів. Гайди-«путівники 2026». **Калькулятора net українською немає** |
| 6 | **Gewerbe українець податки** | informator.ua, heidelberg-hilft-ukraine.de, finber.de/uk, rialtotenders (RU→UA), bus-truck.com.ua, ukrainianingermany.de (×2), **handbookgermany.de/uk (×2)** | Некомерційні довідники + медійні гайди. Цифри частково застарілі: ліміт Kleinunternehmer 22 000 € ще трапляється |
| 7 | налоги ИП Грузия для украинца | **не прогнано** | — |
| 8 | податкове резидентство Польща 183 дні | **окремо не прогнано**. Частково видно з #1 і з запиту «податки українців у Польщі»: naszwybir, ukrainianinpoland, sestry, M.E.Doc, TimeTax (timetax.pl/uk), Wise UA, KPMG UA | Статті-пояснювачі. Інтерактивного «визначника резидентства» українською не трапилось |
| 9 | (супутній) податки українців у Польщі | wise.com/ua, medoc.ua, zen.com/ua, sestry.eu, jobian.com, ukrainianinpoland (×3), KPMG UA, naszwybir (×4), timetax.pl/uk, poland-consult, migrant.biz.ua, europortal.biz.ua | Медіа-гайди й фінтех-блоги |
| 10 | (супутній) калькулятор B2B Польща українською | in-poland.com (RU, 2022), podatki.wtf, nettome, DOU, poland-consult, europortal, ladnepodatki (EN), izibiz.pl; RU-калькулятори b2bpodatki, polskienetto/ru | **Українськомовного калькулятора майже немає.** Є RU-калькулятори та UA-title у podatki.wtf |

**Мої 10 додаткових запитів не прогнано** через вимогу зупинитись. Список для наступної сесії: «ФОП за кордоном податкове резидентство», «чи можна мати ФОП живучи в Польщі», «ричалт 12% IT українець», «ZUS JDG 2026 скільки платити українцю», «UoP чи B2B що вигідніше», «подвійне оподаткування Україна Польща ФОП військовий збір», «налоги в Польше для украинцев ИП», «в якій країні ЄС найнижчі податки для фрілансера», «податки в Чехії для українців ОСВЧ», «Diia.City чи JDG».

### Що виграє у видачі (спостереження)
1. **DOU-треди** стоять у топі UA-видачі по Польщі. Це реальний досвід, але дати 2022–2023, цифри застарілі.
2. **Сторінки консалтингу й юрфірм** (poland-consult, lawyer-catalog, smart-legal, woborders) — лонгріди 2026, мета — лід.
3. **Офіційні UA-сторінки podatki.gov.pl** вже ранжуються, але дають ставки, а не відповідь.
4. **RU-видача по CUKR/JDG** належить візовим агенціям.
5. **Інструменти** (калькулятори) у UA-видачі майже відсутні. Вони польсько-, англо- або російськомовні.

---

## Побічна знахідка, важлива для продукту

**Проєкт змін PIT/ryczałt з 2027 року.** За повідомленнями, Рада міністрів 22.09.2026 ухвалила проєкт UD116: другий поріг 130 000 zł, нова ставка 24% для доходу 130–150 тис. zł, 32% понад 150 тис., ліміт ryczałt знижується з €2 млн до €250 тис., 17% ryczałt для пов'язаних осіб. Джерела: https://ksiegowosc.infor.pl/wiadomosci/7642538,... , https://lex.media.pl/nowa-skala-pit-22-cit-i-nizszy-limit-ryczaltu-od-2027-r-42172866.html , https://finwire.pl/artykuly/ryczalt-2027-uslugi-podmiot-powiazany-17-procent-nowela-pit-cit . **Це проєкт, не закон** [невизн.]. Для `rules.2026.json` нічого не змінює, але це прямий кандидат для rules-change-monitor і для SEO-сторінки «що зміниться у 2027».

---

## Прогалини дослідження (чесно)
- Сайти не відкривались, тому ціни, мови й глибину брали зі сніпетів.
- Не досліджено: Грузія (RU-видача), Чехія, Португалія, Telegram-боти й застосунки, власні 10 SEO-запитів, а також великі гравці Nomad Capitalist, Xolo, Accountable і Deel/Remote як «country explorers». Xolo (ES) і Accountable (DE) лише промайнули як калькулятори однієї країни.
- Регіон WebSearch — US, тому порядок видачі не дорівнює Google.pl/Google.com.ua.
