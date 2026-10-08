// Creates collections, TTL and query indexes, validators and the search indexes: `pnpm db:setup`
// Safe to re-run: every step either creates what is missing or leaves it as it is.
import { connectDb, closeDb, COLLECTIONS } from '../server/db.js';

// 5 MB per file, measured on the raw bytes before any encoding.
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const validators = {
  messages: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['workspaceId', 'nickname', 'createdAt', 'expiresAt'],
      properties: {
        text: { bsonType: 'string', maxLength: 4000 },
        expiresAt: { bsonType: 'date' },
      },
    },
  },
  // Text files are stored as UTF-8 text, binary files as base64 (assets/PLAN.md, File storage).
  files: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['workspaceId', 'filename', 'mime', 'size', 'encoding', 'content', 'expiresAt'],
      properties: {
        encoding: { enum: ['utf8', 'base64'] },
        content: { bsonType: 'string' },
        size: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: MAX_FILE_BYTES },
        expiresAt: { bsonType: 'date' },
      },
    },
  },
};

const indexes = {
  workspaces: [[{ pin: 1 }, { unique: true }]],
  members: [
    [{ tokenHash: 1 }, { unique: true }],
    [{ workspaceId: 1, nickname: 1 }, { unique: true }],
  ],
  messages: [[{ workspaceId: 1, createdAt: -1 }], [{ 'refs.fileId': 1 }]],
  files: [[{ workspaceId: 1, createdAt: -1 }]],
  fileVersions: [[{ fileId: 1, version: 1 }, { unique: true }]],
};

// Search indexes. The vector index `messages_semantic` is not created here: semantic search runs
// only if someone creates it by hand in Atlas, otherwise the search route falls back to keyword.
const searchIndexes = [
  {
    collection: 'files',
    name: 'files_autocomplete',
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          filename: [{ type: 'autocomplete', tokenization: 'edgeGram', minGrams: 2, maxGrams: 20 }],
          workspaceId: { type: 'objectId' },
        },
      },
    },
  },
  // The keyword half of $rankFusion: exact words, names, numbers.
  {
    collection: 'messages',
    name: 'messages_text',
    definition: {
      mappings: { dynamic: false, fields: { text: { type: 'string' }, workspaceId: { type: 'objectId' } } },
    },
  },
];

try {
  const db = await connectDb();
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const name of COLLECTIONS) {
    if (!existing.has(name)) await db.createCollection(name);
    if (validators[name]) await db.command({ collMod: name, validator: validators[name] });

    const collection = db.collection(name);
    // TTL: every document carries its workspace's expiresAt and is deleted at that time.
    await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    for (const [keys, options] of indexes[name] ?? []) await collection.createIndex(keys, options);
    console.log(`✓ ${name}`);
  }

  // The Free tier may refuse one of these from a script; the PRD's fallback is the Atlas UI.
  // Each is tried on its own, so one refusal doesn't stop the others.
  for (const { collection, ...index } of searchIndexes) {
    try {
      const found = await db.collection(collection).listSearchIndexes(index.name).toArray();
      if (found.length === 0) await db.collection(collection).createSearchIndex(index);
      console.log(`✓ search index ${index.name}${found.length ? ' (already there)' : ' (building)'}`);
    } catch (err) {
      console.warn(`! search index ${index.name} not created: ${err.message}`);
      console.warn('  Create it in the Atlas UI with the definition in scripts/setup.js.');
    }
  }
} catch (err) {
  console.error('Setup failed:', err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
