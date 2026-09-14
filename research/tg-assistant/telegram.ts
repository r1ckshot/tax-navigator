/**
 * Адаптер gramjs → `TelegramPort` (ADR-0001). Єдиний файл воркера, що говорить
 * із мережею, тож тестом не покривається — цикл перевіряється через фейковий
 * порт у collector.test.ts, а цей файл лише typecheck-ом і живим прогоном.
 *
 * Read-only місія (`research/tg-mining`): тут немає жодного виклику, що пише в
 * Telegram, — лише діалоги й історія.
 */

import { Api, errors, TelegramClient } from 'telegram';
import { LogLevel } from 'telegram/extensions/Logger.js';
import { StringSession } from 'telegram/sessions/index.js';
import { TelegramReadError, type JoinedChat, type RawMessage, type TelegramPort } from './collector.ts';

/** Коди MTProto, що означають «чату для цього акаунта більше немає» (AC-08). */
const ACCESS_LOST = new Set([
  'CHANNEL_PRIVATE',
  'CHANNEL_INVALID',
  'CHAT_FORBIDDEN',
  'USER_BANNED_IN_CHANNEL',
  'CHANNEL_PUBLIC_GROUP_NA',
]);

export function createClient(apiId: number, apiHash: string, session: string): TelegramClient {
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5,
    // 0 — бібліотека не спить на FLOOD_WAIT сама. Паузу вирішує черга циклу
    // (ADR-0002), інакше один чат мовчки тримав би всіх інших.
    floodSleepThreshold: 0,
  });
  client.setLogLevel(LogLevel.ERROR);
  return client;
}

function toReadError(err: unknown): TelegramReadError {
  if (err instanceof errors.FloodWaitError) return new TelegramReadError({ kind: 'flood_wait', seconds: err.seconds });
  if (err instanceof errors.RPCError) {
    // errorMessage — службовий код на кшталт CHANNEL_PRIVATE, не текст чату.
    const code = err.errorMessage;
    return new TelegramReadError(ACCESS_LOST.has(code) ? { kind: 'access_lost', code } : { kind: 'failed', code });
  }
  return new TelegramReadError({ kind: 'failed', code: err instanceof Error ? err.name : 'unknown' });
}

export class GramjsPort implements TelegramPort {
  private client: TelegramClient;
  private entities = new Map<string, Api.TypeEntityLike>();

  constructor(client: TelegramClient) {
    this.client = client;
  }

  async listJoinedChats(): Promise<JoinedChat[]> {
    const chats: JoinedChat[] = [];
    this.entities.clear();
    for await (const dialog of this.client.iterDialogs({})) {
      // Особисті листування поза предметом збору: лише групи й канали.
      if (dialog.isUser || !dialog.id || !dialog.entity) continue;
      const entity = dialog.entity as Api.Channel | Api.Chat;
      const id = dialog.id.toString();
      this.entities.set(id, entity);
      chats.push({
        id,
        username: 'username' in entity && entity.username ? entity.username : null,
        title: dialog.title ?? dialog.name ?? id,
        createdAt: new Date((entity.date ?? 0) * 1000).toISOString(),
      });
    }
    return chats;
  }

  async readMessagesSince(chatId: string, since: string): Promise<RawMessage[]> {
    const entity = this.entities.get(chatId);
    if (!entity) throw new TelegramReadError({ kind: 'access_lost', code: 'NOT_IN_DIALOGS' });
    const sinceSec = Math.floor(Date.parse(since) / 1000);
    const messages: RawMessage[] = [];
    try {
      // reverse: від старих до нових; offsetDate тоді — нижня межа, але
      // виключна, тому на секунду раніше, а точна межа — фільтром нижче.
      for await (const message of this.client.iterMessages(entity, { reverse: true, offsetDate: sinceSec - 1 })) {
        if (!(message instanceof Api.Message) || !message.message || message.date < sinceSec) continue;
        messages.push({
          telegramMessageId: message.id,
          postedAt: new Date(message.date * 1000).toISOString(),
          text: message.message,
        });
      }
    } catch (err) {
      throw toReadError(err);
    }
    return messages;
  }
}
