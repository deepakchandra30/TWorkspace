import { createHash, randomBytes } from 'node:crypto';

// Session tokens: random, sent to the browser once as an HttpOnly cookie, stored only as a hash.
// Plain JavaScript so both server.js (sockets) and the route handlers can import it.

export const SESSION_COOKIE = 'ws_session';

export function newToken() {
  return randomBytes(32).toString('base64url');
}

// The QR link's invite code. Stored as is, like the PIN, so the QR can be shown again.
export function newJoinSecret() {
  return randomBytes(16).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

// The member behind a session token, if both still exist. Closing a workspace moves every
// member's expiresAt to now, so this stops matching at once, before TTL deletes anything.
export async function findMember(db, token) {
  if (typeof token !== 'string' || token.length === 0) return null;
  return db.collection('members').findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
}

export function parseCookie(header, name) {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}
