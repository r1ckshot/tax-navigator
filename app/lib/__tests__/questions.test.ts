import { describe, expect, it } from 'vitest';
import { SCREENS, visibleScreens, visibleFields, isScreenComplete } from '@/lib/questions/schema';
import { baseAnswers, withAnswers } from '../calc/__tests__/fixtures';

describe('анкета — умовні екрани', () => {
  it('медіанний шлях = 11 екранів', () => {
    // Без етату, без історії JDG, дні відомі, колишнього роботодавця немає.
    // 11-й — підстава перебування (сесія 06): її питають усіх.
    expect(visibleScreens(baseAnswers).length).toBe(11);
  });

  it('найскладніший кейс = 14 екранів', () => {
    // Уточнення днів + історія JDG + умовний екран житла (центр в UA) + підстава.
    const complex = withAnswers({ daysInPl: 'unsure', daysInPlApprox: 200, jdgStatus: 'lt6', personalCenter: 'UA' });
    expect(visibleScreens(complex).length).toBe(14);
  });

  it('уточнення про дні зʼявляється лише при «не впевнений»', () => {
    const ids = (a: typeof baseAnswers) => visibleScreens(a).map((s) => s.id);
    expect(ids(baseAnswers)).not.toContain('daysApprox');
    expect(ids(withAnswers({ daysInPl: 'unsure' }))).toContain('daysApprox');
  });

  it('питання про житло в UA зʼявляється лише коли резидентство неоднозначне', () => {
    const ids = (a: typeof baseAnswers) => visibleScreens(a).map((s) => s.id);
    // Обидва центри в PL — резидент однозначно, тай-брейкер зайвий.
    expect(ids(baseAnswers)).not.toContain('homeInUa');
    // Особистий центр в UA + резидент PL за днями — тай-брейкер вирішує вердикт.
    expect(ids(withAnswers({ personalCenter: 'UA' }))).toContain('homeInUa');
    // Не резидент PL — Конвенція не запускається, питання нічого не змінює.
    expect(ids(withAnswers({ daysInPl: 'lt183', personalCenter: 'UA', economicCenter: 'UA' }))).not.toContain('homeInUa');
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

describe('анкета — повнота', () => {
  it('екран вважається завершеним лише коли заповнені всі ВИДИМІ поля', () => {
    const jdgScreen = SCREENS.find((s) => s.id === 'jdg')!;
    // voluntarySickness прихована на gt30 — її відсутність не блокує.
    expect(isScreenComplete(jdgScreen, { jdgStatus: 'gt30' })).toBe(true);
    expect(isScreenComplete(jdgScreen, { jdgStatus: 'from6to30', formerEmployer: 'no' })).toBe(false);
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

describe('анкета — підстава перебування і замовники (сесія 06)', () => {
  it('підставу питають усіх, і в ній є UKR і CUKR окремо (PRD AC-3)', () => {
    const screen = visibleScreens({}).find((s) => s.id === 'status');
    expect(screen).toBeDefined();
    const values = screen!.fields[0].options!.map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['ukr', 'cukr', 'work_permit', 'study', 'blue_card', 'eu_citizen', 'other']));
  });

  it('кількість замовників питається лише тоді, коли JDG дозволена', () => {
    const screen = SCREENS.find((s) => s.id === 'formerEmployer')!;
    const names = (a: Partial<typeof baseAnswers>) => visibleFields(screen, a).map((f) => f.name);
    expect(names(withAnswers({ stayBasis: 'ukr' }))).toContain('clientCount');
    expect(names(withAnswers({ stayBasis: 'work_permit' }))).not.toContain('clientCount');
    expect(names(withAnswers({ stayBasis: 'other' }))).not.toContain('clientCount');
  });
});
