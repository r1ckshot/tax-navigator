import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { appendCycle, latestCycle, readHistory, writeHistory } from './state.mjs';

function tmpFile(name) {
  const dir = mkdtempSync(join(tmpdir(), 'rules-change-monitor-'));
  return join(dir, name);
}

function makeCycle(month, overrides = {}) {
  return {
    month,
    started_at: `${month}-01T00:00:00Z`,
    finished_at: `${month}-01T00:05:00Z`,
    status: 'completed',
    checks: [],
    ...overrides,
  };
}

describe('readHistory', () => {
  it('повертає порожню історію, якщо файла немає', () => {
    const path = tmpFile('missing.json');

    expect(readHistory(path)).toEqual({ cycles: [] });
  });

  it('кидає з людською причиною на битому JSON, а не повертає порожній стан', () => {
    const path = tmpFile('broken.json');
    writeFileSync(path, '{ не валідний json', 'utf8');

    expect(() => readHistory(path)).toThrow(/пошкоджена|валідний JSON/);
  });

  it('кидає, якщо файл валідний JSON, але без поля cycles', () => {
    const path = tmpFile('wrong-shape.json');
    writeFileSync(path, JSON.stringify({ notCycles: [] }), 'utf8');

    expect(() => readHistory(path)).toThrow();
  });

  it('читає раніше записану історію', () => {
    const path = tmpFile('history.json');
    const history = { cycles: [makeCycle('2026-01')] };
    writeFileSync(path, JSON.stringify(history), 'utf8');

    expect(readHistory(path)).toEqual(history);
  });
});

describe('appendCycle', () => {
  it('додає перший цикл до порожньої історії', () => {
    const history = { cycles: [] };
    const cycle = makeCycle('2026-01');

    const next = appendCycle(history, cycle);

    expect(next.cycles).toEqual([cycle]);
  });

  it('повторний виклик за той самий місяць заміщає запис, а не додає другий', () => {
    const history = { cycles: [] };
    const first = makeCycle('2026-01', { status: 'partial' });
    const second = makeCycle('2026-01', { status: 'completed' });

    const afterFirst = appendCycle(history, first);
    const afterSecond = appendCycle(afterFirst, second);

    expect(afterSecond.cycles).toHaveLength(1);
    expect(afterSecond.cycles[0].status).toBe('completed');
  });

  it('різні місяці накопичуються, не заміщають один одного', () => {
    const history = { cycles: [] };
    const jan = makeCycle('2026-01');
    const feb = makeCycle('2026-02');

    const next = appendCycle(appendCycle(history, jan), feb);

    expect(next.cycles.map((c) => c.month).sort()).toEqual(['2026-01', '2026-02']);
  });

  it('не мутує переданий аргумент історії', () => {
    const history = { cycles: [makeCycle('2026-01')] };
    const frozenCopy = JSON.parse(JSON.stringify(history));

    appendCycle(history, makeCycle('2026-02'));

    expect(history).toEqual(frozenCopy);
  });
});

describe('writeHistory', () => {
  it('атомарний запис лишає валідний файл, який читається назад', () => {
    const path = tmpFile('roundtrip.json');
    const history = { cycles: [makeCycle('2026-01'), makeCycle('2026-02')] };

    writeHistory(path, history);

    expect(readHistory(path)).toEqual(history);
  });

  it('не лишає тимчасовий .tmp файл після успішного запису', () => {
    const path = tmpFile('no-tmp-leftover.json');
    writeHistory(path, { cycles: [] });

    expect(() => readFileSync(`${path}.tmp`, 'utf8')).toThrow();
  });
});

describe('latestCycle', () => {
  it('повертає null для порожньої історії', () => {
    expect(latestCycle({ cycles: [] })).toBeNull();
  });

  it('повертає останній цикл за month незалежно від порядку в масиві', () => {
    const history = {
      cycles: [makeCycle('2026-03'), makeCycle('2026-01'), makeCycle('2026-02')],
    };

    expect(latestCycle(history).month).toBe('2026-03');
  });
});
