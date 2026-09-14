/**
 * Нагляд за колектором після релізу (урок 11.3). Лише читання: `docker inspect`,
 * `docker logs`, `docker exec` з GET на loopback `/metrics`. Нічого не
 * перезапускає і не править — рішення лишається за людиною і за окремим job.
 *
 *   MODE=release  раз на INTERVAL_SECONDS до WINDOW_MINUTES; перша аномалія зупиняє нагляд
 *   MODE=cycle    один зразок: числа останнього циклу проти порогів
 *
 * Вихід: 0 — усі зразки здорові, 42 — знайдено аномалію, 1 — сам нагляд не зміг стартувати.
 * Звіт — REPORT_PATH (report.json), фіксована форма `detector.ts` `Report`.
 */

import { execFile } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { assess, buildReport, errorLines, parseMetrics, type Anomaly, type Mode, type Sample } from './detector.ts';

const run = promisify(execFile);
const EXIT_ANOMALY = 42;

function env(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (value === undefined) {
    process.stderr.write(`missing ${name}\n`);
    process.exit(1);
  }
  return value;
}

const container = env('CONTAINER');
const mode = env('MODE', 'release') as Mode;
const windowMinutes = Number(env('WINDOW_MINUTES', '20'));
const intervalSeconds = Number(env('INTERVAL_SECONDS', '60'));
const since = env('SINCE', new Date().toISOString());
const reportPath = env('REPORT_PATH', 'report.json');
const releaseSha = process.env.RELEASE_SHA || null;

if (mode !== 'release' && mode !== 'cycle') {
  process.stderr.write(`MODE must be release or cycle, got ${mode}\n`);
  process.exit(1);
}

// Скрипт усередині контейнера: HEALTH_PORT береться з його власного оточення.
const FETCH_METRICS =
  "fetch('http://127.0.0.1:'+(process.env.HEALTH_PORT||8080)+'/metrics',{signal:AbortSignal.timeout(5000)})" +
  '.then(r=>r.text()).then(t=>process.stdout.write(t))';

async function takeSample(): Promise<Sample> {
  const at = new Date().toISOString();

  let containerStatus: string | null = null;
  let restartCount: number | null = null;
  try {
    const { stdout } = await run('docker', ['inspect', '-f', '{{.State.Status}} {{.RestartCount}}', container]);
    const [status, restarts] = stdout.trim().split(' ');
    containerStatus = status;
    restartCount = Number(restarts);
  } catch {
    containerStatus = 'missing';
  }

  let metrics: Record<string, number> | null = null;
  let metricsError: string | null = null;
  try {
    const { stdout } = await run('docker', ['exec', container, 'node', '-e', FETCH_METRICS], { timeout: 15_000 });
    metrics = parseMetrics(stdout);
    if (Object.keys(metrics).length === 0) {
      metrics = null;
      metricsError = 'empty /metrics response';
    }
  } catch (err) {
    metricsError = `docker exec failed: ${(err as { code?: unknown }).code ?? 'unknown'}`;
  }

  let errors: string[] = [];
  try {
    // docker logs віддає stdout контейнера у stdout, stderr — у stderr: помилки Node йдуть другим.
    const { stdout, stderr } = await run('docker', ['logs', '--since', since, container], { maxBuffer: 16 * 1024 * 1024 });
    errors = errorLines(`${stdout}\n${stderr}`);
  } catch (err) {
    errors = [`docker logs failed: ${(err as { code?: unknown }).code ?? 'unknown'}`];
  }

  return { at, containerStatus, restartCount, metrics, metricsError, errors };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const deadline = Date.now() + windowMinutes * 60 * 1000;
const samples: Sample[] = [];
let anomalies: Anomaly[] = [];

for (;;) {
  const sample = await takeSample();
  samples.push(sample);
  anomalies = assess(mode, sample, samples[0], new Date());
  process.stdout.write(
    `${JSON.stringify({ at: sample.at, sample: samples.length, anomalies: anomalies.map((a) => a.code) })}\n`,
  );
  if (anomalies.length > 0 || mode === 'cycle' || Date.now() + intervalSeconds * 1000 > deadline) break;
  await sleep(intervalSeconds * 1000);
}

const report = buildReport({ mode, releaseSha, windowStartedAt: since, windowMinutes, samples, anomalies, now: new Date() });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`verdict: ${report.verdict}, samples: ${report.samples_taken}, report: ${reportPath}\n`);

// Три числа на сторінці запуску в Actions: це і є панель, Grafana для тижневого циклу не потрібна.
if (process.env.GITHUB_STEP_SUMMARY) {
  const n = report.three_numbers;
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      `### tg-collector ${mode}: ${report.verdict}`,
      '',
      '| Число | Значення |',
      '|---|---|',
      `| Останній цикл | ${n.last_cycle_status ?? 'немає'} (${report.last_sample.last_cycle_finished_at ?? '—'}) |`,
      `| Чатів не прочитано | ${n.last_cycle_chats_failed ?? '—'} |`,
      `| Нових повідомлень (не питань) | ${n.last_cycle_new_messages ?? '—'} |`,
      `| p95 читання чату, кошик | ${report.last_sample.chat_read_p95_bucket_seconds ?? 'читань не було'} |`,
      `| Зразків / рядків помилок | ${report.samples_taken} / ${report.error_lines.length} |`,
      '',
      ...report.anomalies.map((a) => `- **${a.code}**: ${a.detail}`),
      '',
    ].join('\n'),
  );
}
process.exit(report.verdict === 'healthy' ? 0 : EXIT_ANOMALY);
