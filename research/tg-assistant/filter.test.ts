import { describe, expect, it } from 'vitest';
import { classify, filterBatch, isAdvert, isOnTopic, isQuestion, type FilterInput } from './filter.ts';

// Фікстури синтетичні: сирий текст реальних чатів у git не йде (PRD §6.1).
function msg(text: string, overrides: Partial<FilterInput> = {}): FilterInput {
  return { chatId: '-1001', telegramMessageId: 1, text, outgoing: false, forwarded: false, channelPost: false, ...overrides };
}

const ORGANIC_UA = 'Підкажіть, чи треба платити ZUS, якщо я на JDG і ще працюю по UoP?';

describe('classify — AC-03', () => {
  it('органічне питання учасника проходить', () => {
    expect(classify(msg(ORGANIC_UA))).toEqual({ isOrganic: true });
  });

  it.each([
    ['російською, без знака питання', 'Ищу бухгалтера в Варшаве для ИП, кто-то может посоветовать'],
    ['польською', 'Czy ktoś rozliczał PIT-38 z akcji na Revolut?'],
    ['резидентство', 'Я в Польщі вже 200 днів, я тепер податковий резидент тут чи ще в Україні?'],
    ['український ФОП', 'Є хтось, хто досі працює через ФОП з Польщі? Як з податковою?'],
  ])('органічне: %s', (_, text) => {
    expect(classify(msg(text)).isOrganic).toBe(true);
  });

  // Структурні ознаки перемагають текст: навіть ідеальне питання не органічне.
  it.each([
    ['own_post', { outgoing: true }],
    ['repost', { forwarded: true }],
    ['channel_post', { channelPost: true }],
  ] as const)('%s відсіюється навіть з ідеальним текстом', (reason, overrides) => {
    expect(classify(msg(ORGANIC_UA, overrides))).toEqual({ isOrganic: false, reason });
  });

  it('власний пост перемагає репост: причина одна і найсильніша', () => {
    expect(classify(msg(ORGANIC_UA, { outgoing: true, forwarded: true }))).toEqual({ isOrganic: false, reason: 'own_post' });
  });

  it('реклама бухгалтерії з питанням-гачком — advert, не питання', () => {
    const text = 'Маєте JDG? Пропонуємо ведення бухгалтерії зі знижкою 20%. Пишіть в ЛС @best_ksiegowa';
    expect(classify(msg(text))).toEqual({ isOrganic: false, reason: 'advert' });
  });

  it('питання поза темою — off_topic', () => {
    expect(classify(msg('Підкажіть, де у Варшаві зняти квартиру недорого?'))).toEqual({ isOrganic: false, reason: 'off_topic' });
  });

  it.each([
    ['відповідь на «Вы»', 'Можем попробовать, а у Вас ООО или ФОП?'],
    ['опитування «як ви»', 'Питання до тих, хто на B2B: як ви страхувались на випадок втрати контракту?'],
  ])('звертання до інших без «я» — not_own: %s', (_, text) => {
    expect(classify(msg(text))).toEqual({ isOrganic: false, reason: 'not_own' });
  });

  it.each([
    ['«я» поруч зі звертанням', 'А ви як платите ZUS? Я на JDG перший рік'],
    ['прохання поруч зі звертанням', 'Підкажіть, у вас бухгалтер робить PIT-37?'],
  ])('лишається органічним: %s', (_, text) => {
    expect(classify(msg(text)).isOrganic).toBe(true);
  });

  it('новина про податки без питання — not_question', () => {
    const text = 'З 1 квітня KSeF обовʼязковий для всіх підприємців.';
    expect(classify(msg(text))).toEqual({ isOrganic: false, reason: 'not_question' });
  });
});

describe('словник — анти-регрес на хибні збіги', () => {
  it.each([
    ['pit у pitch', 'Who wants to hear my startup pitch?'],
    ['зус не всередині слова', 'Шукаю кавуна, хто знає де купити?'],
    ['єсв не всередині слова', 'Підкажіть клієнтський сервіс банку?'],
  ])('%s', (_, text) => {
    expect(isOnTopic(text)).toBe(false);
  });

  it('посвідка резидента ЄС — міграція, не податки', () => {
    expect(isOnTopic('Хто отримував довгострокового резидента ЄС, які документи?')).toBe(false);
    expect(isOnTopic('Я податковий резидент Польщі після 183 днів?')).toBe(true);
  });

  it.each(['PIT-37', 'zus.', '(JDG)', 'ЄСВ,'])('ціле слово з розділовим знаком ловиться: %s', (word) => {
    expect(isOnTopic(`питання про ${word}`)).toBe(true);
  });

  it('регістр і ё не впливають', () => {
    expect(isOnTopic('НАЛОГОВАЯ')).toBe(true);
    expect(isQuestion('ПОДСКАЖИТЕ ВСЁ')).toBe(true);
  });
});

describe('isAdvert — межі', () => {
  it('«хтось шукав, ось інфа» — не питання, хоч і «хтось»', () => {
    expect(isQuestion('Там хтось шукав інфу про податки, ось блогерка розповідає')).toBe(false);
    expect(isQuestion('Чи хтось платив ZUS заднім числом')).toBe(true);
  });

  it('довга самопрезентація з одним словом продавця — реклама', () => {
    const pitch = `Привіт! Я представляю команду бухгалтерів для JDG. ${'Ведемо облік, звітність і PIT. '.repeat(15)}`;
    expect(pitch.length).toBeGreaterThan(400);
    expect(isAdvert(pitch)).toBe(true);
    // Те саме слово в короткому питанні — ще не реклама.
    expect(isAdvert('Хто ми для податкової, якщо JDG зареєстрована в Польщі?')).toBe(false);
  });

  it('питання, на яке автор сам відповідає «Да!», — реклама', () => {
    expect(isAdvert('Можно ли выставить фактуру без фирмы? Да! Это просто.')).toBe(true);
    // Відповідь іншого учасника в тому ж рядку не буває; «так» усередині питання — не самовідповідь.
    expect(isAdvert('Чи так треба платити ZUS щомісяця?')).toBe(false);
  });

  it('польський інфопост «Zachęcamy» — реклама, навіть з питанням усередині', () => {
    const post = `Zachęcamy do zawarcia umowy z NFZ. ${'Jakie dokumenty są potrzebne? Składka zależy od dochodu. '.repeat(8)}`;
    expect(isAdvert(post)).toBe(true);
  });

  it('питання-гачок із відповіддю від інкубатора — реклама', () => {
    expect(isAdvert('Легально виставити фактуру без фірми? Так! Бізнес-інкубатор для IT, подивіться в бік нас')).toBe(true);
  });

  it('одне посилання в питанні ще не реклама', () => {
    expect(isAdvert('Ось стаття https://example.test/zus — це про мою ситуацію?')).toBe(false);
  });

  it('одне слово продавця без контакту ще не реклама', () => {
    expect(isAdvert('Бухгалтер дає знижку, якщо платити за рік наперед, це нормально?')).toBe(false);
  });

  it('«мені пропонують» — мова покупця, не продавця', () => {
    expect(isAdvert('Мені пропонують B2B, звертайтесь хто знає, чи це вигідно?')).toBe(false);
    expect(isAdvert('Пропонуємо ведення JDG, звертайтесь')).toBe(true);
  });

  it('слово продавця + контакт — реклама', () => {
    expect(isAdvert('Звертайтесь +48 600 123 456')).toBe(true);
  });

  it('три контакти без слів продавця — реклама', () => {
    expect(isAdvert('t.me/one t.me/two https://example.test')).toBe(true);
  });
});

describe('filterBatch — AC-04 і Step 3', () => {
  it('повідомлення на кілька тем одразу дає рівно один рядок', () => {
    // податки + ZUS + резидентство + бухгалтер: чотири теми, одне повідомлення.
    const multi = msg('Підкажіть бухгалтера: я резидент, JDG, ZUS і податки — з чого почати?', { telegramMessageId: 7 });
    const result = filterBatch([multi, { ...multi }]);
    expect(result.classified).toHaveLength(1);
    expect(result.organic).toHaveLength(1);
  });

  it('той самий id у різних чатах — два різні повідомлення', () => {
    const result = filterBatch([msg(ORGANIC_UA, { chatId: 'a' }), msg(ORGANIC_UA, { chatId: 'b' })]);
    expect(result.organic).toHaveLength(2);
  });

  it('кожне повідомлення має вердикт, відсіяне не зникає мовчки', () => {
    const batch = [
      msg(ORGANIC_UA, { telegramMessageId: 1 }),
      msg(ORGANIC_UA, { telegramMessageId: 2, forwarded: true }),
      msg('Підкажіть, де купити велосипед?', { telegramMessageId: 3 }),
    ];
    const result = filterBatch(batch);
    expect(result.classified.map((m) => [m.telegramMessageId, m.isOrganic])).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ]);
    expect(result.organic.map((m) => m.telegramMessageId)).toEqual([1]);
    expect(result.rejected).toEqual({ own_post: 0, repost: 1, channel_post: 0, advert: 0, off_topic: 1, not_question: 0, not_own: 0 });
  });

  it('порожня партія — нулі, не помилка', () => {
    const result = filterBatch([]);
    expect(result.organic).toEqual([]);
    expect(Object.values(result.rejected).every((n) => n === 0)).toBe(true);
  });
});
