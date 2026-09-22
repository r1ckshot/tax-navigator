# Тижневий лічильник G1 — понеділок після циклу

Цикл (06:00 UTC) сам читає чати й рахує грубим фільтром. Фільтр за ключовими
словами на живому чаті влучає приблизно наполовину (STATE, сесія 16), тож
лічильник G1 ставить людина: ~10 хвилин на тиждень. Тексти не лягають ні в
git, ні на диск сервера.

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

## 2. Розмітка — PowerShell, корінь репо

```
scp -i C:\Users\kapus\.ssh\turtle_bot_vps bot@turtle-bot-mike.duckdns.org:sample.json research\tg-mining\data\sample-<тиждень>.json
node research\tg-assistant\labelSample.ts research\tg-mining\data\sample-<тиждень>.json
```

І на сервері: `shred -u ~/sample.json`.

| Клавіша | Коли |
|---|---|
| `y` | людина питає про свою податкову чи бізнес-ситуацію, продукт на це відповідає |
| `w` | питає про свою ситуацію, але продукт не відповідає — біла пляма |
| `n` | не власне питання: відповідь іншому, реклама, вакансія, новина, болтовня |

Критерій — зміст, не слова: питання без `?` теж питання.

## 3. Числа

```
node research\tg-assistant\evalSample.ts research\tg-mining\data\sample-<тиждень>.json
```

- `questions: confirmed` — лічильник G1 за тиждень (`y + w`), іде в STATE;
- `white spots` — кандидати в беклог продукту;
- `precision` / `recall` — як тримається сам фільтр.

Поріг G1: менше 5 питань сумарно за 6 циклів — півот (idea-brief §13).
