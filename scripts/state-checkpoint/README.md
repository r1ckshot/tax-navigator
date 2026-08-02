# state-checkpoint — Claude Agent SDK drafter для `docs/STATE.md`

**Курс:** Module 5 — Claude Code extended, лекція 5.7 (Claude Agent SDK).
**Форк:** `docs/course/.../5.7-sdk/sdk-cli/release-notes.sh` — той самий
`claude -p` subprocess pattern, адаптований під реальну задачу цього репо
замість учбового fixture-repo. Деталі рішення — [docs/DECISIONS.md](../../docs/DECISIONS.md).

## Що робить

Читає, скільки комітів накопичилось з часу останньої правки `docs/STATE.md`,
і просить агента (`claude -p`) скласти чернетку нового блоку
`Закрито YYYY-MM-DD (...)` — того самого запису, який я вручну пишу в кінці
кожної сесії (DoD, `CLAUDE.md`). Це реальна, повторювана, формулювальна
робота на основі git log — саме те, де agent loop (Read → Bash → Edit)
доречніший за просту генерацію тексту.

## Чому не CHANGELOG.md / git-теги, як у демо курсу

У цьому продукті нема semver-версіонування й тегів (версія в `package.json` —
`0.0.0`, релізів не ріжемо). Копіювати демо буквально означало б вигадувати
CHANGELOG заради вправи. Натомість межа "з останнього разу" — **останній
коміт, що чіпав `docs/STATE.md`**: STATE.md і так є нашим append-only логом
чекпоінтів, тег не потрібен.

## Запуск

```bash
make state-checkpoint                       # з кореня репо
# або напряму:
scripts/state-checkpoint/draft.sh
scripts/state-checkpoint/draft.sh --dry-run  # тільки pre-check, без виклику Claude
```

Потрібно: `claude` CLI у PATH, `jq`, автентифікація — OAuth-сесія
(`claude auth login`) або `ANTHROPIC_API_KEY` env var. Ніколи не хардкодити
ключ у файл чи код.

## Три виміри `--allowed-tools`

| Dimension | Pattern | Що дозволено | Що заблоковано |
|---|---|---|---|
| **Bash** | `git log *` | будь-який `git log ...` (пошук межі + діапазон) | `git commit`, `git push`, `rm`, `curl` |
| **Read** | `docs/**` | `docs/STATE.md`, `docs/BACKLOG.md` (формат і назви задач) | `app/**`, `.env`, `~/.ssh/*` |
| **Edit** | `docs/STATE.md` | лише цей файл | `docs/BACKLOG.md`, `docs/DECISIONS.md`, `docs/JOURNAL.md`, все інше |

`Edit` тут вужчий за демо (`Edit(docs/**)`): агенту дозволено чіпати рівно
один канонічний файл, не всю директорію — `STATE.md` єдиний, де це взагалі
прийнятно.

## Guardrails

- `--max-turns 15` — бюджет на: Read STATE.md → git log (межа) → git log
  (діапазон, `--name-status`) → Read BACKLOG.md → Edit STATE.md → опційний
  re-Read (6, 8 і 10 послідовно падали на живих прогонах — `is_error: true` /
  `error_max_turns`; модель регулярно робить кілька зайвих read/re-read).
- `--model claude-haiku-4-5` — read→transform→write по схемі, не reasoning-задача.
- `is_error` перевіряється перед використанням `result`; при помилці —
  `exit 1`, сирий response виводиться на stderr для діагностики.
- Auth — env var АБО OAuth, ніколи не хардкод.

## Trust model

Агент редагує `docs/STATE.md` **у working tree, як пропозицію**. Скрипт
**не комітить і не пушить**. Після прогону — переглянути `git diff`:

- `git restore docs/STATE.md` — відхилити чернетку;
- відредагувати вручну й закомітити — прийняти (можливо, переформульовано);
- `git diff -- docs/STATE.md > checkpoint.patch` — перенести деінде.

## Тести

`test-precheck.sh` — детермінований тест лише pre-check-логіки (пошук межі
комітів через git log), без жодного виклику API:

```bash
bash scripts/state-checkpoint/test-precheck.sh
```

Живий агентний прогін недетермінований (лекція 5.7: "variance — нормальна
поведінка агентної системи") і коштує грошей — тому не автоматизований,
перевіряється вручну при потребі.
