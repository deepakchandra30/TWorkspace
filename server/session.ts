import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { connectDb } from "./db.js";
import { SESSION_COOKIE, findMember } from "./auth.js";

// Route-handler side of sessions: reading and setting the cookie, checking membership.

export function toObjectId(id: string): ObjectId | null {
  return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
}

export async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Local http has no TLS; Render serves https.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

// An expiry in the past makes the browser drop the cookie.
export async function clearSessionCookie() {
  await setSessionCookie("", new Date(0));
}

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

// The caller's membership in this workspace, or null when there is no valid session for it.
// The workspace must be open and unexpired: that filter hides a closed workspace at once.
export async function getSession(workspaceId: ObjectId) {
  const db = await connectDb();
  const member = await findMember(db, await getSessionToken());
  if (!member || !member.workspaceId.equals(workspaceId)) return null;

  const workspace = await db
    .collection("workspaces")
    .findOne({ _id: workspaceId, status: "open", expiresAt: { $gt: new Date() } });
  if (!workspace) return null;

  return { db, member, workspace };
}
