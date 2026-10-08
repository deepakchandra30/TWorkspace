import type { Document, ObjectId } from "mongodb";
import { getSession, toObjectId } from "@/server/session";
import { jsonError } from "@/server/http";
import { cleanSearchQuery } from "@/lib/search";

const LIMIT = 10;

const PROJECT = { $project: { _id: 1, memberId: 1, nickname: 1, text: 1, imageFileId: 1, createdAt: 1 } };

// Meaning: Atlas embeds the query string itself (autoEmbed), so "wifi pw" finds "network password".
function semantic(q: string, workspaceId: ObjectId): Document[] {
  return [
    {
      $vectorSearch: {
        index: "messages_semantic",
        path: "text",
        query: q,
        filter: { workspaceId },
        limit: LIMIT,
        numCandidates: 100,
      },
    },
  ];
}

// Exact words, names and numbers, forgiving one typo.
function keyword(q: string, workspaceId: ObjectId): Document[] {
  return [
    {
      $search: {
        index: "messages_text",
        compound: {
          must: [{ text: { query: q, path: "text", fuzzy: { maxEdits: 1 } } }],
          filter: [{ equals: { path: "workspaceId", value: workspaceId } }],
        },
      },
    },
    { $limit: LIMIT },
  ];
}

function regex(q: string, workspaceId: ObjectId): Document[] {
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [
    { $match: { workspaceId, text: { $regex: escaped, $options: "i" } } },
    { $sort: { _id: -1 } },
    { $limit: LIMIT },
  ];
}

// Best first. A rung that fails (index still building, embedding rate limit, refused on this tier)
// is logged and the next one answers, so the search box keeps working without a redeploy.
const LADDER: [string, (q: string, workspaceId: ObjectId) => Document[]][] = [
  [
    "hybrid",
    (q, workspaceId) => [
      { $rankFusion: { input: { pipelines: { semantic: semantic(q, workspaceId), keyword: keyword(q, workspaceId) } } } },
      { $limit: LIMIT },
    ],
  ],
  ["semantic", semantic],
  ["keyword", keyword],
  ["regex", regex],
];

// Search this workspace's chat messages. Files are not searched.
export async function GET(request: Request, ctx: RouteContext<"/api/workspaces/[id]/search">) {
  const { id } = await ctx.params;
  const workspaceId = toObjectId(id);
  if (!workspaceId) return jsonError(404, "This workspace doesn't exist.");

  const session = await getSession(workspaceId);
  if (!session) return jsonError(401, "You're not in this workspace, or it has closed.");

  // An empty box never reaches the database, so it never spends an embedding.
  const q = cleanSearchQuery(new URL(request.url).searchParams.get("q"));
  if (!q) return Response.json({ messages: [], mode: "empty" });

  const messages = session.db.collection("messages");
  for (const [mode, pipeline] of LADDER) {
    try {
      const results = await messages.aggregate([...pipeline(q, workspaceId), PROJECT]).toArray();
      return Response.json({ messages: results, mode });
    } catch (err) {
      console.warn(`search: ${mode} failed, trying the next rung:`, err instanceof Error ? err.message : err);
    }
  }
  return jsonError(503, "Search isn't available right now.");
}
