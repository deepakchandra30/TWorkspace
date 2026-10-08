import { randomInt } from "node:crypto";
import type { ObjectId } from "mongodb";
import { connectDb } from "@/server/db.js";
import { hashToken, newJoinSecret, newToken } from "@/server/auth.js";
import { setSessionCookie } from "@/server/session";
import { isDuplicateKey, jsonError, readJson } from "@/server/http";
import { MAX_HOURS, clampLifetimeHours, expiresAtFrom } from "@/lib/expiry";
import { cleanNickname, cleanWorkspaceName } from "@/lib/input";
import { DEFAULT_PREFS } from "@/lib/layout";
import { PIN_LENGTH, formatPin } from "@/lib/pin";

const PIN_ATTEMPTS = 5;

// Create a workspace. The creator joins it as the host and gets a session cookie.
export async function POST(request: Request) {
  const body = await readJson(request);
  const name = cleanWorkspaceName(body.name);
  const hours = clampLifetimeHours(body.hours);
  const nickname = cleanNickname(body.nickname);
  if (!name || hours === null || !nickname) {
    return jsonError(400, `Give the workspace a name, a lifetime of 1 to ${MAX_HOURS} hours, and your nickname.`);
  }

  const db = await connectDb();
  const now = new Date();
  const expiresAt = expiresAtFrom(now, hours);
  const joinSecret = newJoinSecret();

  // The unique index on pin rejects a clash with another live workspace; draw again.
  let workspaceId: ObjectId | undefined;
  let pin = "";
  for (let attempt = 0; attempt < PIN_ATTEMPTS && !workspaceId; attempt++) {
    pin = formatPin(randomInt(0, 10 ** PIN_LENGTH));
    try {
      const result = await db.collection("workspaces").insertOne({
        name,
        pin,
        joinSecret,
        status: "open",
        createdAt: now,
        expiresAt,
        maxExpiresAt: expiresAtFrom(now, MAX_HOURS),
      });
      workspaceId = result.insertedId;
    } catch (err) {
      if (!isDuplicateKey(err, "pin")) throw err;
    }
  }
  if (!workspaceId) return jsonError(503, "Couldn't find a free PIN. Try again.");

  const token = newToken();
  await db.collection("members").insertOne({
    workspaceId,
    nickname,
    tokenHash: hashToken(token),
    role: "host",
    prefs: DEFAULT_PREFS,
    joinedAt: now,
    expiresAt,
  });
  await setSessionCookie(token, expiresAt);

  return Response.json({ id: workspaceId.toHexString(), pin, joinSecret }, { status: 201 });
}
