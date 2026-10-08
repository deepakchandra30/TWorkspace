# How Workspace uses MongoDB

**A workspace for temporary teams: join by QR, share files, chat, search by meaning. When it closes, MongoDB deletes everything, and we never wrote the code that deletes a workspace.**

## TTL: everything has an expiry date

- **What it does:** every workspace, member, message and file carries the workspace's `expiresAt`. A TTL index on each collection deletes a document once that time passes.
- **Code:** `scripts/setup.js`, `createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })`, once per collection.
- **Closing deletes nothing.** It moves `expiresAt` to now on every collection: `app/api/workspaces/[id]/close/route.ts`.
- **It vanishes at once.** Every query filters on `expiresAt > now`, so the workspace is hidden immediately. MongoDB's TTL task then runs [every 60 seconds](https://www.mongodb.com/docs/manual/core/index-ttl/) and removes it. The receipt counts the remaining documents per collection, live, every 3 s.
- **Say:** "Closing a workspace just moves its expiry date to now. MongoDB does the deleting."

## Indexes and validation

- **Unique PIN** among live workspaces, so two open workspaces can never share a PIN.
- **Unique nickname** per workspace.
- **A schema validator caps files at 5 MB.** The database refuses a bigger file even if the app let one through.
- **Say:** "The rules live in the database, not just in our code."

## Change streams: live without a message broker

- **What it does:** one `db.watch()` on inserts, in `server.js`, pushes every new message, file and member to that workspace's phones through Socket.IO.
- **What it hides:** file bytes and token hashes are stripped before anything leaves the server.
- **Say:** "MongoDB tells us when something is new. There's no Redis and no Pusher."

## Search by meaning, inside MongoDB

- **The index:** a vector index with `autoEmbed` and the `voyage-4` model, in `scripts/setup.js`. Atlas creates the embeddings itself, on insert and at query time.
- **The query:** `$vectorSearch` takes plain text, and `$rankFusion` combines it with keyword search (`app/api/workspaces/[id]/search/route.ts`).
- **Measured live, 15:40:** "wifi pw" returned "the network password is hunter2" first, answered by hybrid search, and it was findable within 9 s of being posted.
- **Say:** "No embedding API and no key in our code. Atlas embeds the text and searches it."
- **The vectors go with the data. Measured live, 16:49:** 8 s after a workspace was closed, its documents counted 0 and a vector search for "wifi pw" in it returned nothing.
- **Scope:** chat messages only. Files aren't searched.

## One database for five services

| Instead of | We used |
| --- | --- |
| File storage (S3) | Files inside documents: text as UTF-8, binary as base64 (`lib/content.ts`) |
| Search engine (Elasticsearch) | Atlas Search |
| Vector database plus embedding API | Atlas Vector Search with `autoEmbed` |
| Messaging (Pusher or Redis) | Change streams |
| Cleanup cron job | TTL indexes |

**Cost:** an Atlas M0 free cluster and a Render free service. The card on Atlas only raises the embedding limit from 3 to 2,000 queries a minute, and it stays $0 within the [200M free tokens per model](https://www.mongodb.com/docs/vector-search/crud-embeddings/automated-embedding/models/).

**Scale:** the same code runs unchanged on a bigger cluster. The free tier is the limit, not the design.

## The real limits for a room joining by QR

| Limit | Number | What it means |
| --- | --- | --- |
| Our wrong-PIN block | 5 a minute per IP | Wrong PINs only. QR joins are never blocked |
| Atlas M0 throughput | [100 operations a second](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) | A join costs about 9 database operations, so about 11 joins a second. Over that, Atlas queues them: slower, not failing. 50 people scanning in one minute is about 8 a second |
| Atlas connections | [500](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) | Not the limit: the server uses one pool of 20, however many people join |
| Search | 2,000 a minute | With the card on Atlas |
| Render free | Sleeps after [15 minutes without traffic](https://render.com/docs/free), and takes about a minute to wake | Open the URL before going on stage |
