---
description: Log of known environment blockers in this devcontainer — check here before planning work that depends on builds, servers, or external domains
---

# Межі середовища (журнал відомих блокерів)

Читати перед плануванням роботи, що спирається на білд, сервер або зовнішнє
джерело. Дописувати сюди щоразу, як натрапив на сталу межу — щоб наступна сесія
не витрачала час на те саме.

Файл вантажиться в контекст SessionStart-хуком, тож тримаємо його коротким:
розслідування й післямортеми йдуть у [docs/JOURNAL.md](../../docs/JOURNAL.md), тут — чинний стан і обхід.

| Що | Стан | Перевірено | Обхід |
|---|---|---|---|
| `next build` / `next dev`, vitest + jsdom | **Розв'язано.** Не зависання, а повільна ФС: `/workspace` на 9p (диск Windows), ~10 мс на файловий доступ замість 0.02 | 2026-07-24 | `node_modules` і `.next` — у Docker-томах на ext4. Застосування — тільки **Rebuild Container** (Reopen перевикористовує старий) |
| `next build` у контейнері Mike | **Заборонено.** `build` і `dev` ділили `.next`, продакшн-артефакти ламали dev через `Cannot find module './NNN.js'` | 2026-07-28 | Перевірка — `tsc --noEmit` + `npm test` + `npm run test:ui`. Продакшн-збірку валідує Vercel. Діагностика: `ls .next/BUILD_ID` — якщо є, у теці лежить білд; чистити `find .next -mindepth 1 -delete` |
| `isap.sejm.gov.pl` як джерело даних | **Непридатний, і не через фаєрвол.** Домен в allowlist, але за ним Incapsula (Imperva) WAF: будь-який `curl` (з cookie-jar і `-L` теж) отримує `302` на себе, далі `403` зі сторінкою `_Incapsula_Resource`. Той самий патерн, що в `tax.gov.ua` з Akamai | 2026-08-03 | Цифри брати з `zus.pl` і `podatki.gov.pl` (обидва віддають реальний контент, `200`). ISAP лишається валідним `source_url` для людини — текст устав там канонічний, просто не витягується скриптом |
| Держкалькулятори як еталон для G2 | **Половина є, половини немає.** Складки: `zus.pl/firmy/przedsiebiorco-przeczytaj-wazne/kalkulator-skladki-zdrowotnej` — Liferay-портлет, форма приймає звичайний POST з `curl`, підтримує `periodYear=2026`, віддає число в HTML. PIT: калькулятора немає взагалі — на `podatki.gov.pl` лишились `taryfowy`, `odsetek`, `walut`, а `kalkulator-wynagrodzen-polski-lad` віддає 404 | 2026-08-04 | Складки — скриптувати (не клікати руками); PIT — виводити з норми з посиланням на артикул. Не шукати зниклий калькулятор MF заново |
| `tax.gov.ua` як джерело даних | **Непридатний, і не через фаєрвол.** Firewall пропускає (код `403`, не `000`), але Akamai WAF ріже `curl` навіть із браузерним User-Agent | 2026-07-28 | Не витрачати час: брати ПКУ з `zakon.rada.gov.ua` (`200`, один статичний IP). `tax.gov.ua` — лише як посилання для людини в `source_url` |
| `www.tax.gov.ua` віддає `000` | **Очікувано.** Akamai anycast, ipset наповнюється лише при старті контейнера. Заміряно: IP зротувались за **години** (у ipset `23.47.124.140/.141`, за півдня вже `.135/.145`) | 2026-07-28 | **Rebuild Container**, не дебаг. Але з огляду на WAF вище — переважно не варто й того |
| `.claude/settings.json` | Claude Code не редагує власний settings.json (жорсткий класифікатор, не permission-промпт) | 2026-07-18 | Готую блок для вставки, застосовує Mike |
| `~/.claude/settings.json` | Читається один раз на старті сесії | 2026-07-18 | Правки підхоплює лише наступна сесія |
| `.claude/settings.json` — теж лише на старті | **Стосується й хуків.** Доданий серед сесії `PreToolUse` не спрацював: `echo TEST=1 > .env.hooktest` пройшов, файл створився | 2026-07-30 | Перевіряти хук у **новій** сесії. Логіку до того ганяти ізольовано (`bash .claude/hooks/test-*.sh`) — вона від перезапуску не залежить |
| Нові `.claude/agents/*.md` | Підхоплюються **з затримкою**, не миттєво: одразу після створення спавн падає з `Agent type not found`, за кілька хвилин той самий агент уже доступний у тій же сесії | 2026-07-29 | Не перестворювати файл і не перезапускати сесію — або зачекати, або разово піти через вбудований `Explore` |
| `gh` CLI | **Встановлений і залогінений** (`r1ckshot`, scopes `repo`, `workflow`, `gist`, `read:org`), але лежить у `~/.local/bin`, якого НЕМА в PATH неінтерактивного шелу. `command -v gh` чесно віддає «not found», і з цього легко зробити хибний висновок, що інструмента немає | 2026-08-03 | `export PATH="$HOME/.local/bin:$PATH"` на початку команди, або повний шлях `/home/node/.local/bin/gh`. Шукати бінарник (`ls ~/.local/bin`), а не сканувати змінні з токенами — класифікатор ріже такий пошук як credential-exploration, і слушно |
| `Edit`/`Write` по виконуваному скрипту | **Скидає біт `+x`** у робочому дереві. Симптом оманливий: тест скрипта падає з `Permission denied` і exit 126, що читається як зламана логіка. `git diff --summary` при цьому МОВЧИТЬ — у git режим лишається `100755`, розходиться тільки робоче дерево. Прогін через `bash script.sh` маскує проблему повністю | 2026-08-03 | Після кожної правки `.sh` — `chmod +x` і прогін саме як `./script.sh`, а не `bash script.sh`. Знайдено на `scripts/state-checkpoint/draft.sh` |
| Firewall matching | Матчить по резолвленій IP, не по SNI | 2026-07-18 | Перевіряти `getent` перед додаванням піддоменів — apex не покриває піддомени на спільних CDN |
| Bash-редирект (`> .env`) | Обходить `Edit`/`Write`-permission-деню | 2026-07-24 | Закривається лише OS-рівнем sandbox; свідомо не виправлено |
| `jq`, `ss`, `ip` | Були не встановлені (типові приклади хуків із документації мовчки не спрацьовували). Додані в Dockerfile | 2026-07-24 | Наявні хуки лишаються на `node` — переписувати назад немає потреби |
| Вкладений `claude --plugin-dir <path> -p "/ns:команда"` | **Ненадійний для команд з tool-use.** Тривіальний `-p "reply with pong"` з `--plugin-dir` відповідає за ~9с; та сама команда з реальним `/plugin:command` (наш `scaffold-rule`, без аргументів — Крок 0 має лише зупинитись і спитати `rule_id`, без tool-виклику) висіла >130с тричі поспіль без жодного виводу після попередження про sandbox. `timeout N` навколо не вбиває дочірній `claude`-процес — лишається живим і після спливання. Причина не підтверджена (permission-prompt round-trip у headless без TTY — робоча гіпотеза) | 2026-07-31 | Structural-перевірка (`claude plugin validate <path>`) — безкоштовна, не висить, цим і обмежуватись. Живий виклик tool-use-команди плагіна — тільки інтерактивно (TTY), не з вкладеного headless `-p` у цьому контейнері. Якщо процес завис — `kill -KILL` за PID, `TaskStop` тулу зупиняє лише трекінг у харнесі, не сам OS-процес |
| Вкладений `claude -p ...` (БЕЗ `--plugin-dir`) з реальним Bash-tool-use | **Причина підтверджена, не гіпотеза.** Запуск `claude -p` із-під Bash-тулу вже активної інтерактивної сесії успадковує `CLAUDECODE`, `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_PID`, і головне — `CLAUDE_CODE_SESSION_ID`, ІДЕНТИЧНИЙ батьківській сесії. Вкладений процес намагається торкнутись того самого session-стану, що й батьківський (checkpointing/лок) — а той сам заблокований, чекаючи на завершення цього-таки Bash-виклику: дедлок на файловому лоці, процес висить у `D` (uninterruptible I/O wait). `timeout N` шле SIGTERM вчасно, але сигнал не міг доставитись, поки D-стан не розв'язався сам — виміряно ~5 хв на реальному `Bash(git log)`-виклику. Без Bash-tool-use (лише `Read`) симптом не проявлявся так гостро. Знайдено при живому тестуванні `scripts/state-checkpoint/` (5.7 SDK) | 2026-08-02 | `env -u CLAUDECODE -u CLAUDE_CODE_CHILD_SESSION -u CLAUDE_PID -u CLAUDE_CODE_SESSION_ID -u CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING -u CLAUDE_CODE_SUBPROCESS_ENV_SCRUB -u CLAUDE_CODE_ENABLE_TASKS -u CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY -u CLAUDE_CODE_ENTRYPOINT -u CLAUDE_CODE_EXECPATH -u CLAUDE_AGENT_SDK_VERSION -u CLAUDE_AUTOCOMPACT_PCT_OVERRIDE -u CLAUDE_EFFORT -u AI_AGENT` перед `claude -p` (лишити `CLAUDE_CONFIG_DIR` — без нього губиться workspace trust і `.claude/settings.json` ігнорується). Приклад — `scripts/state-checkpoint/draft.sh`. З голого терміналу (реальний сценарій використання таких скриптів) жодної з цих змінних нема — `env -u` там просто нічого не робить |

## Дозволені домени

**PL:** `zus.pl`, `podatki.gov.pl`, `biznes.gov.pl`, `gov.pl`, `isap.sejm.gov.pl`,
`stat.gov.pl`, `eureka.mf.gov.pl` — кожен у варіантах apex + `www`.

**UA (з 2026-07-28):** `zakon.rada.gov.ua`, `tax.gov.ua`, `www.tax.gov.ua`.

Список мусить збігатися в `.devcontainer/init-firewall.sh` і `.claude/settings.json` —
розбіжність валить `npm run verify`.

## Передісторія

Як розбирали «зависання» Next і jsdom, чому перший діагноз (seccomp) був хибний і
чому відкинули переїзд на WSL2 — [docs/JOURNAL.md](../../docs/JOURNAL.md), розділ «Середовище».
