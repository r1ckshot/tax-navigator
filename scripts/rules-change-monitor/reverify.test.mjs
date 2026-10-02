import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bumpVerifiedAt, guardRulesChange, sameRuleData } from './reverify.mjs';

// Знімок матриці на 2026-10-01: дати в живій рухає сам бот, а тести дат — про форму файла.
const RULES_TEXT = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'rules.2026-10-01.json'), 'utf8');
const TODAY = '2026-11-02';
const rule = (text, id) => JSON.parse(text).rules.find((r) => r.rule_id === id);

describe('bumpVerifiedAt на справжній матриці', () => {
  const { text, bumped } = bumpVerifiedAt(RULES_TEXT, ['common.minimum_wage', 'jdg.skala'], TODAY);

  it('нова дата — рівно названим правилам', () => {
    expect(bumped).toEqual(['common.minimum_wage', 'jdg.skala']);
    expect(rule(text, 'common.minimum_wage').verified_at).toBe(TODAY);
    expect(rule(text, 'jdg.skala').verified_at).toBe(TODAY);
    const untouched = JSON.parse(text).rules.filter((r) => !bumped.includes(r.rule_id));
    expect(untouched.map((r) => r.verified_at)).toEqual(
      JSON.parse(RULES_TEXT).rules.filter((r) => !bumped.includes(r.rule_id)).map((r) => r.verified_at),
    );
  });

  // Дифф PR має бути рівно рядками дат: решта форматування матриці не рухається.
  it('змінено лише рядки verified_at', () => {
    const before = RULES_TEXT.split('\n');
    const after = text.split('\n');
    expect(after).toHaveLength(before.length);
    const changed = after.filter((line, i) => line !== before[i]);
    expect(changed).toHaveLength(2);
    expect(changed.every((line) => /^\s*"verified_at": "2026-11-02"$/.test(line))).toBe(true);
  });

  it('проходить власну охорону', () => {
    expect(guardRulesChange(RULES_TEXT, text, { today: TODAY })).toEqual([]);
  });

  it('дата не рухається назад і повтор того ж дня нічого не пише', () => {
    expect(bumpVerifiedAt(RULES_TEXT, ['common.minimum_wage'], '2026-01-01').bumped).toEqual([]);
    expect(bumpVerifiedAt(text, ['common.minimum_wage'], TODAY).bumped).toEqual([]);
  });

  it('невідоме правило — помилка, а не тиша', () => {
    expect(() => bumpVerifiedAt(RULES_TEXT, ['no.such.rule'], TODAY)).toThrow(/no\.such\.rule/);
  });
});

/**
 * «Готово коли» сесії 04: бот-PR не може змінити `params`. Охорона порівнює дві
 * версії файла сама — тут кожна підміна, яку бот міг би протягнути.
 */
describe('guardRulesChange — у бот-PR нічого, крім дат', () => {
  const edit = (fn) => {
    const json = JSON.parse(RULES_TEXT);
    fn(json);
    return JSON.stringify(json, null, 2);
  };
  const guard = (head) => guardRulesChange(RULES_TEXT, head, { today: TODAY });

  it('змінене число в params — порушення', () => {
    expect(guard(edit((j) => (j.rules.find((r) => r.rule_id === 'common.minimum_wage').params.monthly = 4950)))).toEqual([
      'common.minimum_wage: змінено щось, крім verified_at',
    ]);
  });

  it('змінене число разом із датою — порушення, дата його не прикриває', () => {
    const head = edit((j) => {
      const r = j.rules.find((x) => x.rule_id === 'jdg.skala');
      r.params.lowerRate = 0.1;
      r.verified_at = TODAY;
    });
    expect(guard(head)).toEqual(['jdg.skala: змінено щось, крім verified_at']);
  });

  it('новий лист у params — порушення', () => {
    expect(guard(edit((j) => (j.rules[0].params.extra = 1)))).toHaveLength(1);
  });

  it('інший source_url — порушення', () => {
    expect(guard(edit((j) => (j.rules[0].source_url = 'https://example.com/')))).toHaveLength(1);
  });

  it('додане, прибране чи переставлене правило — порушення', () => {
    expect(guard(edit((j) => j.rules.push({ ...j.rules[0], rule_id: 'new.rule' })))[0]).toMatch(/набір або порядок/);
    expect(guard(edit((j) => j.rules.pop()))[0]).toMatch(/набір або порядок/);
    expect(guard(edit((j) => j.rules.reverse()))[0]).toMatch(/набір або порядок/);
  });

  it('поле поза rules — порушення', () => {
    expect(guard(edit((j) => (j.tax_year = 2027)))).toContain('змінились поля матриці поза rules');
  });

  it('дата назад, у майбутньому чи не дата — порушення', () => {
    expect(guard(edit((j) => (j.rules[0].verified_at = '2026-01-01')))[0]).toMatch(/назад/);
    expect(guard(edit((j) => (j.rules[0].verified_at = '2026-12-31')))[0]).toMatch(/майбутньому/);
    expect(guard(edit((j) => (j.rules[0].verified_at = 'сьогодні')))[0]).toMatch(/не дата/);
  });

  it('переформатований, але той самий файл — не порушення', () => {
    expect(guard(JSON.stringify(JSON.parse(RULES_TEXT)))).toEqual([]);
  });
});

/**
 * Цикл гілки звіряє її матрицю, а бот-PR іде на master. Правило, чиї числа на
 * гілці інші, дати на master не отримує: збіг доводив не ті числа.
 */
describe('sameRuleData — дата лише тим числам, які звірено', () => {
  const branch = JSON.parse(RULES_TEXT);
  branch.rules.find((r) => r.rule_id === 'incubator.kup').params.subscriptionMonthlyMin = 1;
  branch.rules.find((r) => r.rule_id === 'jdg.skala').verified_at = '2026-10-02';
  const branchText = JSON.stringify(branch, null, 2);

  it('інші params — пропуск; інша лише дата — не пропуск', () => {
    expect(sameRuleData(branchText, RULES_TEXT, ['incubator.kup', 'jdg.skala', 'uop.pit'])).toEqual(['jdg.skala', 'uop.pit']);
  });

  it('правило, якого в цільовій матриці немає, — пропуск', () => {
    const extra = JSON.parse(RULES_TEXT);
    extra.rules.push({ rule_id: 'new.rule', params: {}, source_url: 'x', verified_at: '2026-10-01' });
    expect(sameRuleData(JSON.stringify(extra), RULES_TEXT, ['new.rule'])).toEqual([]);
  });
});
