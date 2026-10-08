import type { Db, ObjectId } from "mongodb";

// A workspace's files, newest first, without their bytes: content can be megabytes each.
export async function listFiles(db: Db, workspaceId: ObjectId) {
  return db
    .collection("files")
    .find({ workspaceId, expiresAt: { $gt: new Date() } }, { projection: { content: 0 } })
    .sort({ _id: -1 })
    .toArray();
}
