import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as connect } from "socket.io-client";
import { startServer, stopServer } from "./helpers";

describe("server.js without a reachable database", () => {
  let server: Awaited<ReturnType<typeof startServer>>;

  beforeAll(async () => {
    // Port 1 refuses connections, so the ping fails after server selection times out.
    server = await startServer([], { MONGODB_URI: "mongodb://127.0.0.1:1/" });
  });
  afterAll(() => stopServer(server?.child));

  it("answers a Socket.IO ping over a WebSocket upgrade", async () => {
    // websocket-only, so this goes through the upgrade routing in server.js, not long-polling.
    const socket = connect(server.url, { transports: ["websocket"], reconnection: false });
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
      });
      await expect(socket.timeout(5_000).emitWithAck("health:ping")).resolves.toBe("pong");
    } finally {
      socket.close();
    }
  });

  it("reports the database down with 503, never ok", async () => {
    const res = await fetch(`${server.url}/api/health`);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body).toMatchObject({ status: "error", db: "down" });
  });

  it("lets route handlers reach the Socket.IO server", async () => {
    const body = await (await fetch(`${server.url}/api/health`)).json();
    expect(body.io).toBe(true);
  });
});

describe("server.js with the Atlas database from .env", () => {
  let server: Awaited<ReturnType<typeof startServer>>;

  beforeAll(async () => {
    if (!existsSync(".env")) {
      throw new Error("No .env file. Copy .env.example to .env and fill in MONGODB_URI, then re-run.");
    }
    server = await startServer(["--env-file=.env"], {});
  });
  afterAll(() => stopServer(server?.child));

  it("reports the database up", async () => {
    const res = await fetch(`${server.url}/api/health`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: "ok", db: "up" });
  });
});
