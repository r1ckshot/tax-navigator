# STATE — де ми зараз

Веде Claude Code, оновлення = частина DoD. Тримати в межах однієї сторінки:
історія йде в [JOURNAL.md](JOURNAL.md), рішення — в [DECISIONS.md](DECISIONS.md), черга задач — у [BACKLOG.md](BACKLOG.md).

## Фаза

**Курс:** M4 здано (`docs/capstones/m4.md`), M5 здано (усі 7 лекцій застосовані
на реальному продукті — `interview`, хуки, `tax-navigator-toolkit`,
`team-marketplace`, `scripts/state-checkpoint/`), M6 у роботі — пройдено
ideation по фічі `tg-assistant`, далі PRD і tasks.

**Продукт:** FREE-анкета в проді на Vercel — вердикт резидентства + порівняння
4 сценаріїв рахуються детерміновано на клієнті. 92 node-тести + 9 UI зелені.

**Ворота:** G1 перевідкриті (провалився канал, не попит — DECISIONS 2026-07-28).
G2 (10/10 профілів проти держкалькуляторів) не пройдені — закріплено 1 калібрувальний.

## Зараз у роботі

Закрито 2026-08-02 (M5.7 SDK — `scripts/state-checkpoint/`, 2 коміти):
- [x] Форк `sdk-cli/release-notes.sh` (курс 5.7) під реальну задачу: замість
  CHANGELOG.md/git-тегів (яких нема в продукті) — чернетка запису `Закрито`
  у `docs/STATE.md`, межа = останній коміт, що чіпав STATE.md
- [x] Три виміри `--allowed-tools`: `Bash(git log *)`, `Read(docs/**)`,
  `Edit(docs/STATE.md)` — вужче за demo (рівно один файл); JSON-schema на
  structured output; `--max-turns 15` (6/8/10 падали на живих прогонах)
- [x] Живий прогін на цьому ж репо знайшов і виправив 3 баги: дедлок
  вкладеного `claude -p` через колізію `CLAUDE_CODE_SESSION_ID` з
  батьківською сесією (~5 хв D-state, `environment-limits.md`); `set -e`
  ховав diff і summary на error-шляху; замалий `--max-turns`
- [x] Invalid-prompt тест (`--max-turns 1`) підтвердив `is_error: true` +
  exit 1. Окрема знахідка: `is_error: false` не гарантує фактичну точність
  — агент кілька разів повертав валідний за схемою, але вигаданий контент
  (неіснуючий Makefile-таргет, невірна кількість тестів) → trust-модель
  "скрипт ніколи не комітить сам" підтверджена на практиці, не лише в теорії
- [x] `test-precheck.sh` — 5 детермінованих кейсів межі комітів без API;
  підтверджено, що ловить регресію (навмисна мутація → 2 провалені кейси)

Закрито 2026-08-01 (`pre-commit-gate.mjs` — гейт перед комітом):
- [x] Два чеки замість інлайн `npm test` у settings.json: кирилиця в
  `git commit`-команді (включно з heredoc-тілом) → deny одразу; інакше
  `npm test` + `npm run verify`, будь-який провал → deny
- [x] Привід: спроба закомітити `docs: fix stale M5 reference in Наступне` —
  українське слово протекло в subject, Mike зловив очима, не хук
- [x] 3 кейси перевірені локально (allow на реальному зеленому прогоні,
  deny-кирилиця, deny-провалений test) — не лише щасливий шлях
- [x] Підключено в `.claude/settings.json` (Mike); спрацювання підтвердиться
  в новій сесії

Закрито 2026-07-31 (M5.6 Marketplace — публічний [team-marketplace](https://github.com/r1ckshot/team-marketplace)):
- [x] v1 = `block-env-writes@1.0.0`, єдиний реальний плагін — курсові приклади
  (deploy-checklist/pr-review-rules/security-scan) свідомо не копіювались,
  у нас немає їхніх реальних відповідників
- [x] Хук закалений перед публікацією: `$IFS`-нормалізація і детекція запису
  через `node -e`/`python3 -c` (веб-дослідження bypass-технік) — 21 кейс
  зелені, синхронізовано і в `.claude/hooks/`, і в `tax-navigator-toolkit/`
- [x] CI (`validate-plugins.yml`: static-validate + plugin-validate + ізольований
  тест хука) зелений на `main`; version-invariant між `marketplace.json` і
  `plugin.json` — власна перевірка, курсовий шаблон її не мав
- [x] Тег `block-env-writes@1.0.0`; install-флоу підтверджений наскрізно
  (`marketplace add` → `install` → живий блок у терміналі Mike), тестова
  інсталяція прибрана після перевірки
- [x] `auto-flow`-ідея (bootstrap-agentic-workflow) занесена в BACKLOG як v1.1,
  не блокує v1

Закрито 2026-07-31 (M5.5 Plugins — конвертація реального `.claude/` у плагін, `tax-navigator-toolkit/`):
- [x] `.claude-plugin/plugin.json`, копія команди `scaffold-rule` і скіла
  `add-source-domain` без змін усередині — свідомо без `interview`/`map-architecture`,
  бо ті адаптовані з курсу, не наш оригінал. `hooks/hooks.json` — кореневий
  `"hooks"`-об'єкт зі `settings.json` програмно звірений байт-у-байт (окрім одного шляху)
- [x] Єдина заміна на `$CLAUDE_PLUGIN_ROOT`: шлях до `block-env-writes.mjs` —
  скрипт фізично переїжджає з плагіном. Шлях до `environment-limits.md` у
  SessionStart-хуку НЕ чіпав: хуки виконуються з cwd хост-проєкту незалежно від
  джерела плагіна, це не шлях усередині плагіна
- [x] `claude plugin validate --strict` зелений; ізольований тест хука (16 кейсів)
  перепрогнаний з нового розташування — зелений
- [x] Живий `claude --plugin-dir` тест: тривіальний prompt пройшов, реальний
  namespace-виклик `/tax-navigator-toolkit:scaffold-rule` тричі завис у цьому
  контейнері (>130с, `timeout` не вбиває дочірній процес) — задокументовано в
  `environment-limits.md`, верифікація лишилась на structural-перевірці

Закрито 2026-07-31 (машинна звірка документів, `scripts/check-docs.mjs` у `npm run verify`):
- [x] Три перевірки: кількість тестів у STATE.md == фактична (vitest --reporter=json),
  NOW у BACKLOG.md не дублює закрите в STATE.md (звірка backtick-токенів),
  відносні markdown-посилання між git-трекнутими `.md` не биті
- [x] Кожна перевірка підтверджена на реальному провалі (тимчасова мутація
  STATE.md/BACKLOG.md, revert через `git checkout`) — не лише на зеленому шляху
- [x] `npm run verify` і `npm test` зелені після інтеграції

Закрито 2026-07-30 (інструментарій M5 — скіл і хук):
- [x] Скіл `add-source-domain` — процедура + судження «чи варто відкривати домен».
  Прогін проти baseline на 3 задачах × 2 конфігурації × 2 ітерації: 100% проти 85%
- [x] Дублі прибрані — `scaffold-rule.md` більше не переказує процедуру, а вказує на скіл.
  До прибирання дельта була рівно 0: baseline читав команду
- [x] Хук `PreToolUse` проти запису в `.env` через шелл + ізольований тест (16 кейсів)
- [x] Хук підтверджений уживу в новій сесії; скіл прогнаний обома способами виклику

Закрито 2026-07-29 (ЄСВ/ВЗ для ФОП, `feat/fop-figures`, 6 комітів):
- [x] `/scaffold-rule fop.esv_vz`: ЄСВ мін. 1,902.34 грн/міс = 22% × мінімалка 8,647;
  ВЗ 3 гр. = 1% доходу. Деталі — EVIDENCE §Сценарій A і §Нестабільності п. 4
- [x] Курс UAH→PLN не конвертуємо (DECISIONS 2026-07-29)
- [x] `fop.ts` віддає `foreignBurden` двома валютами; `rangeMonthly` лишається
  `null` свідомо — складки ZUS для `zakład` не звірені (заведено в BACKLOG → LATER)
- [x] Еталон у `benchmark.test.ts` + UI-тест на підписані валюти
- [x] `SPEC.md` критерій 6 і карта архітектури переформульовані
- [x] Візуальний рев'ю Mike пройдено (правки: підпис над таблицею, одиниця в рядок,
  уточнений напис порожньої комірки)

Закрито 2026-07-29 (три задачі, три гілки, історія лінійна):
- [x] Розчистка: домени, хуки, консистентність 12 файлів, STATE↔JOURNAL, BACKLOG у чергу
- [x] Карта архітектури (`docs/architecture-map.md`) + вендорений скіл `map-architecture` і агент `explorer`
- [x] Три розходження з карти закриті: одне джерело квантизації, одна назва продукту, машинна перевірка мови UI
- [x] Тести зелені (86 node + 8 UI), `verify` зелений, коміти атомарні
- [x] STATE, BACKLOG і DECISIONS оновлені

Деталі — [JOURNAL.md](JOURNAL.md), рішення — [DECISIONS.md](DECISIONS.md).

## Живі блокери

- **`.claude/settings.json` править лише Mike** — Claude Code не редагує власний
  settings (жорсткий класифікатор). Готую блок, застосовує Mike.
- **`~/.claude/settings.json` читається раз на старті сесії** — правки підхоплює
  лише наступна сесія.
- **`next build` у цьому контейнері не запускаємо** — перевірка через `tsc --noEmit`
  + `npm test` + `npm run test:ui`; продакшн-збірку валідує Vercel.
- **G2 не пройдені** — движок не вважається готовим, поки нема 10/10 профілів.

Решта відомих меж середовища — [.claude/rules/environment-limits.md](../.claude/rules/environment-limits.md).

## Наступне

**1.** `tg-assistant` T1+T2 — новий канал вимірювання G1. Розмір S → короткий PRD,
далі `tasks/`. Критерій зупинки: 6 циклів, <5 питань → півот.

**2.** M6 далі за мапою модулів (`SESSIONS-GUIDE.md`) — M5 повністю закрито.

Повна черга — [BACKLOG.md](BACKLOG.md).
