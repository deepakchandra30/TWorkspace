import { getSession, toObjectId } from "@/server/session";
import { jsonError } from "@/server/http";
import { listFiles } from "@/server/files";
import { loadMessages } from "@/server/messages";

// Everything a member needs on load: the workspace, who they are, how many are here, the files
// (without their bytes) and recent chat.
export async function GET(_request: Request, ctx: RouteContext<"/api/workspaces/[id]">) {
  const { id } = await ctx.params;
  const workspaceId = toObjectId(id);
  if (!workspaceId) return jsonError(404, "This workspace doesn't exist.");

  const session = await getSession(workspaceId);
  if (!session) return jsonError(401, "You're not in this workspace, or it has closed.");
  const { db, member, workspace } = session;

  const [memberCount, files, page] = await Promise.all([
    db.collection("members").countDocuments({ workspaceId, expiresAt: { $gt: new Date() } }),
    listFiles(db, workspaceId),
    loadMessages(db, workspaceId),
  ]);

  return Response.json({
    workspace: {
      id,
      name: workspace.name,
      pin: workspace.pin,
      joinSecret: workspace.joinSecret,
      status: workspace.status,
      expiresAt: workspace.expiresAt,
    },
    me: { id: member._id, nickname: member.nickname, role: member.role, prefs: member.prefs },
    memberCount,
    files,
    ...page,
  });
}
