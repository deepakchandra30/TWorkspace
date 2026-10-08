// Desktop panel layout for a member's saved preferences.
// Files focus: small chat, big files. Chat focus: small files, big chat.
// Choosing the left side swaps the chat and file panels.

export type Mode = "files" | "chat";
export type ChatSide = "left" | "right";
export type Prefs = { mode: Mode; chatSide: ChatSide };
export type Panel = "files" | "viewer" | "chat";
export type Layout = { panels: Panel[]; columns: string };

export const DEFAULT_PREFS: Prefs = { mode: "files", chatSide: "right" };

// Fixed widths for the narrow panels; the focused panel takes the rest.
export const PANEL_WIDTH = { files: "240px", chat: "320px" } as const;

const MODES: readonly Mode[] = ["files", "chat"];
const SIDES: readonly ChatSide[] = ["left", "right"];

// Saved prefs come from the database, so anything invalid falls back field by field.
export function normalizePrefs(input: unknown): Prefs {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const mode = MODES.includes(raw.mode as Mode) ? (raw.mode as Mode) : DEFAULT_PREFS.mode;
  const chatSide = SIDES.includes(raw.chatSide as ChatSide) ? (raw.chatSide as ChatSide) : DEFAULT_PREFS.chatSide;
  return { mode, chatSide };
}

export function layoutFor(input: unknown): Layout {
  const { mode, chatSide } = normalizePrefs(input);

  const panels: Panel[] = mode === "files" ? ["files", "viewer", "chat"] : ["files", "chat"];
  if (chatSide === "left") panels.reverse();

  const wide: Panel = mode === "files" ? "viewer" : "chat";
  const columns = panels
    .map((panel) => (panel === wide ? "1fr" : PANEL_WIDTH[panel as keyof typeof PANEL_WIDTH]))
    .join(" ");

  return { panels, columns };
}
