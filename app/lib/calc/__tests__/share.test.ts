import { describe, expect, it } from 'vitest';
import { encodeAnswers, decodeAnswers } from '@/lib/share';
import { quantizeRevenue } from '@/lib/calc/quantize';
import { assessResidency } from '../residency';
import { baseAnswers, withAnswers } from './fixtures';

describe('шеринг — точний дохід не витікає', () => {
  it('URL несе лише квантизоване значення, не точну суму', () => {
    const query = encodeAnswers(withAnswers({ monthlyRevenue: 17342 }));
    expect(query).not.toContain('17342');
    expect(new URLSearchParams(query).get('r')).toBe('17500'); // 17342 → крок 2500
  });

  it('декодування дає квантизоване значення, а не оригінал', () => {
    const decoded = decodeAnswers(encodeAnswers(withAnswers({ monthlyRevenue: 17342 })));
    expect(decoded.monthlyRevenue).toBe(17500);
    expect(decoded.monthlyRevenue).not.toBe(17342);
  });

  it('різні суми в одному кроці 2500 дають однаковий лінк — за ним не відновити точну', () => {
    // 14 000 і 15 100 обидва округляються до 15 000.
    expect(encodeAnswers(withAnswers({ monthlyRevenue: 14000 }))).toBe(
      encodeAnswers(withAnswers({ monthlyRevenue: 15100 }))
    );
  });

  it('квантизація тримається меж слайдера і кроку 2500', () => {
    expect(quantizeRevenue(1)).toBe(2500); // нижче мінімуму → мінімум
    expect(quantizeRevenue(5000)).toBe(5000); // поріг zdrowotnej лягає на крок
    expect(quantizeRevenue(6000)).toBe(5000);
    expect(quantizeRevenue(25000)).toBe(25000); // другий поріг zdrowotnej
    expect(quantizeRevenue(999999)).toBe(50000); // вище максимуму → максимум
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
