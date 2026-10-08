import type { Db, ObjectId } from "mongodb";
import { COLLECTIONS } from "@/server/db.js";
import { getSession, toObjectId } from "@/server/session";
import { jsonError } from "@/server/http";
import { getIo } from "@/server/io";

const RECEIPT_EVERY_MS = 3_000;
// TTL runs about once a minute; stop reporting if deletion takes far longer than that.
const RECEIPT_GIVE_UP_MS = 3 * 60_000;

// What's left of a workspace, per collection. Expired documents still count until TTL removes them.
async function countRemaining(db: Db, workspaceId: ObjectId) {
  const counts = await Promise.all(
    COLLECTIONS.map(async (name: string) => {
      const filter = name === "workspaces" ? { _id: workspaceId } : { workspaceId };
      return [name, await db.collection(name).countDocuments(filter)] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<string, number>;
}

// The deletion receipt: counts every few seconds to everyone still connected, until all reach 0.
function sendReceipts(db: Db, workspaceId: ObjectId) {
  const room = workspaceId.toHexString();
  const started = Date.now();
  const tick = async () => {
    try {
      const counts = await countRemaining(db, workspaceId);
      getIo()?.to(room).emit("receipt:update", counts);
      const done = Object.values(counts).every((n) => n === 0);
      if (!done && Date.now() - started < RECEIPT_GIVE_UP_MS) setTimeout(tick, RECEIPT_EVERY_MS);
    } catch (err) {
      console.error("deletion receipt stopped:", err);
    }
  };
  void tick();
}

// Close for everyone, host only. Every document's expiresAt moves to now: every query filters on
// expiresAt > now, so the workspace vanishes at once, and TTL deletes it all within about a minute.
export async function POST(_request: Request, ctx: RouteContext<"/api/workspaces/[id]/close">) {
  const { id } = await ctx.params;
  const workspaceId = toObjectId(id);
  if (!workspaceId) return jsonError(404, "This workspace doesn't exist.");

  const session = await getSession(workspaceId);
  if (!session) return jsonError(401, "You're not in this workspace, or it has closed.");
  const { db, member } = session;
  if (member.role !== "host") return jsonError(403, "Only the host can close the workspace.");

  const now = new Date();
  await db
    .collection("workspaces")
    .updateOne({ _id: workspaceId }, { $set: { status: "closed", closedAt: now, expiresAt: now } });
  await Promise.all(
    COLLECTIONS.filter((name: string) => name !== "workspaces").map((name: string) =>
      db.collection(name).updateMany({ workspaceId }, { $set: { expiresAt: now } }),
    ),
  );

  getIo()?.to(workspaceId.toHexString()).emit("workspace:closed", { closedAt: now });
  sendReceipts(db, workspaceId);

  return Response.json({ ok: true, closedAt: now });
}
