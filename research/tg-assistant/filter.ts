/**
 * Фільтр органічних питань (S-2): AC-03, AC-04.
 *
 * Визначення — глосарій CONTEXT.md «Органічне питання (A+)»: питання про
 * податки, форму діяльності або резидентство від учасника чату, у власній
 * ситуації. NOT: оголошення, реклама послуг, репост, пост самого автора.
 *
 * Евристика, не модель: вердикт детермінований, кожне відсіювання несе
 * причину, тож дрейф фільтра видно у звіті циклу, а не лише в KPI.
 * Точність міряє evalFilter.ts на розмітці раунду 2.
 */

export interface FilterInput {
  chatId: string;
  telegramMessageId: number;
  text: string;
  /** Надіслано з акаунта дослідника — власний пост автора продукту. */
  outgoing: boolean;
  /** Переслано з іншого чату чи каналу — репост, не власне питання. */
  forwarded: boolean;
  /** Пост каналу від імені адмінів, не коментар учасника. */
  channelPost: boolean;
}

export type RejectReason = 'own_post' | 'repost' | 'channel_post' | 'advert' | 'off_topic' | 'not_question' | 'not_own';

export type Verdict = { isOrganic: true } | { isOrganic: false; reason: RejectReason };

export type Classified<T extends FilterInput> = T & Verdict;

export interface FilterResult<T extends FilterInput> {
  /** Кожне повідомлення партії рівно раз, включно з відсіяними (Step 3). */
  classified: Classified<T>[];
  /** Лише органічні — вхід для розмітки S-3. */
  organic: T[];
  rejected: Record<RejectReason, number>;
}

/**
 * Словник теми. Кирилиця — основи (флексії UA/RU), латиниця — цілі слова там,
 * де коротка основа ловила б чуже (`pit` у `pitch`, `єсв` чи `ієн` у `клієнт`).
 */
const TOPIC_STEMS = [
  // Без голого `резидент`: він ловить посвідку резидента ЄС, а це міграція. Податкове
  // резидентство й так несе `податк`/`налог`/`podat` або `183`.
  'податк', 'податок', 'налог', 'фоп', 'флп', 'декларац', 'бухгалтер',
  'єдиний внесок', 'ричалт', 'рычалт', 'складк',
  'фактур', 'інвойс', 'инвойс', 'самозайнят', 'самозанят', 'підприєм', 'предприним', 'dzialalno',
  'działalno', 'ryczałt', 'ryczalt', 'składk', 'skladk', 'urząd skarbow', 'urzad skarbow', 'faktur',
  'dochód', 'dochod', 'rozlicz', 'podat', 'księgow', 'ksiegow', 'invoice', 'self-employ',
];
const TOPIC_WORDS = ['jdg', 'pit', 'zus', 'зус', 'єсв', 'b2b', 'tax', 'taxes', 'vat', 'ksef', '183', 'uop'];

const QUESTION_MARKERS = [
  'підкаж', 'порад', 'хтось знає', 'хтось може', 'є хтось', 'чи хтось', 'хто знає', 'чи є', 'чи можна', 'чи треба', 'чи потрібно', 'як краще',
  'що робити', 'шукаю', 'допоможіть', 'поділіться', 'подскаж', 'посовет', 'кто-то знает', 'кто-то может', 'есть кто', 'кто знает',
  'есть ли', 'можно ли', 'нужно ли', 'как лучше', 'что делать', 'ищу', 'помогите', 'поделитесь',
  'czy ', 'jak ', 'pomóż', 'doradź', 'does anyone', 'anyone know', 'how do',
];

/**
 * «Своя ситуація» (глосарій): звертання до іншої людини без жодного «я» і без
 * прохання — це відповідь або опитування («у Вас ООО или ФОП?», «як ви…»).
 */
const SECOND_PERSON = ['ви', 'вы', 'вас', 'вам', 'ти', 'ты', 'тебе', 'тобі', 'тебя'];
const FIRST_PERSON = ['я', 'мені', 'мене', 'мне', 'меня', 'мій', 'моя', 'моє', 'мої', 'мой', 'моё', 'мое', 'мои', 'маю', 'хочу', 'шукаю', 'ищу'];

/** Мова продавця, а не того, хто питає. */
const ADVERT_MARKERS = [
  'наші послуги', 'надаємо послуг', 'звертайтесь', 'звертайтеся', 'пишіть в лс',
  'пишіть в особист', 'знижк', 'акція', 'безкоштовн консульт', 'записуйтесь',
  'наши услуги', 'оказываем', 'обращайтесь', 'пишите в лс', 'скидк', 'бесплатн консульт', 'записывайтесь',
  'oferujemy', 'zapraszamy', 'we offer', 'dm me',
  // Самопрезентація: реклама, що маскується під пораду або питання-гачок.
  'помогаю', 'помогаем', 'допомагаю', 'допомагаємо', 'представляю команд', 'кто мы', 'хто ми',
  'почему выбирают', 'чому обирають', 'посмотрите в сторону', 'подивіться в бік', 'инкубатор', 'інкубатор',
  'zachęcamy', 'zachecamy',
];
/** Питання-гачок, на яке автор тут же відповідає сам: «…без фірми? Да!». */
const SELF_ANSWER = /\?\s*(да|так|yes|tak)\s*[!.]/u;
/** Цілим словом: `пропоную` сидить усередині `пропонують`, а «мені пропонують» каже покупець. */
const ADVERT_WORDS = ['пропоную', 'пропонуємо', 'предлагаю', 'предлагаем'];
const LONG_POST_CHARS = 400;
const CONTACT = /(https?:\/\/|t\.me\/|(^|\s)@[a-z0-9_]{4,}|\+?\d[\d\s()-]{8,}\d)/giu;

export const normalize = (text: string) => text.toLocaleLowerCase('uk').replace(/ё/g, 'е');

export function hasWord(text: string, word: string): boolean {
  // \b не працює з кирилицею навіть із прапорцем u — межа слова через \p{L}.
  const escaped = word.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(text);
}

/**
 * Які саме ознаки спрацювали — без тексту повідомлення. Цим живуть і вердикт,
 * і діагностика evalFilter.ts: помилку фільтра видно, не відкриваючи сирих даних.
 */
export function explain(text: string) {
  const t = normalize(text);
  return {
    topic: [...TOPIC_STEMS.filter((stem) => t.includes(stem)), ...TOPIC_WORDS.filter((word) => hasWord(t, word))],
    question: [...(t.includes('?') ? ['?'] : []), ...QUESTION_MARKERS.filter((marker) => t.includes(marker))],
    seller: [
      ...ADVERT_MARKERS.filter((marker) => t.includes(marker)),
      ...ADVERT_WORDS.filter((word) => hasWord(t, word)),
      ...(SELF_ANSWER.test(t) ? ['<self-answer>'] : []),
    ],
    requests: QUESTION_MARKERS.filter((marker) => t.includes(marker)),
    secondPerson: SECOND_PERSON.filter((word) => hasWord(t, word)),
    firstPerson: FIRST_PERSON.filter((word) => hasWord(t, word)),
    contacts: t.match(CONTACT)?.length ?? 0,
    length: t.length,
  };
}

export function isOnTopic(text: string): boolean {
  return explain(text).topic.length > 0;
}

export function isQuestion(text: string): boolean {
  return explain(text).question.length > 0;
}

export function isAddressedToOthers(text: string): boolean {
  const { secondPerson, firstPerson, requests } = explain(text);
  return secondPerson.length > 0 && firstPerson.length === 0 && requests.length === 0;
}

export function isAdvert(text: string): boolean {
  const { seller, contacts, length } = explain(text);
  // Одне посилання буває і в питанні («ось стаття, це про мене?»), тож сам
  // контакт рекламою не робить: потрібна мова продавця або кілька контактів.
  // Довгий текст зі словом продавця — пост-презентація: питання учасника коротші.
  const long = length > LONG_POST_CHARS;
  return seller.length >= 2 || (seller.length >= 1 && (contacts >= 1 || long)) || contacts >= 3 || seller.includes('<self-answer>');
}

/** Порядок перевірок — від структури до тексту: структурна ознака не помиляється. */
export function classify(message: FilterInput): Verdict {
  if (message.outgoing) return { isOrganic: false, reason: 'own_post' };
  if (message.forwarded) return { isOrganic: false, reason: 'repost' };
  if (message.channelPost) return { isOrganic: false, reason: 'channel_post' };
  if (isAdvert(message.text)) return { isOrganic: false, reason: 'advert' };
  if (!isOnTopic(message.text)) return { isOrganic: false, reason: 'off_topic' };
  if (!isQuestion(message.text)) return { isOrganic: false, reason: 'not_question' };
  if (isAddressedToOthers(message.text)) return { isOrganic: false, reason: 'not_own' };
  return { isOrganic: true };
}

export function emptyRejected(): Record<RejectReason, number> {
  return { own_post: 0, repost: 0, channel_post: 0, advert: 0, off_topic: 0, not_question: 0, not_own: 0 };
}

export function filterBatch<T extends FilterInput>(batch: readonly T[]): FilterResult<T> {
  const classified: Classified<T>[] = [];
  const organic: T[] = [];
  const rejected = emptyRejected();
  const seen = new Set<string>();

  for (const message of batch) {
    // AC-04: повідомлення — одиниця підрахунку. Хай скільки тем воно зачіпає
    // і скільки разів прийшло в партію, рядок один.
    const key = `${message.chatId}:${message.telegramMessageId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const verdict = classify(message);
    classified.push({ ...message, ...verdict });
    if (verdict.isOrganic) organic.push(message);
    else rejected[verdict.reason] += 1;
  }
  return { classified, organic, rejected };
}
