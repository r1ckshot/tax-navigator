/**
 * Архітектурні правила як контракт, а не побажання (ARCHITECTURE.md).
 *
 * Стрілки залежностей ідуть лише всередину:
 *   presentation → adapters → calc → rules
 *
 * TypeScript не має вбудованого enforcement, тож межі тримає цей конфіг
 * (`npm run test:arch`, ганяється в `npm test`). Браузерні глобали він НЕ
 * бачить — `window.sessionStorage` не є імпортом — їх ловить
 * `app/lib/__tests__/architecture.test.ts`.
 */

/** Ядро: детерміновані розрахунки + дані правил. */
const CORE = '^app/lib/(rules|calc)/';
/** Адаптери введення/зберігання/лінка + presentation-хелпери. */
const ADAPTERS = '^app/lib/(storage|share|format)\\.ts$|^app/lib/(questions|i18n)/';
/** Presentation: компоненти і сторінки App Router. */
const PRESENTATION = '^app/components/|^app/[^/]*\\.tsx$|^app/.*/page\\.tsx$';

module.exports = {
  forbidden: [
    {
      name: 'core-no-external',
      severity: 'error',
      comment:
        'Ядро (rules/, calc/) не має зовнішніх залежностей: жодного npm-пакета, ' +
        'включно з react і next. Розрахунок мусить рахуватись у голому Node.',
      from: { path: CORE, pathNot: '__tests__' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-peer', 'npm-optional', 'npm-bundled'] },
    },
    {
      name: 'core-no-adapters',
      severity: 'error',
      comment:
        'Ядро не знає про адаптери: ні про sessionStorage-чернетку, ні про share-лінк, ' +
        'ні про схему анкети, ні про форматування. Залежність іде в інший бік.',
      from: { path: CORE, pathNot: '__tests__' },
      to: { path: ADAPTERS },
    },
    {
      name: 'lib-no-presentation',
      severity: 'error',
      comment:
        'Жоден файл app/lib/** не імпортує компоненти чи сторінки. ' +
        'Порушення означає, що бізнес-логіка почала залежати від UI.',
      from: { path: '^app/lib/', pathNot: '__tests__' },
      to: { path: PRESENTATION },
    },
    {
      name: 'rules-are-leaf',
      severity: 'error',
      comment:
        'rules/ — найнижчий шар: дані + типи. Він не імпортує нічого, крім самого себе ' +
        '(включно з власним rules.2026.json).',
      from: { path: '^app/lib/rules/', pathNot: '__tests__' },
      to: { pathNot: '^app/lib/rules/' },
    },
    {
      name: 'ui-no-raw-rule-data',
      severity: 'error',
      comment:
        'Цифри доходять до UI лише через calc/, ніколи прямим читанням rules.2026.json — ' +
        'інакше показане число обійде розрахунок і власні тести (.claude/rules/evidence-numbers.md).',
      from: { path: PRESENTATION },
      to: { path: '^app/lib/rules/rules\\..*\\.json$' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Цикл між модулями означає, що межа шару вже стерта.',
      from: { pathNot: '__tests__' },
      to: { circular: true },
    },
    {
      name: 'no-unresolvable',
      severity: 'error',
      comment:
        'Нерезолвлений імпорт у нашому коді = правила вище мовчки його не перевірили. ' +
        'Найімовірніша причина — зламаний аліас @/ у tsconfig.',
      from: { path: '^app/' },
      to: { couldNotResolve: true },
    },
  ],
  options: {
    /**
     * doNotFollow, а НЕ exclude: exclude викидає npm-модулі з графа разом із
     * ребрами, і тоді `core-no-external` мовчки не має що перевіряти (спіймано
     * навмисною поломкою). doNotFollow лишає ребро, але не ходить усередину.
     */
    doNotFollow: { path: 'node_modules' },
    /** Аліас @/* → app/* живе в tsconfig; без цього рядка імпорти не резолвляться. */
    tsConfig: { fileName: 'tsconfig.json' },
    /** Без цього `import type` не видно, а майже всі межі тут — типові. */
    tsPreCompilationDeps: true,
    exclude: { path: '\\.next/' },
  },
};
