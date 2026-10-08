// Text people type: trimmed, never empty, capped. Anything else is rejected with null.

export const MAX_NICKNAME_LENGTH = 32;
export const MAX_NAME_LENGTH = 80;
// Matches the messages validator in scripts/setup.js.
export const MAX_MESSAGE_LENGTH = 4000;

function cleanText(input: unknown, max: number): string | null {
  if (typeof input !== "string") return null;
  const text = input.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

export const cleanNickname = (input: unknown) => cleanText(input, MAX_NICKNAME_LENGTH);
export const cleanWorkspaceName = (input: unknown) => cleanText(input, MAX_NAME_LENGTH);
export const cleanMessageText = (input: unknown) => cleanText(input, MAX_MESSAGE_LENGTH);
