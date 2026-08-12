import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  dedupMessages,
  defaultState,
  hasCycleRun,
  loadState,
  recordCycleRun,
  saveState,
} from './state';

describe('dedupMessages — AC-09', () => {
  it('перший прогін: усі id нові', () => {
    const { newIds } = dedupMessages(defaultState(), 'chat-1', [10, 11, 12]);
    expect(newIds).toEqual([10, 11, 12]);
  });

  it('anti-regression: повторний прогін того самого batch не дублює', () => {
    const first = dedupMessages(defaultState(), 'chat-1', [10, 11, 12]);
    const second = dedupMessages(first.state, 'chat-1', [10, 11, 12]);

    expect(second.newIds).toEqual([]);
  });

  it('catch-up: серед повтору і нового повертає лише нове', () => {
    const first = dedupMessages(defaultState(), 'chat-1', [10, 11]);
    const second = dedupMessages(first.state, 'chat-1', [10, 11, 12, 13]);

    expect(second.newIds).toEqual([12, 13]);
  });

  it('дедуп по (chat_id, telegram_message_id) — той самий id в іншому чаті новий', () => {
    const first = dedupMessages(defaultState(), 'chat-1', [10]);
    const second = dedupMessages(first.state, 'chat-2', [10]);

    expect(second.newIds).toEqual([10]);
  });
});

describe('cycle_runs.week_of — ідемпотентність циклу', () => {
  it('week_of не позначений до першого record', () => {
    expect(hasCycleRun(defaultState(), '2026-W32')).toBe(false);
  });

  it('recordCycleRun позначає week_of; повторний виклик не змінює startedAt', () => {
    const once = recordCycleRun(defaultState(), '2026-W32');
    expect(hasCycleRun(once, '2026-W32')).toBe(true);

    const twice = recordCycleRun(once, '2026-W32');
    expect(twice.cycleRuns['2026-W32'].startedAt).toBe(once.cycleRuns['2026-W32'].startedAt);
  });
});

describe('saveState/loadState — atomic write roundtrip', () => {
  it('стан переживає запис і повторне читання', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tg-assistant-state-'));
    const filePath = join(dir, 'nested', 'state.json');

    try {
      const withData = dedupMessages(
        recordCycleRun(defaultState(), '2026-W32'),
        'chat-1',
        [10, 11]
      ).state;

      saveState(filePath, withData);
      expect(existsSync(filePath)).toBe(true);

      const reloaded = loadState(filePath);
      expect(reloaded).toEqual(withData);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('відсутній файл повертає порожній стан, а не кидає помилку', () => {
    const missing = join(tmpdir(), `tg-assistant-state-missing-${Date.now()}.json`);
    expect(loadState(missing)).toEqual(defaultState());
  });
});
