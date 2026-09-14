import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkProposal } from './gate';

const anomaly = ['error_log_lines'];
const notes = 'error_log_lines: cycle_error TypeError comes from collector.ts when failures is undefined.';

describe('checkProposal', () => {
  it('правка колектора з нотатками, що називають аномалію, — показується людині', () => {
    expect(checkProposal({ changedFiles: ['research/tg-assistant/collector.ts', ''], anomalyCodes: anomaly, notes }).verdict).toBe('proposal');
  });

  it('агент нічого не змінив — зупинка без пропозиції, не помилка', () => {
    expect(checkProposal({ changedFiles: [], anomalyCodes: anomaly, notes })).toEqual({
      verdict: 'no_proposal',
      reason: 'agent changed nothing: not enough evidence for a fix',
    });
  });

  it('звіт без аномалій — виправляти нічого', () => {
    expect(checkProposal({ changedFiles: ['research/tg-assistant/collector.ts'], anomalyCodes: [], notes }).verdict).toBe('no_proposal');
  });

  it('нотатки не називають жодної знайденої аномалії — доказів мало', () => {
    const r = checkProposal({ changedFiles: ['research/tg-assistant/collector.ts'], anomalyCodes: anomaly, notes: 'Refactored for clarity.' });
    expect(r.verdict).toBe('no_proposal');
    expect(checkProposal({ changedFiles: ['research/tg-assistant/collector.ts'], anomalyCodes: anomaly, notes: null }).verdict).toBe('no_proposal');
  });

  it.each([
    '.github/workflows/deploy-tg-collector.yml',
    'research/tg-assistant/observability/detector.ts',
    'research/tg-assistant/compose.vps.yml',
    'research/tg-assistant/package.json',
    '.claude/settings.json',
    'CLAUDE.md',
    'research/tg-assistant/collector.test.ts',
    'research/tg-assistant/vitest.config.ts',
  ])('зачеплено нагляд або права (%s) — відхилено, навіть з гарними нотатками', (file) => {
    const r = checkProposal({ changedFiles: ['research/tg-assistant/collector.ts', file], anomalyCodes: anomaly, notes });
    expect(r.verdict).toBe('rejected');
  });

  it('правка поза колектором — відхилено', () => {
    expect(checkProposal({ changedFiles: ['app/lib/calc/tax.ts'], anomalyCodes: anomaly, notes }).verdict).toBe('rejected');
  });
});

describe('gate.ts як команда', () => {
  it('rejected дає exit 1, proposal — exit 0 і proposal=true', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gate-'));
    writeFileSync(join(dir, 'report.json'), JSON.stringify({ anomalies: [{ code: 'error_log_lines', detail: '1 line' }] }));
    writeFileSync(join(dir, 'notes.md'), notes);
    const call = (stdin: string) =>
      new Promise<{ code: number; stdout: string }>((resolve) => {
        const child = execFile('node', [join(__dirname, 'gate.ts'), join(dir, 'report.json'), join(dir, 'notes.md')], (err, stdout) =>
          resolve({ code: err ? (err as unknown as { code: number }).code : 0, stdout }),
        );
        child.stdin?.end(stdin);
      });

    const ok = await call('research/tg-assistant/collector.ts\n');
    expect(ok.code).toBe(0);
    expect(ok.stdout).toContain('proposal=true');

    const bad = await call('research/tg-assistant/observability/detector.ts\n');
    expect(bad.code).toBe(1);
    expect(bad.stdout).toContain('proposal=false');
  }, 20_000);
});
