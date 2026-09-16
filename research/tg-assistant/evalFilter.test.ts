import { describe, expect, it } from 'vitest';
import { matchPositives, parseDump, parsePositives, score, toFilterInput } from './evalFilter.ts';

// Синтетичний дамп у форматі раунду 2: той самий текст під двома ключовими словами.
const DUMP = `---
date: 2026-03-25
chat: demo
source: comment
keyword: бухгалтер
---
Порадьте бухгалтера для PIT-38, ситуація нестандартна

---
date: 2026-03-25
chat: demo
source: comment
keyword: PIT
---
Порадьте бухгалтера для PIT-38, ситуація нестандартна

---
date: 2026-05-05
chat: demo
source: post
keyword: JDG
---
Маєте JDG? З 1 квітня KSeF обовʼязковий.
`;

describe('parseDump', () => {
  it('текст під кількома ключовими словами — один запис (одиниця AC-04)', () => {
    const records = parseDump('demo', DUMP);
    expect(records.map((r) => [r.id, r.date, r.source])).toEqual([
      ['demo#1', '2026-03-25', 'comment'],
      ['demo#2', '2026-05-05', 'post'],
    ]);
    expect(records[0].text).toBe('Порадьте бухгалтера для PIT-38, ситуація нестандартна');
  });

  it('пост каналу стає channelPost для фільтра', () => {
    const [comment, post] = parseDump('demo', DUMP);
    expect(toFilterInput(comment, 1).channelPost).toBe(false);
    expect(toFilterInput(post, 2).channelPost).toBe(true);
  });
});

describe('parsePositives + matchPositives', () => {
  const SUMMARY = [
    '**DOU Polska:**',
    '1. 2026-03-25 — "Порадьте бухгалтера для PIT-38, ситуація нестандартна…"',
    '2. 2026-01-11 — "...багато власників бізнесу сидить в Польщі через податки..."',
    '3. 2026-01-12 — "коротко"',
    'Total: 25 organic A+ questions',
  ].join('\n');

  it('знімає дату і шматок цитати, обрізаний із обох боків; закороткі не беруться', () => {
    expect(parsePositives(SUMMARY)).toEqual([
      { date: '2026-03-25', snippet: 'порадьте бухгалтера для pit-38, ситуація' },
      { date: '2026-01-11', snippet: 'багато власників бізнесу сидить в польщі' },
    ]);
  });

  it('позитив збігається лише за датою і текстом разом', () => {
    const positives = parsePositives(SUMMARY);
    const [record] = parseDump('demo', DUMP);
    expect(matchPositives(record, positives)).toHaveLength(1);
    expect(matchPositives({ ...record, date: '2026-03-26' }, positives)).toEqual([]);
  });
});

it('одна цитата на два чати не лишає другу «незнайденою»', () => {
  const twice = parsePositives('1. 2026-03-25 — "Порадьте бухгалтера для PIT-38, ситуація"\n2. 2026-03-25 — "Порадьте бухгалтера для PIT-38, ситуація"');
  const [record] = parseDump('demo', DUMP);
  expect(matchPositives(record, twice)).toHaveLength(2);
});

describe('score', () => {
  it('precision, recall, accuracy з матриці; порожній знаменник — null, не NaN', () => {
    // 8 tp, 2 fp, 4 fn, 86 tn → 8/10, 8/12, 94/100.
    expect(score({ tp: 8, fp: 2, fn: 4, tn: 86 })).toEqual({ precision: 0.8, recall: 8 / 12, accuracy: 0.94 });
    expect(score({ tp: 0, fp: 0, fn: 0, tn: 5 }).precision).toBeNull();
  });
});
