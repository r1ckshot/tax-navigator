import type { Answers, ScenarioResult } from '../types';
import { calcFop } from './fop';
import { calcIncubator } from './incubator';
import { calcJdg } from './jdg';
import { calcUop } from './uop';
import { calcZlecenie } from './zlecenie';

/**
 * Порівняння варіантів — НЕ рекомендація. Порядок фіксований (як у README),
 * жодного сортування «за вигодою»: воно читалось би як «тобі краще X».
 * Zlecenie стоїть перед UoP: обидва — найм, і поруч видно ціну добровільної
 * хворобової та інших KUP.
 */
export function compareScenarios(answers: Answers): ScenarioResult[] {
  return [
    calcFop(answers),
    calcJdg(answers),
    calcIncubator(answers),
    calcZlecenie(answers),
    calcUop(answers),
  ];
}

export { calcFop, calcIncubator, calcJdg, calcUop, calcZlecenie };
