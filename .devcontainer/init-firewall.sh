#!/bin/bash
# init-firewall.sh - default-deny outbound + minimal whitelist для Claude Code container.
# Запускається у postStartCommand devcontainer або entrypoint docker compose.
# Потребує capabilities NET_ADMIN і NET_RAW (cap_add у Docker Compose або runArgs у devcontainer).
#
# Також виправляє власника named volumes (/home/node/.claude, /commandhistory) на node:node.
# Docker створює точку монтування named volume від root незалежно від USER у Dockerfile,
# тому без цього node не міг писати туди (Claude Code login мовчки провалювався).
# Виконується тут, а не окремим postCreateCommand, щоб не розширювати sudoers на нову команду -
# цей скрипт і так вже дозволений через /etc/sudoers.d/node-firewall.
#
# Захист:
# - IPv4 (iptables) і IPv6 (ip6tables) обидва default-deny на OUTPUT
# - DNS обмежений до nameserver з /etc/resolv.conf (захист від DNS rebinding через arbitrary resolver)
# - CIDR блоки з api.github.com/meta валідуються regex-ом перед додаванням (захист від 0.0.0.0/0 injection)
# - Self-validation у кінці перевіряє що whitelist працює і default-deny не зламано
#
# ALLOWED_DOMAINS тут мусить збігатися з sandbox.network.allowedDomains у .claude/settings.json
# (перевіряється npm run verify). statsig.anthropic.com/sentry.io свідомо не в списку -
# DISABLE_TELEMETRY/DISABLE_ERROR_REPORTING вимикають ці канали на рівні Claude Code (DECISIONS.md).

set -euo pipefail

# 0. Власник named volumes - node, не root (див. коментар вище)
chown -R node:node /home/node/.claude /commandhistory

# 1. Скинути попередні правила, поставити default policy на IPv4 і IPv6
iptables -F OUTPUT
iptables -F INPUT
iptables -P OUTPUT DROP
iptables -P INPUT DROP
iptables -P FORWARD DROP

ip6tables -F OUTPUT
ip6tables -F INPUT
ip6tables -P OUTPUT DROP
ip6tables -P INPUT DROP
ip6tables -P FORWARD DROP

# 2. Loopback завжди дозволений
iptables  -A INPUT  -i lo -j ACCEPT
iptables  -A OUTPUT -o lo -j ACCEPT
ip6tables -A INPUT  -i lo -j ACCEPT
ip6tables -A OUTPUT -o lo -j ACCEPT

# 3. Уже встановлені з'єднання - ACCEPT
iptables  -A INPUT  -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables  -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
ip6tables -A INPUT  -m state --state ESTABLISHED,RELATED -j ACCEPT
ip6tables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# 4. DNS обмежений до nameserver з /etc/resolv.conf (а не всі сервери на 53/udp).
#    Це захист від обходу whitelist через підставу довільного DNS-резолвера.
DNS_SERVERS=$(awk '/^nameserver / {print $2}' /etc/resolv.conf | sort -u)
if [ -z "$DNS_SERVERS" ]; then
  echo "WARN: /etc/resolv.conf без nameserver - використовую 127.0.0.11 (Docker embedded DNS)"
  DNS_SERVERS="127.0.0.11"
fi
for dns in $DNS_SERVERS; do
  if [[ "$dns" == *:* ]]; then
    ip6tables -A OUTPUT -p udp -d "$dns" --dport 53 -j ACCEPT
    ip6tables -A OUTPUT -p tcp -d "$dns" --dport 53 -j ACCEPT
  else
    iptables  -A OUTPUT -p udp -d "$dns" --dport 53 -j ACCEPT
    iptables  -A OUTPUT -p tcp -d "$dns" --dport 53 -j ACCEPT
  fi
done

# 5. Whitelist через ipset (динамічне резолювання доменів у IP)
ipset destroy claude-allowed   2>/dev/null || true
ipset destroy claude-allowed-6 2>/dev/null || true
ipset create  claude-allowed   hash:net family inet  hashsize 1024 maxelem 65536
ipset create  claude-allowed-6 hash:net family inet6 hashsize 1024 maxelem 65536

ALLOWED_DOMAINS=(
  "api.anthropic.com"
  "console.anthropic.com"
  "claude.ai"
  "github.com"
  "api.github.com"
  "objects.githubusercontent.com"
  "codeload.github.com"
  "registry.npmjs.org"
  "vercel.com"
  "api.vercel.com"
  "tax-navigator-red.vercel.app"
  "neon.tech"
  "console.neon.tech"
  "www.zus.pl"
  "zus.pl"
  "www.podatki.gov.pl"
  "podatki.gov.pl"
  "www.biznes.gov.pl"
  "biznes.gov.pl"
  "www.gov.pl"
  "gov.pl"
  "isap.sejm.gov.pl"
  "stat.gov.pl"
  "eureka.mf.gov.pl"
)

for domain in "${ALLOWED_DOMAINS[@]}"; do
  # IPv4 (A records)
  ips4=$(getent ahostsv4 "$domain" | awk '/STREAM/ {print $1}' | sort -u) || true
  for ip in $ips4; do
    ipset add claude-allowed "$ip" 2>/dev/null || true
  done
  # IPv6 (AAAA records) - якщо є. getent повертає non-zero коли AAAA нема (норма, не помилка) -
  # || true рятує від pipefail, інакше set -e тихо вбиває весь скрипт на першому домені без IPv6.
  ips6=$(getent ahostsv6 "$domain" 2>/dev/null | awk '/STREAM/ {print $1}' | sort -u) || true
  for ip in $ips6; do
    ipset add claude-allowed-6 "$ip" 2>/dev/null || true
  done
  if [ -z "$ips4" ] && [ -z "$ips6" ]; then
    echo "WARN: не вдалось зрезолвити $domain - пропускаємо"
  fi
done

# 6. GitHub CIDR ranges з api.github.com/meta - тимчасово відкриваємо api.github.com,
#    тягнемо meta, валідуємо кожен CIDR regex-ом (захист від 0.0.0.0/0 injection).
gh_ip=$(getent ahostsv4 api.github.com | awk '/STREAM/ {print $1; exit}')
if [ -n "$gh_ip" ]; then
  iptables -I OUTPUT 1 -d "$gh_ip" -p tcp --dport 443 -j ACCEPT
  github_cidrs=$(curl -fsS --max-time 10 https://api.github.com/meta \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('\n'.join(c for c in d.get('git',[]) if ':' not in c))" \
    || true)
  cidr_re='^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[1-2][0-9]|3[0-2])$'
  for cidr in $github_cidrs; do
    # Reject CIDRs ширші ніж /8 (захист від 0.0.0.0/0 та подібних)
    if [[ "$cidr" =~ $cidr_re ]]; then
      prefix="${cidr##*/}"
      if [ "$prefix" -lt 8 ]; then
        echo "WARN: відкидаю CIDR $cidr (prefix /$prefix занадто широкий)"
        continue
      fi
      ipset add claude-allowed "$cidr" 2>/dev/null || true
    else
      echo "WARN: відкидаю невалідний CIDR $cidr"
    fi
  done
fi

# 7. ACCEPT для всіх IP/CIDR з whitelist на портах 80/443 (IPv4 і IPv6)
iptables  -A OUTPUT -p tcp -m set --match-set claude-allowed   dst --dport 443 -j ACCEPT
iptables  -A OUTPUT -p tcp -m set --match-set claude-allowed   dst --dport 80  -j ACCEPT
ip6tables -A OUTPUT -p tcp -m set --match-set claude-allowed-6 dst --dport 443 -j ACCEPT
ip6tables -A OUTPUT -p tcp -m set --match-set claude-allowed-6 dst --dport 80  -j ACCEPT

# 8. Self-validation
echo "=== Firewall self-validation ==="

if curl -sS --max-time 5 https://api.anthropic.com -o /dev/null; then
  echo "OK: api.anthropic.com доступний"
else
  echo "FAIL: api.anthropic.com має бути доступний - whitelist зламаний"
  exit 1
fi

# example.com має fail. Перевіряємо що НІ IPv4 НІ IPv6 не пройде.
if curl -sS --max-time 5 https://example.com -o /dev/null 2>&1; then
  echo "FAIL: example.com має бути заблокований - default-deny зламаний"
  exit 1
else
  echo "OK: example.com заблокований (як і має бути)"
fi

# IPv6 sanity check - якщо ipv6.google.com резолвиться, спроба коннекту має fail
if getent ahostsv6 ipv6.google.com >/dev/null 2>&1; then
  if curl -6 -fsS --max-time 5 https://ipv6.google.com -o /dev/null 2>&1; then
    echo "FAIL: ipv6.google.com доступний по IPv6 - ip6tables default-deny зламаний"
    exit 1
  else
    echo "OK: IPv6 default-deny працює"
  fi
fi

echo "=== Firewall ready ==="
