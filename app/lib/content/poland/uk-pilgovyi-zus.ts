import type { AnswerPageContent } from '../types';

/**
 * «Коли закінчуються пільгові внески ZUS» (questions-2026-09.md). Етапи й суми —
 * правило `jdg.zus.stages` (EVIDENCE, сценарій B), колишній роботодавець —
 * `jdg.byly_pracodawca` (art. 18 Prawa przedsiębiorców, art. 18a ustawy o sus).
 *
 * Статті про пільги названо в тексті: джерело `jdg.byly_pracodawca` — закон про
 * ричалт, а сторінка zus.pl строків не пише (одне `source_url` на правило, BACKLOG
 * «Друге джерело на правило»).
 *
 * Свідомо немає: Mały ZUS Plus (у правилах його немає, BACKLOG → LATER) і частки
 * «30% мінімалки» / «60% середньої» — у правилі лише самі бази, а частка
 * літералом пройшла б повз дані.
 */
export const pilgovyiZus: AnswerPageContent = {
  slug: 'pilgovyi-zus',
  title: 'Пільгові внески ZUS на JDG: коли закінчуються',
  description:
    'Ulga na start, пільговий і повний ZUS: скільки триває кожен етап, скільки коштує і хто не має права на пільги. Суми з джерелом.',
  lead: 'За умов, описаних нижче, нова JDG перші {{amount:jdg.zus.stages/ulgaNaStartMonths}} місяців не платить соціальних внесків, наступні {{amount:jdg.zus.stages/preferencyjnyMonths}} місяці платить знижені, а далі — повні. Інших пільг ZUS ця сторінка не розглядає.',
  body: [
    { kind: 'h2', text: 'Перші {{amount:jdg.zus.stages/ulgaNaStartMonths}} місяців: ulga na start' },
    {
      kind: 'p',
      text: 'Соціальних внесків немає зовсім (art. 18 Prawa przedsiębiorców). Платиться лише внесок на здоровʼя. {{cite:jdg.zus.stages}}',
    },
    { kind: 'h2', text: 'Наступні {{amount:jdg.zus.stages/preferencyjnyMonths}} місяці: пільговий ZUS' },
    {
      kind: 'p',
      text: 'Внески рахуються від зниженої бази — щонайменше {{amount:jdg.zus.stages/preferencyjnyBase}} zł (art. 18a ustawy o systemie ubezpieczeń społecznych). Від такої бази це {{amount:jdg.zus.stages/preferencyjnyWithSickness}} zł на місяць з добровільним хворобовим страхуванням або {{amount:jdg.zus.stages/preferencyjnyWithoutSickness}} zł без нього.',
    },
    { kind: 'h2', text: 'Далі: повний ZUS' },
    {
      kind: 'p',
      text: 'Внески рахуються від бази щонайменше {{amount:jdg.zus.stages/duzyBase}} zł. Від такої бази з хворобовим страхуванням це {{amount:jdg.zus.stages/duzyMonthly}} zł на місяць.',
    },
    {
      kind: 'p',
      text: 'Внесок на здоровʼя платиться окремо на всіх трьох етапах. {{cite:jdg.zus.stages}}',
    },
    { kind: 'h2', text: 'Хто не має права на пільги' },
    {
      kind: 'p',
      text: 'Обидві пільги — для тих, хто не вів діяльності останні {{amount:jdg.zus.stages/priorBusinessLookbackMonths}} місяців (art. 18 Prawa przedsiębiorców і art. 18a ustawy o systemie ubezpieczeń społecznych).',
    },
    {
      kind: 'p',
      text: 'Пільг немає й тоді, коли JDG працює на колишнього роботодавця і виконує для нього хоча б частину того, що людина робила в нього в рамках трудових відносин у році відкриття JDG або в попередньому (ті самі статті). {{cite:jdg.byly_pracodawca}}',
    },
  ],
  prefill: {},
};
