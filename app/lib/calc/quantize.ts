/**
 * Виручка живе на одній дискретній шкалі по 2 500 zł — для слайдера, сховища,
 * лінка й розрахунку. Крок навмисне грубий: правило product-safety «сирі доходи
 * не зберігаємо» так виконується за конструкцією — застосунок ніколи не отримує
 * точнішого за 2 500 zł числа, тож і розкривати в лінку нема чого. Пороги
 * zdrowotnej (60 000 і 300 000 zł на рік → 5 000 і 25 000 на місяць) лягають
 * рівно на межі кроків, тож жоден варіант не «зависає» між ступенями.
 *
 * Живе в calc/, а не в share.ts, бо це продуктове рішення про приватність, а не
 * деталь шарингу — і бо воно потрібне трьом шарам одразу. До цього те саме
 * округлення існувало двічі: тут і окремою копією в слайдері, з різними
 * джерелами меж. Дві реалізації одного правила приватності неминуче розходяться.
 */
export const REVENUE_STEP = 2500;
export const REVENUE_MIN = 2500;
export const REVENUE_MAX = 50000;

export interface StepScale {
  min: number;
  max: number;
  step: number;
  /** Що повернути на нечисловому вводі. */
  fallback: number;
}

/** Будь-яке число → найближчий крок шкали, затиснутий у її межі. */
export function snapToStep(value: number, scale: StepScale): number {
  if (!Number.isFinite(value)) return scale.fallback;
  const stepped = Math.round(value / scale.step) * scale.step;
  return Math.min(scale.max, Math.max(scale.min, stepped));
}

/** Виручка → крок 2 500 у межах шкали. Єдине джерело квантизації доходу. */
export function quantizeRevenue(value: number): number {
  return snapToStep(value, {
    min: REVENUE_MIN,
    max: REVENUE_MAX,
    step: REVENUE_STEP,
    fallback: REVENUE_MIN,
  });
}
