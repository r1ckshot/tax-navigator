/** Словник мови: ключ → текст. Ключі однакові в усіх мовах (тест `i18n-locales`). */
export type Dictionary = Record<string, string>;

/** `{name}` у тексті підставляється з `vars`; без значення плейсхолдер лишається видимим. */
export type Translate = (key: string, vars?: Record<string, string>) => string;

/** Відсутній ключ показується як є: так пропуск видно на екрані, а не порожнім місцем. */
export function createT(dictionary: Dictionary): Translate {
  return (key, vars) => {
    const text = dictionary[key] ?? key;
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);
  };
}
