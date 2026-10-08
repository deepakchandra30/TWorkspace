import { connectDb } from "@/server/db.js";
import { getSession, toObjectId } from "@/server/session";
import { jsonError } from "@/server/http";
import { decode, type StoredContent } from "@/lib/content";

// Types a browser would run as a page on our origin. They only ever download.
const ACTIVE_CONTENT = /html|svg|xml/i;

// A file's bytes, decoded, with its stored type. ?download=1 saves it instead of showing it.
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const fileId = toObjectId(id);
  if (!fileId) return jsonError(404, "File not found.");

  const db = await connectDb();
  const file = await db.collection("files").findOne({ _id: fileId, expiresAt: { $gt: new Date() } });
  if (!file) return jsonError(404, "File not found.");
  if (!(await getSession(file.workspaceId))) return jsonError(401, "You're not in this workspace, or it has closed.");

  const download = new URL(request.url).searchParams.get("download") === "1" || ACTIVE_CONTENT.test(file.mime);
  const name = encodeURIComponent(file.filename);

  return new Response(decode(file as unknown as StoredContent), {
    headers: {
      "content-type": file.mime,
      "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
}
