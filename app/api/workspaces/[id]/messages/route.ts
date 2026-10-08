import type { Document, ObjectId } from "mongodb";
import { getSession, toObjectId } from "@/server/session";
import { jsonError, readJson } from "@/server/http";
import { loadMessages } from "@/server/messages";
import { MAX_MESSAGE_LENGTH, cleanMessageText } from "@/lib/input";

const MAX_REFS = 10;

// Older messages: ?before=<message id> returns the page before that message.
export async function GET(request: Request, ctx: RouteContext<"/api/workspaces/[id]/messages">) {
  const { id } = await ctx.params;
  const workspaceId = toObjectId(id);
  if (!workspaceId) return jsonError(404, "This workspace doesn't exist.");

  const session = await getSession(workspaceId);
  if (!session) return jsonError(401, "You're not in this workspace, or it has closed.");

  const beforeParam = new URL(request.url).searchParams.get("before");
  const before = beforeParam ? toObjectId(beforeParam) : undefined;
  if (beforeParam && !before) return jsonError(400, "before must be a message id.");

  return Response.json(await loadMessages(session.db, workspaceId, before ?? undefined));
}

// Post a message. Everyone in the workspace receives it through the change stream in server.js.
export async function POST(request: Request, ctx: RouteContext<"/api/workspaces/[id]/messages">) {
  const { id } = await ctx.params;
  const workspaceId = toObjectId(id);
  if (!workspaceId) return jsonError(404, "This workspace doesn't exist.");

  const session = await getSession(workspaceId);
  if (!session) return jsonError(401, "You're not in this workspace, or it has closed.");
  const { db, member, workspace } = session;

  const body = await readJson(request);

  // A pasted screenshot is uploaded first, then posted as a message pointing at that file.
  let imageFileId: ObjectId | null = null;
  if (body.imageFileId !== undefined) {
    imageFileId = toObjectId(String(body.imageFileId));
    const image =
      imageFileId &&
      (await db
        .collection("files")
        .findOne({ _id: imageFileId, workspaceId, expiresAt: { $gt: new Date() } }, { projection: { _id: 1 } }));
    if (!image) return jsonError(400, "That image isn't in this workspace.");
  }

  // @ references: kept only for files in this workspace, with the stored filename, never the
  // client's. A stale or foreign id is dropped rather than failing the whole message.
  const refIds = (Array.isArray(body.refs) ? body.refs : [])
    .slice(0, MAX_REFS)
    .map((ref) => toObjectId(String((ref as { fileId?: unknown })?.fileId ?? "")))
    .filter((fileId): fileId is ObjectId => fileId !== null);
  const refs = refIds.length
    ? (
        await db
          .collection("files")
          .find({ _id: { $in: refIds }, workspaceId, expiresAt: { $gt: new Date() } }, { projection: { filename: 1 } })
          .toArray()
      ).map((file: Document) => ({ fileId: file._id as ObjectId, filename: String(file.filename) }))
    : [];

  // Text is optional only when an image is attached.
  const hasText = typeof body.text === "string" && body.text.trim() !== "";
  const text = hasText ? cleanMessageText(body.text) : "";
  if (text === null || (!text && !imageFileId)) {
    return jsonError(400, `A message needs 1 to ${MAX_MESSAGE_LENGTH} characters, or an image.`);
  }

  const message = {
    workspaceId,
    memberId: member._id,
    nickname: member.nickname,
    text,
    ...(imageFileId ? { imageFileId } : {}),
    refs,
    createdAt: new Date(),
    expiresAt: workspace.expiresAt,
  };
  const { insertedId } = await db.collection("messages").insertOne(message);

  return Response.json({ ...message, _id: insertedId }, { status: 201 });
}
