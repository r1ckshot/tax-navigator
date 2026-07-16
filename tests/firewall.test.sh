#!/bin/bash
# firewall.test.sh - перевіряє що firewall блокує не-whitelisted домени.
# Запускається ВСЕРЕДИНІ devcontainer (після postStartCommand і init-firewall.sh).
# На хості без iptables просто пропустить тести і повідомить.

set -euo pipefail

# Перевірка чи ми всередині контейнера з iptables
if ! command -v iptables >/dev/null 2>&1; then
  echo "SKIP: iptables не доступний. Запусти цей тест ВСЕРЕДИНІ devcontainer."
  exit 0
fi

# Precondition-перевірку "чи DROP policy активна" прибрано: iptables -L потребує root,
# а non-root node user (least-privilege sudoers - тільки init-firewall.sh passwordless)
# завжди бачить порожній вивід і хибно SKIP-ає навіть коли firewall реально працює.
# Самі curl-тести нижче не потребують root і є достатнім сигналом стану firewall.

echo "=== Firewall behavior test ==="
echo ""

# 1. api.anthropic.com має бути доступний (whitelist)
echo "Test 1: api.anthropic.com (whitelist) має пройти"
if curl -sS --max-time 5 https://api.anthropic.com -o /dev/null; then
  echo "OK: api.anthropic.com доступний"
else
  echo "FAIL: api.anthropic.com заблокований - whitelist зламаний"
  exit 1
fi
echo ""

# 2. example.com має бути заблокований (default-deny)
echo "Test 2: example.com (не у whitelist) має бути заблокований"
if curl -sS --max-time 5 https://example.com -o /dev/null 2>&1; then
  echo "FAIL: example.com доступний - default-deny зламаний"
  exit 1
else
  echo "OK: example.com заблокований (timeout або refused)"
fi
echo ""

# 3. registry.npmjs.org має бути доступний (whitelist для Node стеку)
echo "Test 3: registry.npmjs.org (whitelist для Node) має пройти"
if curl -sS --max-time 5 https://registry.npmjs.org -o /dev/null; then
  echo "OK: registry.npmjs.org доступний"
else
  echo "FAIL: registry.npmjs.org заблокований - стекоспецифічний whitelist зламаний"
  exit 1
fi
echo ""

# 4. github.com має бути доступний (whitelist)
echo "Test 4: github.com (whitelist) має пройти"
if curl -sS --max-time 5 https://github.com -o /dev/null; then
  echo "OK: github.com доступний"
else
  echo "FAIL: github.com заблокований - whitelist зламаний"
  exit 1
fi
echo ""

# 5. vercel.com має бути доступний (whitelist для деплою)
echo "Test 5: vercel.com (whitelist) має пройти"
if curl -sS --max-time 5 https://vercel.com -o /dev/null; then
  echo "OK: vercel.com доступний"
else
  echo "FAIL: vercel.com заблокований - whitelist зламаний"
  exit 1
fi
echo ""

echo "=== Firewall test PASSED ==="
