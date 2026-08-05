---
status: Living
updated_at: "2026-08-05"
---

# Domain Context — rules-change-monitor

<!--
CONTEXT.md is the domain glossary — not a PRD and not a scratch pad. NO implementation
detail here (no datastore/broker/framework names, no API contracts) — only domain words
and the boundaries between them. Implementation choices live in the SAD and ADRs;
behaviour lives in PRD.md.
-->

## Glossary

- дрейф — застарілий `verified_at` запису в `rules.2026.json` без підтвердження, що джерело досі актуальне. NOT «зміна правила» (дрейф — це невідомість/час без перевірки, а не зафіксований факт, що щось реально змінилось).
- звірка — повторний цикл перевірки вже внесеного в `rules.2026.json` запису: чи розійшлось значення в джерелі з тим, що записано. NOT «первісна верифікація» (одноразова перевірка нового правила при першому додаванні в matrix через `/scaffold-rule`, а не повторний моніторинг вже внесеного).
- зміна правила — подія: офіційне джерело (zus.pl, podatki.gov.pl, zakon.rada.gov.ua) опублікувало нове значення чи текст для запису, який вже є в `rules.2026.json`. NOT «оновлення застосунку» (deploy нової версії коду/UI, не повʼязаний зі зміною цифри в джерелі).
- сповіщення — повідомлення користувачу, персоналізоване під його сценарій (форма, резидентство): саме ЦЯ зміна правила стосується саме його профілю. NOT «розсилка» (масове повідомлення всім підписникам однаково, без фільтрування під профіль).
