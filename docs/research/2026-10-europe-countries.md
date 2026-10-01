# Розширення Tax Navigator на Європу: факти для вибору перших країн

Дата дослідження: 2026-09-29 – 2026-10-01. Канал: лише WebSearch (одна спроба WebFetch на Eurostat Statistics Explained упала, як і очікувалось, повторів не було).

## 0. Як читати цей звіт (обмеження прогону)

Дослідження зупинили достроково за вказівкою координатора, тому рівень перевірки різний:

| Блок | Стан |
|---|---|
| 1. Кількість бенефіціарів тимчасового захисту (ТЗ) | **Перевірено** для 17 із 20 країн ЄС зі списку (Eurostat, кінець липня або червня 2026), плюс UK. Не знайдено: GR, HU, SI, MT; CY лише як ставка на 1000 жителів; GE не шукали |
| 2. Форми самозайнятості й пільгові режими | **Назви й механіка — із загальних знань, у цьому прогоні не звірені з першоджерелом.** Жодних чисел (ставок, порогів) без URL не наводжу: усюди «не перевірено». Виняток — поріг для AT з URL |
| 3. Право на самозайнятість під ТЗ | Загальна норма ЄС **перевірена** (ст. 12 Директиви 2001/55/ЄС + рішення 2022/382). Національні умови перевірені лише для DE, AT, CZ, PL, BE, EE |
| 4. Офіційні домени податкової й соцстраху | Домени названі із загальних знань; **доступність і WAF не перевіряли** — «не перевірено» для всіх |
| 5. Сигнали інтересу з боку UA IT | **Не перевірено** (не шукали) |

Наслідок для рішення: надійно ранжувати можна лише вісь «розмір діаспори». Решту осей у скорингу нижче позначено як експертну оцінку, яку треба звірити до старту конкретного навігатора (за правилом `evidence-numbers`).

### Загальне по ТЗ (перевірено)

- **31.07.2026: 4,43 млн** осіб під ТЗ у ЄС, +19 945 (+0,5 %) за місяць. Найбільше: DE 1 290 225 (29,1 %), PL 953 060 (21,5 %), CZ 395 225 (8,9 %). На 1000 жителів: CZ 36,2, SK 27,5, CY 26,7; ЄС — 9,8. Понад 98,5 % — громадяни України. — https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260910-1
- Червень 2026 (4 407 680), розбивка по країнах (SK, NL, IE, AT, BG, LV, EE, BE та ін.) — Інтерфакс-Україна з посиланням на Eurostat: https://interfax.com.ua/news/general/1192481.html ; Eurostat: https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260811-1
- Застереження Eurostat: цифри **ES, GR, IE, CY** включають частину осіб із уже недійсним статусом; країни по-різному знімають людей з обліку, тому можливі різкі місячні стрибки. **LV за липень 2026 даних не подала.**
- Наступний реліз (серпень 2026) очікується близько середини жовтня 2026 — моя оцінка за ритмом публікацій, не підтверджена дата.
- **Правова рамка змінилась:** 31.07.2026 Рада ЄС продовжила ТЗ до **4 березня 2028**; для **нових** заявників — умова виконання військових обов'язків за законом України (діє з 5.08.2026; DE, ES, CZ серед перших, хто відмовляє). — https://www.eeas.europa.eu/delegations/ukraine/krayiny-yes-pohodylysya-podovzhyty-tymchasovyy-zakhyst-dlya-tykh-khto-ryatuyetsya-vid-viyny-v_uk ; https://www.slovoidilo.ua/2026/08/21/infografika/svit/yaki-krayiny-pershymy-obmezhyly-nadannya-tymchasovoho-zaxystu-vijskovozobovyazanym-ukrayincyam
- Сирі дані: датасети Eurostat `migr_asytpsm`, `migr_asytpspop` — https://ec.europa.eu/eurostat/databrowser/view/migr_asytpsm__custom_10559172/default/table?lang=en

### Загальне по праву на самозайнятість під ТЗ (перевірено на рівні ЄС)

Ст. 12 Директиви 2001/55/ЄС: держави-члени **зобов'язані** дозволити особам під ТЗ найману роботу **і самозайнятість** (з дотриманням правил конкретної професії) на строк дії захисту; рішення 2022/382 поширило це на осіб з України. Тож базова відповідь для всіх 20 країн ЄС — **«так»**; відрізняються формальності. Огляди: EMN-OECD (2024) https://www.oecd.org/content/dam/oecd/en/topics/policy-issues/migration/OECD-EMN%20Inform_%20Labour-market-integration-of-beneficiaries-of-temporary-protection-from-Ukraine.pdf ; ELA (2023) https://www.ela.europa.eu/sites/default/files/2023-06/Report-on-the-Overview-of-the-measures-taken-by-EU-and-EFTA-countries-regarding-employment-and-social-security-of-displaced-persons-from-Ukraine.pdf ; Fragomen (огляд 2022: 5 країн, серед них AT і HU, тоді вимагали окремий дозвіл на роботу; DE явно дозволяє самозайнятість) https://www.fragomen.com/insights/eueea-temporary-protection-for-ukraine-taking-stock.html

---

## 1. Країни

Позначки: **[✓]** — перевірено з URL у цьому прогоні; **[нп]** — не перевірено (загальні знання, без URL, без чисел).

### Німеччина (DE)
1. **ТЗ: 1 290 225** (31.07.2026) [✓] — https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260910-1
2. Форми [нп]: *Freiberufler* (вільні професії; IT-розробник часто, але не завжди, кваліфікується — питання статусу визначає Finanzamt), *Gewerbe* (реєстрація промислу, Gewerbesteuer), *Kleinunternehmerregelung* (звільнення від ПДВ для малого обороту). Спеціального режиму для новоприбулих немає. Числа — не перевірено.
3. Самозайнятість під ТЗ: **так** [✓] — DE явно дозволяє (Fragomen). Нових заявників-чоловіків призовного віку з 5.08.2026 обмежують [✓, slovoidilo вище].
4. Джерела [нп]: `bundesfinanzministerium.de`, `elster.de`, `deutsche-rentenversicherung.de`. Доступність/WAF — не перевірено.
5. Сигнали UA IT: не перевірено.

### Чехія (CZ)
1. **ТЗ: 395 225** (31.07.2026), 36,2 на 1000 — найвища ставка в ЄС [✓] — Eurostat вище.
2. Форми [нп]: *OSVČ* (živnostenské oprávnění) + **paušální daň** (єдиний місячний платіж замість податку й внесків, кілька смуг за доходом) — найближчий аналог польського ryczałt/UA ФОП. Паушальні витрати (výdajové paušály). Числа — не перевірено.
3. Самозайнятість під ТЗ: **так**, на тих самих умовах, що громадяни, без дозволу на роботу [✓] — огляд за пошуком (ECRE/зведення). **Ризик:** з 1.07.2026 повідомляється про жорсткіші умови продовження ТЗ (мова A2, стабільна зайнятість) — джерело низької авторитетності, **не перевірено** проти офіційного: https://www.visasupdate.com/post/czech-temporary-protection-rules-2026-ukraine-refugees
4. Джерела [нп]: `financnisprava.gov.cz`, `cssz.cz` (соцстрах), `mpsv.cz`. Доступність — не перевірено.
5. Сигнали: не перевірено.

### Іспанія (ES)
1. **ТЗ: 269 690** (30.06.2026); 267 400 (31.05.2026) [✓] — https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260710-1 ; червень за https://www.arc-legal.es/en/temporary-protection-in-the-eu-reaches-4-41-million-beneficiaries-at-the-end-of-june-2026/ . Липневої цифри не знайдено. Застереження Eurostat: включає частину недійсних статусів.
2. Форми [нп]: *autónomo* (RETA, внески за шкалою реальних доходів), *tarifa plana* (пільговий внесок для нових autónomos), **Beckham** (régimen especial de impatriados — плоска ставка для новоприбулих; після Ley de Startups поширений на частину підприємців/цифрових номадів — умови не перевірено). Числа — не перевірено.
3. Самозайнятість під ТЗ: так за ст. 12 Директиви [✓ рівень ЄС]; національні умови — не перевірено. Іспанія видала інструкцію про перехід з ТЗ на інші статуси (SEM 2/2026): https://www.inclusion.gob.es/documents/d/migraciones/instrucciones_transicion_desde_la_proteccion_temporal.pdf . З 5.08.2026 — обмеження для нових військовозобов'язаних [✓].
4. Джерела [нп]: `agenciatributaria.gob.es`, `seg-social.es`; ТЗ — `ucraniaurgente.inclusion.gob.es` (з'являвся в пошуку). Доступність — не перевірено.
5. Сигнали: не перевірено.

### Румунія (RO)
1. **ТЗ: 212 405** (31.05.2026, Eurostat, 11,15 на 1000) — за переказом румунських ЗМІ, напр. https://www.mediafax.ro/externe/peste-44-milioane-de-ucraineni-beneficiaza-de-protectie-temporara-in-ue-romania-pe-locul-5-intre-tarile-care-ii-gazduiesc-23788761 ; у липні +4 055 (+1,9 %) — друге найбільше зростання в ЄС [✓ Eurostat]. Національна цифра IGI: ~223 808 на 31.08.2026 — https://www.veridica.ro/stiri/aproape-224000-de-straini-beneficiaza-de-protectie-temporara-in-romania
2. Форми [нп]: *PFA* (особа-підприємець, норма доходу/реальна система), *microîntreprindere* (SRL з податком з обороту). Числа й умови після реформ 2023–2025 — не перевірено.
3. Самозайнятість під ТЗ: так за ст. 12 [✓ рівень ЄС]; національні умови — не перевірено.
4. Джерела [нп]: `anaf.ro`, `cnpp.ro`, ТЗ — `igi.mai.gov.ro`. Доступність — не перевірено.
5. Сигнали: не перевірено.

### Словаччина (SK)
1. **ТЗ: 147 320** (30.06.2026; ~27,5 на 1000 у липні) [✓] — https://interfax.com.ua/news/general/1192481.html
2. Форми [нп]: *živnosť* (SZČO) з паушальними витратами; невелика ставка податку для малого доходу. Числа — не перевірено.
3. Самозайнятість під ТЗ: так; у 2022 вимагалось повідомлення до служби зайнятості (Fragomen) [✓ стан 2022]. ТЗ продовжено автоматично до 4.03.2027: https://www.minv.sk/?tlacove-spravy-6=&sprava=docasne-utocisko-pre-odidencov-z-ukrajiny-na-slovensku-sa-automaticky-predlzuje-do-4-marca-2027
4. Джерела [нп]: `financnasprava.sk`, `socpoist.sk`. Доступність — не перевірено.
5. Сигнали: не перевірено.

### Нідерланди (NL)
1. **ТЗ: 142 210** (30.06.2026) [✓] — Інтерфакс вище.
2. Форми [нп]: *eenmanszaak / ZZP* (зареєстрований у KVK), підприємницькі відрахування (zelfstandigenaftrek, startersaftrek — поступово скорочуються); **30 %-ruling** — лише для найманих працівників-експатів, ZZP не покриває. Числа — не перевірено.
3. Самозайнятість під ТЗ: так за ст. 12 [✓ рівень ЄС]; нова умова щодо військових обов'язків описана юристами: https://hodak.nl/uk/blog-ua/tymchasovyj-zahyst-i-vijskovi-obovyazky-v-niderlandah/
4. Джерела [нп]: `belastingdienst.nl`, `kvk.nl`, `svb.nl`. Доступність — не перевірено.
5. Сигнали: не перевірено.

### Ірландія (IE)
1. **ТЗ: 120 170** (30.06.2026) [✓] — Інтерфакс вище. Застереження Eurostat: включає частину недійсних статусів.
2. Форми [нп]: *sole trader* (самооцінка, Form 11, PRSI class S). Спецрежим SARP — для найманих. Числа — не перевірено.
3. Самозайнятість під ТЗ: так за ст. 12 [✓ рівень ЄС]; національні умови — не перевірено.
4. Джерела [нп]: `revenue.ie`, `gov.ie` (DSP). Доступність — не перевірено.
5. Сигнали: не перевірено.

### Австрія (AT)
1. **ТЗ: 90 570** (30.06.2026) [✓] — Інтерфакс вище.
2. Форми [нп]: *Einzelunternehmen / Neue Selbständige* (страхування в SVS), Kleinunternehmerregelung. Числа — не перевірено, крім: **для переходу на Rot-Weiß-Rot-Karte plus самозайнятому потрібен річний дохід понад €6 221,28 (цифра 2024)** [✓] — ECRE WP 22 (02.2026): https://ecre.org/wp-content/uploads/2026/02/ECRE-Working-Paper-22_Transitioning-to-What_Legal-Statuses-Available-After-Temporary-Protection-for-People-Displaced-from-Ukraine_Paper-1.pdf
3. Самозайнятість під ТЗ: **так**, найм і самозайнятість, дозволу не треба, реєстрація в AMS рекомендована [✓] — ECRE вище. З 10.2024 відкрито перехід на RWR Card plus.
4. Джерела [нп]: `bmf.gv.at`, `svs.at`, `usp.gv.at`. Доступність — не перевірено.
5. Сигнали: не перевірено.

### Болгарія (BG)
1. **ТЗ: 74 040** (30.06.2026) [✓] — Інтерфакс вище. У травні 2026 найбільше падіння (−12 345; −14,8 %) — ознака хвилі зняття з обліку: https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260710-1
2. Форми [нп]: *ЕТ / свободна професия* з плоским податком на дохід; ЕООД. Числа — не перевірено.
3. Самозайнятість під ТЗ: так за ст. 12 [✓ рівень ЄС]; національні умови — не перевірено.
4. Джерела [нп]: `nap.bg`, `noi.bg`. Доступність — не перевірено.
5. Сигнали: не перевірено.

### Португалія (PT)
1. **ТЗ: 68 415** (31.07.2026) [✓] — https://www.tveuropa.pt/noticias/numero-de-ucranianos-com-estatuto-de-protecao-temporaria-cresce-na-uniao-europeia . AIMA (2024): 79 232 громадяни України, з них 55 245 під ТЗ — https://portugal.mfa.gov.ua/pt/partnership/240-ukrajinci-u-portugaliji/informaciya-pro-ukrayinsku-gromadu-v-portugaliyi
2. Форми [нп]: *trabalhador independente* (recibos verdes, regime simplificado — оподатковується частина обороту), **IFICI / «NHR 2.0»** (пільгова ставка для кваліфікованих новоприбулих у визначених видах діяльності). Числа — не перевірено.
3. Самозайнятість під ТЗ: так; у 2022 PT дозволяла роботу одразу з моменту подання заяви (Fragomen) [✓ стан 2022]. ТЗ продовжено до 4.03.2027 (RCM 53-A/2026): https://aima.gov.pt/pt/noticias/protecao-temporaria-para-pessoas-deslocados-da-ucrania-prorrogada-ate-2027
4. Джерела [нп]: `portaldasfinancas.gov.pt`, `seg-social.pt`, `aima.gov.pt`. Доступність — не перевірено.
5. Сигнали: не перевірено.

### Італія (IT)
1. **ТЗ: 53 975** (31.07.2026), 0,92 на 1000; у квітні +20,8 % за місяць [✓] — https://www.eunews.it/en/2026/09/10/eurostat-4-43-million-ukrainians-under-temporary-protection-in-the-eu-in-july-2026/ ; https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260610-1
2. Форми [нп]: *partita IVA* у **regime forfettario** (податок-замінник з частини обороту, знижена ставка для стартапу), **impatriati** (часткове звільнення доходу для новоприбулих; режим звужено реформою 2024). Числа — не перевірено.
3. Самозайнятість під ТЗ: так; у 2022 IT дозволяла роботу з моменту подання заяви (Fragomen) [✓ стан 2022].
4. Джерела [нп]: `agenziaentrate.gov.it`, `inps.it`. Доступність — не перевірено.
5. Сигнали: не перевірено.

### Литва (LT)
1. **ТЗ: 50 230** (30.06.2026) [✓] — https://eng.lsm.lv/article/society/society/11.08.2026-31000-ukrainians-currently-have-refuge-in-latvia.a658368/ (з посиланням на Eurostat)
2. Форми [нп]: *individuali veikla* (за довідкою), *verslo liudijimas* (патент для частини видів діяльності), MB. Числа — не перевірено.
3. Самозайнятість під ТЗ: так за ст. 12 [✓ рівень ЄС]; продовження ТЗ не автоматичне — заява через MIGRIS: https://www.lrt.lt/en/news-in-english/19/2690542/lithuania-extends-temporary-protection-for-ukrainian-refugees-until-march-2027
4. Джерела [нп]: `vmi.lt`, `sodra.lt`. Доступність — не перевірено.
5. Сигнали: не перевірено.

### Латвія (LV)
1. **ТЗ: 31 690** (30.06.2026) [✓] — LSM вище. **За липень 2026 LV даних не подала** (Eurostat).
2. Форми [нп]: *pašnodarbinātais*, *mikrouzņēmumu nodoklis* (режим скорочено в останні роки). Числа — не перевірено.
3. Самозайнятість під ТЗ: так за ст. 12 [✓ рівень ЄС]; національні умови — не перевірено.
4. Джерела [нп]: `vid.gov.lv`. Доступність — не перевірено.
5. Сигнали: не перевірено.

### Естонія (EE)
1. **ТЗ: 30 405** (30.06.2026) [✓] — LSM вище.
2. Форми [нп]: *FIE* (füüsilisest isikust ettevõtja), *ettevõtluskonto* (спрощений рахунок з податком з обороту), OÜ (e-Residency-екосистема). Числа — не перевірено.
3. Самозайнятість під ТЗ: так; ті самі права, що в естонських шукачів роботи/працівників [✓ за оглядом пошуку].
4. Джерела [нп]: `emta.ee`, `tootukassa.ee`. Доступність — не перевірено.
5. Сигнали: не перевірено.

### Хорватія (HR)
1. **ТЗ: 30 000** (30.06.2026) [✓ за переказом Eurostat у пошуковій видачі; першоджерело — `migr_asytpsm`]. Нац. джерело: https://hrvatskazaukrajinu.gov.hr/informacije/status-privremene-zastite/152
2. Форми [нп]: *obrt* (paušalni obrt — фіксований податок за смугами доходу), *slobodno zanimanje*. Числа — не перевірено.
3. Самозайнятість під ТЗ: так за ст. 12 [✓ рівень ЄС]; національні умови — не перевірено.
4. Джерела [нп]: `porezna-uprava.gov.hr`, `mirovinsko.hr`. Доступність — не перевірено.
5. Сигнали: не перевірено.

### Кіпр (CY)
1. **ТЗ: абсолютна цифра не перевірена.** Ставка 26,7 на 1000 (липень 2026), третя в ЄС; у липні −110 (−0,4 %) [✓ Eurostat]. Моя оцінка ~26–28 тис. — **не цифра Eurostat**. Застереження: включає частину недійсних статусів.
2. Форми [нп]: самозайнятий (ІПН за шкалою + GHS + соцстрах) або Ltd; **non-dom** і 50 %/20 % звільнення для новоприбулих — для найманих. Числа — не перевірено.
3. Самозайнятість під ТЗ: так за ст. 12 [✓ рівень ЄС]; національні умови — не перевірено.
4. Джерела [нп]: `tax.gov.cy` / Tax Department MoF, `mlsi.gov.cy` (соцстрах). Доступність — не перевірено.
5. Сигнали: не перевірено.

### Греція (GR), Угорщина (HU), Словенія (SI), Мальта (MT)
1. **ТЗ: не перевірено** (у пошуковій видачі відсутні; брати з `migr_asytpsm`). GR — з застереженням про недійсні статуси.
2. Форми [нп]: GR — ελεύθερος επαγγελματίας + пільга 50 % для новоприбулих (5B ΚΦΕ); HU — **KATA** (після 2022 лише для B2C, B2B-IT практично виключено), átalányadó; SI — **normirani s.p.** (нормовані витрати); MT — self-employed + Highly Qualified Persons (для найманих). Числа — не перевірено.
3. Самозайнятість під ТЗ: так за ст. 12 [✓ рівень ЄС]; **HU у 2022 вимагала окремий дозвіл на роботу** (Fragomen) — актуальність не перевірено.
4. Джерела [нп]: GR `aade.gr`, `efka.gov.gr`; HU `nav.gov.hu`; SI `fu.gov.si`, `zpiz.si`; MT `mtca.gov.mt` (CFR). Доступність — не перевірено.
5. Сигнали: не перевірено.

### Велика Британія (UK, поза ЄС, ТЗ немає)
1. Офіційний еквівалент [✓]: **290 044** віз за Ukraine Schemes з 03.2022 по 06.2026 (15 595 — за рік до 06.2026); **159 341** продовжень Ukraine Permission Extension (до 30.06.2026) — https://www.gov.uk/government/statistics/immigration-system-statistics-year-ending-june-2026/how-many-people-come-to-the-uk-via-safe-and-legal-humanitarian-routes ; ~234 тис. прибуттів (Homes for Ukraine + Family Scheme, дані до 12.2025) — https://commonslibrary.parliament.uk/research-briefings/cbp-9473/ . Шляху до ПМЖ немає.
2. Форми [нп]: *sole trader* (Self Assessment, Class 4 NIC), Ltd. Режимів для новоприбулих (крім ремітансу, скасованого з 2025) — не перевірено.
3. Самозайнятість: схеми дозволяють працювати; самозайнятість конкретно — не перевірено.
4. Джерела [нп]: `gov.uk` (HMRC). Доступність — не перевірено.
5. Сигнали: не перевірено.

### Грузія (GE, поза ЄС, ТЗ немає)
1. Еквівалент: **не перевірено** (не шукали).
2. Форми [нп]: **ІП зі статусом малого бізнесу** — податок з обороту до порогу; **резидентність ≠ безвізовий 1 рік** — числа не перевірено.
3. Самозайнятість: громадяни України в'їжджають без віз; право на ІП — не перевірено.
4. Джерела [нп]: `rs.ge` (Revenue Service). Доступність — не перевірено.
5. Сигнали: не перевірено (за загальним враженням — популярний напрям релокації UA IT у 2022, без URL).

### Польща (PL) — довідково, поточний ринок продукту
- **ТЗ: 953 060** (31.07.2026), єдина велика країна зі стійким падінням (−8 110 за липень) [✓ Eurostat].
- **Важливо для чинного продукту:** з 5.03.2026 право вести JDG на рівних з поляками прив'язане до статусу ТЗ; без статусу — загальні правила для громадян третіх країн [✓] — https://knowledge.dlapiper.com/dlapiperknowledge/globalemploymentlatestdevelopments/2026/changes-to-the-rules-governing-the-residence-and-employment-of-ukrainian-citizens-in-poland

### Інші країни з даних (не в списку, для контексту)
FR 48 865 (31.07.2026, https://www.tveuropa.pt/... вище); BE 96 180 і NO 86 570 (30.06.2026, Інтерфакс).

---

## 2. Прозорий скоринг

Формула: **Score = D × R × L**, кожна вісь 1–5. Вісь A (доступність офіційних джерел) **виключено (=1 для всіх)**, бо не перевірено жодного домену — її треба заміряти `curl` перед вибором (досвід репо: `tax.gov.ua`, `isap.sejm.gov.pl` за WAF).

- **D (діаспора, перевірено):** 5 — ≥1 млн; 4 — 250–999 тис.; 3,5 — 200–249 тис.; 3 — 100–199 тис.; 2,5 — 60–99 тис.; 2 — 40–59 тис.; 1,5 — <40 тис.; 1 — невідомо. (CY оцінено як 1,5 за власною оцінкою з per-1000.)
- **R (режим для IT-фрілансера, експертна оцінка, НЕ перевірено):** 5 — плаский/паушальний платіж, що закриває і податок, і внески; 4 — ставка з обороту/пільга новоприбулим; 3 — стандартна прогресія з відрахуваннями; 2 — складна/дорога система.
- **L (право на самозайнятість під ТЗ):** 5 — так без додаткових дозволів (ст. 12 + нац. підтвердження або без даних про обмеження); 4 — з додатковою формальністю (AT/HU історично); для UK/GE — 3 (не ТЗ).

| # | Країна | D | R | L | Score |
|---|---|---|---|---|---|
| 1 | CZ | 4 | 5 | 5 | 100 |
| 2 | RO | 3,5 | 4 | 5 | 70 |
| 3 | ES | 4 | 3 | 5 | 60 |
| 4 | SK | 3 | 3,5 | 5 | 52,5 |
| 5 | DE | 5 | 2 | 5 | 50 |
| 5 | PT | 2,5 | 4 | 5 | 50 |
| 5 | BG | 2,5 | 4 | 5 | 50 |
| 8 | NL | 3 | 3 | 5 | 45 |
| 9 | IT | 2 | 4 | 5 | 40 |
| — | IE 30, LT 30, HR 22,5, EE 30, LV 22,5, AT 25 (2,5×2,5×4), CY ~30, GR/HU/SI/MT — D невідомо | | | | |

Чутливість: DE стрибає на 1-ше місце, щойно R підняти до 4 (наприклад, якщо продукт таргетує не режим, а «великий незрозумілий ринок» — тоді складність = цінність навігатора). Це рішення про продуктову тезу, а не про факти.

## 3. Найбільші сюрпризи й ризики

1. **ТЗ продовжено до 4.03.2028, але для нових заявників — умова військового обліку (з 5.08.2026).** Роутер не може вважати ТЗ доступним «за замовчуванням»: для чоловіків призовного віку, які ще не мають статусу, гілка «отримати ТЗ» у DE/ES/CZ уже закрита.
2. **Польща з 5.03.2026 прив'язала JDG для українців до статусу ТЗ** — це торкається чинного продукту, не лише розширення; варто звірити з `rules.2026.json`/сценаріями.
3. **Дані Eurostat мають дірки й шум:** ES/GR/IE/CY рахують частину недійсних статусів, LV не подала липень, BG у травні −14,8 % за рахунок зняття з обліку. Для «розміру ринку» брати ковзну середню й нац. джерела, а не одну місячну цифру.
4. (Процесний) У цьому прогоні **не перевірено жодної ставки/порогу податкових режимів і жодного офіційного домену на WAF** — до старту будь-якого навігатора це окремий прохід за `evidence-numbers`.

## 4. Перелік джерел

- Eurostat, липень 2026: https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260910-1
- Eurostat, червень 2026: https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260811-1
- Eurostat, травень 2026: https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260710-1
- Eurostat, квітень 2026: https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260610-1
- Eurostat Statistics Explained: https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Temporary_protection_for_persons_fleeing_Ukraine_-_monthly_statistics
- Eurostat датасет migr_asytpsm: https://ec.europa.eu/eurostat/databrowser/view/migr_asytpsm__custom_10559172/default/table?lang=en
- Інтерфакс-Україна (червень 2026, розбивка по країнах): https://interfax.com.ua/news/general/1192481.html
- Eunews (липень 2026, IT): https://www.eunews.it/en/2026/09/10/eurostat-4-43-million-ukrainians-under-temporary-protection-in-the-eu-in-july-2026/
- LSM (Балтія, червень 2026): https://eng.lsm.lv/article/society/society/11.08.2026-31000-ukrainians-currently-have-refuge-in-latvia.a658368/
- ARC Legal (ES, червень 2026): https://www.arc-legal.es/en/temporary-protection-in-the-eu-reaches-4-41-million-beneficiaries-at-the-end-of-june-2026/
- TV Europa (PT, липень 2026): https://www.tveuropa.pt/noticias/numero-de-ucranianos-com-estatuto-de-protecao-temporaria-cresce-na-uniao-europeia
- Посольство України в PT (AIMA 2024): https://portugal.mfa.gov.ua/pt/partnership/240-ukrajinci-u-portugaliji/informaciya-pro-ukrayinsku-gromadu-v-portugaliyi
- AIMA, продовження до 2027: https://aima.gov.pt/pt/noticias/protecao-temporaria-para-pessoas-deslocados-da-ucrania-prorrogada-ate-2027
- Mediafax (RO, травень 2026): https://www.mediafax.ro/externe/peste-44-milioane-de-ucraineni-beneficiaza-de-protectie-temporara-in-ue-romania-pe-locul-5-intre-tarile-care-ii-gazduiesc-23788761
- Veridica (RO, IGI 31.08.2026): https://www.veridica.ro/stiri/aproape-224000-de-straini-beneficiaza-de-protectie-temporara-in-romania
- Hrvatska za Ukrajinu: https://hrvatskazaukrajinu.gov.hr/informacije/status-privremene-zastite/152
- MV SR (SK, продовження): https://www.minv.sk/?tlacove-spravy-6=&sprava=docasne-utocisko-pre-odidencov-z-ukrajiny-na-slovensku-sa-automaticky-predlzuje-do-4-marca-2027
- LRT (LT, MIGRIS): https://www.lrt.lt/en/news-in-english/19/2690542/lithuania-extends-temporary-protection-for-ukrainian-refugees-until-march-2027
- Іспанія, SEM 2/2026: https://www.inclusion.gob.es/documents/d/migraciones/instrucciones_transicion_desde_la_proteccion_temporal.pdf
- Hodak (NL, військова умова): https://hodak.nl/uk/blog-ua/tymchasovyj-zahyst-i-vijskovi-obovyazky-v-niderlandah/
- EEAS (продовження до 2028): https://www.eeas.europa.eu/delegations/ukraine/krayiny-yes-pohodylysya-podovzhyty-tymchasovyy-zakhyst-dlya-tykh-khto-ryatuyetsya-vid-viyny-v_uk
- Слово і Діло (обмеження для військовозобов'язаних): https://www.slovoidilo.ua/2026/08/21/infografika/svit/yaki-krayiny-pershymy-obmezhyly-nadannya-tymchasovoho-zaxystu-vijskovozobovyazanym-ukrayincyam
- ECRE WP 22 (AT, перехідні статуси): https://ecre.org/wp-content/uploads/2026/02/ECRE-Working-Paper-22_Transitioning-to-What_Legal-Statuses-Available-After-Temporary-Protection-for-People-Displaced-from-Ukraine_Paper-1.pdf
- Fragomen (огляд прав на роботу, 2022): https://www.fragomen.com/insights/eueea-temporary-protection-for-ukraine-taking-stock.html
- EMN-OECD Inform (2024): https://www.oecd.org/content/dam/oecd/en/topics/policy-issues/migration/OECD-EMN%20Inform_%20Labour-market-integration-of-beneficiaries-of-temporary-protection-from-Ukraine.pdf
- ELA (2023): https://www.ela.europa.eu/sites/default/files/2023-06/Report-on-the-Overview-of-the-measures-taken-by-EU-and-EFTA-countries-regarding-employment-and-social-security-of-displaced-persons-from-Ukraine.pdf
- DLA Piper (PL, з 5.03.2026): https://knowledge.dlapiper.com/dlapiperknowledge/globalemploymentlatestdevelopments/2026/changes-to-the-rules-governing-the-residence-and-employment-of-ukrainian-citizens-in-poland
- visasupdate (CZ, 2026 — низька авторитетність): https://www.visasupdate.com/post/czech-temporary-protection-rules-2026-ukraine-refugees
- GOV.UK (UK, рік до 06.2026): https://www.gov.uk/government/statistics/immigration-system-statistics-year-ending-june-2026/how-many-people-come-to-the-uk-via-safe-and-legal-humanitarian-routes
- House of Commons Library (UK): https://commonslibrary.parliament.uk/research-briefings/cbp-9473/
