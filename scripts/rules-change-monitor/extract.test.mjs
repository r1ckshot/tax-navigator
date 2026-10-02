import { describe, it, expect } from 'vitest';

import { AMOUNT, INTEGER, PERCENT, PL_DATE, isoFromPolishDate, pageText, pick } from './extract.mjs';

const all = (re, text) => [...text.matchAll(re)].map((m) => m[0].trim());

describe('pageText', () => {
  it('знімає теги, скрипти й числові сутності podatki.gov.pl', () => {
    const html = '<p>Stawki podatku wed&#x142;ug skali</p><script>var x = "120 000 zł";</script><p>koszty uzyskania przychod&#xF3;w</p>';
    expect(pageText(html)).toBe('Stawki podatku według skali koszty uzyskania przychodów');
  });

  it('прибирає нуль-ширинні пробіли zus.pl, щоб валюта не відривалась від суми', () => {
    expect(pageText('<p>wynosi 1 495,04 ​​​zł</p>')).toBe('wynosi 1 495,04 zł');
  });

  it('не рядок — порожньо, а не виняток', () => {
    expect(pageText(null)).toBe('');
  });
});

describe('AMOUNT', () => {
  /**
   * Анти-регрес на відому пастку: zus.pl пише `1441,80 zł` без пробілу тисяч, і
   * попередня регулярка (`\d{1,3}(?: \d{3})*`) матчила з середини — `441,80 zł`.
   * Тисяча зникала мовчки, і розбіжність у -69% читалась би як зміна закону.
   */
  it('сума без пробілу тисяч береться цілою, а не з другої цифри', () => {
    expect(all(AMOUNT, 'Podstawa wymiaru 1441,80 zł [ 4 ]')).toEqual(['1441,80 zł']);
    expect(all(AMOUNT, 'wynosi 10813,50 zł')).toEqual(['10813,50 zł']);
  });

  it('сума з пробілом тисяч — одним матчем', () => {
    expect(all(AMOUNT, 'kwota 9 228,64 zł i 8 517 200 zł')).toEqual(['9 228,64 zł', '8 517 200 zł']);
  });

  it('без валюти числа не беремо: номер року чи меню сумою не є', () => {
    expect(all(AMOUNT, 'w 2026 roku nav__li--lvl3 120')).toEqual([]);
  });
});

describe('PERCENT і INTEGER', () => {
  it('відсоток у двох написаннях biznes.gov.pl', () => {
    expect(all(PERCENT, 'Emerytalna 9,76% 9,76% 19,52%')).toEqual(['9,76%', '9,76%', '19,52%']);
    expect(all(PERCENT, 'chorobowe (2,45 proc. wynagrodzenia)')).toEqual(['2,45 proc.']);
  });

  it('ціле з групами тисяч і без них, але не частина десяткового', () => {
    expect(all(INTEGER, 'ponad do 120 000 12%')).toEqual(['120 000', '12']);
    expect(all(INTEGER, '8517200')).toEqual(['8517200']);
    expect(all(INTEGER, '9,76')).toEqual([]);
  });
});

describe('дати словами', () => {
  it('польська дата → ISO', () => {
    expect(isoFromPolishDate('8 lipca 2026')).toBe('2026-07-08');
    expect(isoFromPolishDate('1 czerwca 2025')).toBe('2025-06-01');
  });

  it('не дата — null, а не вгадане число', () => {
    expect(isoFromPolishDate('8 lipcaa 2026')).toBeNull();
    expect(isoFromPolishDate(null)).toBeNull();
  });

  it('PL_DATE знаходить дату в реченні', () => {
    expect(all(PL_DATE, 'Nowe przepisy obowiązują od 8 lipca 2026 r.')).toEqual(['8 lipca 2026']);
  });
});

describe('pick', () => {
  const text = 'Menu minimalne wynagrodzenie. Tabela: Emerytalna 9,76% 9,76% 19,52% Rentowa 1,50% 6,50% 8%';

  it('ланцюжок маркерів веде в потрібний рядок, nth — у потрібну колонку', () => {
    expect(pick(text, { after: [/Tabela:/, /Rentowa/], value: PERCENT, within: 30 })).toBe('1,50%');
    expect(pick(text, { after: [/Tabela:/, /Rentowa/], value: PERCENT, within: 30, nth: 1 })).toBe('6,50%');
  });

  it('маркера немає — null, а не перше число сторінки', () => {
    expect(pick(text, { after: [/Wypadkowa/], value: PERCENT })).toBeNull();
  });

  it('значення за межами вікна — null: число з сусіднього розділу не підставляється', () => {
    expect(pick('Limit wynosi …………………………………… 4806 zł', { after: [/Limit wynosi/], value: AMOUNT, within: 10 })).toBeNull();
  });

  it('before бере найближче значення перед маркером', () => {
    const rates = '20% - od nierezydentów, 19% - od dochodów z pozarolniczej działalności';
    expect(pick(rates, { before: /- od dochodów z pozarolniczej/, value: PERCENT, within: 8 })).toBe('19%');
  });

  it('другий маркер шукається після першого, а не з початку', () => {
    const page = 'Suma składek do zapłaty 1926,76 zł … Tabela preferencyjna … Suma składek do zapłaty 456,18 zł';
    expect(pick(page, { after: [/Tabela preferencyjna/, /Suma składek do zapłaty/], value: AMOUNT, within: 20 })).toBe('456,18 zł');
  });
});
