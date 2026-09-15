/**
 * Свіжість звірки правила: чи давно цифру не звіряли з джерелом.
 *
 * Поріг і спосіб рахунку ті самі, що в `scripts/check-stale-rules.mjs` (його
 * читає SessionStart-хук). Імпортувати скрипт сюди не можна: `calc/` не бачить
 * нічого, крім `rules/`. Тож збіг двох реалізацій тримає тест, а не імпорт.
 *
 * Стара цифра не обовʼязково хибна. Стан означає лише «варто звірити знову».
 */

export const STALE_AFTER_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Повні доби від `verifiedAt` (YYYY-MM-DD, північ UTC) до `now`. */
export function ageInDays(verifiedAt: string, now: Date): number {
  const verified = Date.parse(`${verifiedAt}T00:00:00Z`);
  if (Number.isNaN(verified)) throw new Error(`Invalid verified_at: ${verifiedAt}`);
  return Math.floor((now.getTime() - verified) / DAY_MS);
}

/** 90-та доба ще свіжа, 91-ша вже ні: `>`, як у скрипті. */
export function isStale(verifiedAt: string, now: Date, thresholdDays: number = STALE_AFTER_DAYS): boolean {
  return ageInDays(verifiedAt, now) > thresholdDays;
}
