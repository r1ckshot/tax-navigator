/**
 * AC-02 — "Never collect from chats the researcher never joined."
 *
 * Pure-function частина: реальний MTProto-запит (ADR-0001) поза скоупом,
 * тут лише фільтр кандидатів-чатів проти списку вже приєднаних. Точний
 * збіг рядка (без normalization case/trim) — гейт на рівні запиту, не
 * "схожий чат".
 */

export function filterKnownChats(
  candidateChatIds: readonly string[],
  knownChatIds: readonly string[]
): string[] {
  const known = new Set(knownChatIds);
  return candidateChatIds.filter((chatId) => known.has(chatId));
}
