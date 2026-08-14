import { describe, expect, it } from 'vitest';
import { filterKnownChats } from './chatFilter';

describe('filterKnownChats — AC-02', () => {
  it('AC-02.1: усі candidates є в known — результат той самий список у тому самому порядку', () => {
    const result = filterKnownChats(['chat-1', 'chat-2'], ['chat-1', 'chat-2']);
    expect(result).toEqual(['chat-1', 'chat-2']);
  });

  it('AC-02.2: один чат з candidates відсутній у known (known непорожній) — відсутній і в результаті', () => {
    const result = filterKnownChats(['chat-1'], ['chat-9']);
    expect(result).toEqual([]);
  });

  it('AC-02.3: змішаний список — лишаються лише known, у вихідному відносному порядку', () => {
    const result = filterKnownChats(
      ['chat-1', 'chat-x', 'chat-2', 'chat-y'],
      ['chat-1', 'chat-2']
    );
    expect(result).toEqual(['chat-1', 'chat-2']);
  });

  it('AC-02.4: порожній candidates — результат порожній масив, не помилка', () => {
    const result = filterKnownChats([], ['chat-1', 'chat-2']);
    expect(result).toEqual([]);
  });

  it('AC-02.5: порожній known — результат порожній масив для будь-яких candidates', () => {
    const result = filterKnownChats(['chat-1', 'chat-2'], []);
    expect(result).toEqual([]);
  });

  it('AC-02.6 (anti-regression pitfall): відмінний регістр і пробіл не проходять фільтр — точний збіг рядка', () => {
    const result = filterKnownChats(['Chat-1', ' chat-1'], ['chat-1']);
    expect(result).toEqual([]);
  });
});
