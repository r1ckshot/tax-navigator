import { describe, expect, it } from 'vitest';
import { ConfigError, normalizeChatRef, parseConfig } from './config';

const BASE = {
  TG_API_ID: '12345',
  TG_API_HASH: 'hash-value-that-must-not-leak',
  TG_SESSION: 'session-value-that-must-not-leak',
  TG_CHATS: '@Ukraine_Poland_Chat, https://t.me/nakordoni_poland -1001234567890',
};

describe('normalizeChatRef', () => {
  it.each([
    ['@Ukraine_Poland_Chat', 'ukraine_poland_chat'],
    ['t.me/nakordoni_poland', 'nakordoni_poland'],
    ['https://t.me/ITWarsawCommunity', 'itwarsawcommunity'],
    ['-1001234567890', '-1001234567890'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeChatRef(raw)).toBe(expected);
  });

  it('посилання-запрошення відхиляється: у нього немає стабільного ключа', () => {
    expect(() => normalizeChatRef('https://t.me/+InQU9E0vEadhNWNk')).toThrow(ConfigError);
  });
});

describe('parseConfig', () => {
  it('дефолти: стан у томі /data, вікно 4 тижні, понеділок 06:00 UTC', () => {
    const config = parseConfig(BASE);
    expect(config.chats).toEqual(['ukraine_poland_chat', 'nakordoni_poland', '-1001234567890']);
    expect(config.statePath).toBe('/data/state.json');
    // Шлях матриці в образі (Dockerfile COPY --from=rules).
    expect(config.rulesPath).toBe('/app/rules/rules.2026.json');
    expect(config.windowWeeks).toBe(4);
    expect(config.schedule).toEqual({ weekday: 1, hourUtc: 6 });
    expect(config.apiId).toBe(12345);
  });

  it('помилка називає відсутні змінні і не містить значень секретів', () => {
    const { TG_SESSION: _s, TG_CHATS: _c, ...rest } = BASE;
    let message = '';
    try {
      parseConfig(rest);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toBe('missing environment variables: TG_SESSION, TG_CHATS');
    expect(message).not.toContain(BASE.TG_API_HASH);
  });

  it('години поза 0-23 не мовчки обрізаються, а валять старт', () => {
    expect(() => parseConfig({ ...BASE, CYCLE_HOUR_UTC: '24' })).toThrow('CYCLE_HOUR_UTC must be an integer in [0, 23]');
  });

  it('дублікати чатів у різних записах зводяться до одного ключа', () => {
    expect(parseConfig({ ...BASE, TG_CHATS: '@abcd_chat t.me/ABCD_chat' }).chats).toEqual(['abcd_chat']);
  });
});
