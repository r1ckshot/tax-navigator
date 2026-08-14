export function filterKnownChats(
  candidateChatIds: readonly string[],
  knownChatIds: readonly string[]
): string[] {
  const known = new Set(knownChatIds);
  return candidateChatIds.filter((chatId) => known.has(chatId));
}
