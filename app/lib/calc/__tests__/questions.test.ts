import { describe, expect, it } from 'vitest';
import { SCREENS, visibleScreens, visibleFields, isScreenComplete, validateRevenue } from '@/lib/questions/schema';
import { baseAnswers, withAnswers } from './fixtures';

describe('анкета — умовні екрани', () => {
  it('медіанний шлях = 10 екранів', () => {
    // Без етату, без історії JDG, дні відомі, колишнього роботодавця немає.
    expect(visibleScreens(baseAnswers).length).toBe(10);
  });

  it('найскладніший кейс = 12 екранів', () => {
    const complex = withAnswers({ daysInPl: 'unsure', daysInPlApprox: 200, jdgStatus: 'lt6' });
    expect(visibleScreens(complex).length).toBe(12);
  });

  it('уточнення про дні зʼявляється лише при «не впевнений»', () => {
    const ids = (a: typeof baseAnswers) => visibleScreens(a).map((s) => s.id);
    expect(ids(baseAnswers)).not.toContain('daysApprox');
    expect(ids(withAnswers({ daysInPl: 'unsure' }))).toContain('daysApprox');
  });
});

describe('анкета — питання не ставиться, коли не впливає на результат', () => {
  it('історія JDG не питається при паралельному етаті (społeczne і так 0)', () => {
    const ids = visibleScreens(withAnswers({ jdgStatus: 'lt6', hasParallelUop: true })).map((s) => s.id);
    expect(ids).not.toContain('jdgHistory');
  });

  it('історія JDG не питається, коли пільгу вже втрачено через колишнього роботодавця', () => {
    const ids = visibleScreens(withAnswers({ jdgStatus: 'lt6', formerEmployer: 'partial' })).map((s) => s.id);
    expect(ids).not.toContain('jdgHistory');
  });

  it('історія JDG не питається при діяльності понад 30 міс — пільга вичерпана за віком', () => {
    const ids = visibleScreens(withAnswers({ jdgStatus: 'gt30' })).map((s) => s.id);
    expect(ids).not.toContain('jdgHistory');
  });

  it('хворобова питається лише на етапі preferencyjny', () => {
    const jdgScreen = SCREENS.find((s) => s.id === 'jdg')!;
    const names = (a: typeof baseAnswers) => visibleFields(jdgScreen, a).map((f) => f.name);
    expect(names(withAnswers({ jdgStatus: 'from6to30' }))).toContain('voluntarySickness');
    expect(names(withAnswers({ jdgStatus: 'gt30' }))).not.toContain('voluntarySickness');
    expect(names(withAnswers({ jdgStatus: 'from6to30', hasParallelUop: true }))).not.toContain('voluntarySickness');
  });
});

describe('анкета — повнота і валідація', () => {
  it('екран вважається завершеним лише коли заповнені всі ВИДИМІ поля', () => {
    const jdgScreen = SCREENS.find((s) => s.id === 'jdg')!;
    // voluntarySickness прихована на gt30 — її відсутність не блокує.
    expect(isScreenComplete(jdgScreen, { jdgStatus: 'gt30' })).toBe(true);
    expect(isScreenComplete(jdgScreen, { jdgStatus: 'from6to30', formerEmployer: 'no' })).toBe(false);
  });

  it('виручка: нуль, відʼємне і нечислове не проходять', () => {
    expect(validateRevenue(15000)).toBe('ok');
    expect(validateRevenue(0)).toBe('tooLow');
    expect(validateRevenue(-5)).toBe('tooLow');
    expect(validateRevenue('15000')).toBe('notANumber');
    expect(validateRevenue(NaN)).toBe('notANumber');
  });

  it('виручка понад місячний еквівалент ліміту ричалту позначається окремо', () => {
    expect(validateRevenue(800000)).toBe('overRyczaltLimit');
  });
});

describe('анкета — цілісність схеми', () => {
  it('id екранів унікальні', () => {
    const ids = SCREENS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('кожне поле-вибір має варіанти', () => {
    for (const screen of SCREENS) {
      for (const field of screen.fields) {
        if (field.kind === 'choice') expect(field.options?.length, field.name).toBeGreaterThan(1);
      }
    }
  });
});
