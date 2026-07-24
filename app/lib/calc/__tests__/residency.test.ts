import { describe, expect, it } from 'vitest';
import { assessResidency } from '../residency';
import { withAnswers } from './fixtures';

describe('резидентство — тест 183 днів', () => {
  it('≥183 днів робить резидентом навіть без центру інтересів у PL', () => {
    const r = assessResidency(
      withAnswers({ daysInPl: 'gte183', personalCenter: 'UA', economicCenter: 'UA', permanentHomeInUa: true })
    );
    expect(r.plResident).toBe(true);
    expect(r.basis).toContain('days');
  });

  it('«не впевнений» розкривається через орієнтовну кількість днів', () => {
    expect(assessResidency(withAnswers({ daysInPl: 'unsure', daysInPlApprox: 200 })).basis).toContain('days');
    expect(
      assessResidency(
        withAnswers({
          daysInPl: 'unsure',
          daysInPlApprox: 100,
          personalCenter: 'UA',
          economicCenter: 'UA',
        })
      ).plResident
    ).toBe(false);
  });
});

describe('резидентство — центр інтересів рахується по двох осях («АБО»)', () => {
  // Саме цей кейс провалювала злита версія питання: родина в UA сприймалась
  // як «центр в UA», хоча економічного центру в PL уже достатньо.
  it('родина в UA + економічний центр у PL → резидент PL', () => {
    const r = assessResidency(
      withAnswers({ daysInPl: 'lt183', personalCenter: 'UA', economicCenter: 'PL', permanentHomeInUa: true })
    );
    expect(r.plResident).toBe(true);
    expect(r.basis).toEqual(['centerEconomic']);
  });

  it('дзеркальний кейс: родина в PL + економічний центр у UA → теж резидент PL', () => {
    const r = assessResidency(
      withAnswers({ daysInPl: 'lt183', personalCenter: 'PL', economicCenter: 'UA', permanentHomeInUa: true })
    );
    expect(r.plResident).toBe(true);
    expect(r.basis).toEqual(['centerPersonal']);
  });

  it('обидві осі в UA і <183 днів → не резидент PL', () => {
    const r = assessResidency(
      withAnswers({ daysInPl: 'lt183', personalCenter: 'UA', economicCenter: 'UA' })
    );
    expect(r.plResident).toBe(false);
    expect(r.basis).toEqual([]);
  });
});

describe('резидентство — спецнорма art. 52zr', () => {
  it('заява дає підставу і ЗАВЖДИ тягне попередження про sunset 31.12.2026', () => {
    const r = assessResidency(
      withAnswers({ daysInPl: 'lt183', personalCenter: 'UA', economicCenter: 'UA', specialLaw52zr: 'yes' })
    );
    expect(r.plResident).toBe(true);
    expect(r.basis).toContain('declaration52zr');
    expect(r.sunsetNote).toBe(true);
  });

  it('без заяви попередження про sunset не показуємо', () => {
    expect(assessResidency(withAnswers({ specialLaw52zr: 'no' })).sunsetNote).toBe(false);
  });
});

describe('резидентство — тай-брейки Конвенції 1993 art. 4 ust. 2', () => {
  it('без житла в UA ланцюг зупиняється на першому кроці', () => {
    const r = assessResidency(withAnswers({ personalCenter: 'UA', permanentHomeInUa: false }));
    expect(r.dualRisk).toBe(true);
    expect(r.tiebreak).toEqual({ resolvedAt: 'permanentHome', result: 'PL' });
  });

  it('житло в обох країнах → вирішує центр інтересів', () => {
    const r = assessResidency(
      withAnswers({ personalCenter: 'UA', economicCenter: 'PL', permanentHomeInUa: true, daysInPl: 'gte183' })
    );
    // По одній осі в кожній країні — нічия, тому крок далі.
    expect(r.tiebreak).toEqual({ resolvedAt: 'habitualAbode', result: 'PL' });
  });

  it('нічия по центру і невідомі дні → доходимо до громадянства і не виносимо вироку', () => {
    const r = assessResidency(
      withAnswers({
        personalCenter: 'UA',
        economicCenter: 'PL',
        permanentHomeInUa: true,
        daysInPl: 'unsure',
        daysInPlApprox: 200,
      })
    );
    expect(r.tiebreak).toEqual({ resolvedAt: 'citizenship', result: 'unresolved' });
  });

  it('без звʼязків з UA тай-брейк взагалі не запускається', () => {
    const r = assessResidency(withAnswers({}));
    expect(r.dualRisk).toBe(false);
    expect(r.tiebreak).toBeUndefined();
  });
});

describe('резидентство — джерела', () => {
  it('кожен висновок несе щонайменше одне джерело', () => {
    const r = assessResidency(withAnswers({}));
    expect(r.sources.length).toBeGreaterThan(0);
    for (const s of r.sources) expect(s.url).toMatch(/^https?:\/\//);
  });
});
