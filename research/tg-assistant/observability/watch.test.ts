import { execFile } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { CollectorMetrics } from '../metrics';
import type { CycleReport } from '../state';

const run = promisify(execFile);
const WATCH = join(__dirname, 'watch.ts');

const w38: CycleReport = {
  weekOf: '2026-W38',
  status: 'partial',
  startedAt: '2026-09-14T06:00:00.000Z',
  finishedAt: '2026-09-14T06:04:10.000Z',
  chats: [{ ref: 'a', title: 'A', newMessages: 53, windowStartAt: null }],
  failures: [{ ref: 'c', title: 'C', reason: 'Chat exhausted after 3 consecutive FLOOD_WAIT retries' }],
};

/**
 * Підроблений `docker` у PATH: inspect/exec/logs віддають вміст файлів.
 * Сам watch.ts запускається справжнім `node`, як на раннері.
 */
function fakeDocker(logs: string): { dir: string; env: NodeJS.ProcessEnv } {
  const dir = mkdtempSync(join(tmpdir(), 'watch-'));
  const metrics = new CollectorMetrics(new Date('2026-09-14T05:59:30Z')).render({
    health: { ok: true, problems: [], weekOf: '2026-W38', lastCycle: null },
    telegramConnected: true,
    lastReport: w38,
  });
  writeFileSync(join(dir, 'metrics.txt'), metrics);
  writeFileSync(join(dir, 'logs.txt'), logs);
  writeFileSync(
    join(dir, 'docker'),
    [
      '#!/bin/sh',
      `case "$1" in`,
      `  inspect) echo "running 0" ;;`,
      `  exec) cat "${join(dir, 'metrics.txt')}" ;;`,
      `  logs) cat "${join(dir, 'logs.txt')}" ;;`,
      `  *) exit 99 ;;`,
      'esac',
    ].join('\n'),
  );
  chmodSync(join(dir, 'docker'), 0o755);
  return {
    dir,
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      CONTAINER: 'fake',
      WINDOW_MINUTES: '0.02',
      INTERVAL_SECONDS: '0.5',
      SINCE: '2026-09-14T08:40:00Z',
      RELEASE_SHA: 'abc123',
      REPORT_PATH: join(dir, 'report.json'),
    },
  };
}

async function exitCode(env: NodeJS.ProcessEnv): Promise<number> {
  try {
    await run('node', [WATCH], { env, timeout: 20_000 });
    return 0;
  } catch (err) {
    return (err as { code: number }).code;
  }
}

describe('watch.ts проти підробленого docker', () => {
  it('здоровий колектор: кілька зразків за вікно, exit 0, звіт healthy з трьома числами', async () => {
    const { dir, env } = fakeDocker('{"ts":"t","event":"worker_started","chats":3}\n');
    const summary = join(dir, 'summary.md');
    expect(await exitCode({ ...env, MODE: 'release', GITHUB_STEP_SUMMARY: summary })).toBe(0);
    const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
    expect(report.verdict).toBe('healthy');
    expect(readFileSync(summary, 'utf8')).toContain('| Нових повідомлень (не питань) | 53 |');
    expect(report.samples_taken).toBeGreaterThan(1);
    expect(report.three_numbers).toEqual({ last_cycle_status: 'partial', last_cycle_chats_failed: 1, last_cycle_new_messages: 53 });
  }, 30_000);

  it('рядок помилки в логах: зупинка на першому зразку, exit 42, у звіті лише безпечні поля', async () => {
    const { dir, env } = fakeDocker('{"ts":"t","event":"cycle_error","error":"TimeoutError","text":"private"}\n');
    expect(await exitCode({ ...env, MODE: 'release' })).toBe(42);
    const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
    expect(report.verdict).toBe('anomaly');
    expect(report.samples_taken).toBe(1);
    expect(report.anomalies.map((a: { code: string }) => a.code)).toEqual(['error_log_lines']);
    expect(report.error_lines).toEqual(['{"ts":"t","event":"cycle_error","error":"TimeoutError"}']);
    expect(readFileSync(join(dir, 'report.json'), 'utf8')).not.toContain('private');
  }, 30_000);

  it('невідомий MODE — сам нагляд не стартує, exit 1, а не мовчазне «здорово»', async () => {
    const { env } = fakeDocker('');
    expect(await exitCode({ ...env, MODE: 'nonsense' })).toBe(1);
  }, 30_000);
});
