# STATE — де ми зараз

Веде Claude Code, оновлення = частина DoD. Тримати в межах однієї сторінки:
історія йде в [JOURNAL.md](JOURNAL.md), рішення — в [DECISIONS.md](DECISIONS.md), черга задач — у [BACKLOG.md](BACKLOG.md).

## Фаза

**Курс:** M3, M4, M5 здано. M5 разом із capstone закрито 2026-08-04 — вимір,
рішення й пруфи в [CAPSTONE_LOG.md](../CAPSTONE_LOG.md). M6 SDLC-серія (6.1-6.7)
здана обома рівнями 2026-08-05→10 — інвентаризація, ideation, PRD, SAD, §6
sequence-потоки, data-model + staged-міграції, API/events-контракти і тепер
`tasks/` для `tg-assistant` та `rules-change-monitor` готові. M7 execution &
scale (7.1-7.7) здана обома рівнями 2026-08-12→14, останній урок 7.7 (TDD
discipline) закрито 2026-08-14. Далі — не курс, а реальний білд: T1+T2
`tg-assistant` за `tasks/tracker.md`.

**Продукт:** FREE-анкета в проді на Vercel — вердикт резидентства + порівняння
6 сценаріїв рахуються детерміновано на клієнті. 183 node-тести + 17 UI зелені.

**Ворота:** G1 перевідкриті (провалився канал, не попит — DECISIONS 2026-07-28).
**G2 пройдені 2026-08-05:** 10/10 профілів зелені — складки проти держкалькулятора
`zus.pl`, PIT ручним виводом із норми (DECISIONS 2026-08-05).

## Зараз у роботі

**Нічого — урок 7.7 (TDD discipline, останній у серії M7) закрито 2026-08-14.** Далі за чергою:
реальний білд `tg-assistant` — S-1 (collector), 3/5 checklist-кроків уже зроблено (Step 3,
Step 4, Step 5, нижче) + Step 1 і Step 2 частково скриптовані (pure-function зрізи без
MTProto/мережі), решта потребує живого Telegram — [tasks/tracker.md](features/tg-assistant/tasks/tracker.md)
([BACKLOG.md](BACKLOG.md) → NOW).

Закрито 2026-08-14 (курс, урок 7.7 — TDD discipline, обидва рівні, останній урок M7):
- [x] Демо `7.7-tdd-discipline` оглянуто: `make test` RED заблокований (`uv`/`pytest`
  відсутні — той самий блокер, що 7.2-7.5, `environment-limits.md`), `make demo`
  прогнано (друкує кроки, python не потрібен), 3 agent-файли й `SKILL.md` прочитані
- [x] Простий рівень: реальний AC-10 (S-1 Step 4, backfill window) вручну — 6 AC з
  GWT, RED-коміт (6 тестів чесно падають на throw, не на import), GREEN з першої
  спроби, тести не чіпані — `research/tg-assistant/window.ts`
- [x] Складний рівень: власні `.claude/agents/tdd-{test-writer,implementer,refactorer}.md`
  + `.claude/skills/tdd/SKILL.md`, адаптовані під vitest/TS (колоковані `*.test.ts`
  замість окремої `tests/`-теки, обов'язковий `Co-Authored-By`-gate, якого демо не
  знає). 2 реальні історії з S-1 (AC-08 retry-queue, AC-02 chat-filter) прогнані і
  через `/tdd`-агентів, і через одну сесію на 4 окремих гілках. Метрики й mini-essay
  здані як текст на завдання курсу, свідомо не як файл у репо
- [x] `--review-tests` зловив реальний дефект: AC-02.2 дублював AC-02.5 замість
  тестувати власний сценарій — виправлено до GREEN, саме той клас помилки, що мав
  би зловити людина-рев'ювер
- [x] Живий прогін знайшов і власний баг координатора: Gate 3 очікував Python
  `_underscore`-конвенцію для приватних helpers, тоді як цей репо (camelCase,
  `state.ts`) — реальний refactor дав 2 helpers, які gate спершу порахував як 0.
  Виправлено, перенесено на infra-гілку до старту другої історії
- [x] `.claude/agents/*.md` не підхопились цієї сесії (відомий, задокументований
  environment-limit) — ізоляцію контексту відтворено через `general-purpose` Agent
  tool з повністю вбудованими інструкціями кожного агента; вікно контексту було
  ізольоване по-справжньому, `tools:`-обмеження з frontmatter — ні
  (`general-purpose` бачить усі інструменти)
- [x] 3 переможні гілки (`feat/tg-assistant-backfill-window`, `exp/tdd-agents-retry-queue`,
  `exp/tdd-agents-chat-filter`) rebase+ff-merged у `master` лінійно, без merge-комітів.
  `exp/tdd-single-*` і `feat/tdd-orchestrator-infra` лишені не змерджені як доказ.
  25/25 нових тестів + 183/183 наявних + `test:arch` clean після мержу
- [x] S-1 checklist: Step 4 позначено `[x]` (повний pure-function зріз AC-10); Step 1 і
  Step 2 лишились `[ ]`, але отримали примітку про частковий скрипт (chat-filter,
  retry-decision) — не заявлено зробленим те, що не зроблено (MTProto/мережа поза
  скоупом уроку)

Закрито 2026-08-14 (курс, урок 7.6 — feedback loops, обидва рівні):
- [x] Демо `7.6-feedback-loops` оглянуто: `make verify` RED на story-28 (test-first,
  `sortQueue` стаб), `make gate` (`tsc --noEmit && npm test`) теж RED — той самий гейт,
  що pre-commit/Stop-hook; скіли `verify-ui`, `verify-gate`, `code-reviewer-subagent`
  прочитані, `baselines/edit-card-form.png` переглянуто
- [x] Живий Playwright недоступний у цій сесії: `cdn.playwright.dev` /
  `playwright.download.prss.microsoft.com` додано в обидва allowlist-файли, `npm run
  verify` підтвердив синхронність, Rebuild зроблено двічі (з кешем і без) — але
  з'єднання флапає на рівні edge-балансувальника, не стало стабільним. Задокументовано
  в `environment-limits.md` як третій anycast-кейс, окремий від `www.tax.gov.ua`
- [x] Простий рівень (story-26, кнопка «Скасувати»): критерій — рендерений `class`
  кнопки містить `px-3`, не `px-2` (fallback-канал jsdom + React Testing Library
  замість недоступного getComputedStyle-у-браузері). 3 ітерації: RED (реальний баг) +
  RED (власна діра в тесті, забутий `cleanup`) → cleanup виправлено, баг ще RED →
  код виправлено, `2 passed`. Канал зловив і сам баг, і власну помилку тестового
  харнесу, не лише заявлену готовність
- [x] Складний рівень (story-27, localStorage-регресія, критичний шлях — цілісність
  стану): контракт рев'юера — вхід diff+AC без історії, вихід один з
  ACCEPT/WARN/PARTIAL/REJECT. Self-check (сам собі) — DONE, проґавив гард
  `if (queue.length > 0)`, що мовчки ламає AC-1 саме коли оцінюють ОСТАННЮ картку
  (штатний кінцевий стан, не крайній випадок). Clean-context субагент-рев'юер (Task,
  без пам'яті про написання коду) — REJECT з першого прогону, точно на цьому сценарії;
  після фіксу новий чистий рев'юер — ACCEPT
- [x] Калібрування за ризиком: story-26 (косметика) — лише typecheck + DOM/class-
  порівняння, без рев'юера; story-27 (цілісність даних користувача) — повний набір
  (живий рендер-канал + clean-context рев'юер). Різниця за ціною помилки, не за
  складністю diff
- [x] Побічна знахідка: story-25 (off-by-one у `removeFromQueue`) і story-27
  зчеплені — поки живий off-by-one, чергу неможливо спорожнити звичайним UI-кліком
  (останній елемент математично ніколи не splice-иться), тож перший варіант live-
  регрес-тесту на AC-1 довелось відкинути, а не тягнути силою
- [x] Firewall-фікс закомічено на гілці `chore/playwright-firewall`, fast-forward
  змерджено в `master` (`1ef567e`) з підтвердженням Mike; push у origin ще не робився
- [x] Чесна межа: жоден доказ цього уроку не з живого браузера — технічно звірено
  (`tsc` чистий, тести зелені в демо), але не пройшло візуального рев'ю Mike
  (`visual-review.md`). Зміни демо (`docs/course/`) локальні — тека в `.gitignore`,
  у трек репо не потрапляють

Закрито 2026-08-13 (курс, урок 7.5 — фонове виконання і розклад, обидва рівні):
- [x] Простий рівень: демо `7.5-background` оглянуто — `make matrix` (чистий shell,
  без Python) зелений, `make verify` той самий `uv`/`pytest`-блокер, що 7.2-7.4;
  `recipes/loop.md`, `background.md`, `dashboard.md`, `routines/README.md` прочитані.
  На собі — GitHub issue-тріаж + git-watchdog на розсинхрон STATE.md, звʼязані в один
  живий `/loop`-аналог: сам `/loop` клієнтський slash-command, недосяжний з-під
  SDK-сесії (той самий клас, що `/goal`/`/workflow`, [environment-limits.md](../.claude/rules/environment-limits.md)),
  обхід — `CronCreate` як реальний tool-еквівалент. 4 цикли по ~2 хв, самозупинка
  власним лічильником через `CronDelete` на себе
- [x] Пастка «хмара не бачить локальних файлів» підтверджена не абстрактно: watchdog
  зловив живий приклад — незакомічений edit `environment-limits.md` посеред цієї ж
  сесії, а STATE.md «Зараз у роботі» про нього ще мовчав. Cloud `/schedule` побачив би
  «clean» на свіжій копії з git; живий `git status` показав дрейф
- [x] Складний рівень: той самий cron як реально запущений процес зі страхувальною
  сіткою — жорсткий лічильник циклів замість `/goal`-оцінювача (детермінований
  read-only чекліст, суддя був би зайвим ризиком), мінімум прав (append лише в
  scratchpad поза git), сесійність (non-durable, помирає з сесією), перевірено
  `CLAUDE_CODE_DISABLE_CRON` (не встановлена, рубильник доступний)
- [x] Нова знахідка: `tax-navigator-red.vercel.app` — allowlisted, `getent` резолвить,
  але `curl` висить до `--max-time` і повертає `000` — той самий anycast-дрейф ipset,
  що `tax.gov.ua`. Задокументовано в `environment-limits.md`
- [x] Дашборд `claude agents` перевірено наживо (Mike, окремий термінал) — порожній
  стан із трьома категоріями (Needs input / Working / Completed). Не збій: дашборд
  бачить окремі сесії (`/background`, рутини), а внутрішні тіки `CronCreate` в межах
  поточної сесії туди не потрапляють — межа, а не помилка
- [x] Гілка `docs/lesson-7.5-background` — коміт із новою знахідкою в
  `environment-limits.md` зроблено; злиття в `master` чекає підтвердження Mike

Закрито 2026-08-13 (курс, урок 7.4 — dynamic workflows, обидва рівні):
- [x] Простий рівень: демо `7.4-dynamic-workflows` оглянуто — `make verify` той самий
  `uv`-блокер, що 7.2/7.3; `make check-workflow` (`node --check`) зелений. Підтверджено
  всі три примітиви в `ship-snippets.mjs` (`agent`/`parallel`/`pipeline`) і два в
  `audit-independence.mjs` (`agent`/`parallel`, без `pipeline`); живого `while` немає
  в жодному — ітерація через `.map()`, збіжність тримає `pipeline()` з парними
  рецензентами
- [x] На собі: три реальні пункти NEXT з BACKLOG (i18n без другої особи, звірка карти
  архітектури п.1/6/7, перенесення тестів-адаптерів — п.5) розкидані трьома `Agent`-
  викликами в **межах одного ходу** координатора — доказ fan-out, не послідовності.
  Множини файлів не перетнулись, кожен виконавець повернув зелений `npm test`.
  Найважче — заздалегідь звірити файли під кожен пункт (один кандидат із BACKLOG,
  UI-тест на лендинг, виявився вже мовчки зробленим у коді — довелось відкинути й
  шукати заміну), не спокуса самому писати код: координатор лишався read-only
- [x] Складний рівень: нативний тригер `workflow`/`/workflows` недосяжний з-під цієї
  SDK-сесії (той самий клас, що `/goal` — клієнтська, не tool-фіча; підтверджено
  порожнім `ToolSearch` і артефактом `no pending launch handoff`) —
  [environment-limits.md](../.claude/rules/environment-limits.md). Обхід підтверджено
  робочим: Mike відкрив окремий термінальний `claude` (не вкладений — інший дедлок),
  тригер спрацював нативно, скрипт збережено як власна команда
  [.claude/commands/audit-i18n-safety.md](../.claude/commands/audit-i18n-safety.md).
  Живий прогін із фазами `/workflows` і порівнянням токенів у цій сесії не знято —
  Mike перейшов одразу до візуального рев'ю коміту, а не до самого аудиту
- [x] Гейт: `check-anchors.mjs` зловив реальний дрейф — правки звірки карти зсунули
  рядки в `ARCHITECTURE.md`/`globals.css`, а один якір (`types.ts:38`) був
  неоднозначний між `rules/` і `calc/`. П'ять якорів звірено очима й виправлено,
  відбиток оновлено свідомо (`--update`), не наосліп
- [x] Візуальний рев'ю Mike пройдено на i18n-коміті: темна тема (штатно), світла
  (тимчасовий `prefers-color-scheme` override у коді на момент перевірки, одразу
  повернутий), вузький/широкий вʼюпорт, клавіатурний фокус — усі ОК
- [ ] Гілка `feat/lesson-7.4-backlog-cleanup`, 4 коміти — злиття в `master` чекає
  підтвердження Mike

Закрито 2026-08-12 (курс, урок 7.3 — /goal, обидва рівні):
- [x] Простий рівень: демо `7.3-goal` оглянуто (`uv`/`pytest` той самий блокер, що 7.2;
  `make demo`/`make demo-weak` — чисті `@echo`, прогнані реально). Власна пара умов на
  реальному repo-гепі, не kata: слабка `/goal add a good test for the results screen
  and make sure it works` закрилась за 1 хід — не через сліпу пляму оцінювача, а бо я
  сам чесно прогнав тест і виклав вивід. Робоча умова (3 частини, `npm test` +
  `git status --porcelain`) — 6 ходів; оцінювач тримав буквальний текст умови навіть
  ПІСЛЯ мого вербального override, поки Mike сам не ввів `/goal clear` — сліпа пляма
  не спрацювала, натомість проявилась протилежна межа (жорсткість оцінювача проти
  живого human override). Побічний реальний результат: `app/page.tsx` і
  `ComparisonTable` мали непокритий дрейф-ризик порядку сценаріїв, закрито двома
  новими тестами — [page.test.tsx](../app/__tests__/page.test.tsx),
  [comparison-table-order.test.tsx](../app/components/__tests__/comparison-table-order.test.tsx)
- [x] Складний рівень: мета-промптинг (subagent проти власного чорновика умови) на
  S-1 Step 3 (`state.ts` dedup, AC-09) — свіжий агент зловив вимогу друкувати exit-код
  дослівно в транскрипт, я зловив, що його ж constraint-частина була прозовою без
  машинного сліду. Живий прогін виявив два реальні розриви між умовою і репо (не
  вигадані): `npx tsc --noEmit` і bare `vitest run` не бачать `research/` (root-конфіги
  скоуплені на `app/**`) — виправлено власними `vitest.config.ts`/`tsconfig.json`
  усередині `research/tg-assistant/`, без правки кореневих. Третя, більша знахідка:
  кореневий `.gitignore` бланкетно ігнорував увесь `research/`, тож жоден файл
  `tg-assistant` узагалі не міг потрапити в git — звужено до `research/tg-mining/`
  окремим комітом. 5 комітів, S-1 Step 3 відмічено done

Закрито 2026-08-12 (курс, урок 7.2 — Ralph loop, обидва рівні):
- [x] Простий рівень: демо `7.2-ralph-loop` оглянуто (README, `ralph.sh`, `PROMPT.md`,
  `Makefile`, скіл `ralph-prep`) без запуску — `make verify` тут не відтворює RED
  (`uv`/`pytest` відсутні в контейнері, PyPI поза allowlist, задокументовано в
  `environment-limits.md`). Власний `PROMPT.md` (3 секції) — реальний Step 5 з
  [S-1-tg-assistant.md](features/tg-assistant/tasks/S-1-tg-assistant.md) (roundtrip
  staged-міграцій проти `node:sqlite`), не вигадана kata-задача
- [x] Складний рівень: обидва канонічні шляхи запуску виявились нежиттєздатними в цій
  самій сесії — `ralph.sh` дедлочиться на вкладеному `claude -p` (задокументований
  блокер), плагін `ralph-loop` є в кеші маркетплейсу, але не активований і Stop-hook
  підхоплюється лише наступною сесією (нова знахідка, `environment-limits.md`). Ролі
  циклу (warm, 1 ітерація з ліміту 5) виконав сам агент — `scripts/verify-tg-assistant-migrations.mjs`
  + `scripts/test-verify-tg-assistant-migrations.sh`, зелено з першого разу, S-1 Step 5
  відмічено done. Найгірше, що сталось — не в логіці (жодного відкату), а в
  `pre-commit-gate`: перша спроба коміту впала на відсутньому трейлері
  `Co-Authored-By`, той самий клас помилки, що вже описаний у CLAUDE.md
- [x] Гілка `feat/ralph-migration-roundtrip`, 3 коміти, змерджена в `master`

Закрито 2026-08-10 (курс, урок 6.7 — task-packages, обидва рівні):
- [x] Простий рівень: готовий (невендорений) `sdlc-task-packages`
  (`docs/course/agentic-engineering-course/playbook/skills/sdlc-task-packages`
  — не `sdlc/plugin/skills/break-tasks`, яке текст завдання називає, але не
  описує дослівно; плутанина зафіксована в плані сесії) прогнаний вручну на
  `tg-assistant`: 4 stories в 4 хвилях, по одній на модуль лінійного пайплайна
  (`sad.md` §5: «виконуються послідовно») — жодного паралелізму, і це чесно
  назване властивістю пайплайна, не недоглядом нарізки. Реальний
  `AskUserQuestion`-checkpoint (Accept без правок). Один навмисний
  fail→regenerate на Stage 2 (S-2, gate #5) — виявив не формальну нестачу
  рядків, а реальний пропуск: чернетка не реалізовувала AC-04 (дедуп) узагалі
  — [tg-assistant/tasks/](features/tg-assistant/tasks/) (7 файлів)
- [x] Складний рівень: той самий протокол на `rules-change-monitor`
  (`target_surfaces: ["worker"]`, без дрейфу frontmatter, на відміну від
  tg-assistant) — 5 stories в 4 хвилях, **з реальним паралелізмом** у хвилі 2
  (класифікаційний гейт без фетчу не залежить від fetch-пайплайна). Нарізка
  йшла по гілках `alt`-блоку одного файлу (`diff.mjs` — єдина точка істини
  для всіх 7 станів AC-03), не по файлах-модулях механічно — знахідка, що не
  повторила простий підхід tg-assistant. Усі 8 gate перевірені на КОЖНІЙ з 5
  stories, не вибірково — [rules-change-monitor/tasks/](features/rules-change-monitor/tasks/)
  (8 файлів)
- [x] `CONTEXT.md` для `rules-change-monitor` доповнено до 5 секцій — реальний
  шаблон `fix-term` має лише 3 H2 (`Glossary`/`Invariants`/`Out of scope`);
  текст завдання просив 5. Додано `Sentinel errors` (типові
  `failure_reason`-значення, не вигаданий `module.error_name`-реєстр) і
  `Org-filter invariant` (`N/A: немає org-межі, соло-локальний інструмент`,
  з поясненням, не мовчки пропущено) — розширення шаблону, не заміна, той
  самий патерн, що `rules-migrations-baseline.md`
- [x] Власний скіл `.claude/skills/tasks-forge/` — вивід у
  `docs/features/<slug>/tasks/`, не `delivery/`; reference-шляхи реальної
  структури репо (`scripts/<slug>/*.mjs`, `app/lib/**`), не курсовий Go
  hexagonal-приклад; API contract excerpt читає `events.md` **або**
  `openapi.yaml` залежно від того, що реально є (курсовий жорстко очікує
  `openapi.yaml`); sentinel errors з реальних доменних полів; wave-scaling
  зважає на `.size` (S → 2-3, типово; M → 3-4). Порівняльний прогін цього
  разу не робився (не в git-стратегії плану сесії) —
  [.claude/skills/tasks-forge/](../.claude/skills/tasks-forge/)

Закрито 2026-08-10 (курс, урок 6.6 — api-forge, обидва рівні):
- [x] Простий рівень: готовий (невендорений) `api-forge` прогнаний вручну на
  tg-assistant — `target_surfaces` не задекларовано, PRD прямо каже «без
  публічного API», fallback на `architecture-map.md`+PRD визначив «немає
  зовнішнього інтерфейсу»: жодного `openapi.yaml` не згенеровано — це
  задокументована гілка skip протоколу (крок 1), не помилка —
  [tg-assistant/contracts/api-sync-report.md](features/tg-assistant/contracts/api-sync-report.md)
- [x] Складний рівень: `rules-change-monitor` (`target_surfaces: ["worker"]`,
  задекларовано `architecture-design`) → форма контракту `contracts/events.md`
  (не `openapi.yaml`) за таблицею `_shared/surfaces.md`; inline drift-check
  4/4, back-feed coverage AC↔events; навмисне розходження (`diff_percent` у
  `data-model.md`) підхоплено прогоном `--reconcile` без бампу версії —
  [rules-change-monitor/contracts/events.md](features/rules-change-monitor/contracts/events.md),
  [rules-change-monitor/contracts/api-sync-report.md](features/rules-change-monitor/contracts/api-sync-report.md).
  Codegen-крок хард-рівня (`oapi-codegen`/`openapi-typescript`) — N/A,
  задокументовано в звіті: немає `openapi.yaml`, генерувати нема з чого.
- [x] Власний скіл `.claude/skills/contract-forge/` — `events.md`/`cli.md` за
  замовчуванням замість курсового HTTP-first (`openapi.yaml`), auth/pagination/
  codegen — opt-in, не мовчазний дефолт; error envelope лише там, де є межа
  процесу. Прогнано на `rules-change-monitor` (не tg-assistant — там немає
  інтерфейсу взагалі, нема що порівнювати) для порівняння з курсовим
  прогоном — вихід структурно ідентичний (курсовий `events.md`-шаблон і так
  не мав HTTP-дефолтів), реальна різниця показала б себе лише на гіпотетичній
  `backend-service`-фічі, якої в репо немає —
  [rules-change-monitor/contracts/events-contract-forge.md](features/rules-change-monitor/contracts/events-contract-forge.md)

Закрито 2026-08-07 (курс, урок 6.5 — sequence diagrams + data model, обидва рівні):
- [x] Простий рівень: готові (невендорені) `complete-sequence-diagrams` +
  `generate-data-model` прогнані вручну (плагін не встановлювався —
  `environment-limits.md` фіксує `--plugin-dir` як ненадійний для tool-use)
  на tg-assistant — §6 `sad.md` мав незаповнений шаблон від 6.4, домальовано
  перший реальний потік (AC-01/02/09) + `data-model.md` і staged-міграції —
  [tg-assistant/sad.md](features/tg-assistant/sad.md),
  [tg-assistant/data-model.md](features/tg-assistant/data-model.md)
- [x] Складний рівень: той самий пайплайн на `rules-change-monitor` до
  повного закриття (усі 10 AC), плюс breaking change (`normalized_value`
  NOT NULL) декомпозовано expand → backfill → contract і перевірено живим
  roundtrip up→down→up на `node:sqlite` — знахідка: `ALTER COLUMN SET NOT
  NULL` у SQLite не існує взагалі, contract-фазу довелось перекладати на
  table-rebuild для тесту —
  [rules-change-monitor/_audit/data-model-2026-08-07.md](features/rules-change-monitor/_audit/data-model-2026-08-07.md)
- [x] Власний скіл `.claude/skills/migrations-forge/` — SQLite замість
  курсового Postgres, власний `node:sqlite`-раннер замість golang-migrate/
  Alembic/Liquibase (жодного нема в репо), contract-фаза одразу
  table-rebuild. Прогнано на tg-assistant для порівняння — сутності й
  індекси співпали з курсовим прогоном (той самий вхід §6), розійшлись лише
  типи колонок і (на іншій фічі) сам патерн contract-фази —
  [tg-assistant/data-model-migrations-forge.md](features/tg-assistant/data-model-migrations-forge.md)
- [x] Самокорекція під час прогону: перше підтвердження потоку `sad.md`
  порушило власний протокол скіла (`_shared/diagram-presentation.md` —
  сирий Mermaid у питанні замість прози) — впіймано, виправлено для решти
  потоків; деталі — [JOURNAL.md](JOURNAL.md)

Закрито 2026-08-06 (курс, урок 6.4 — SAD + ADR через architecture-design, обидва рівні):
- [x] Простий рівень: адаптовано `.claude/skills/architecture-design/` (з
  курсового `sdlc/plugin/skills/architecture-design`) + агент `sad-critic` —
  прогнано на tg-assistant §1-§5, 3 ADR, коміт на секцію (не один фінальний,
  як у write-prd). Edit-стовп §4 з явним посиланням на §2-інцидент
  (`FLOOD_WAIT_X`) — [tg-assistant/sad.md](features/tg-assistant/sad.md)
- [x] Складний рівень: `rules-change-monitor` перекласифікований S→M саме
  для цієї вправи (`.size` + PRD `feature_size`), повний прохід §1-§12 +
  критик-раунд. Критик зловив 6 реальних розривів — дрімаючий AC-10 в
  ADR-0002 (PRD §8 вже казав, що він не спрацює під дефолтним allowlist, ніхто
  це не звів під час walk-у), самосуперечність в ADR-0003, вигадану роль «Tech
  Lead» — усі виправлені —
  [rules-change-monitor/sad.md](features/rules-change-monitor/sad.md) (3 ADR,
  нижче курсового «типового» діапазону 5-12 для M — свідомо не роздуто)
- [x] Власний скіл `.claude/skills/sad-forge/` — 4-й критерій радіусу удару
  («зачіпає постійне сховище»), рекомендовані контейнери §5 під дві реальні
  форми фічі цього репо, формалізована ADR-naming конвенція. Прогнано на
  tg-assistant §1-§5 для порівняння —
  [tg-assistant/sad-sad-forge.md](features/tg-assistant/sad-sad-forge.md).
  Найпомітніший приріст — §1 Stakeholders уникнув вигаданої ролі «Tech Lead»
  з самого початку, там, де оригінальний прогін зловив це лише через критика
  (і на іншій фічі); деталі порівняння — [JOURNAL.md](JOURNAL.md)
- [ ] Гілка `feat/m6-4-architecture-design` — злиття в `master` чекає підтвердження Mike

Закрито 2026-08-06 (курс, урок 6.3 — from idea brief to PRD, обидва рівні):
- [x] Простий рівень: адаптовано `.claude/skills/write-prd/` (з курсового
  `sdlc/plugin/skills/write-prd` + `docs/notes/6-sdlc.md` §6.3) + агент
  `prd-critic` і скіл `prd-review` — прогнано на tg-assistant, 4 раунди
  `/prd-review` до APPROVE. Критик спіймав реальний розрив: AC розмічав
  усі непокриті питання «біла пляма», хоча власний `CONTEXT.md` уже виключав
  із цієї мітки те, на що продукт свідомо не відповідає —
  [tg-assistant/PRD.md](features/tg-assistant/PRD.md) (`status: Approved`)
- [x] Складний рівень: той самий `write-prd --reference
  scripts/check-stale-rules.mjs` на `rules-change-monitor`, повний Socratic
  + Add edge case (AC-10, захист від ветованого значення), 7 раундів
  `/prd-review` — критик двічі впіймав власні арифметичні помилки в KPI-цілях,
  перерахувавши 26 записів `rules.2026.json` незалежно —
  [rules-change-monitor/PRD.md](features/rules-change-monitor/PRD.md)
  (`status: Approved`)
- [x] Власний скіл `.claude/skills/spec-forge/` — паралельний, не привʼязаний
  до фічі: §9 Evidence ledger (кожна NFR/KPI-цифра з джерелом) + self-check
  на слова-поради + рубрика розміру з `CLAUDE.md` замість generic XS-XL.
  Прогнано на tg-assistant для порівняння —
  [tg-assistant/PRD-spec-forge.md](features/tg-assistant/PRD-spec-forge.md).
  Правило іменованих станів упіймало той самий розрив на кроці чернетки, який
  `write-prd` знайшов лише через 4 раунди критика
- [x] Гілка `feat/m6-3-write-prd`, 5 комітів, змержено в `master`

Закрито 2026-08-05 (курс, урок 6.2 — словник термінів і бриф ідеї, обидва рівні):
- [x] Простий рівень: bootstrap `CONTEXT.md` через `fix-term` (3 терміни з NOT-межами)
  + кроки 1-2 `interview` на toy-ідеї — скріншоти зняті, артефакти видалено, не
  закомічено
- [x] Складний рівень: готовий (невендорений) `interview`+`fix-term` прогнано вручну,
  без встановлення плагіна, на реальній фічі з бэклогу —
  [rules-change-monitor/idea-brief.md](features/rules-change-monitor/idea-brief.md)
  (15 секцій, Approach C, RICE=12.5, self-check зелений)
- [x] Побічна знахідка Phase 10 цінніша за сам бриф: `scripts/check-stale-rules.mjs` +
  `.claude/hooks/session-stale-rules.mjs` вже реалізують дрейф-детекцію для цієї самої
  ідеї — саме це, а не абстрактне міркування, схилило вибір до Approach C
- [x] Власний `.claude/skills/interview/` доповнено 4 прикладами під наш ринок
  (Сократ для B2C, глосарій, 3 підходи, sentinel errors) — перше зарахування як
  "готового власного скіла" було неповним, зловив Mike
- [x] Коміти `415ffc7` (скіл) + `4fc967e` (бриф); порівняння ready vs власний —
  [JOURNAL.md](JOURNAL.md)

Закрито 2026-08-05 (курс, урок 6.1 — інспекція артефактів, складний рівень):
- [x] Ручна інвентаризація фічі `nierejestrowana` (у проді з 2026-08-03) по 9
  фазах SDLC, з контрактом між фазами по кожному —
  [features/nierejestrowana/artifact-inventory.md](features/nierejestrowana/artifact-inventory.md).
  Артефакти сімох фаз існують, і жоден не лежав у `docs/features/`: теку фічі
  довелось створити під сам аудит
- [x] Скіл `.claude/skills/sdlc-audit/` — інспекційний, read-only, з п'ятим
  статусом `н/д` і машинною умовою його зняття (`test -d app/api`, БД-залежність
  у `package.json`): без цього три артефакти з дев'яти вічно рахувались би
  пропусками, і звіт перестали б читати
- [x] Прогін на тій самій фічі знайшов чотири контейнери, яких не побачив ручний
  прохід, і три помилки самого скіла (хибний стейл від правок i18n, сліпа
  `%cI` після rebase-мерджу, омоніми slug) — усі сім правок унесені в SKILL.md.
  Звіт і порівняння —
  [features/nierejestrowana/sdlc-audit-run.md](features/nierejestrowana/sdlc-audit-run.md)
- [x] Найкритичніший пропуск — **моніторинг**: фіча в проді третій день, її
  центральна гіпотеза не перевірена й перевірити її нічим

Закрито 2026-08-05 (G2 — 10 еталонних профілів):
- [x] **Еталон визначений і записаний.** Складки — державний калькулятор `zus.pl`
  (Liferay-портлет: приймає POST, підтримує `periodYear=2026`), тож звірка
  скриптується: `scripts/fetch-zus-benchmark.mjs` → фікстура з `source_url` і
  `fetched_at`, тести читають її офлайн. PIT — ручний вивід із артикула, бо
  держкалькулятора для нього НЕМА (`podatki.gov.pl` лишив `taryfowy`, `odsetek`,
  `walut`). Ворота переформульовані в PROJECT і EVIDENCE §7, рішення — в DECISIONS
- [x] **Крок 0:** усі еталони переїхали з `rangeContains` на центр смуги. Переїзд
  одразу знайшов баг: `round2` губив рівну половину грошa на float-шумі
  (`120 199,98 / 12`) — правий був еталон, не код
- [x] **10 профілів зелені** (`g2-profiles.test.ts`, 33 тести; P9 лишився у своєму
  сценарії в `benchmark.test.ts`, щоб не тримати еталон у двох місцях). Пороги
  беруться парами — 60 000 і 60 000,01, 25 000 і 25 000,01: включність межі й
  річність ярусу видно лише на самій межі
- [x] **Профіль P6 знайшов помилку в грошах.** Ричалт не віднімав фактичних витрат
  від «на руки»: база податку — прихід (це правильно), але гроші з кишені виходять
  однаково. Залежність виходила перевернутою — що більші витрати, то привабливішим
  виглядав ричалт; при 40% розрив сягав 6 000 zł/міс. Виправлено, break-even
  ≳15–30% з EVIDENCE тепер відтворюється. Калібрувальний приклад §6 перерахований
  (9 352–10 132): він помічений «перераховано движком», тобто успадкував дефект
- [x] Гейт: 182 node + 15 UI зелені, `depcruise` 0, `verify` зелений. Мутації по
  кожному новому чеку — від 1 до 5 падінь на мутацію

Закрито 2026-08-05 (картка сценарію: причина замість суми):
- [x] Причина недоступної підформи пішла з комірки суми в нотатки **першим
  пунктом**. У комірці вона була прозою в ЧИСЛОВІЙ колонці: вирівняна праворуч і
  через `width: max-content` розтягувала таблицю під найдовше речення, відриваючи
  числа решти підформ від назв. Таких рядків виявилось **п'ять у трьох сценаріях**
  (JDG, інкубатор, zlecenie), три з них 62–68 символів — Mike побачив один
- [x] Тексти переписані: повтор підмета зник, а `ryczalt.notItWork` уперше каже
  вердикт, а не довідку. Кожен рядок сам називає підформу, бо поза своїм рядком
  таблиці він її втрачає
- [x] Кольором причина НЕ виділяється — лише курсивом: варіант без числа читається
  тихіше, не голосніше (DECISIONS 2026-08-04), а роботу виконує позиція
- [x] `ryczalt.overLimit` недосяжний з UI (обидва входи клампляться до
  `REVENUE_MAX` = 50 000, ліміт спрацьовує від ~709 766). Guard лишили, але
  співвідношення закріплене тестом: піднімуть стелю анкети — тест впаде й нагадає,
  що текст став видимим
- [x] Візуальний рев'ю Mike пройдено

Закрито 2026-08-05 (поза BRIEF — спливло по дорозі):
- [x] `.claude/settings.json` не парсився з 2026-08-04: ключ `attribution` тримав
  `true` там, де схема чекає текст трейлера, і глушив **увесь** файл — ні `deny`,
  ні sandbox, ні хуки. Ключ прибраний: атрибуція дефолтна й сама підставляє
  поточну модель, а вписаний рядок став би статичним і брехав би при `/model`
- [x] Трейлер тепер тримає не інструкція, а хук: четвертий чек у `pre-commit-gate`
  (репо) + `~/.claude/hooks/require-attribution.mjs` (усі проєкти). Обидва звіряють
  факт трейлера, не імʼя моделі
- [x] Дірка, через яку це протекло, закрита: `verify` перевіряв лише валідність
  JSON, а ламається схема — `scripts/check-settings-shape.mjs` звіряє ФОРМУ
  значень (23 кейси на фікстурах, бо робочий `settings.json` правити не можна).
  На тому самому `attribution: true` він падає з поясненням, чим це загрожує
- [x] `tax-navigator-toolkit@1.1.1` у marketplace, CI зелений. Реліз 1.1.0 впав —
  і не дарма: CI показав дірку, яку локальний прогін маскував. Гілковий гейт не
  бачив гілки в репо без жодного коміта (`rev-parse` падає на ненародженій), тобто
  ПЕРШИЙ коміт у свіжому репо йшов повз гейт. Фікстура ховала це, бо засівала
  коміт, а той потребує git-ідентичності, якої в CI нема

Закрито 2026-08-04 (атрибуція комітів і дрейф карти):
- [x] `attribution` у `.claude/settings.json` увімкнено; п'ять комітів того ж дня
  переписані з трейлером (тег `backup/before-attribution`, дерево не змінилось).
  Переписування зробив Mike руками — класифікатор ріже rewrite історії `master`
- [x] `check-anchors` навчено ловити **зміст**, а не лише межі файла: відбіток
  `docs/architecture-map.anchors.json` + `--update` зі списком змін. Мутація
  (зайвий рядок у цитований файл) валить перевірку
- [x] Знайдено й перепризначено **16 зсунутих якорів** карти: сім поїхали від
  сьогоднішньої перебудови екрана, ще девʼять дрейфували раніше й проходили
  повз зелений гейт. Одне твердження застаріло по суті — картка сценарію більше
  не має власного фону

Закрито 2026-08-04 (екран результату: адаптивність + ясність):
- [x] Результат читається на 375px: рядок таблиці стає карткою (назва → сума з
  підписом → ризик), ролі таблиці проставлені явно, бо `display: block` забирає
  неявні. Шапка з екрана йде, для читалок лишається
- [x] Український тягар — обведений блок із прямим підписом «скільки платиш
  щомісяця, поки ФОП відкритий». Формулювання через заперечення («це не …»)
  відкинуто: читач мусив спершу зібрати речення, а потім вивернути
- [x] Ухвалено й записано в DECISIONS: усі шість сценаріїв рівноважні, порядок
  фіксований для будь-якого профілю; рядок без числа відрізняється лише
  типографікою. Умова перегляду названа там само
- [x] Правило статус-іконок переписане в `product-safety.md`: підпис словами
  обовʼязковий там, де шкала вводиться вперше (колонка таблиці); далі на тому ж
  екрані іконка може стояти без видимого підпису, якщо той лишається в розмітці
- [x] Термін «на руки» замінено на «чистими» в UI і в трьох документах, що його
  цитували
- [x] Візуальний рев'ю Mike пройдено — сім кіл правок, від ширини до оптики гліфів
- [x] Гейт: 135 node + 15 UI зелені, `depcruise` 0 порушень, `verify` зелений

Закрито 2026-08-04 (розчистка документів після capstone):
- [x] STATE врізано вчетверо, хроніка M5 — у `JOURNAL.md`; таблиця «Курс» у BACKLOG
  згорнута до 4 рядків; фаза «M5 здано» вирівняна в 5 файлах
- [x] `check-docs` звіряв нуль токенів після врізання STATE (скан спинявся на
  першому перенесеному рядку) — полагоджено, доведено мутацією
- [x] Правило «у master не комітимо» стало машинним: третій чек у `pre-commit-gate`
  (привід — вісім файлів застейджено просто в master цієї ж сесії). 17 кейсів,
  дві навмисні мутації спіймано

Закрито 2026-08-04 (M5 capstone — усі 5 етапів, здано постом у TG):
- [x] F1 руками (сценарій zlecenie, PR #1) і F2 через плагін (сценарій
  działalność nierejestrowana, PR #3) — той самий наскрізний зріз двічі
- [x] 44 хв → 18 хв (2.4×), мутаційна перевірка 2/5 → 7/7 спійманих регресій,
  хуки `layer-boundary` і `core-no-external` спрацювали на реальних записах
- [x] `tax-navigator-toolkit@1.0.0` у публічному
  [team-marketplace](https://github.com/r1ckshot/team-marketplace), CI зелений;
  SDK-скрипт `scripts/state-checkpoint/` перевірений живим прогоном проти 4 критеріїв
- [x] Борг, залишений свідомо: лендинг не покритий тестами (BACKLOG → LATER)

Хроніка M5 і післямортеми — [JOURNAL.md](JOURNAL.md), рішення — [DECISIONS.md](DECISIONS.md).

## Живі блокери

- **Витрати поза JDG** — інкубатор і `zlecenie` фактичних витрат від «на руки» не
  віднімають. Для `zlecenie` це, ймовірно, правильно (KUP 20%/50% — податкова
  фікція, а не реальні витрати виконавця), для інкубатора — питання відкрите.
  Всплило разом із правкою ричалту 2026-08-05; окремим рішенням, бо там інша
  природа величини.
- Межі середовища (9p, `next build`, WAF на джерелах, `settings.json` править лише
  Mike) свідомо не дублюються тут: чинний список —
  [.claude/rules/environment-limits.md](../.claude/rules/environment-limits.md),
  він вантажиться в контекст на старті кожної сесії.

## Наступне

Порядок узгоджений з Mike 2026-08-03 і тримається на **воротах, а не на модулях
курсу** — обґрунтування в [DECISIONS.md](DECISIONS.md), запис 2026-08-03.

1. **`tg-assistant` T1+T2 — реальний білд.** SDLC-документація завершена
   (PRD → SAD → data-model → contracts → `tasks/`), `tasks/tracker.md` називає
   S-1 (collector: chats/messages/cycle_runs/cycle_chat_failures) першим
   ready-story. Блокер знято: движок звірений 10/10, тож G1 тепер міряє
   попит на те, що ми можемо гарантувати.
2. **Витрати поза JDG** — інкубатор фактичних витрат не віднімає (див. блокери).

Повна черга — [BACKLOG.md](BACKLOG.md).
