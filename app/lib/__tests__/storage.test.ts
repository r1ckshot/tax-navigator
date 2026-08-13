import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { visibleScreens, resumeIndex } from '@/lib/questions/schema';
import { clearDraft, loadDraft, saveDraft } from '@/lib/storage';
import { baseAnswers } from '../calc/__tests__/fixtures';

/** Мінімальний sessionStorage, щоб гонити storage у node-пулі без jsdom. */
function installFakeWindow(): void {
  const map = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    sessionStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    },
  };
}

beforeEach(installFakeWindow);
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('чернетка переживає F5', () => {
  it('відновлює і відповіді, і номер кроку', () => {
    saveDraft({ daysInPl: 'gte183', personalCenter: 'PL' }, 4);
    const restored = loadDraft();

    expect(restored.answers.daysInPl).toBe('gte183');
    expect(restored.step).toBe(4);
  });

  it('виручка зберігається квантизованою до 2500, точна сума — ні', () => {
    saveDraft({ ...baseAnswers, monthlyRevenue: 17342 }, 7);
    const restored = loadDraft().answers.monthlyRevenue;
    expect(restored).toBe(17500);
    expect(restored! % 2500).toBe(0);
  });

  it('порожнє сховище дає нульовий крок, а не NaN', () => {
    clearDraft();
    expect(loadDraft()).toEqual({ answers: {}, step: 0 });
  });

  it('зіпсований крок у сховищі не ламає відновлення', () => {
    saveDraft({ daysInPl: 'gte183' }, Number.NaN);
    expect(loadDraft().step).toBe(0);
  });
});

describe('resumeIndex — куди саме висаджуємо після F5', () => {
  it('не пускає далі першого незаповненого екрана', () => {
    // Якщо ранній екран лишився неповним (зіпсована чи часткова чернетка),
    // збережений крок 9 не має права його перестрибнути.
    const { personalCenter: _dropped, ...partial } = baseAnswers;
    const screens = visibleScreens(partial);
    const centersScreen = screens.findIndex((s) => s.id === 'centers');

    expect(resumeIndex(partial, 9)).toBe(centersScreen);
  });

  it('повертає саме збережений крок, коли попередні екрани заповнені', () => {
    expect(resumeIndex(baseAnswers, 3)).toBe(3);
  });

  it('на повністю заповнених відповідях не виходить за останній екран', () => {
    const last = visibleScreens(baseAnswers).length - 1;
    expect(resumeIndex(baseAnswers, 99)).toBe(last);
  });

  it('відʼємний збережений крок не дає відʼємного індексу', () => {
    expect(resumeIndex(baseAnswers, -5)).toBe(0);
  });
});
