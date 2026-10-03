import { describe, expect, it } from 'vitest';
import { formatCount, formatDate, formatVars, pluralUk } from '../format';
import { t } from '../i18n/uk';

const RULES = ['{n} правило', '{n} правила', '{n} правил'] as const;

describe('pluralUk', () => {
  // Еталон руками за правилом української граматики: остача від 10 вирішує,
  // але 11–14 завжди третя форма.
  it.each([
    [1, '1 правило'],
    [2, '2 правила'],
    [4, '4 правила'],
    [5, '5 правил'],
    [11, '11 правил'],
    [12, '12 правил'],
    [14, '14 правил'],
    [21, '21 правило'],
    [22, '22 правила'],
    [26, '26 правил'],
    [111, '111 правил'],
    [0, '0 правил'],
  ])('%i → %s', (n, expected) => {
    expect(formatCount(n, RULES)).toBe(expected);
  });

  it('повертає саму форму без підстановки', () => {
    expect(pluralUk(3, ['a', 'b', 'c'])).toBe('b');
  });
});

describe('дати з правил у тексті', () => {
  it('ISO → ДД.ММ.РРРР без зсуву зони', () => {
    expect(formatDate('2028-03-04')).toBe('04.03.2028');
    expect(formatDate('2026-07-08')).toBe('08.07.2026');
  });

  it('не-дата лишається як є', () => {
    expect(formatVars({ until: '2028-03-04', days: '30' })).toEqual({ until: '04.03.2028', days: '30' });
    expect(formatVars(undefined)).toBeUndefined();
  });

  it('t() підставляє змінні, а без значення лишає плейсхолдер видимим', () => {
    expect(t('status.ukrProtection', { protectionUntil: '04.03.2028', abroadDays: '30' })).toContain('до 04.03.2028');
    expect(t('status.ukrProtection', { abroadDays: '30' })).toContain('{protectionUntil}');
    expect(t('risk.uop.standard', { x: '1' })).toBe(t('risk.uop.standard'));
  });
});
