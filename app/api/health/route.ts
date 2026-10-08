import { connectDb } from "@/server/db.js";
import { getIo } from "@/server/io";

// Never prerender: a build must not try to reach the database.
export const dynamic = "force-dynamic";

export async function GET() {
  // True when this handler shares a process with server.js, so later routes can emit to sockets.
  const io = Boolean(getIo());

  try {
    const db = await connectDb();
    await db.command({ ping: 1 });
    return Response.json({ status: "ok", db: "up", io });
  } catch (err) {
    // Full detail goes to the server log; the public response names only the error type.
    console.error("health check failed:", err);
    const error = err instanceof Error ? err.name : "UnknownError";
    return Response.json({ status: "error", db: "down", io, error }, { status: 503 });
  }
}
