// @ file references in a chat message, as in Claude Code: type @, pick a file, it becomes a ref.
// The text keeps "@filename"; the message also stores refs [{fileId, filename}] so a chip can open it.

export type FileRef = { fileId: string; filename: string };
export type Mention = { start: number; query: string };
export type Segment = { text: string } | { ref: FileRef };

export const MENTION_LIMIT = 8;

// The @ token that ends at the caret: an @ at the start or after whitespace, then no whitespace.
export function mentionAt(text: string, caret: number): Mention | null {
  const before = text.slice(0, caret);
  const match = /(^|\s)@(\S*)$/.exec(before);
  if (!match) return null;
  return { start: before.length - match[2].length - 1, query: match[2] };
}

// Replace the token with "@filename " and put the caret after it.
export function insertMention(text: string, mention: Mention, filename: string) {
  const end = mention.start + 1 + mention.query.length;
  const inserted = `@${filename} `;
  return { text: text.slice(0, mention.start) + inserted + text.slice(end), caret: mention.start + inserted.length };
}

// Client-side filter over the file list already loaded: names starting with the query first.
export function filterFiles<T extends { filename: string }>(files: T[], query: string, limit = MENTION_LIMIT): T[] {
  const q = query.toLowerCase();
  const starts: T[] = [];
  const contains: T[] = [];
  for (const file of files) {
    const name = file.filename.toLowerCase();
    if (name.startsWith(q)) starts.push(file);
    else if (name.includes(q)) contains.push(file);
  }
  return [...starts, ...contains].slice(0, limit);
}

// The refs to send: those whose "@filename" is still in the text, each file once.
export function refsInText(text: string, refs: FileRef[]): FileRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.fileId) || !text.includes(`@${ref.filename}`)) return false;
    seen.add(ref.fileId);
    return true;
  });
}

// Split a sent message into plain text and refs, for rendering refs as chips.
export function splitMentions(text: string, refs: FileRef[]): Segment[] {
  // Longest names first, so "@deck v2.pdf" wins over "@deck".
  const sorted = [...refs].sort((a, b) => b.filename.length - a.filename.length);
  const segments: Segment[] = [];
  let rest = text;
  while (rest) {
    let best: { index: number; ref: FileRef } | null = null;
    for (const ref of sorted) {
      const index = rest.indexOf(`@${ref.filename}`);
      if (index !== -1 && (!best || index < best.index)) best = { index, ref };
    }
    if (!best) {
      segments.push({ text: rest });
      break;
    }
    if (best.index > 0) segments.push({ text: rest.slice(0, best.index) });
    segments.push({ ref: best.ref });
    rest = rest.slice(best.index + 1 + best.ref.filename.length);
  }
  return segments;
}
