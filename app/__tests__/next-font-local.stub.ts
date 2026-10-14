/**
 * `next/font/local` у тестах. Справжній loader — це перетворення компілятора
 * Next, а не функція: поза збіркою його default-експорт порожній, і layout
 * падав би на імпорті. Заглушка віддає ту саму форму результату з
 * передбачуваним іменем родини — тестам потрібна розмітка, а не шрифт.
 */
let next = 0;

export default function localFont() {
  const family = `font${next++}`;
  return { className: family, variable: `--${family}`, style: { fontFamily: `'${family}'` } };
}
