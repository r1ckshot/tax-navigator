# API contract sync report — tg-assistant

<!-- Написано протоколом api-forge, крок 1 (скіл невендорений, запущено вручну). -->

## Interface kind determination

- `sad.md` frontmatter `target_surfaces: []` — не задекларовано `architecture-design`.
- Fallback (за протоколом, крок 1): `docs/architecture-map.md` + `PRD.md`.
- `PRD.md`: «інструмент для одного користувача без нової авторизаційної межі й без
  публічного API» (розділ Security review) — явна відмова від HTTP-поверхні.
- `sad.md` §5/§6: одна точка входу `cycle.ts` за розкладом (`Note over C,S: Trigger:
  щотижневий cron-запуск циклу збору`), жодного webhook/inbound HTTP. Telegram Bot API
  використовується лише як вихідний виклик (читання повідомлень), не як вхідний
  інтерфейс цієї фічі.

## Рішення

Інтерфейс: **немає** (pure internal logic). За протоколом крок 1: «No external
interface → skip with a one-line note in the report; go straight to `break-tasks`».
`contracts/openapi.yaml` і `contracts/events.md` **не генеруються** — це не пропуск
кроку, а коректний результат для cron-скрипта без запит/відповідь і без
event-поверхні.

## Нотатка (одним рядком)

tg-assistant не має зовнішнього інтерфейсу для контракту — переходимо одразу до
`break-tasks`.

---

## ✅ api-forge — tg-assistant

**What I did**
- Визначив вид інтерфейсу (fallback: `architecture-map.md` + `PRD.md`, бо
  `target_surfaces` не задекларовано) → немає зовнішнього інтерфейсу. Жодного
  `openapi.yaml`/`events.md` не згенеровано — це задокументована гілка «skip»
  протоколу, не помилка. Записав цей звіт.

**Review before continuing**
- `docs/features/tg-assistant/contracts/api-sync-report.md` — визначення виду
  інтерфейсу і причина «skip»

**Run next**
1. `/clear`
2. `/sdlc-break-tasks tg-assistant`
