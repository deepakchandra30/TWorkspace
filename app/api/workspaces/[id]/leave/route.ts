import { clearSessionCookie, getSession, toObjectId } from "@/server/session";
import { jsonError } from "@/server/http";
import { getIo } from "@/server/io";

// Leave for good: the member is deleted, so the nickname is free again. Closing the tab is not
// leaving; the member stays and the cookie lets them back in. The host closes the workspace instead.
export async function POST(_request: Request, ctx: RouteContext<"/api/workspaces/[id]/leave">) {
  const { id } = await ctx.params;
  const workspaceId = toObjectId(id);
  if (!workspaceId) return jsonError(404, "This workspace doesn't exist.");

  const session = await getSession(workspaceId);
  if (!session) return jsonError(401, "You're not in this workspace, or it has closed.");
  const { db, member } = session;
  if (member.role === "host") return jsonError(403, "Hosts close the workspace instead.");

  await db.collection("members").deleteOne({ _id: member._id });
  await clearSessionCookie();
  // The change stream only carries inserts, so the departure is announced from here.
  getIo()?.to(workspaceId.toHexString()).emit("member:left", { memberId: member._id.toHexString() });

  return Response.json({ ok: true });
}
