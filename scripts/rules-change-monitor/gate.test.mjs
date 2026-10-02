import { describe, it, expect } from 'vitest';

import { judgeProposal } from './gate.mjs';

const NOTES = 'Перечитано DU/2026/846: art. 22 ust. 9 ustawy o PIT не змінено, змінено лише Ordynację.';
const PKG = JSON.stringify({ name: 'tax-navigator', version: '0.2.0', scripts: { test: 'vitest run' } });
const judge = (changed, extra = {}) => judgeProposal({ changed, notes: NOTES, ...extra });

describe('ворота пропозиції агента', () => {
  it('правило + доказ + тест — пропозиція', () => {
    expect(judge(['app/lib/rules/rules.2026.json', 'docs/EVIDENCE.md', 'app/lib/calc/__tests__/rules.test.ts']).verdict).toBe('proposal');
  });

  it('лише нотатки — зупинка без пропозиції, не помилка', () => {
    expect(judge([]).verdict).toBe('none');
  });

  // DECISIONS 2026-09-15: немає артефакту — прогін червоний, навіть якщо змін нуль.
  it('без нотаток — червоний прогін', () => {
    expect(judgeProposal({ changed: [], notes: null }).verdict).toBe('rejected');
    expect(judgeProposal({ changed: [], notes: '  ' }).verdict).toBe('rejected');
  });

  it.each([
    '.github/workflows/rules-verify.yml',
    'scripts/rules-change-monitor/gate.mjs',
    'scripts/rules-change-monitor/pages.mjs',
    'app/lib/calc/scenarios/incubator.ts',
    'app/lib/rules/rules.2027.json',
    '.claude/settings.json',
  ])('файл поза дозволеними — порушення: %s', (file) => {
    const r = judge(['docs/EVIDENCE.md', file]);
    expect(r.verdict).toBe('rejected');
    expect(r.reasons[0]).toContain(file);
  });

  it('правило без рядка доказу — порушення (evidence-numbers)', () => {
    expect(judge(['app/lib/rules/rules.2026.json']).reasons).toContain('rules.2026.json змінено без рядка в docs/EVIDENCE.md');
  });

  it('package.json: лише version — можна; скрипт чи залежність — ні', () => {
    const bumped = JSON.stringify({ ...JSON.parse(PKG), version: '0.2.1' });
    const hacked = JSON.stringify({ ...JSON.parse(PKG), scripts: { test: 'true' } });
    const files = ['package.json', 'CHANGELOG.md'];
    expect(judge(files, { packageBase: PKG, packageHead: bumped }).verdict).toBe('proposal');
    expect(judge(files, { packageBase: PKG, packageHead: hacked }).verdict).toBe('rejected');
    expect(judge(files).verdict).toBe('rejected');
  });
});
