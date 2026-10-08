import { MongoClient, ServerApiVersion } from 'mongodb';

// Collection names, shared by setup.js, routes and the change stream.
export const COLLECTIONS = ['workspaces', 'members', 'messages', 'files', 'fileVersions'];

// Kept on globalThis, not module scope: Next bundles route handlers separately from
// server.js, so a module-level variable would give each its own pool.
const state = (globalThis.__workspaceMongo ??= { client: undefined, db: undefined, connecting: undefined });

// Connect once per process and reuse the pooled client everywhere.
export async function connectDb() {
  if (state.db) return state.db;
  // Concurrent first calls share one connection attempt instead of opening two pools.
  state.connecting ??= open().finally(() => {
    state.connecting = undefined;
  });
  return state.connecting;
}

async function open() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set (copy .env.example to .env)');

  const client = new MongoClient(uri, {
    // Stable API v1, but not strict: $search (the @ file picker) is outside the strict set.
    serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
    // Free-tier cluster allows 500 connections; keep the pool small.
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10_000,
  });

  try {
    await client.connect();
  } catch (err) {
    await client.close().catch(() => {});
    throw err;
  }
  state.client = client;
  state.db = client.db(process.env.MONGODB_DB || 'workspace');
  return state.db;
}

export function getDb() {
  if (!state.db) throw new Error('Database not connected; call connectDb() first');
  return state.db;
}

export function getClient() {
  if (!state.client) throw new Error('Database not connected; call connectDb() first');
  return state.client;
}

export async function closeDb() {
  await state.client?.close();
  state.client = undefined;
  state.db = undefined;
}
