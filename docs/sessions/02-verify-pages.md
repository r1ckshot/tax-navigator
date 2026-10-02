# 02 · Автозвірка: спосіб звірки на кожне правило, сторінки

Тема 1.2 · сесія 1 з 3 · гілка `feat/rules-auto-verify` · Opus · high

## Мета

Кожне з 26 правил `rules.2026.json` має названий спосіб автоматичної звірки, і
правило без способу ламає `npm test`. Правила зі сторінок zus.pl, podatki.gov.pl,
biznes.gov.pl, gov.pl і stat.gov.pl (19 із 26) звіряються скриптом.

## Прочитати

- DECISIONS 2026-10-01 (автозвірка; `verified_at` через бот-PR)
- [PRD](../features/rules-change-monitor/PRD.md), [sad.md](../features/rules-change-monitor/sad.md), [data-model.md](../features/rules-change-monitor/data-model.md), `contracts/`, `adr/` фічі
- `scripts/rules-change-monitor/`: `cycle.mjs`, `sources.mjs` (`EXTRACTORS`), `allowlist.mjs`, `challenge.mjs`, `diff.mjs`, `states.mjs`, `veto.mjs`
- `app/lib/rules/rules.2026.json`; `.claude/rules/evidence-numbers.md`
- `environment-limits.md`: `isap` (WAF), challenge-сторінки з кодом 200, фаєрвол за IP

## Кроки

1. PRD монітора: зняти non-goal «автоматична правка `verified_at`» з посиланням на
   DECISIONS 2026-10-01; скоуп «усі правила, далі — кожне нове». `sad.md` чіпати
   лише там, де змінюється (розклад — сесія 04).
2. Preflight: для кожного домену з `source_url` і для `api.sejm.gov.pl` (ELI API,
   знадобиться в сесії 03) — `curl` код і `challenge.mjs` на тілі. Недоступне →
   `/add-source-domain`: `init-firewall.sh` правлю сам, блок для
   `.claude/settings.json` + Rebuild — крок Mike, одразу на старті.
3. Реєстр способів звірки: кожне правило → `page` (екстрактор сторінки), `act`
   (зміна акта після `verified_at`, ELI), `edition` (дата чинної редакції),
   `llm` (модель дістає число, скрипт перевіряє дослівно), `manual` (лише з
   причиною). Ціль — нуль `manual`. Де живе реєстр (у моніторі чи службовим полем
   правила) — вирішити тут; критерій — нове правило будь-якої країни не може
   з'явитись без способу.
4. Таблиця «правило → спосіб → чому» у `docs/features/rules-change-monitor/verification-methods.md`.
5. Екстрактори `page` для всіх правил цього типу: фікстури з реальних сторінок у
   `__fixtures__`, тест на кожен.
6. Guard-тест: правило без способу звірки → червоний `npm test`. Перевірити
   навмисною поломкою (прибрати запис реєстру).
7. Живий прогін `node scripts/rules-change-monitor/cycle.mjs`: скільки правил
   «збігається», решта — з явним станом.

## Агенти й скіли

- `explorer` — карта монітора перед правками, якщо контексту бракує
- `/add-source-domain` — для кожного недоступного домену
- `env-scout` — якщо домен віддає `000`/`403` або challenge
- `drift-reviewer` — звіт живого прогону

## Крок Mike

Якщо крок 2 знайшов закритий домен: вставити готовий блок у `.claude/settings.json`
і зробити Rebuild Container.

## Готово коли

- [x] `verification-methods.md` покриває 26 з 26 (`page` 19, `act` 6, `edition` 1, `manual` 0; тест звіряє документ із реєстром)
- [x] Guard-тест є і падає на правилі без способу (перевірено поломкою: прибраний `uop.pit` і прибраний лист `taxFreeAmount`)
- [x] Екстрактори `page` з тестами на фікстурах (65 полів на 10 справжніх сторінках; мутація кожного значення → розбіжність)
- [x] Живий прогін записано: 19 «збігається», 7 `out_of_scope` зі способом `act`/`edition`, 0 розбіжностей; `drift-reviewer` WARN (два P2 про формулювання звіту — закрито), без REJECT
- [x] PRD оновлено; `npm test` зелений (590); гілка запушена, чернетка PR відкрита
