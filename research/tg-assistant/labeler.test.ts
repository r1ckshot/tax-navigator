import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { countLabels, labelQuestion, labelQuestions, loadMatrix, matchRules, parseMatrix, RULE_CLAUSES, type Matrix, type QuestionLabel } from './labeler.ts';

// Фікстури синтетичні: сирий текст реальних чатів у git не йде (PRD §6.1).
const RULES_PATH = fileURLToPath(new URL('../../app/lib/rules/rules.2026.json', import.meta.url));
const MATRIX = loadMatrix(RULES_PATH);
const AT = '2026-09-21T06:00:00.000Z';

describe('словник проти чинної матриці', () => {
  // Інваріант PRD §7 (Accuracy): мітка «покрито» цитує лише rule_id, що існує в
  // rules.2026.json. Обернений бік: нове правило без словника не може тихо
  // перетворити свої питання на білі плями — тест падає до деплою.
  it('кожен rule_id словника є в матриці, і кожне правило матриці має словник', () => {
    const matrixIds = MATRIX.rules.map((r) => r.rule_id).sort();
    expect(Object.keys(RULE_CLAUSES).sort()).toEqual(matrixIds);
  });

  it('матриця читається повністю: кожне правило з source_url і verified_at', () => {
    const raw = JSON.parse(readFileSync(RULES_PATH, 'utf8')) as { rules: unknown[] };
    expect(MATRIX.rules).toHaveLength(raw.rules.length);
    for (const rule of MATRIX.rules) {
      expect(rule.source_url).toMatch(/^https:\/\//);
      expect(rule.verified_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('matchRules — AC-05', () => {
  // Еталон виведено вручну: для кожного тексту пройдено всі клаузи словника.
  it.each([
    ['ZUS на JDG: клауза «=zus І JDG»', 'Підкажіть, чи платити ZUS на JDG?', ['jdg.zus.stages']],
    ['резидентство фразою з флексією', 'Я в Польщі вже 200 днів, я тепер податковий резидент тут чи ще в Україні?', ['residency.days_threshold']],
    // «na ryczałcie» не містить основи `ryczałt` — пастка, через яку основа коротша.
    ['ryczałt у місцевому відмінку + składka zdrowotna', 'Czy na ryczałcie płacę składkę zdrowotną od przychodu?', ['jdg.ryczalt.rate', 'jdg.zdrowotna.ryczalt']],
    ['ФОП і ЄСВ — два правила, у порядку матриці', 'Хтось знає, чи треба платити ЄСВ, якщо ФОП на паузі, а я в Польщі?', ['fop.zaklad_in_pl', 'fop.esv_vz']],
    ['nierejestrowana з PESEL UKR', 'Czy mogę prowadzić działalność nierejestrowaną z PESEL UKR i ile mogę zarobić?', ['nierejestrowana.limit', 'nierejestrowana.cudzoziemcy']],
    ['мінімалка у родовому відмінку', 'Від мінімальної зарплати рахується внесок?', ['common.minimum_wage']],
    ['UoP і PIT цілим словом', 'Mam UoP, jaki PIT zapłacę?', ['uop.pit']],
  ])('%s', (_, text, expected) => {
    expect(matchRules(text, MATRIX)).toEqual(expected);
  });

  it.each([
    // Mały ZUS Plus продукт не покриває (BACKLOG → LATER): `=zus` без JDG правила не дає.
    ['Mały ZUS Plus', 'Як відкрити Mały ZUS Plus і чи вийде дешевше?'],
    // `=pit` — ціле слово: `pitch` не робить питання про UoP податковим.
    ['pitch не PIT', 'Mam UoP, a pitch deck robić po polsku?'],
  ])('біла пляма: %s', (_, text) => {
    expect(matchRules(text, MATRIX)).toEqual([]);
  });
});

describe('labelQuestion — AC-05', () => {
  it('«покрито» несе rule_id і редакцію матриці', () => {
    expect(labelQuestion('Підкажіть, чи платити ZUS на JDG?', MATRIX, '2026-W39', AT)).toEqual({
      weekOf: '2026-W39',
      label: 'covered',
      ruleIds: ['jdg.zus.stages'],
      matrixVerifiedAt: MATRIX.verified_at,
      labeledAt: AT,
    });
  });

  it('«біла пляма» підтверджує, що перевірено всі правила матриці', () => {
    expect(labelQuestion('Як відкрити Mały ZUS Plus?', MATRIX, '2026-W39', AT)).toEqual({
      weekOf: '2026-W39',
      label: 'white_spot',
      rulesChecked: MATRIX.rules.length,
      matrixVerifiedAt: MATRIX.verified_at,
      labeledAt: AT,
    });
  });

  it('правило, якого вже немає в матриці, не цитується, хоч словник його пам’ятає', () => {
    const without: Matrix = { ...MATRIX, rules: MATRIX.rules.filter((r) => r.rule_id !== 'jdg.zus.stages') };
    expect(labelQuestion('Підкажіть, чи платити ZUS на JDG?', without, '2026-W39', AT)).toMatchObject({ label: 'white_spot', rulesChecked: MATRIX.rules.length - 1 });
  });
});

describe('labelQuestions — AC-06 мітка пишеться один раз', () => {
  const question = { chatId: '-1001', telegramMessageId: 7, text: 'Підкажіть, чи платити ZUS на JDG?', weekOf: '2026-W39' };

  it('наявна мітка не переписується навіть проти іншої матриці', () => {
    const earlier: QuestionLabel = { weekOf: '2026-W38', label: 'covered', ruleIds: ['jdg.zus.stages'], matrixVerifiedAt: '2026-07-24', labeledAt: '2026-09-14T06:00:00.000Z' };
    const changed: Matrix = { verified_at: '2026-09-20', rules: MATRIX.rules.filter((r) => r.rule_id !== 'jdg.zus.stages') };

    const result = labelQuestions({ '-1001:7': earlier }, [question], changed, AT);

    expect(result.labels['-1001:7']).toEqual(earlier);
    expect(result.added).toEqual([]);
  });

  it('нове питання отримує мітку, і лічильник бачить лише додані', () => {
    const result = labelQuestions({}, [question, { ...question, telegramMessageId: 8, text: 'Як відкрити Mały ZUS Plus?' }], MATRIX, AT);

    expect(result.added).toEqual(['-1001:7', '-1001:8']);
    expect(countLabels(result.labels, result.added)).toEqual({ covered: 1, whiteSpot: 1 });
  });

  it('вхідний стан не мутується', () => {
    const existing = {};
    labelQuestions(existing, [question], MATRIX, AT);
    expect(existing).toEqual({});
  });
});

describe('parseMatrix — матриця без джерела не вантажиться', () => {
  const rule = { rule_id: 'a.b', source_url: 'https://example.test', verified_at: '2026-07-24', params: {} };

  it('бере лише rule_id, source_url, verified_at — цифри параметрів розмітці не потрібні', () => {
    expect(parseMatrix(JSON.stringify({ verified_at: '2026-07-24', rules: [rule] }))).toEqual({
      verified_at: '2026-07-24',
      rules: [{ rule_id: 'a.b', source_url: 'https://example.test', verified_at: '2026-07-24' }],
    });
  });

  it.each([
    ['правило без source_url', { verified_at: '2026-07-24', rules: [{ ...rule, source_url: '' }] }, /rule #0 has no source_url/],
    ['правило без verified_at', { verified_at: '2026-07-24', rules: [{ rule_id: 'a.b', source_url: 'https://example.test' }] }, /rule #0 has no verified_at/],
    ['порожній список правил', { verified_at: '2026-07-24', rules: [] }, /non-empty rules array/],
  ])('%s', (_, data, message) => {
    expect(() => parseMatrix(JSON.stringify(data))).toThrow(message);
  });
});
