import type { AnswerPageContent } from '../types';

/**
 * «Податки B2B Польща скільки на руки» — запит без відповіді українською з
 * розрахунком (research §D, №2). Сторінка не називає суми «на руки»: вона
 * розкладає, з чого суму рахують, а діапазон дає анкета (product-safety:
 * діапазони, не точні суми). Ставки — правила `jdg.*`; база порівняння з етатом —
 * EVIDENCE, сценарій F («виручку B2B трактуємо як повний кошт роботодавця»).
 * Сторінки «B2B N zł» з числами з движка — сесія 15.
 */
export const b2bNaRuky: AnswerPageContent = {
  slug: 'b2b-na-ruky',
  title: 'B2B у Польщі: з чого складається сума на руки',
  description:
    'Податок однієї з трьох форм, внески ZUS і внесок на здоровʼя: що віднімається від суми B2B на JDG і як її порівнювати з етатом.',
  lead: 'На B2B через JDG із суми рахунку платяться три речі: податок, соціальні внески ZUS і внесок на здоровʼя. Скільки лишиться, залежить від форми податку, етапу ZUS і ваших витрат.',
  body: [
    { kind: 'h2', text: 'Податок: три форми' },
    {
      kind: 'list',
      items: [
        'ричалт (ryczałt) — {{percent:jdg.ryczalt.rate/rateProgramming}} від виручки за програмування, витрати не віднімаються;',
        'лінійний — {{percent:jdg.liniowy/rate}} від доходу, тобто виручки мінус витрати;',
        'шкала — {{percent:jdg.skala/lowerRate}} до {{amount:jdg.skala/bracketThreshold}} zł доходу за рік і {{percent:jdg.skala/upperRate}} з надлишку; неоподатковувана сума — {{amount:jdg.skala/taxFreeAmount}} zł.',
      ],
    },
    { kind: 'h2', text: 'Внески ZUS' },
    {
      kind: 'p',
      text: 'Залежать від того, скільки існує JDG і чи є право на пільги: перші місяці — без соціальних внесків, потім пільгові, далі повні — щонайменше {{amount:jdg.zus.stages/duzyMonthly}} zł на місяць з хворобовим страхуванням. Пільг немає, зокрема, якщо JDG працює на колишнього роботодавця або людина вела діяльність останні {{amount:jdg.zus.stages/priorBusinessLookbackMonths}} місяців (art. 18 Prawa przedsiębiorców, art. 18a ustawy o systemie ubezpieczeń społecznych).',
    },
    { kind: 'h2', text: 'Внесок на здоровʼя' },
    {
      kind: 'list',
      items: [
        'на лінійному — {{percent:jdg.liniowy/zdrowotnaRate}} доходу, але не менше {{amount:jdg.liniowy/zdrowotnaMinMonthly}} zł на місяць;',
        'на шкалі — {{percent:jdg.skala/zdrowotnaRate}} доходу, але не менше {{amount:jdg.skala/zdrowotnaMinMonthly}} zł на місяць;',
        'на ричалті — фіксована сума за порогами річної виручки. {{cite:jdg.zdrowotna.ryczalt}}',
      ],
    },
    { kind: 'h2', text: 'Порівняння з етатом' },
    {
      kind: 'p',
      text: 'За трудовим договором роботодавець, крім зарплати брутто, платить свої внески ZUS. Тому анкета ставить суму B2B поруч не з брутто, а з повною вартістю працівника для роботодавця. {{cite:uop.employer_contributions}}',
    },
    {
      kind: 'p',
      text: 'Окремий ризик B2B — не податковий: з {{date:jdg.przekwalifikowanie/pipDecisionPowerFrom}} інспекція праці може рішенням визнати такий договір трудовим.',
    },
  ],
  prefill: {},
};
