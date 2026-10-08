import type { Db, ObjectId } from "mongodb";

export const PAGE_SIZE = 50;

// One page of a workspace's messages, oldest first for display. Pages walk backwards by _id:
// ObjectIds increase with insertion order, so ties in createdAt can't drop a message at a page edge.
export async function loadMessages(db: Db, workspaceId: ObjectId, before?: ObjectId) {
  const docs = await db
    .collection("messages")
    .find({ workspaceId, expiresAt: { $gt: new Date() }, ...(before ? { _id: { $lt: before } } : {}) })
    .sort({ _id: -1 })
    .limit(PAGE_SIZE + 1)
    .toArray();

  const hasMore = docs.length > PAGE_SIZE;
  return { messages: docs.slice(0, PAGE_SIZE).reverse(), hasMore };
}
