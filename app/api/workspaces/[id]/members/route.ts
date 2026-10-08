import { getSession, toObjectId } from "@/server/session";
import { jsonError } from "@/server/http";

// Who is in the workspace: nicknames and roles only, first joined first.
export async function GET(_request: Request, ctx: RouteContext<"/api/workspaces/[id]/members">) {
  const { id } = await ctx.params;
  const workspaceId = toObjectId(id);
  if (!workspaceId) return jsonError(404, "This workspace doesn't exist.");

  const session = await getSession(workspaceId);
  if (!session) return jsonError(401, "You're not in this workspace, or it has closed.");

  const members = await session.db
    .collection("members")
    .find({ workspaceId, expiresAt: { $gt: new Date() } }, { projection: { nickname: 1, role: 1 } })
    .sort({ _id: 1 })
    .toArray();
  return Response.json({ members });
}
