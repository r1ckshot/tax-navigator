/**
 * Конфіг воркера зі змінних середовища. Значення секретів ніколи не
 * потрапляють у текст помилки — лише назви змінних, яких бракує
 * (PRD §6.1: токен сесії дає повний доступ до акаунта).
 */

import type { WeeklySchedule } from './schedule.ts';

export interface WorkerConfig {
  apiId: number;
  apiHash: string;
  session: string;
  /** Нормалізовані ключі чатів: username у нижньому регістрі або числовий id діалогу. */
  chats: string[];
  statePath: string;
  /** rules.2026.json, проти якої розмічаються питання (S-3). */
  rulesPath: string;
  windowWeeks: number;
  schedule: WeeklySchedule;
  maxFloodWaitSeconds: number;
  healthPort: number;
}

export class ConfigError extends Error {}

/**
 * `@Name`, `t.me/name`, `https://t.me/name` → `name`; числовий id лишається як є.
 * Посилання-запрошення (`t.me/+hash`) не несе стабільного ключа — для таких
 * чатів береться id з `npm run chats`.
 */
export function normalizeChatRef(raw: string): string {
  const ref = raw.trim().replace(/^https?:\/\//, '').replace(/^t\.me\//, '').replace(/^@/, '');
  if (ref.startsWith('+') || ref.startsWith('joinchat/')) {
    throw new ConfigError(`TG_CHATS: invite links have no stable key, use the numeric chat id from "npm run chats"`);
  }
  if (/^-?\d+$/.test(ref)) return ref;
  if (!/^[A-Za-z0-9_]{4,32}$/.test(ref)) {
    throw new ConfigError(`TG_CHATS: "${ref}" is neither a username nor a numeric chat id`);
  }
  return ref.toLowerCase();
}

function intInRange(env: Record<string, string | undefined>, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConfigError(`${name} must be an integer in [${min}, ${max}]`);
  }
  return value;
}

const REQUIRED = ['TG_API_ID', 'TG_API_HASH', 'TG_SESSION', 'TG_CHATS'] as const;

export function parseConfig(env: Record<string, string | undefined>): WorkerConfig {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new ConfigError(`missing environment variables: ${missing.join(', ')}`);
  }

  const chats = [...new Set((env.TG_CHATS as string).split(/[,\s]+/).filter(Boolean).map(normalizeChatRef))];

  return {
    apiId: intInRange(env, 'TG_API_ID', 0, 1, Number.MAX_SAFE_INTEGER),
    apiHash: env.TG_API_HASH as string,
    session: env.TG_SESSION as string,
    chats,
    statePath: env.STATE_PATH || '/data/state.json',
    // Дефолт — шлях в образі (Dockerfile). Поза образом задається явно.
    rulesPath: env.RULES_PATH || '/app/rules/rules.2026.json',
    // PRD §8: дефолт вікна backfill — відкрите питання, зараз 4 тижні (S-1 Step 4).
    windowWeeks: intInRange(env, 'WINDOW_WEEKS', 4, 1, 52),
    schedule: {
      weekday: intInRange(env, 'CYCLE_WEEKDAY', 1, 1, 7),
      hourUtc: intInRange(env, 'CYCLE_HOUR_UTC', 6, 0, 23),
    },
    maxFloodWaitSeconds: intInRange(env, 'MAX_FLOOD_WAIT_SECONDS', 600, 1, 86_400),
    healthPort: intInRange(env, 'HEALTH_PORT', 8080, 1, 65_535),
  };
}
