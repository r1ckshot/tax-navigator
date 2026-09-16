/**
 * Розмітка органічних питань (S-3): AC-05, AC-06.
 *
 * «Покрито» — питання зачіпає правило чинної rules-матриці, і мітка називає
 * які саме `rule_id`. «Біла пляма» — жодне правило не зачеплене, і мітка
 * несе підтвердження: скільки правил перевірено і якою редакцією матриці.
 *
 * Та сама евристика, що фільтр S-2: словник, не модель. Вердикт детермінований,
 * а словник звірено з матрицею тестом, тож нове правило без словника валить
 * деплой, а не тихо перетворює свої питання на білі плями.
 *
 * Глосарій CONTEXT.md каже, що питання, на яке продукт свідомо не відповідає
 * (персональна порада, точна сума), білою плямою не є. Бінарна мітка MVP їх не
 * розрізняє (PRD §8): вони потрапляють у «білу пляму», дослідник відсіює руками.
 */

import { readFileSync } from 'node:fs';
import { hasWord, normalize } from './filter.ts';

/** Лише ті поля правила, які потрібні розмітці. Параметри, тобто цифри, сюди не читаються. */
export interface MatrixRule {
  rule_id: string;
  source_url: string;
  verified_at: string;
}

export interface Matrix {
  verified_at: string;
  rules: MatrixRule[];
}

export type QuestionLabel =
  | { weekOf: string; label: 'covered'; ruleIds: string[]; matrixVerifiedAt: string; labeledAt: string }
  | { weekOf: string; label: 'white_spot'; rulesChecked: number; matrixVerifiedAt: string; labeledAt: string };

/**
 * Клауза спрацьовує, коли в тексті є хоч один термін з `any` і, якщо задано,
 * хоч один з `and`. Термін — основа (підрядок), а з `=` на початку — ціле слово:
 * `=pit` не має ловити `pitch`, `=зус` — нічого всередині іншого слова.
 * У фразі кожне слово теж основа: `мінімальн зарплат` ловить і «мінімальна
 * зарплата», і «мінімальної зарплати», без переліку відмінків.
 */
interface Clause {
  any: string[];
  and?: string[];
}

const JDG = ['=jdg', 'działalno', 'dzialalno', 'підприєм', 'предприним', 'самозайнят', 'самозанят'];
const UOP = ['=uop', 'umow o prac', '=etat', 'етат', 'трудов догов'];
const ZLECENIE = ['zlecen', 'злецен', 'цивільно-правов', 'гражданско-правов'];
const NIEREJ = ['nierejestrowan', 'незареєстрован', 'незарегистрирован', 'без реєстрації', 'без регистрации'];
const CONTRIBUTIONS = ['=zus', '=зус', 'składk', 'skladk', 'складк', 'внеск', 'внесок', 'взнос'];
const HEALTH = ['zdrowotn', 'здоровотн', 'здравотн', 'медстрах', 'медичн страх', 'медицинск страх', '=nfz'];
const INCOME_TAX = ['=pit', 'podat', 'податок', 'податк', 'налог', 'декларац', 'rozlicz', 'netto', 'на руки'];
const FORM_CHOICE = ['форм оподатк', 'форм налогообл', 'form opodatk', 'вигідн', 'выгодн', 'opłaca', 'oplaca'];
// `ryczał`, не `ryczałt`: «na ryczałcie» основу `ryczałt` не містить.
const RYCZALT = ['ryczał', 'ryczal', 'ричалт', 'рычалт'];

/**
 * Словник на правило. Ключ — `rule_id` із `rules.2026.json`; тест тримає
 * відповідність в обидва боки. Mały ZUS Plus, IP Box і реєстрація JDG свідомо
 * не згадані: продукт їх не покриває (BACKLOG → LATER), тож це білі плями.
 */
export const RULE_CLAUSES: Record<string, Clause[]> = {
  'residency.days_threshold': [
    { any: ['резидентств', 'резидентност', 'rezydencj', 'податков резидент', 'налогов резидент', 'rezydent podatk', '=183'] },
  ],
  'residency.special_norm_52zr': [{ any: ['52zr', '52 zr', 'спецзакон', 'specustaw'] }],
  'residency.treaty_tiebreakers': [
    { any: ['подвійн оподатк', 'двойн налог', 'podwójn', 'podwojn', 'центр життєв', 'центр жизненн', 'ośrod interes', 'osrod interes', 'unikani opodatk'] },
  ],
  'common.minimum_wage': [
    { any: ['мінімалк', 'минималк', 'мінімальн зарплат', 'минимальн зарплат', 'minimaln wynagrodz', 'płac minimal', 'plac minimal'] },
  ],
  'common.projected_average_wage': [
    { any: ['середн зарплат', 'средн зарплат', 'przeciętn wynagrodz', 'przecietn wynagrodz', 'średni wynagrodz', 'sredni wynagrodz'] },
  ],
  'jdg.ryczalt.rate': [{ any: RYCZALT }, { any: JDG, and: FORM_CHOICE }],
  'jdg.zdrowotna.ryczalt': [{ any: HEALTH, and: RYCZALT }],
  'jdg.liniowy': [{ any: ['liniow', 'лінійн', 'линейн'] }, { any: JDG, and: FORM_CHOICE }],
  'jdg.skala': [{ any: ['skala', 'skali', 'шкал', 'kwot woln', '=32%'] }, { any: JDG, and: FORM_CHOICE }],
  'jdg.zus.stages': [
    { any: ['ulg na start', 'uldze na start', 'пільг на старт', 'льгот на старт', 'preferencyj', 'преференц', 'duży zus', 'duzy zus', 'велик зус', 'больш зус', 'пільгов зус', 'льготн зус'] },
    { any: ['=zus', '=зус'], and: JDG },
  ],
  'jdg.byly_pracodawca': [
    { any: ['колишн'], and: ['роботодав'] },
    { any: ['бывш'], and: ['работодат'] },
    { any: ['były', 'byly', 'byłym', 'bylym', 'byłego', 'bylego'], and: ['pracodaw'] },
  ],
  'incubator.kup': [{ any: ['інкубатор', 'инкубатор', 'inkubator', '=aip'] }],
  'uop.employer_contributions': [
    { any: ['koszt pracodaw', 'brutto brutto', 'брутто брутто'] },
    { any: ['роботодав', 'работодат', 'pracodaw'], and: CONTRIBUTIONS },
  ],
  'uop.employee_contributions': [{ any: UOP, and: CONTRIBUTIONS }],
  'uop.pit': [{ any: UOP, and: INCOME_TAX }],
  'uop.annual_contribution_cap': [
    { any: ['30-krotno', '30-кратн', 'limit składek', 'limit skladek', 'ліміт внеск', 'лимит взнос', 'limit 30'] },
  ],
  'fop.zaklad_in_pl': [
    { any: ['фоп', 'флп', 'zakład zagran', 'zaklad zagran', 'постійн представництв', 'постоянн представительств'] },
  ],
  'fop.esv_vz': [
    { any: ['=єсв', '=есв', 'єдин соціальн внес', 'един социальн взнос'] },
    { any: ['військов'], and: ['збір', 'збор'] },
    { any: ['военн'], and: ['сбор'] },
  ],
  'zlecenie.contributions': [{ any: ZLECENIE, and: [...CONTRIBUTIONS, ...HEALTH] }],
  'zlecenie.kup': [{ any: ZLECENIE, and: ['koszt', '=kup', 'витрат', 'расход', ...INCOME_TAX] }, { any: ['autorsk', 'авторськ прав', 'авторск прав'] }],
  'zlecenie.zbieg_z_etatem': [{ any: ZLECENIE, and: UOP }, { any: ['zbieg tytuł', 'zbieg tytul'] }],
  'zlecenie.przekwalifikowanie': [{ any: ['przekwalifik', 'перекваліф', 'переквалиф', '=pip', 'inspekcj pracy', 'інспекці праці', 'инспекци труд'] }],
  'nierejestrowana.limit': [{ any: NIEREJ }],
  'nierejestrowana.zus': [{ any: NIEREJ, and: [...CONTRIBUTIONS, ...HEALTH] }],
  'nierejestrowana.pit': [{ any: NIEREJ, and: INCOME_TAX }],
  'nierejestrowana.cudzoziemcy': [
    { any: NIEREJ, and: ['pesel', 'песел', 'cudzoziem', 'іноземц', 'иностран', 'українц', 'украинц', 'ukrai', 'kart pobyt', 'карт побиту', 'карт побыту', 'ochron czasow', 'тимчасов захист', 'временн защит'] },
  ],
};

const phrases = new Map<string, RegExp>();

function hasTerm(text: string, term: string): boolean {
  if (term.startsWith('=')) return hasWord(text, term.slice(1));
  if (!term.includes(' ')) return text.includes(term);
  let re = phrases.get(term);
  if (!re) {
    const words = term.split(' ').map((w) => w.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'));
    re = new RegExp(words.join('\\p{L}*\\s+'), 'u');
    phrases.set(term, re);
  }
  return re.test(text);
}

function clauseMatches(text: string, clause: Clause): boolean {
  return clause.any.some((term) => hasTerm(text, term)) && (!clause.and || clause.and.some((term) => hasTerm(text, term)));
}

/**
 * Які правила чинної матриці зачіпає текст, у порядку матриці. Правило, якого
 * в матриці вже немає, не цитується, навіть якщо словник його ще пам'ятає:
 * «покрито» означає покриття зараз, а не колись.
 */
export function matchRules(text: string, matrix: Matrix): string[] {
  const t = normalize(text);
  return matrix.rules.map((rule) => rule.rule_id).filter((id) => (RULE_CLAUSES[id] ?? []).some((clause) => clauseMatches(t, clause)));
}

export function labelQuestion(text: string, matrix: Matrix, weekOf: string, labeledAt: string): QuestionLabel {
  const ruleIds = matchRules(text, matrix);
  const base = { weekOf, matrixVerifiedAt: matrix.verified_at, labeledAt };
  return ruleIds.length > 0 ? { ...base, label: 'covered', ruleIds } : { ...base, label: 'white_spot', rulesChecked: matrix.rules.length };
}

export interface LabelInput {
  chatId: string;
  telegramMessageId: number;
  text: string;
  weekOf: string;
}

/**
 * AC-06: мітка пишеться один раз. Ключ, що вже має мітку, пропускається, хай
 * матриця відтоді як завгодно змінилась: попередні звіти не переписуються.
 * Шляху оновлення немає навмисно, а не з недогляду.
 */
export function labelQuestions(
  existing: Readonly<Record<string, QuestionLabel>>,
  questions: readonly LabelInput[],
  matrix: Matrix,
  labeledAt: string
): { labels: Record<string, QuestionLabel>; added: string[] } {
  const labels = { ...existing };
  const added: string[] = [];
  for (const q of questions) {
    const key = `${q.chatId}:${q.telegramMessageId}`;
    if (key in labels) continue;
    labels[key] = labelQuestion(q.text, matrix, q.weekOf, labeledAt);
    added.push(key);
  }
  return { labels, added };
}

export function countLabels(labels: Readonly<Record<string, QuestionLabel>>, keys: readonly string[]): { covered: number; whiteSpot: number } {
  let covered = 0;
  for (const key of keys) if (labels[key]?.label === 'covered') covered += 1;
  return { covered, whiteSpot: keys.length - covered };
}

/**
 * Матриця читається з файла на старті воркера: зламаний чи відсутній файл
 * валить контейнер одразу, а не перетворює тиждень питань на білі плями.
 * Кожне правило мусить нести `source_url` + `verified_at` — інакше мітка
 * «покрито» цитувала б правило без джерела (PRD §7, Accuracy).
 */
export function parseMatrix(raw: string): Matrix {
  const data = JSON.parse(raw) as Partial<Matrix>;
  if (typeof data.verified_at !== 'string' || !Array.isArray(data.rules) || data.rules.length === 0) {
    throw new Error('rules matrix: expected verified_at and a non-empty rules array');
  }
  const rules = data.rules.map((rule, i) => {
    for (const field of ['rule_id', 'source_url', 'verified_at'] as const) {
      if (typeof rule?.[field] !== 'string' || rule[field] === '') throw new Error(`rules matrix: rule #${i} has no ${field}`);
    }
    return { rule_id: rule.rule_id, source_url: rule.source_url, verified_at: rule.verified_at };
  });
  return { verified_at: data.verified_at, rules };
}

export function loadMatrix(filePath: string): Matrix {
  return parseMatrix(readFileSync(filePath, 'utf8'));
}
