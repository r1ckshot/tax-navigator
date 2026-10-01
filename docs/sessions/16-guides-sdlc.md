# 16 · Гайди: рішення й артефакти

Тема 4.1 · сесія 1 з 5 · гілка `feat/guides` · Opus · high · **чернетка**

## Мета

Платні гайди спроєктовані повним ланцюгом M+ (перший серверний код продукту), репо
закрите до появи першого тексту гайда, а правова основа продажу звірена.

## Прочитати

- DECISIONS 2026-10-01 (гайди, MoR, ключ, приватне репо); [research/2026-10-payments-legal.md](../research/2026-10-payments-legal.md)
- [paid-action-plan/idea-brief.md](../features/paid-action-plan/idea-brief.md) — замінена ідея
- ADR-0002 (розрахунок на клієнті); OPEN-RISKS §1, §4, §7

## Кроки

1. Приватність репо. Ruleset на `master` для приватного репо на GitHub Free не
   діє, а хвилини Actions стають лімітованими. Заміряти поточне споживання хвилин
   і дати Mike одну рекомендацію: GitHub Pro або зміст гайдів в окремому
   приватному сховищі. Записати вибір у DECISIONS.
2. `interview` у MVP-глибині: більшість фаз закривають рішення 2026-10-01; Mike
   питати лише про те, чого там немає.
3. `write-prd` → `prd-review` до APPROVE.
4. `architecture-design`: `sad.md` + ADR — перевірка ключа на сервері, MoR, зміст
   лише після ключа, оновлення гайда при зміні правил. Тригери перегляду ADR-0002
   звірити явно. `sad-critic`.
5. `tasks-forge` → `docs/features/paid-guides/tasks/`; уточнити файли сесій 17–20 за ними.
6. Звірити з першоджерелом: право Mike на nierejestrowana (art. 5 ust. 7 PP, активний
   UKR); заборонені товари Lemon Squeezy — цифровий контент, а не послуга.
   Результат — EVIDENCE і OPEN-RISKS §4.
7. Стара ідея: позначка «замінено гайдами» у `paid-action-plan/idea-brief.md`.

## Агенти й скіли

- `interview`, `write-prd`, `prd-review` (`prd-critic`), `architecture-design` (`sad-critic`), `tasks-forge`

## Крок Mike

1. Відповіді на питання інтерв'ю, яких немає в DECISIONS.
2. Дія за кроком 1: GitHub Pro + зробити репо приватним (Settings → General → Danger Zone) або створити приватне сховище змісту.

## Готово коли

- [ ] Репо приватне або зміст гайдів має приватне сховище; ruleset `master` діє (перевірено `gh api`)
- [ ] PRD — APPROVE; `sad.md` з ADR; `tasks/` є; файли 17–20 уточнені
- [ ] EVIDENCE і OPEN-RISKS §4 оновлені
- [ ] Гілка запушена, чернетка PR відкрита
