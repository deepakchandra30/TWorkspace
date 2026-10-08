import { getSession, toObjectId } from "@/server/session";
import { jsonError } from "@/server/http";
import { MAX_FILE_BYTES, encode } from "@/lib/content";

// Room for the multipart boundaries and part headers around the file. The exact limit is checked
// on the file's own bytes; this only stops an oversized body before it is read.
const MULTIPART_OVERHEAD = 64 * 1024;
const MAX_FILENAME_LENGTH = 255;
const TOO_LARGE = "File too large: 5 MB max.";

// Upload one file as multipart/form-data, field "file". Everyone in the workspace gets file:new
// through the change stream in server.js, which leaves the bytes out.
export async function POST(request: Request, ctx: RouteContext<"/api/workspaces/[id]/files">) {
  const { id } = await ctx.params;
  const workspaceId = toObjectId(id);
  if (!workspaceId) return jsonError(404, "This workspace doesn't exist.");

  const session = await getSession(workspaceId);
  if (!session) return jsonError(401, "You're not in this workspace, or it has closed.");
  const { db, member, workspace } = session;

  if (Number(request.headers.get("content-length")) > MAX_FILE_BYTES + MULTIPART_OVERHEAD) {
    return jsonError(413, TOO_LARGE);
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError(400, 'Send the file as multipart/form-data in a field named "file".');
  if (file.size > MAX_FILE_BYTES) return jsonError(413, TOO_LARGE);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const meta = {
    workspaceId,
    memberId: member._id,
    nickname: member.nickname,
    filename: file.name.trim().slice(0, MAX_FILENAME_LENGTH) || "untitled",
    mime: file.type || "application/octet-stream",
    size: bytes.length,
    createdAt: new Date(),
    expiresAt: workspace.expiresAt,
  };
  const { insertedId } = await db.collection("files").insertOne({ ...meta, ...encode(bytes) });

  return Response.json({ ...meta, _id: insertedId }, { status: 201 });
}
