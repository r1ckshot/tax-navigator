# Колектор tg-assistant (S-1). Секретів в образі немає: TG_* приходять лише
# змінними середовища з файла на сервері (compose.vps.yml → env_file).
# Мажорний тег, а не точний: Docker Hub поза allowlist девконтейнера, і точну
# версію звідси не перевірити. Вимога одна — Node ≥ 22.18 (type stripping без
# прапорця); deploy-крок друкує фактичну `node -v` образу.
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    STATE_PATH=/data/state.json \
    HEALTH_PORT=8080

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Лише код воркера: тести, конфіги vitest/tsc і нотатки уроків відсікає .dockerignore.
COPY *.ts ./

# Іменований том при першому монтуванні бере власника з образу: без цього
# /data належала б root, і процес від node не зміг би записати стан.
RUN mkdir /data && chown node:node /data
USER node

# start-period покриває холодний старт MTProto; далі раз на хвилину.
HEALTHCHECK --interval=60s --timeout=10s --start-period=90s --retries=3 \
  CMD ["node", "healthcheck.ts"]

CMD ["node", "main.ts", "run"]
