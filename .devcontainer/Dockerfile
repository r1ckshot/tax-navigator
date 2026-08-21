# Dockerfile - база для devcontainer і docker compose з Claude Code.
# init-firewall.sh має лежати у тій самій директорії що цей Dockerfile.

ARG TZ=Europe/Warsaw
ARG CLAUDE_CODE_VERSION=latest

FROM node:22

ARG TZ
ARG CLAUDE_CODE_VERSION
ENV TZ=$TZ

RUN apt-get update && apt-get install -y --no-install-recommends \
    iptables \
    ipset \
    sudo \
    bubblewrap \
    curl \
    git \
    zsh \
    fzf \
    vim \
    less \
    python3 \
    ca-certificates \
    jq \
    iproute2 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# gh CLI - офіційний apt-репозиторій (github.com/cli/cli/blob/trunk/docs/install_linux.md).
# Бінарник встановлюється тут, `gh auth login` лишається ручним кроком після кожного
# Rebuild - токен свідомо не бейкається в образ.
RUN mkdir -p -m 755 /etc/apt/keyrings \
    && out=$(mktemp) && wget -nv -O "$out" https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    && cat "$out" | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && mkdir -p -m 755 /etc/apt/sources.list.d \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

RUN echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall \
    && chmod 0440 /etc/sudoers.d/node-firewall

COPY init-firewall.sh /usr/local/bin/init-firewall.sh
RUN chmod +x /usr/local/bin/init-firewall.sh

# Валідуємо CLAUDE_CODE_VERSION щоб уникнути shell injection через --build-arg.
# Дозволяємо тільки latest, semver-подібні теги, hex commits.
RUN echo "${CLAUDE_CODE_VERSION}" | grep -qE '^(latest|[0-9a-zA-Z._-]+)$' || \
    (echo "ERROR: невалідний CLAUDE_CODE_VERSION='${CLAUDE_CODE_VERSION}'" && exit 1) \
    && npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}"

# node_modules і .next живуть у Docker-томах (див. devcontainer.json): нативний
# overlay замість повільного bind через 9p/drvfs. Для node_modules це прибирає
# десятки секунд на резолвленні; для .next — прибирає HMR-краш "Cannot find module
# './NNN.js'", який виникав, бо хард-релоад не встигав побачити чанки, записані на
# 9p посеред перекомпіляції. Готуємо теки від root, щоб свіжі (порожні) томи
# успадкували власника node, а не root, і dev/postCreate могли в них писати.
RUN mkdir -p /workspace/node_modules /workspace/.next \
    && chown node:node /workspace/node_modules /workspace/.next

USER node
WORKDIR /workspace
