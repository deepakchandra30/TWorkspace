import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { ObjectId } from "mongodb";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatPin } from "../lib/pin";
import { startServer, stopServer, type RunningServer } from "./helpers";

// The P1 flow against Atlas: create, join, chat live, page history. Needs .env.

const PAGE_SIZE = 50;

type Created = { id: string; pin: string; joinSecret: string };

let server: RunningServer;
let created: Created;
const cookies: Record<string, string> = {};
const sockets: Socket[] = [];

async function api(path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) {
  const res = await fetch(`${server.url}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  const body = await res.json().catch(() => null);
  return { status: res.status, body, cookie: setCookie?.split(";")[0] };
}

async function socketFor(cookie: string) {
  const socket = connect(server.url, { transports: ["websocket"], reconnection: false, extraHeaders: { cookie } });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return socket;
}

beforeAll(async () => {
  if (!existsSync(".env")) {
    throw new Error("No .env file. Copy .env.example to .env and fill in MONGODB_URI, then re-run.");
  }
  process.loadEnvFile(".env");
  server = await startServer(["--env-file=.env"], {});
});

afterAll(async () => {
  sockets.forEach((s) => s.close());
  await stopServer(server?.child);
  if (!created) return;
  // Remove what the test wrote rather than waiting an hour for TTL.
  const { connectDb, closeDb, COLLECTIONS } = await import("../server/db.js");
  const db = await connectDb();
  const workspaceId = new ObjectId(created.id);
  await db.collection("workspaces").deleteOne({ _id: workspaceId });
  for (const name of COLLECTIONS) await db.collection(name).deleteMany({ workspaceId });
  await closeDb();
});

describe("creating and joining a workspace", () => {
  it("creates a workspace and signs the host in with an HttpOnly cookie", async () => {
    const res = await api("/api/workspaces", { body: { name: "Integration test", hours: 1, nickname: "Host" } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: expect.any(String), pin: expect.stringMatching(/^\d{6}$/) });
    expect(res.body.joinSecret).toEqual(expect.any(String));
    expect(res.cookie).toMatch(/^ws_session=/);
    created = res.body;
    cookies.host = res.cookie!;
  });

  it("joins by PIN", async () => {
    const res = await api("/api/join", { body: { pin: created.pin, nickname: "Guest" } });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
    cookies.guest = res.cookie!;
  });

  it("joins by the QR link's secret", async () => {
    const res = await api("/api/join", { body: { secret: created.joinSecret, nickname: "Scanner" } });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  it("refuses a nickname already taken in the workspace", async () => {
    const res = await api("/api/join", { body: { pin: created.pin, nickname: "Guest" } });
    expect(res.status).toBe(409);
  });

  it("finds no workspace for a different PIN", async () => {
    const other = formatPin((Number(created.pin) + 1) % 1_000_000);
    const res = await api("/api/join", { body: { pin: other, nickname: "Lost" } });
    expect(res.status).toBe(404);
  });

  it("rejects a request with no session cookie", async () => {
    const res = await api(`/api/workspaces/${created.id}`);
    expect(res.status).toBe(401);
  });

  it("returns the workspace to a member", async () => {
    const res = await api(`/api/workspaces/${created.id}`, { cookie: cookies.guest });
    expect(res.status).toBe(200);
    expect(res.body.workspace).toMatchObject({ name: "Integration test", pin: created.pin });
    expect(res.body.me).toMatchObject({ nickname: "Guest", role: "guest" });
    expect(res.body.memberCount).toBe(3);
  });
});

describe("live chat", () => {
  it("delivers a message from one member to another's socket", async () => {
    const hostSocket = await socketFor(cookies.host);
    const received = new Promise<{ text: string; nickname: string }>((resolve) =>
      hostSocket.once("message:new", resolve),
    );

    const sent = await api(`/api/workspaces/${created.id}/messages`, {
      body: { text: "Slides are up" },
      cookie: cookies.guest,
    });
    expect(sent.status).toBe(201);

    const message = await Promise.race([
      received,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("no message:new within 2 s")), 2_000)),
    ]);
    expect(message).toMatchObject({ text: "Slides are up", nickname: "Guest" });
  });

  it("sends nothing to a socket without a session", async () => {
    const stranger = connect(server.url, { transports: ["websocket"], reconnection: false });
    sockets.push(stranger);
    await new Promise<void>((resolve) => stranger.once("connect", resolve));
    let leaked = false;
    stranger.on("message:new", () => (leaked = true));

    await api(`/api/workspaces/${created.id}/messages`, { body: { text: "members only" }, cookie: cookies.guest });
    await new Promise((r) => setTimeout(r, 1_000));
    expect(leaked).toBe(false);
  });
});

describe("history for late joiners", () => {
  it("returns the newest page, then every older message, with nothing missing or repeated", async () => {
    for (let i = 0; i < PAGE_SIZE + 5; i++) {
      const res = await api(`/api/workspaces/${created.id}/messages`, { body: { text: `m${i}` }, cookie: cookies.guest });
      expect(res.status).toBe(201);
    }

    const first = await api(`/api/workspaces/${created.id}`, { cookie: cookies.host });
    expect(first.body.messages).toHaveLength(PAGE_SIZE);
    expect(first.body.hasMore).toBe(true);
    expect(first.body.messages.at(-1).text).toBe(`m${PAGE_SIZE + 4}`);

    const seen = [...first.body.messages];
    let before = seen[0]._id;
    for (let page = 0; page < 10; page++) {
      const older = await api(`/api/workspaces/${created.id}/messages?before=${before}`, { cookie: cookies.host });
      expect(older.status).toBe(200);
      seen.unshift(...older.body.messages);
      if (!older.body.hasMore) break;
      before = older.body.messages[0]._id;
    }

    const ids = seen.map((m: { _id: string }) => m._id);
    expect(new Set(ids).size).toBe(ids.length);
    // Two earlier messages from the live-chat tests, plus this test's batch.
    expect(seen).toHaveLength(PAGE_SIZE + 5 + 2);
    expect(seen.at(-1).text).toBe(`m${PAGE_SIZE + 4}`);
  });
});

describe("files", () => {
  async function upload(bytes: Uint8Array<ArrayBuffer>, filename: string, type: string) {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type }), filename);
    const res = await fetch(`${server.url}/api/workspaces/${created.id}/files`, {
      method: "POST",
      headers: { cookie: cookies.guest },
      body: form,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  // U4: a route handler takes a body just under the limit with no config, and refuses one over it.
  it("stores a file just under 5 MB and serves back the same bytes", async () => {
    const bytes = new Uint8Array(randomBytes(Math.floor(4.9 * 1024 * 1024)));
    const res = await upload(bytes, "big.bin", "application/octet-stream");
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty("content");

    const download = await fetch(`${server.url}/api/files/${res.body._id}`, { headers: { cookie: cookies.host } });
    expect(download.status).toBe(200);
    expect(Buffer.from(await download.arrayBuffer()).equals(Buffer.from(bytes))).toBe(true);
  });

  it("refuses a file over 5 MB", async () => {
    const res = await upload(new Uint8Array(Math.ceil(5.1 * 1024 * 1024)), "too-big.bin", "application/octet-stream");
    expect(res.status).toBe(413);
  });

  it("lists files without their bytes", async () => {
    const res = await api(`/api/workspaces/${created.id}`, { cookie: cookies.host });
    expect(res.body.files.length).toBeGreaterThan(0);
    for (const file of res.body.files) expect(file).not.toHaveProperty("content");
  });
});
