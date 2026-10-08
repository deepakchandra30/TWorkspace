// Wrong-PIN limit per IP, in memory. Only failures count: a room full of people on one Wi-Fi
// shares an IP and must all be able to join. One process on Render; a restart only resets it.

const WINDOW_MS = 60_000;
const MAX_FAILURES = 5;
const failures = new Map<string, number[]>();

// Render's proxy puts the client's address first.
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

function recent(ip: string, now: number) {
  const list = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length) failures.set(ip, list);
  else failures.delete(ip);
  return list;
}

export function isBlocked(ip: string, now = Date.now()): boolean {
  return recent(ip, now).length >= MAX_FAILURES;
}

export function recordFailure(ip: string, now = Date.now()) {
  failures.set(ip, [...recent(ip, now), now]);
}
