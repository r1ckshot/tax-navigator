# Тижневий лічильник G1 — понеділок після циклу

Цикл (06:00 UTC) сам читає чати й рахує грубим фільтром. Фільтр за ключовими
словами на живому чаті хибить приблизно в кожному третьому-четвертому «питанні», тож
лічильник G1 ставить не він: вибірку розмічає Claude, список питань підтверджує
Mike (DECISIONS 2026-09-28). Тексти не лягають ні в git, ні на диск сервера.

## 1. Вибірка — на сервері (`bot`)

```
umask 077; sudo bash -s > ~/sample.json <<'EOF'
set -euo pipefail
id=$(docker ps -q --filter label=com.docker.compose.project=tax-navigator --filter label=com.docker.compose.service=tg-collector)
image=$(docker inspect -f '{{.Config.Image}}' "$id")
env_file=$(mktemp); trap 'rm -f "$env_file"; docker start "$id" >&2' EXIT
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$id" > "$env_file"
docker stop "$id" >&2
docker run --rm --env-file "$env_file" -v tax-navigator-tg-collector-data:/data:ro "$image" node main.ts sample
EOF
```

Воркер на хвилину зупиняється (друга сесія Telegram поруч ризикує
`AUTH_KEY_DUPLICATED`) і стартує сам. Не запускати у 20-хвилинне вікно
`watch` після деплою: нагляд прочитає зупинку як аварію.

Чат, що в циклі впав (`report` → «Недоступні чати»), береться окремо:
`node main.ts sample --chat <ref>`.

## 2. Забрати вибірку — PowerShell, корінь репо

```
scp -i C:\Users\kapus\.ssh\turtle_bot_vps bot@turtle-bot-mike.duckdns.org:sample.json research\tg-mining\labeling\sample-<тиждень>.json
```

І одразу на сервері: `shred -u ~/sample.json`. **`scp` — рівно один раз:** повтор
перезапише локальний файл нерозміченою копією, і розмітка пропаде.

Тека `labeling/` — поза git і поза `deny` на `research/tg-mining/data/**`: у ній
вибірку читає Claude. Сирі дампи лишаються під `deny`.

## 3. Розмітка

Claude розмічає файл сам і показує список питань за темами; Mike підтверджує або
називає номери, які міняє. Вручну — той самий файл:
`node research\tg-assistant\labelSample.ts research\tg-mining\labeling\sample-<тиждень>.json`
(після `q` продовжує з першого нерозміченого).

| Клавіша | Коли |
|---|---|
| `y` | людина питає про свою податкову чи бізнес-ситуацію, і продукт відповідає на питання повністю |
| `w` | питає про свою ситуацію, але продукт не відповідає — біла пляма |
| `n` | не власне питання: відповідь іншому, реклама, вакансія, новина, болтовня |

Критерій — зміст, не слова: питання без `?` теж питання. Відповідь іншому,
переказ новини, думка чи голий лінк — `n`, навіть на податкову тему. Повідомлення,
що вже є в попередній вибірці (той самий `id`), рахується один раз.

## 4. Числа

```
node research\tg-assistant\evalSample.ts research\tg-mining\labeling\sample-<тиждень>.json
```

- `questions: confirmed` — лічильник G1 за тиждень (`y + w`), іде в STATE;
- `white spots` — кандидати в беклог продукту;
- `precision` / `recall` — як тримається сам фільтр.

Поріг G1: менше 5 питань сумарно за 6 циклів — півот (idea-brief §13).
