import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOCALE, DICTIONARIES, LOCALES, isLocale, translator } from '../i18n';
import { uk } from '../i18n/uk';
import { en } from '../i18n/en';

/**
 * Каркас мов (ADR-0003): мова вмикається рядком у реєстрі `i18n/index.ts`, а
 * не правкою маршрутів. Тут три речі: увімкнена мова повна, каркас `en` не
 * засмічений, і маршрути справді беруть мови з реєстру.
 */

describe('увімкнені мови', () => {
  it('кожен ключ uk є в кожній увімкненій мові, і зайвих немає', () => {
    const keys = Object.keys(uk).sort();
    for (const [locale, dictionary] of Object.entries(DICTIONARIES)) {
      expect(Object.keys(dictionary).sort(), `словник ${locale}`).toEqual(keys);
    }
  });

  it('жоден текст увімкненої мови не порожній', () => {
    for (const [locale, dictionary] of Object.entries(DICTIONARIES)) {
      const empty = Object.entries(dictionary).filter(([, text]) => text.trim() === '');
      expect(empty, `словник ${locale}`).toEqual([]);
    }
  });

  it('мова за замовчуванням увімкнена; сьогодні це лише uk', () => {
    expect(LOCALES).toContain(DEFAULT_LOCALE);
    expect(LOCALES).toEqual(['uk']);
  });

  it('чужий сегмент адреси — не мова, навіть якщо це властивість обʼєкта', () => {
    expect(isLocale('uk')).toBe(true);
    expect(isLocale('en')).toBe(false);
    expect(isLocale('toString')).toBe(false);
  });

  it('перекладач мови підставляє змінні так само, як t', () => {
    expect(translator('uk')('app.title')).toBe(uk['app.title']);
    expect(translator('uk')('no.such.key')).toBe('no.such.key');
  });
});

describe('каркас en', () => {
  // До сесії 34 словник порожній; що б туди не додали, ключі мусять бути ключами uk,
  // інакше переклад розійдеться з інтерфейсом ще до увімкнення.
  it('містить лише ключі, що є в uk', () => {
    const stray = Object.keys(en).filter((key) => !(key in uk));
    expect(stray).toEqual([]);
  });

  it('не увімкнений: на сайті його немає', () => {
    expect(Object.keys(DICTIONARIES)).not.toContain('en');
  });
});

describe('нова мова вмикається словником, без змін у маршрутах', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/i18n');
    vi.resetModules();
  });

  /**
   * Реєстр підмінюється на такий, де `en` є (тексти — копія uk з позначкою), і
   * той самий `layout.tsx`, без жодної правки, мусить: згенерувати адресу `/en`,
   * поставити `lang="en"` і взяти метадані з `en`.
   */
  async function layoutWithEnglish() {
    vi.resetModules();
    vi.doMock('@/lib/i18n', async () => {
      const actual = await vi.importActual<typeof import('../i18n')>('../i18n');
      const { createT } = await vi.importActual<typeof import('../i18n/translate')>('../i18n/translate');
      const fake = Object.fromEntries(Object.entries(uk).map(([k, v]) => [k, `EN ${v}`]));
      const DICTIONARIES = { ...actual.DICTIONARIES, en: fake } as Record<string, Record<string, string>>;
      return {
        ...actual,
        DICTIONARIES,
        LOCALES: Object.keys(DICTIONARIES),
        isLocale: (value: string) => Object.hasOwn(DICTIONARIES, value),
        translator: (locale: string) => createT(DICTIONARIES[locale]),
      };
    });
    return import('@/[locale]/layout');
  }

  it('адреса /en зʼявляється в статичних параметрах', async () => {
    const layout = await layoutWithEnglish();
    expect(layout.generateStaticParams()).toEqual([{ locale: 'uk' }, { locale: 'en' }]);
    expect(layout.dynamicParams).toBe(false);
  });

  it('<html lang> і метадані йдуть з мови адреси', async () => {
    const layout = await layoutWithEnglish();
    const params = Promise.resolve({ locale: 'en' });

    const html = renderToStaticMarkup(await layout.default({ children: null, params }));
    expect(html).toMatch(/^<html lang="en">/);

    const meta = await layout.generateMetadata({ params });
    expect(meta.title).toBe(`EN ${uk['app.title']}`);
    expect(meta.openGraph).toMatchObject({ locale: `EN ${uk['app.ogLocale']}` });
  });

  it('без підміни реєстру той самий layout дає лише uk', async () => {
    vi.resetModules();
    const layout = await import('@/[locale]/layout');
    expect(layout.generateStaticParams()).toEqual([{ locale: 'uk' }]);
    const html = renderToStaticMarkup(await layout.default({ children: null, params: Promise.resolve({ locale: 'uk' }) }));
    expect(html).toMatch(/^<html lang="uk">/);
  });
});

/**
 * Мова доходить до тексту лише через провайдер або `translator(locale)`.
 * Прямий імпорт `i18n/uk` у сторінці чи компоненті показав би українську під
 * будь-якою адресою — і жоден тест на `uk` цього не побачив би.
 */
describe('мова не обходить провайдер', () => {
  const APP = join(process.cwd(), 'app');
  /** Технічна сторінка без мови в адресі (ADR-0003). */
  const ALLOWED = ['app/(technical)/'];

  function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === 'lib' ? [] : sources(full);
      return /\.tsx?$/.test(entry.name) ? [relative(process.cwd(), full).split(sep).join('/')] : [];
    });
  }

  it('жоден компонент чи сторінка не імпортує словник uk напряму', () => {
    const files = sources(APP);
    expect(files.length).toBeGreaterThan(15);
    const offenders = files
      .filter((f) => !ALLOWED.some((prefix) => f.startsWith(prefix)))
      .filter((f) => /from ['"]@\/lib\/i18n\/uk['"]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
