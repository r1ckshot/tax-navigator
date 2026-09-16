import { describe, expect, it } from 'vitest';
import { agreement, type CoverageRow } from './evalLabeler.ts';

const row = (predicted: CoverageRow['predicted'], expected: CoverageRow['expected']): CoverageRow => ({ id: 'x', predicted, expected });

describe('agreement', () => {
  it('рахує збіг і розводить два види помилок', () => {
    // 4 рядки: 2 збіги; пропущена пляма (covered замість white_spot) і хибна пляма.
    const rows = [row('covered', 'covered'), row('white_spot', 'white_spot'), row('covered', 'white_spot'), row('white_spot', 'covered')];
    expect(agreement(rows)).toEqual({ total: 4, agreed: 2, rate: 0.5, missedWhiteSpots: 1, falseWhiteSpots: 1 });
  });

  it('порожній список — n/a, а не 100%', () => {
    expect(agreement([]).rate).toBeNull();
  });
});
