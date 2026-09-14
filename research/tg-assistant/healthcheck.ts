/**
 * HEALTHCHECK контейнера: 0 лише при 200 від /health. Сам по собі код виходу
 * нічого не пояснює, тож у stdout іде тіло відповіді — `docker inspect` його
 * покаже поруч зі статусом.
 */

const port = process.env.HEALTH_PORT || '8080';

try {
  const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(5000) });
  process.stdout.write(`${await res.text()}\n`);
  process.exit(res.status === 200 ? 0 : 1);
} catch (err) {
  process.stdout.write(`health endpoint unreachable: ${err instanceof Error ? err.name : 'unknown'}\n`);
  process.exit(1);
}

export {};
