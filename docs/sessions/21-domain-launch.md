# 21 · Власний домен, Search Console, редирект

Тема 5.1 · сесія 1 з 1 · гілка `chore/domain` · Sonnet · medium · **чернетка**
**Чекає:** Mike купив `nettomap.com`.

## Мета

Продукт живе на `nettomap.com`, стара адреса веде туди постійним редиректом, Google
знає про сайт і його sitemap. Реліз `1.0.0`.

## Прочитати

- DECISIONS 2026-10-01 (домен, бренд); `environment-limits.md` (Vercel anycast, фаєрвол за IP)
- Сесія 08 (базова адреса з env)

## Кроки

1. Базова адреса з env → `https://nettomap.com`: canonical, sitemap, hreflang, OG.
2. `tax-navigator-red.vercel.app` → 301 на домен (налаштування домену у Vercel).
3. Allowlist контейнера: новий домен в `init-firewall.sh` (моє), блок для
   `.claude/settings.json` (Mike); `npm run verify` звіряє обидва файли.
4. README, текст листа очікування, посилання в документах — нова адреса.
5. Перевірка: `curl -I` старої адреси → 301. Якщо контейнер дає `000` (anycast,
   `environment-limits.md`) — перевіряє Mike у браузері, і це записано як межа, а
   не як збій.
6. `1.0.0` + CHANGELOG → `gh pr ready` → мердж.

## Агенти й скіли

- `/add-source-domain` — для allowlist; `env-scout` — якщо `000`

## Крок Mike

1. Купити `nettomap.com` у Cloudflare Registrar (dash.cloudflare.com → Domain Registration).
2. Vercel → Project → Settings → Domains → додати `nettomap.com`; DNS-записи, які покаже Vercel, внести в Cloudflare DNS.
3. Search Console: додати домен, підтвердити TXT-записом, надіслати `sitemap.xml`.
4. Вставити блок allowlist у `.claude/settings.json`, Rebuild.

## Готово коли

- [ ] `nettomap.com` віддає продукт; стара адреса — 301
- [ ] Search Console підтверджена, sitemap прийнятий
- [ ] `verify` зелений; `1.0.0` у CHANGELOG; PR злитий, реліз вийшов
