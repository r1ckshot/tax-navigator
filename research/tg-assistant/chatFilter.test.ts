import { describe, expect, it } from 'vitest';
import { filterKnownChats } from './chatFilter';

describe('filterKnownChats — AC-02', () => {
  it('AC-02.1: усі candidates є в known — той самий список, той самий порядок', () => {
    const result = filterKnownChats(['chat-1', 'chat-2'], ['chat-1', 'chat-2']);
    expect(result).toEqual(['chat-1', 'chat-2']);
  });

  it('AC-02.2: один candidate відсутній у непорожньому known — відсутній і в результаті', () => {
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

  it('AC-02.4: порожній candidates — порожній результат, без помилки', () => {
    expect(filterKnownChats([], ['chat-1'])).toEqual([]);
  });

  it('AC-02.5: порожній known — порожній результат для будь-яких candidates', () => {
    expect(filterKnownChats(['chat-1', 'chat-2'], [])).toEqual([]);
  });

  it('AC-02.6 (anti-regression pitfall): інший регістр/пробіл не проходять — точний збіг рядка', () => {
    const result = filterKnownChats(['Chat-1', ' chat-1'], ['chat-1']);
    expect(result).toEqual([]);
  });
});
