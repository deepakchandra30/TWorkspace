import { connectDb } from "@/server/db.js";
import { findMember, hashToken, newToken } from "@/server/auth.js";
import { getSessionToken, setSessionCookie } from "@/server/session";
import { isDuplicateKey, jsonError, readJson } from "@/server/http";
import { clientIp, isBlocked, recordFailure } from "@/server/ratelimit";
import { cleanNickname } from "@/lib/input";
import { DEFAULT_PREFS } from "@/lib/layout";
import { normalizePin } from "@/lib/pin";

const MAX_SECRET_LENGTH = 64;

// Join by the 6-digit PIN or by the QR link's secret, with a nickname only.
export async function POST(request: Request) {
  const ip = clientIp(request);
  const body = await readJson(request);
  const nickname = cleanNickname(body.nickname);
  const pin = normalizePin(body.pin);
  const secret =
    typeof body.secret === "string" && body.secret.length > 0 && body.secret.length <= MAX_SECRET_LENGTH
      ? body.secret
      : null;
  if (!nickname || (!pin && !secret)) return jsonError(400, "Enter the 6-digit PIN and a nickname.");
  // Only PIN joins are limited: a room on one Wi-Fi shares an IP, and a QR secret can't be guessed.
  if (pin && isBlocked(ip)) return jsonError(429, "Too many wrong PINs. Wait a minute, then try again.");

  const db = await connectDb();
  const now = new Date();
  const workspace = await db
    .collection("workspaces")
    .findOne({ ...(pin ? { pin } : { joinSecret: secret }), status: "open", expiresAt: { $gt: now } });
  if (!workspace) {
    if (pin) recordFailure(ip);
    return jsonError(404, pin ? "No open workspace with that PIN." : "This invite link has expired.");
  }

  // Already a member here from this browser: let them back in instead of refusing their nickname.
  const existing = await findMember(db, await getSessionToken());
  if (existing?.workspaceId.equals(workspace._id)) {
    return Response.json({ id: workspace._id.toHexString() });
  }

  const token = newToken();
  try {
    await db.collection("members").insertOne({
      workspaceId: workspace._id,
      nickname,
      tokenHash: hashToken(token),
      role: "guest",
      prefs: DEFAULT_PREFS,
      joinedAt: now,
      expiresAt: workspace.expiresAt,
    });
  } catch (err) {
    if (isDuplicateKey(err, "nickname")) return jsonError(409, "That nickname is taken in this workspace.");
    throw err;
  }
  await setSessionCookie(token, workspace.expiresAt);

  return Response.json({ id: workspace._id.toHexString() });
}
