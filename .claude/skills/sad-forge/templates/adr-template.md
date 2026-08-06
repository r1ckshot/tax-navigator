<!-- Формат: MADR (Markdown Any Decision Record). Спавниться скілом sad-forge,
коли рішення перетинає поріг «масштаб удару» — 2 з 4 (delta від курсового
architecture-design, який рахує лише 3): незворотнє / ≥2 модулі / чесна
альтернатива / зачіпає постійне сховище. Деталі критеріїв — SKILL.md цього скіла. -->

<!-- ADR-naming (конвенція команди, formalized тут): filename і H1-заголовок —
англійською kebab-case, форма РІШЕННЯ, не проблеми:
✓ 0002-local-json-file-for-cycle-history-and-veto-list.md
✗ 0002-cycle-state-storage.md
Решта тіла — українською, як решта артефактів репо (CLAUDE.md §Мова). -->

---
status: Accepted                                # Proposed → Accepted → Superseded by NNNN. Цей скіл пише Accepted одразу
owner: "Mike"                                    # хто несе відповідальність за рішення
reviewers: []                                    # хто переглянув перед мержем
updated_at: "<YYYY-MM-DD>"                       # дата останнього оновлення (для Superseded — дата заміни)
feature_size: "<з .size: XS/S/M/L/XL>"           # успадковується з PRD
stage: "04-05"
ticket: "—"
---

# NNNN — <назва у формі рішення, англійською, напр. «Use sliding window for rate limiting»>

<!-- ВАЖЛИВО: заголовок описує РІШЕННЯ, не проблему.
✓ «Local JSON file for cycle history and the veto list» (rules-change-monitor ADR-0002)
✗ «Cycle state storage strategy» -->

- **Status:** Accepted
- **Date:** <YYYY-MM-DD>
- **Deciders:** Mike + Claude (sad-forge, Socratic walk)

## Context

<2-4 речення: що відбувається, чому рішення потрібне саме зараз. З `sad.md` §3
(Контекст) + секції, що спричинила це ADR.>

## Decision drivers

<буліти — якості/обмеження, що штовхнули вибір>

- <напр. NFR з PRD §6 — дослівно>
- <напр. обмеження з sad.md §2>
- <напр. якість з sad.md §1 Топ-3>

<!-- Кожен буліт — або з PRD §6 NFR, або з §2 Обмеження, або з §1 Топ-3 якостей.
НЕ вигадувати драйверів — це фільтр від рішень «бо мені так подобається». -->

## Considered options

<УСІ опції, які реально були в AskUserQuestion, включно з відкинутими. Одне речення кожна.>

1. **<Опція A>** — <одне речення>.
2. **<Опція B>** — <одне речення>.
3. **<Опція C>** — <одне речення>.

<!-- ВАЖЛИВО: без соломʼяних опцій (варіант, вже виключений обмеженням стеку) — це F6-помилка критика. -->

## Decision outcome

**Обрано:** Опція <буква/назва>. <1-2 речення rationale — чому саме ця опція
перемогла, з посиланням на Decision drivers вище.>

## Consequences

**Positive**
- <напр. переваги обраного варіанта>

**Negative**
- <напр. явна ціна обраного варіанта — чесно, не замовчувати>

**Neutral**
- <напр. відкладений наслідок, ні плюс ні мінус>

<!-- Чесний лог наслідків відрізняється від «забули» тим, що Negative і Neutral заповнені теж, не лише Positive.
Пастка з критик-раунду rules-change-monitor (F6): Positive і Negative тут не мають
суперечити одне одному (напр. Positive каже «ризик знятий», Negative каже «ризик
лишається, якщо...») — критик читає обидва блоки разом і ловить саме таку нестиковку. -->

## Links

<!-- Без цієї секції ADR — файл-сирота. Три звʼязки обовʼязково: -->

- PRD: [[../PRD.md]]
- SAD: [[../sad.md]] §<N>
- Related ADR: <[[NNNN-other]] якщо є>
