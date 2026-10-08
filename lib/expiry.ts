// Workspace lifetime: chosen by the host in whole hours, 1 to 48.

export const MIN_HOURS = 1;
export const MAX_HOURS = 48;

const HOUR_MS = 60 * 60 * 1000;

export function clampLifetimeHours(input: unknown): number | null {
  if (typeof input !== "number" && (typeof input !== "string" || input.trim() === "")) return null;
  const hours = Number(input);
  if (!Number.isFinite(hours)) return null;
  return Math.min(MAX_HOURS, Math.max(MIN_HOURS, Math.round(hours)));
}

export function expiresAtFrom(start: Date, hours: number): Date {
  return new Date(start.getTime() + hours * HOUR_MS);
}
