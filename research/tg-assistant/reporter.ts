/**
 * Тижневий звіт (S-4): AC-07, AC-08, AC-10.
 *
 * Звіт збирається зі стану на диску, а не з пам'яті прогону: мітки, маркери
 * чатів і підсумок циклу вже лежать у `state.json`, тож той самий звіт можна
 * перезібрати будь-коли після циклу, хоч через місяць.
 *
 * Тексту питань у стані немає (PRD §6.1), і звіт його не повертає: питання
 * названо міткою і службовим посиланням на повідомлення. Прочитати сам текст
 * дослідник іде за посиланням у Telegram.
 */

import type { QuestionLabel } from './labeler.ts';
import type { CycleReport, CycleState } from './state.ts';

export interface ReportQuestion {
  chatId: string;
  telegramMessageId: number;
  chatTitle: string | null;
  label: QuestionLabel;
  /** `https://t.me/...`, або null для малої групи, у якої адреси повідомлення немає. */
  link: string | null;
}

export type WeeklyReport =
  | { weekOf: string; state: 'no_cycle' }
  /** Цикл стартував, але звіту не записав: не нуль питань, а незавершений тиждень. */
  | { weekOf: string; state: 'unfinished'; startedAt: string }
  | { weekOf: string; state: 'finished'; cycle: CycleReport; questions: ReportQuestion[] };

/**
 * Посилання на повідомлення. Username дає публічну адресу; супергрупа без нього
 * (`-100…`) — адресу `t.me/c/`, що відкривається учаснику чату. Мала група
 * адреси не має, тоді службовим посиланням лишається пара chat_id:message_id.
 */
export function messageLink(chatId: string, ref: string | null, telegramMessageId: number): string | null {
  if (ref && !/^-?\d+$/.test(ref)) return `https://t.me/${ref}/${telegramMessageId}`;
  if (/^-100\d+$/.test(chatId)) return `https://t.me/c/${chatId.slice(4)}/${telegramMessageId}`;
  return null;
}

function splitKey(key: string): { chatId: string; telegramMessageId: number } {
  const at = key.lastIndexOf(':');
  return { chatId: key.slice(0, at), telegramMessageId: Number(key.slice(at + 1)) };
}

/** Звіт тижня; без `weekOf` — останній завершений цикл. */
export function buildWeeklyReport(state: CycleState, weekOf?: string): WeeklyReport {
  const reports = Object.values(state.reports ?? {});
  const week = weekOf ?? reports.reduce<CycleReport | null>((a, b) => (a && a.finishedAt >= b.finishedAt ? a : b), null)?.weekOf;
  if (!week) return { weekOf: '', state: 'no_cycle' };

  const cycle = state.reports?.[week];
  if (!cycle) {
    const run = state.cycleRuns[week];
    return run ? { weekOf: week, state: 'unfinished', startedAt: run.startedAt } : { weekOf: week, state: 'no_cycle' };
  }

  const questions: ReportQuestion[] = [];
  for (const [key, label] of Object.entries(state.labels ?? {})) {
    // Мітка пишеться один раз (AC-06), тож її weekOf — тиждень, коли питання прийшло.
    if (label.weekOf !== week) continue;
    const { chatId, telegramMessageId } = splitKey(key);
    const marker = state.chats?.[chatId];
    questions.push({ chatId, telegramMessageId, chatTitle: marker?.title ?? null, label, link: messageLink(chatId, marker?.ref ?? null, telegramMessageId) });
  }
  questions.sort((a, b) => (a.chatId === b.chatId ? a.telegramMessageId - b.telegramMessageId : a.chatId < b.chatId ? -1 : 1));

  return { weekOf: week, state: 'finished', cycle, questions };
}

/**
 * Назва чату — чужий текст: її пише адмін чату, а звіт може читати й модель.
 * Одним рядком, без розмітки й обрізана, щоб не стати ні списком, ні посиланням.
 */
function plain(text: string): string {
  const flat = text.replace(/[\p{Cc}\p{Cf}]+/gu, ' ').replace(/[\\`*_[\]<>|#]/g, '').replace(/\s+/g, ' ').trim();
  return flat.length > 80 ? `${flat.slice(0, 79)}…` : flat;
}

const STATUS_UA: Record<CycleReport['status'], string> = {
  completed: 'усі чати прочитано',
  partial: 'частину чатів не прочитано',
  failed: 'жодного чату не прочитано',
};

function questionLine(q: ReportQuestion): string {
  const where = q.link ?? `${q.chatId}:${q.telegramMessageId}`;
  const chat = q.chatTitle ? plain(q.chatTitle) : q.chatId;
  const verdict =
    q.label.label === 'covered' ? `покрито: ${q.label.ruleIds.join(', ')}` : `біла пляма: жодного з ${q.label.rulesChecked} правил`;
  return `- ${verdict} · ${chat} · ${where}`;
}

export function renderWeeklyReport(report: WeeklyReport): string {
  if (report.state === 'no_cycle') {
    return report.weekOf ? `# Тижневий звіт ${report.weekOf}\n\nЦиклу за цей тиждень не було.\n` : '# Тижневий звіт\n\nЖодного циклу ще не було.\n';
  }
  if (report.state === 'unfinished') {
    return `# Тижневий звіт ${report.weekOf}\n\nЦикл стартував ${report.startedAt}, але звіту не записав. Це незавершений тиждень, а не нуль питань.\n`;
  }

  const { cycle, questions } = report;
  const out: string[] = [`# Тижневий звіт ${cycle.weekOf}`, ''];
  out.push(`Цикл: ${cycle.status} (${STATUS_UA[cycle.status]}), ${cycle.startedAt} → ${cycle.finishedAt}.`);
  out.push(`Чатів прочитано: ${cycle.chats.length}, нових повідомлень: ${cycle.chats.reduce((sum, c) => sum + c.newMessages, 0)}.`);
  out.push('');

  out.push('## Питання');
  out.push('');
  if (!cycle.labels) {
    // Цикли до S-2 питань не рахували, до S-3 не розмічали: це не нуль, а відсутність виміру.
    out.push(cycle.filter ? 'Цикл пройшов до розмітки S-3: питання не розмічались.' : 'Цикл пройшов до фільтра S-2: питання не рахувались.');
  } else {
    const { covered, whiteSpot, matrixVerifiedAt } = cycle.labels;
    out.push(`Органічних питань: ${covered + whiteSpot}. Покрито: ${covered}, біла пляма: ${whiteSpot}. Матриця правил від ${matrixVerifiedAt}.`);
    if (questions.length !== covered + whiteSpot) {
      out.push(`Увага: у стані ${questions.length} міток цього тижня, а цикл записав ${covered + whiteSpot}. Звіт показує мітки зі стану.`);
    }
    out.push('');
    for (const q of questions) out.push(questionLine(q));
    if (whiteSpot > 0) {
      out.push('');
      // PRD §8: бінарна мітка не відрізняє прогалину матриці від питання поза продуктом.
      out.push(
        'Біла пляма не означає дірку продукту. Мітка лише каже, що жодне правило матриці не зачеплене, і сюди ж потрапляють питання, яких продукт свідомо не покриває: пошук бухгалтера, банки, документи на побут, персональна порада. У раунді 2 таких було 7 з 10. Кожну пляму перевірити за посиланням.'
      );
    }
  }
  if (cycle.filter) {
    const rejected = Object.entries(cycle.filter.rejected).filter(([, n]) => n > 0);
    out.push('');
    out.push(`Відсіяно фільтром: ${rejected.length > 0 ? rejected.map(([reason, n]) => `${reason} ${n}`).join(', ') : 'нічого'}.`);
  }

  out.push('', '## Недоступні чати', '');
  // AC-08: частковий тиждень називає, чого бракує, а не мовчить.
  if (cycle.failures.length === 0) out.push('Немає.');
  for (const f of cycle.failures) out.push(`- ${f.title ? plain(f.title) : f.ref} (${f.ref}): ${f.reason}`);

  const windowed = cycle.chats.filter((c) => c.windowStartAt !== null);
  out.push('', '## Межа історії', '');
  // AC-10: чат, прочитаний через вікно, має неповну історію, і звіт каже, з якої дати.
  if (windowed.length === 0) out.push('Жоден чат не читався через вікно: історія повна від попереднього циклу.');
  for (const c of windowed) out.push(`- ${plain(c.title)} (${c.ref}): лише повідомлення від ${c.windowStartAt}, раніше не читалось.`);

  return `${out.join('\n')}\n`;
}
