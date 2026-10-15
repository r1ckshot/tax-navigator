import type { AnswerPageContent } from '../types';

/**
 * Демонстраційна сторінка шаблону (сесія 13): проходить увесь шлях — числа з
 * чотирьох правил, джерела, анкета з передзаповненням. Твердження — з EVIDENCE.md,
 * сценарій B (ryczałt, składka zdrowotna, były pracodawca).
 *
 * «Ричалт» кирилицею, а польське слово один раз у дужках: так люди шукають
 * («ричалт 12% IT», research §D), а польські відмінки посеред українського
 * речення читаються важко. «Внесок на здоровʼя», а не калька «складка».
 *
 * Свідомо немає: відрахування 50% внеску від виручки й доплати за весь рік при
 * переході порогу — в EVIDENCE вони є лише прозою, без рядка «Верифіковано»
 * (рев'ю сесії 13). Повернуться, коли їх звірить `/scaffold-rule`.
 */
export const ryczaltIt: AnswerPageContent = {
  slug: 'ryczalt-it',
  title: 'Ричалт {{percent:jdg.ryczalt.rate/rateProgramming}} для програміста на JDG',
  description:
    'Скільки податку на ричалті (ryczałt) у програміста, ліміт виручки і внесок на здоровʼя. Кожна цифра з посиланням на джерело.',
  lead: 'Ричалт (ryczałt) — податок від виручки JDG (przychód), а не від прибутку. Для послуг програмування ставка {{percent:jdg.ryczalt.rate/rateProgramming}}.',
  body: [
    { kind: 'h2', text: 'Як рахується податок' },
    {
      kind: 'p',
      text: 'Ставка береться від виручки без вирахування витрат. Оренда, техніка чи бухгалтер податку не зменшують. Тому результат ричалту залежить від того, скільки витрат у вашій роботі.',
    },
    { kind: 'h2', text: 'Хто може його обрати' },
    {
      kind: 'p',
      text: 'Одна з умов ричалту — виручка за попередній рік не більша за {{amount:jdg.ryczalt.rate/annualLimit}} zł.',
    },
    {
      kind: 'p',
      text: 'Він не діє для оплати від колишнього роботодавця за ту саму роботу, яку ви виконували в нього за трудовим договором цього або попереднього року. Від дня такої оплати до кінця року податок рахується за шкалою. {{cite:jdg.byly_pracodawca}}',
    },
    { kind: 'h2', text: 'Внесок на здоровʼя' },
    { kind: 'p', text: 'На ричалті внесок на здоровʼя (składka zdrowotna) залежить від виручки за рік:' },
    {
      kind: 'list',
      items: [
        'до {{amount:jdg.zdrowotna.ryczalt/tiers.0.annualRevenueUpTo}} zł включно — {{amount:jdg.zdrowotna.ryczalt/tiers.0.monthly}} zł на місяць;',
        'понад {{amount:jdg.zdrowotna.ryczalt/tiers.0.annualRevenueUpTo}} і до {{amount:jdg.zdrowotna.ryczalt/tiers.1.annualRevenueUpTo}} zł — {{amount:jdg.zdrowotna.ryczalt/tiers.1.monthly}} zł на місяць;',
        'понад {{amount:jdg.zdrowotna.ryczalt/tiers.1.annualRevenueUpTo}} zł — {{amount:jdg.zdrowotna.ryczalt/tiers.2.monthly}} zł на місяць.',
      ],
    },
    {
      kind: 'p',
      text: 'Соціальні внески ZUS сплачуються окремо від податку й внеску на здоровʼя. Анкета показує їх разом і порівнює ричалт з іншими формами роботи. {{cite:jdg.zus.stages}}',
    },
    { kind: 'h2', text: 'Дивіться також' },
    {
      kind: 'links',
      items: [
        { to: 'b2b-na-ruky', text: 'З чого складається сума на руки на B2B' },
        { to: 'b2b-20000-zl', text: 'Приклад: скільки лишається з типової суми B2B' },
        { to: 'vat-jdg', text: 'VAT на JDG: коли потрібна реєстрація' },
      ],
    },
  ],
  prefill: { workKind: 'programming' },
  guide: 'jdg',
};
