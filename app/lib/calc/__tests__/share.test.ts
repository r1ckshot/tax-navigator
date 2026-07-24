import { describe, expect, it } from 'vitest';
import { encodeAnswers, decodeAnswers, bandOf } from '@/lib/share';
import { assessResidency } from '../residency';
import { baseAnswers, withAnswers } from './fixtures';

describe('шеринг — точний дохід не витікає', () => {
  it('URL не містить точної виручки', () => {
    const query = encodeAnswers(withAnswers({ monthlyRevenue: 17342 }));
    expect(query).not.toContain('17342');
    expect(new URLSearchParams(query).get('r')).toBe('d');
  });

  it('декодування дає репрезентативне значення смуги, а не оригінал', () => {
    const decoded = decodeAnswers(encodeAnswers(withAnswers({ monthlyRevenue: 17342 })));
    expect(decoded.monthlyRevenue).toBe(20000);
    expect(decoded.monthlyRevenue).not.toBe(17342);
  });

  it('різні доходи в одній смузі дають однаковий лінк — за ним не відновити суму', () => {
    expect(encodeAnswers(withAnswers({ monthlyRevenue: 11000 }))).toBe(
      encodeAnswers(withAnswers({ monthlyRevenue: 14900 }))
    );
  });

  it('смуги покривають усю шкалу', () => {
    expect(bandOf(1)).toBe('a');
    expect(bandOf(5000)).toBe('a');
    expect(bandOf(5001)).toBe('b');
    expect(bandOf(999999)).toBe('e');
  });
});

describe('шеринг — round-trip', () => {
  it('усі нечислові відповіді відновлюються без втрат', () => {
    const decoded = decodeAnswers(encodeAnswers(baseAnswers));
    const { monthlyRevenue: _ignored, ...rest } = baseAnswers;
    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined) continue;
      expect(decoded[key as keyof typeof decoded], key).toBe(value);
    }
  });

  it('булеві поля не перетворюються на рядки', () => {
    const decoded = decodeAnswers(encodeAnswers(withAnswers({ permanentHomeInUa: true, hasParallelUop: false })));
    expect(decoded.permanentHomeInUa).toBe(true);
    expect(decoded.hasParallelUop).toBe(false);
  });

  it('вердикт резидентства з лінка збігається з оригінальним', () => {
    const answers = withAnswers({ personalCenter: 'UA', economicCenter: 'PL', permanentHomeInUa: true });
    const restored = { ...answers, ...decodeAnswers(encodeAnswers(answers)) };
    expect(assessResidency(restored)).toEqual(assessResidency(answers));
  });
});
