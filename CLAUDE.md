# CLAUDE.md

Tax Navigator — інформаційний податковий навігатор UA↔PL. Соло-проєкт, курс Agentic Engineering (Module 3, фініш ~09.2026). Деталі продукту: [README.md](README.md).

## Порядок читання нової сесії
`docs/SESSIONS-GUIDE.md` (як працюємо) → `docs/PROJECT.md` (що і навіщо) → `docs/STATE.md` (де зараз) → `docs/BACKLOG.md` (що далі) → релевантне з `docs/EVIDENCE.md` / `docs/OPEN-RISKS.md` / `docs/DISTRIBUTION.md`.

## Тверді правила продукту
### Product / UI / calculations → .claude/rules/product-safety.md
### Цифри та джерела → .claude/rules/evidence-numbers.md
- `research/tg-mining`: read-only до Telegram; дані і сесії — ніколи в git.
- Автовідправка ботом у чужі спільноти — окреме рішення на кожен канал, не наслідок цього правила (див. `docs/BACKLOG.md`).

## Як працюємо
- **Перед стартом задачі** → `.claude/rules/preflight.md` (тести, домени, команди верифікації — перевірити ДО роботи).
- **Тести** → `.claude/rules/testing.md` (пишуться з кодом; еталон не підганяється під код).
- **Візуальні зміни** → `.claude/rules/visual-review.md` (не «готово», поки Mike не подивився очима).
- **Межі середовища** → `.claude/rules/environment-limits.md` (журнал відомих блокерів; читати перед плануванням).

## Git
- Гілка на фічу (`feat/*`, `fix/*`); у `master` напряму не пушимо, тільки merge після підтвердження Mike.
- Conventional Commits: `type(scope): description`, **англійською** (subject і тіло, включно з "чому"). Один логічний крок = один коміт.
- Subject короткий (imperative); тіло коміта — тільки "чому", коли неочевидно з diff (не переказ what).
- Docs-only коміти (STATE.md/DECISIONS.md/README) — тіло практично ніколи не потрібне: сам diff вже проза.
- У тілі fix-коміта — лише root-cause/insight, без речень, що починаються з переказу "що змінилось".
- Нові коміти замість `--amend`; без `--no-verify`; без force-push до `master`.
- Стейджити файли за іменем, не `git add -A` наосліп — перевіряти `git status` перед комітом.
- `.env` ніколи в git, тільки `.env.example`.
- **Перед кожним комітом — явне підтвердження Mike.** Показати diff/список файлів, дочекатись "так", тільки тоді комітити.
- Атрибуція Claude в комітах/PR — керується `attribution.commit` / `attribution.pr` у settings.json (User tier), не хардкодиться в промпті.
- PR-флоу (draft PR, авто-рев'ю, Rule of Two) додається з Module 9, коли з'явиться CI.

## Definition of Done
"Готово коли" з STATE.md виконано → тести проходять → коміти атомарні → STATE.md оновлено → рішення (якщо є) записане в DECISIONS.md.

## Compact Instructions
При `/compact` зберігати: список змінених файлів, команди тестів/верифікації (`npm run verify`), поточний DoD-чекліст задачі, останні архітектурні рішення з DECISIONS.md.
