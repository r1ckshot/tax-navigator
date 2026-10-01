# 01 · Колектор за запитом

Тема 1.1 · сесія 1 з 1 · гілка `chore/collector-on-demand` · Sonnet · medium

## Мета

Тижневий цикл колектора на VPS більше не запускається сам. Коли Mike каже
«подивись, про що говорять за період X», одна команда збирає вибірку з усіх чатів
за цей період, Claude розмічає її і пише звіт тем. Тексти людей, як і раніше, не
лягають ні в git, ні на GitHub (PRD tg-assistant §6.1; DECISIONS 2026-10-01).

## Прочитати

- DECISIONS 2026-10-01 (колектор) і 2026-09-28 (розмітка)
- `research/tg-assistant/WEEKLY.md`, `main.ts` (команди `run`, `sample`, `report`), `schedule.ts`, `config.ts`, `compose.vps.yml`
- `.github/workflows/deploy-tg-collector.yml`, `.github/workflows/tg-collector-oncall.yml`
- [PRD tg-assistant](../features/tg-assistant/PRD.md) §6.1, [questions-2026-09.md](../features/tg-assistant/questions-2026-09.md) — зразок звіту
- `environment-limits.md`: рядки про Telegram-вхід, `claude -p`, actionlint

## Кроки

1. З'ясувати, що зараз стартує цикл (планувальник у `main.ts run` + `schedule.ts`,
   довгоживучий контейнер із `compose.vps.yml`) і що на ньому тримається: `watch`
   після деплою, `/metrics`, on-call.
2. Вимкнути розклад так, щоб код лишився: контейнер не тримає циклу, `run` не
   викликається за часом. Що робити з `watch` і on-call, коли довгоживучого процесу
   немає, — вирішити тут і прибрати мертве, а не лишати зеленим порожняк.
3. Команда за запитом: вибірка з **усіх** чатів конфігу за довільний період
   (`sample` уже вміє `--from/--to` для одного чату — розширити), JSON у stdout.
   Межі ToS: лише читання, пауза між запитами (`FLOOD_SLEEP_SECONDS`), жодного
   розкладу.
4. Доставка вибірки до Claude без git і GitHub: перевірити, чи контейнер має
   ssh до VPS. Немає — команда для Mike одним рядком (`ssh … > research/tg-mining/labeling/<період>.json`).
   Логи job на GitHub для текстів людей не годяться.
5. Переписати `WEEKLY.md` у протокол «за запитом»: запит Mike → команда → розмітка
   Claude за строгим критерієм → звіт `docs/features/tg-assistant/questions-<період>.md`
   (лише теми, без цитат) → підтвердження Mike.
6. Деплой гілки на VPS без мержу: `gh workflow run deploy-tg-collector.yml --ref chore/collector-on-demand`.
7. Оновити STATE («Що крутиться саме»), README («Два фонові інструменти»),
   BACKLOG (рядок NEXT про коментарі DOU — у LATER з умовою «якщо колектор
   повернеться до регулярного режиму»).

## Агенти й скіли

- `env-scout` — якщо ssh, деплой чи Telegram поводяться не так, як записано
- `actionlint` (рядок у `environment-limits.md`) — на кожен змінений workflow
- `feature-ship` — перед тим, як назвати роботу готовою

## Крок Mike

Лише якщо контейнер не дістає VPS: один пробний запуск команди з кроку 4 у своєму
терміналі (команду дає сесія).

## Готово коли

- [ ] Після деплою гілки цикл на VPS не стартує сам: доказ — лог або стан контейнера
- [ ] Команда за запитом дає вибірку за довільний період з усіх чатів; один реальний прогін (наприклад, за останній тиждень) розмічено і звіт тем записано
- [ ] Тести `research/tg-assistant` зелені, нова поведінка покрита
- [ ] `actionlint` чистий на змінених workflow
- [ ] WEEKLY.md, STATE, README, BACKLOG оновлені
- [ ] PR злитий (тема з однієї сесії: draft → ready → merge в цій же сесії)
