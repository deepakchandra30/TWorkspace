# Workspace PRD (final)

Oct 3, 2026 · @deepak

A temporary workspace anyone can join by QR or PIN with no account. Files open in a large viewer, chat sits beside them, messages reference files with `@`, and everyone sees the full history whenever they join. The workspace lives up to 48 hours, then MongoDB deletes it. Public link and submission due 16:00.

## 1. Scope

**Problem:** teams at hackathons, workshops and study sessions share files, screenshots and links through WhatsApp groups (exposing phone numbers) or AirDrop (Apple only), and the content lives on strangers' phones forever.

**Product:** a workspace, not an event room. A host creates it with a lifetime of 1 to 48 hours and can extend it up to 48 hours in total. Anyone with the QR or PIN joins with a nickname only.

**Rules:**

- Whenever someone joins, they see the full chat and every file, paged as they scroll back.
- When the lifetime ends or the host closes the workspace, it is hidden at once and TTL deletes every document within about 60 seconds.

**The one workflow for the demo:** join by QR → open a file in the viewer → chat about it with `@file` references → paste a screenshot → host closes the workspace → deletion receipt reaches 0.

**Not in the MVP:** accounts, Ask the room (AI), files over 5 MB, live co-editing, lifetimes over 48 hours. All are listed in section 9 as next steps.

## 2. Interface

Two layout modes and a chat-side switch, saved per member; on phones under 768 px the panels become Files and Chat tabs.

| Setting | Option | Layout on desktop |
| --- | --- | --- |
| Mode | **Files focus** | File list (240 px) + file viewer (wide) + chat (320 px) |
| Mode | **Chat focus** (default) | File list (240 px) + chat (wide); clicking a file opens it in a panel over the chat |
| Chat side | Right (default) or left | Swaps the chat and file panels |

**File viewer (Google Docs feel, GitHub-style rendering):**

- The opened file fills the main pane with a top bar: name, uploader, size, time, Download, Copy `@` reference, and "Mentioned in N messages".
- Images: full size with zoom; also inline in chat.
- PDF: browser PDF viewer.
- Code: line numbers and syntax highlighting.
- Markdown: rendered, with a Source toggle.
- CSV: table view.
- Text, Markdown and code are editable in place: Save creates a new version, and everyone's viewer updates live. Version history shows who saved when.
- Anything else: icon, details, Download.

**Chat:**

- Type `@` to open a file picker that matches as you type. The message stores the reference, which renders as a chip; clicking the chip opens the file.
- Paste a screenshot (Ctrl+V or Cmd+V) or drop an image into the input to upload it and post it inline, as in GitHub comments.
- Scrolling up loads older messages until the start of the workspace.

**Header:** workspace name, PIN, QR button, people count, countdown to deletion, Extend (host), Close workspace (host).

**Safety:** HTML and SVG files are shown as source code, never rendered as pages. Markdown output is sanitised. Files are served with `X-Content-Type-Options: nosniff`.

## 3. Requirements

P0 must work on the public link at 16:00; P1 only after every P0 check passes.

| # | Requirement | Priority |
| --- | --- | --- |
| R1 | Host creates a workspace: name, lifetime 1 to 48 h; gets PIN, QR and host token | P0 |
| R2 | Join by QR link or PIN with a nickname; no email, phone or password | P0 |
| R3 | Layout: Files focus and Chat focus modes, chat left or right, phone tabs (section 2) | P0 |
| R4 | Real-time chat; full history for any joiner, loaded 50 at a time on scroll | P0 |
| R5 | Upload any file type up to 5 MB; shows in everyone's file list within 2 s | P0 |
| R6 | File viewer for images, PDF, code, Markdown, text; download for the rest | P0 |
| R7 | `@` file references in chat, with chips that open the file | P0 |
| R8 | Paste or drop a screenshot into chat | P0 |
| R9 | Host closes the workspace, or its lifetime ends: hidden at once, TTL deletes it within about 60 s | P0 |
| R10 | Deletion receipt: document counts per collection falling to 0 | P0 |
| R11 | Host extends lifetime, capped at 48 h from creation | P1 |
| R12 | Edit text, Markdown and code files in place, with versions | P1 |
| R13 | "Mentioned in N messages" backlinks on each file | P1 |
| R14 | Export chat as Markdown | P1 |
| R15 | CSV table view; host lock and kick | P1 |

## 4. MongoDB features showcased

Every feature listed in the event guide does a visible job in the product; each row is something you can point at during the demo.

| Feature | What it does in the product | What to say to judges |
| --- | --- | --- |
| Document model | A workspace's members, messages, files and versions as documents keyed by `workspaceId`; member layout preferences stored on the member document | One query loads a workspace; a new field is just a new field |
| TTL indexes | One `expiresAt` copied onto every document; closing or extending is one `updateMany` per collection | Deletion is done by the database, with no cron job and no cascade code |
| Change streams | One stream pushes new messages, files, file versions and deletions to every browser | Live updates come from the database itself; also drives the deletion receipt |
| Atlas Search (autocomplete) | The `@` file picker: fuzzy, as-you-type matches on file names within the workspace | Typo-tolerant search in about 10 lines of pipeline |
| Aggregation | Backlinks ("Mentioned in N messages"), deletion receipt counts, the people count | Read-time joins and counts without extra tables |
| Schema validation | Messages must have `workspaceId`, `expiresAt`, text up to 4,000 characters; files capped at 5 MB | The database rejects bad writes, not only the API |
| Unique indexes | One PIN per live workspace; one nickname per workspace; one token per member | Duplicates are impossible, even under race conditions |
| Versioning pattern | Each save of a text file inserts a version document; the file points at the latest | Full edit history for free, and it expires with everything else |

Keep within the Free cluster's limits: 3 Search indexes in total (this plan uses 1), 5 change streams (this plan uses 1), 0.5 GB of storage.

## 5. Technical design

One Node.js service serves the API, Socket.IO and the built React app, so there is one public URL.

**Stack:** Node.js, Express, Socket.IO, MongoDB Node driver, `multer`; React with Vite; `qrcode`, `highlight.js`, `marked` with `DOMPurify`, `papaparse` (CSV). PDFs use the browser viewer.

**Collections** (each document has `workspaceId` and the workspace's `expiresAt`; TTL index `{expiresAt: 1}`, `expireAfterSeconds: 0` on all)

| Collection | Key fields | Other indexes |
| --- | --- | --- |
| `workspaces` | `name, pin, joinSecret, hostTokenHash, status (open, closed), createdAt, maxExpiresAt` | unique `{pin: 1}` |
| `members` | `nickname, tokenHash, role, prefs {mode, chatSide}` | unique `{tokenHash: 1}`, unique `{workspaceId: 1, nickname: 1}` |
| `messages` | `memberId, nickname, text, refs [{fileId, filename}], imageFileId, createdAt` | `{workspaceId: 1, createdAt: -1}`, `{"refs.fileId": 1}`; schema validation |
| `files` | `uploaderId, filename, mime, size, data (BinData), latestVersion, createdAt` | `{workspaceId: 1, createdAt: -1}`; Search index with `autocomplete` on `filename`, `token` on `workspaceId` |
| `fileVersions` | `fileId, version, text, savedBy, savedAt` | unique `{fileId: 1, version: 1}` |

The file list query projects out `data`, so it never loads file bytes.

**API routes** (all except create and join need the session cookie)

| Route | Does |
| --- | --- |
| `POST /api/workspaces` | Create; set host cookie; return PIN and QR URL |
| `POST /api/join` | PIN or joinSecret plus nickname; 5 attempts per minute per IP |
| `GET /api/workspaces/:id` | Workspace, member count, file list, newest 50 messages |
| `GET /api/workspaces/:id/messages?before=<date>` | Older 50 messages (history paging) |
| `POST /api/workspaces/:id/messages` | Text plus `refs[]` |
| `POST /api/workspaces/:id/files` | Upload up to 5 MB (also used by screenshot paste) |
| `GET /api/files/:id` | Stream with stored `mime`; `?download=1` for attachment |
| `GET /api/workspaces/:id/files/search?q=` | `$search` autocomplete for the `@` picker |
| `PUT /api/files/:id` | Save a new text version (P1) |
| `GET /api/files/:id/backlinks` | Messages that reference the file (P1) |
| `PATCH /api/workspaces/:id/prefs` | Save layout mode and chat side |
| `POST /api/workspaces/:id/extend` and `/close` | Host only; update `expiresAt` on every collection |
| `GET /api/workspaces/:id/receipt` | Counts per collection |

**Live events:** one change stream on the database (inserts, updates, deletes on `messages`, `files`, `fileVersions`, `members`). The server emits `message:new`, `file:new`, `file:updated`, `member:joined`, `workspace:closed`, `receipt:update` to the Socket.IO room named after `workspaceId`.

**`@` picker query:** `$search` with `compound: { must: [autocomplete on filename, fuzzy maxEdits 1], filter: [equals workspaceId] }`, limit 8.

**If you use B2 later instead of storing files in Atlas:** private bucket; key `workspaceId/fileId`; serve via the server or 5-minute signed URLs; delete the prefix on close or expiry, plus a 2-day lifecycle rule as a backstop.

## 6. Hosting and the public link

Host the app as one Render free web service and the data on an Atlas Free cluster. Total cost is $0, and you don't need student credits for today.

**Atlas (do this first, about 10 minutes)**

1. In Atlas, create a project and a Free cluster in an EU region.
2. Database Access: add a user with a long generated password.
3. Network Access: add `0.0.0.0/0`. Render's free tier has no fixed IP, so this is the quick route for today; the password protects the cluster. Restrict it after the event.
4. Copy the connection string into `MONGODB_URI` in `.env` (in `.gitignore`) and in Render's environment variables.
5. Create the TTL, unique and Search indexes from a `setup.js` script, so setup can be repeated, as the event guide asks.

**Render (deploy a hello-world by 13:30, then redeploy as you go)**

1. Push the repo to GitHub.
2. In Render: New → Web Service → connect the repo → instance type Free.
3. Build command `npm install && npm run build`; start command `node server.js`. Express serves `client/dist` and the API from the same origin, so there are no CORS issues. Read the port from `process.env.PORT`.
4. Add `MONGODB_URI` and `SESSION_SECRET` as environment variables.
5. Your public link is `https://<service-name>.onrender.com`. Each push to `main` redeploys.

**Render free-tier facts that affect the demo** ([Render docs](https://render.com/docs/free)):

- A free service spins down after 15 minutes with no HTTP request or WebSocket message, and the first request after that waits while it starts. Open the link 5 minutes before judging and keep a tab connected.
- Each workspace gets 750 free instance hours a month, which is plenty for today.
- WebSockets are supported, so Socket.IO works.

**Student credits**

- MongoDB gives $50 of Atlas credit through the [GitHub Student Developer Pack](https://www.mongodb.com/students). Verify at education.github.com/pack, then sign in at mongodb.com/students with GitHub and apply the code to your Atlas organisation's billing.
- Pack verification can take longer than a day, so don't depend on it today. The Free cluster covers this build.
- Use credits later for an M10 cluster: 100 change streams instead of 5 ([limits](https://www.mongodb.com/docs/atlas/atlas-ui/triggers/limitations/)), and no 100 operations-per-second cap. Check the Atlas pricing page for the hourly rate.
- Ask the MongoDB engineers on site whether event credits are available.

## 7. Phased MVP plan

Six phases, each ending in something that works on the public link, so if time runs out you submit the last finished phase rather than a half-built one.

**Rules for the day**

- A phase is done only when its exit check passes on the Render URL, not on localhost.
- Push and redeploy at the end of every phase.
- At each cut-line time, if the phase is not done, apply its cut and move on.
- Features freeze at 15:15. After that, fix bugs only.

| Phase | Time | Ends with | Main MongoDB features |
| --- | --- | --- | --- |
| 0. Foundations | 12:55 to 13:15 | Public URL answers `/health` with a database ping | Indexes, TTL, schema validation |
| 1. Walking skeleton | 13:15 to 14:00 | Two phones join by QR and chat live | Unique indexes, change stream |
| 2. Files | 14:00 to 14:40 | A pasted screenshot and a PDF show on the other phone | Document model, BinData |
| 3. Differentiators | 14:40 to 15:15 | `@` picker, layout modes, close and deletion receipt | Atlas Search, aggregation, TTL |
| 4. Harden | 15:15 to 15:40 | All section 8 checks pass |  |
| 5. Ship | 15:40 to 16:00 | Submitted, with README and backup video |  |

### Phase 0: Foundations (12:55 to 13:15)

**Person A**

- Create the GitHub repo with `server/` and `client/` folders and `.gitignore` covering `.env` and `node_modules`.
- Create the Atlas Free cluster, database user and network access (section 6).
- Write and run `setup.js` (code at the end of this section).
- Minimal Express app: `GET /health` runs `db.command({ping: 1})` and returns `ok`.
- Create the Render web service and set its environment variables.

**Person B**

- `npm create vite@latest client -- --template react`.
- App shell: header bar, file panel, main pane, chat panel as CSS grid.
- Mode classes `files-focus` and `chat-focus`, a `chat-left` class, and tabs under 768 px. Use static placeholder content for now.

**Exit check:** `https://<name>.onrender.com/health` returns `ok` from the database.

**Cut line (13:15):** if the Search index won't create from the script, create it in the Atlas UI later; don't block on it.

### Phase 1: Walking skeleton (13:15 to 14:00, over lunch)

**Person A**

- `POST /api/workspaces`: PIN from `crypto.randomInt(0, 1e6)` padded to 6 digits, retrying on duplicate key; `joinSecret` and host token from `crypto.randomBytes`; store SHA-256 hashes only; set `expiresAt` to now plus the chosen hours (maximum 48).
- `POST /api/join`: find an open workspace by PIN or `joinSecret`; insert the member; set an `HttpOnly`, `Secure`, `SameSite=Lax` cookie; return 409 if the nickname is taken; rate limit 5 per minute per IP (`express-rate-limit`).
- Auth middleware: cookie → hash → member → `workspaceId`. Every query filters on `workspaceId` and `expiresAt > now`.
- `GET /api/workspaces/:id` and `GET …/messages?before=` (newest first, limit 50).
- `POST …/messages`.
- One change stream feeding Socket.IO rooms; socket auth reads the same cookie.

**Person B**

- Create screen (name, lifetime slider 1 to 48 h) → shows the QR (`qrcode`) and PIN.
- Join screen at `/j/:secret` and a PIN screen at `/`.
- Chat: list and input, socket listener for `message:new`, load older messages when scrolled to the top, auto-scroll for new messages.

**Exit check:** two phones on mobile data join by QR and exchange messages in under 1 second.

**Cut line (14:00):** drop the PIN entry screen and keep QR-only join; drop rate limiting until Phase 4.

### Phase 2: Files (14:00 to 14:40)

**Person A**

- `POST …/files` with `multer` memory storage, `limits.fileSize` 5 MB; store `data` as BinData with `mime`, `size`, `filename`; reject over-size files with 413 and a clear message.
- `GET /api/files/:id`: auth check, then send `data.buffer` with `Content-Type` from `mime`, `X-Content-Type-Options: nosniff`, and `Content-Disposition: attachment` when `?download=1` or when `mime` is HTML or SVG.
- File list query projects out `data`. The change stream projects out `fullDocument.data` too, so 5 MB files never travel through sockets.

**Person B**

- Upload by button and drag-drop; paste handler on the chat input for clipboard images, which uploads then posts a message with `imageFileId`.
- File list with type icons, uploader and size; `file:new` updates it live.
- Viewer by `mime`: `<img>` for images; `<iframe>` for PDF; `highlight.js` with line numbers for code; `marked` plus `DOMPurify` for Markdown, with a Source toggle; `<pre>` for text; icon and Download button for the rest.

**Exit check:** a screenshot pasted on the laptop appears inline on both phones in under 2 seconds; a PDF opens on a phone.

**Cut line (14:40):** keep images, PDF and download; show code and Markdown as plain `<pre>`.

### Phase 3: Differentiators (14:40 to 15:15)

**Person A**

- `GET …/files/search?q=` running the `@` pipeline below.
- `PATCH …/prefs`: `$set` on `members.prefs`.
- `POST …/close`: the close code below; then a server interval that counts each collection for that workspace every 3 seconds and emits `receipt:update` to the room until every count is 0. Sockets stay open after the member documents are deleted, so the receipt needs no auth.
- `POST …/extend`: new `expiresAt` = the earlier of (current + chosen hours) and (`createdAt` + 48 h), applied to every collection.

**Person B**

- `@` picker: on `@` in the input, query search with 150 ms debounce; arrow keys and Enter select; insert a chip; send `refs: [{fileId, filename}]` with the message.
- Messages render refs as chips; clicking a chip opens the file in the viewer.
- Layout switches call the prefs route; apply saved prefs on load.
- Header countdown from `expiresAt`; Close (with a confirm step) and Extend for the host.
- Deletion receipt overlay: one row per collection, the number falling live, and a "Workspace deleted" state at 0.

**Exit check:** the full demo workflow in section 1 runs on the public link without a reload.

**Cut line (15:15):** drop Extend. If the Search index is not ready, the picker falls back to a `^prefix` regex on `filename`; keep the Search code in the repo and explain it.

### Phase 4: Harden (15:15 to 15:40)

- Run every check in section 8 on the public link; fix only failures.
- On socket reconnect, refetch the newest 50 messages and the file list, so a phone that slept catches up.
- Error messages for: file too large, wrong PIN, nickname taken, workspace closed.
- `seed.js` creates the demo workspace: 4 files (PDF, screenshot, code file, Markdown) and 15 messages with two `@` references, lifetime 48 h.
- Open the Render URL to keep it awake; check portrait layout on both phones.

### Phase 5: Ship (15:40 to 16:00)

- README: problem, public link, how to run (`setup.js`, `seed.js`), the MongoDB features table from section 4, one challenge (change streams carrying 5 MB files until we projected `data` out, and the Free cluster's 5-stream limit), and next steps from section 9.
- Submit by 15:50, leaving 10 minutes of buffer.
- Record a 90-second backup video of the demo path.
- Rehearse the 3-minute demo once: problem, join by QR, `@` reference, screenshot, close, receipt to 0.

### Stretch (only if the Phase 3 exit check passed by 15:00)

1. Mention counts on every file in one aggregation (below).
2. Edit text, Markdown and code files with versions.
3. CSV table view.
4. Export chat as Markdown.

### Key code

**`setup.js`** (run once; repeatable)

```javascript
import { MongoClient } from 'mongodb';
const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db('workspace');
const colls = ['workspaces', 'members', 'messages', 'files', 'fileVersions'];
const existing = (await db.listCollections().toArray()).map(c => c.name);
for (const name of colls) {
  if (!existing.includes(name)) await db.createCollection(name);
  await db.collection(name).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
await db.collection('workspaces').createIndex({ pin: 1 }, { unique: true });
await db.collection('members').createIndex({ tokenHash: 1 }, { unique: true });
await db.collection('members').createIndex({ workspaceId: 1, nickname: 1 }, { unique: true });
await db.collection('messages').createIndex({ workspaceId: 1, createdAt: -1 });
await db.collection('messages').createIndex({ 'refs.fileId': 1 });
await db.collection('files').createIndex({ workspaceId: 1, createdAt: -1 });
await db.collection('fileVersions').createIndex({ fileId: 1, version: 1 }, { unique: true });
await db.command({
  collMod: 'messages',
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['workspaceId', 'nickname', 'createdAt', 'expiresAt'],
    properties: {
      text: { bsonType: 'string', maxLength: 4000 },
      expiresAt: { bsonType: 'date' }
    }
  } }
});
await db.collection('files').createSearchIndex({
  name: 'files_autocomplete',
  definition: { mappings: { dynamic: false, fields: {
    filename: [{ type: 'autocomplete', tokenization: 'edgeGram', minGrams: 2, maxGrams: 20 }],
    workspaceId: { type: 'objectId' }
  } } }
});
await client.close();
```

**Change stream** (inserts only, so close and extend updates never flood the sockets)

```javascript
const events = { messages: 'message:new', files: 'file:new', fileVersions: 'file:updated', members: 'member:joined' };
function watch() {
  const stream = db.watch([
    { $match: { operationType: 'insert', 'ns.coll': { $in: Object.keys(events) } } },
    { $project: { 'fullDocument.data': 0, 'fullDocument.tokenHash': 0 } }
  ]);
  stream.on('change', ev => {
    io.to(String(ev.fullDocument.workspaceId)).emit(events[ev.ns.coll], ev.fullDocument);
  });
  stream.on('error', () => setTimeout(watch, 1000));
}
watch();
```

**`@` file search**

```javascript
db.collection('files').aggregate([
  { $search: { index: 'files_autocomplete', compound: {
    must: [{ autocomplete: { query: q, path: 'filename', fuzzy: { maxEdits: 1 } } }],
    filter: [{ equals: { path: 'workspaceId', value: workspaceId } }]
  } } },
  { $limit: 8 },
  { $project: { filename: 1, mime: 1, size: 1 } }
]);
```

**Close workspace**

```javascript
const now = new Date();
await db.collection('workspaces').updateOne({ _id: workspaceId }, { $set: { status: 'closed', expiresAt: now } });
await Promise.all(['members', 'messages', 'files', 'fileVersions'].map(c =>
  db.collection(c).updateMany({ workspaceId }, { $set: { expiresAt: now } })));
io.to(String(workspaceId)).emit('workspace:closed');
```

**Mention counts for every file** (stretch)

```javascript
db.collection('messages').aggregate([
  { $match: { workspaceId } },
  { $unwind: '$refs' },
  { $group: { _id: '$refs.fileId', mentions: { $sum: 1 } } }
]);
```

## 8. Acceptance checks

Run on the public Render link with two phones and a laptop.

- [ ] Scan the QR, enter a nickname, land in the workspace in under 10 seconds
- [ ] A message on phone 1 shows on phone 2 in under 1 second
- [ ] A pasted screenshot shows inline on every device in under 2 seconds
- [ ] A PDF, a code file and a Markdown file each open in the viewer
- [ ] Typing `@sli` in chat suggests `slides.pdf`; the chip opens it
- [ ] Switching Files focus and Chat focus, and moving chat left or right, works; it is still set after a reload
- [ ] Someone joining 30 minutes in can scroll back to the first message
- [ ] Close workspace: hidden for everyone at once; receipt reaches 0 in every collection within 90 seconds
- [ ] **Hard case:** a 6 MB upload is rejected with a clear message
- [ ] **Hard case:** a wrong PIN 6 times in a minute is blocked

## 9. Next steps: how it scales

Every growth step keeps `workspaceId` as the unit, so the data model holds from one demo workspace to thousands.

| Next step | What changes | MongoDB feature |
| --- | --- | --- |
| Ask the workspace | Questions answered from chat and files, with citations | Automated Embedding and Vector Search filtered by `workspaceId`; hybrid with `$rankFusion` |
| More app servers | Run several Node instances behind a load balancer | [Socket.IO MongoDB adapter](https://socket.io/docs/v4/mongo-adapter/), which broadcasts between servers using change streams; M10 or larger for 100 change streams |
| Many workspaces | Spread load across shards | Shard on `{workspaceId: 1}` on a dedicated cluster |
| Large files | Files over 5 MB | Private B2 or S3 bucket; metadata, references and expiry stay in MongoDB |
| Longer lifetimes | Paid workspaces lasting days or weeks | Same TTL design, different `expiresAt` |
| Live co-editing | Several people editing one file at once | Change streams on `fileVersions` |
| Sensitive workspaces | Encrypted messages | Queryable Encryption, at the cost of search on those fields |
| Organiser analytics | Join rate, busiest hours | Time series collection |

## Sources

- [Render: Deploy for Free (spin-down, 750 hours)](https://render.com/docs/free)
- [Render changelog: WebSocket messages keep free services awake](https://render.com/changelog/free-web-services-now-remain-active-while-receiving-websocket-messages)
- [MongoDB for Students ($50 Atlas credit via GitHub Student Developer Pack)](https://www.mongodb.com/students)
- [Atlas Free Cluster Limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)
- [Atlas change stream limits per tier](https://www.mongodb.com/docs/atlas/atlas-ui/triggers/limitations/)
- [TTL Indexes](https://www.mongodb.com/docs/manual/core/index-ttl/)
- [Socket.IO MongoDB adapter](https://socket.io/docs/v4/mongo-adapter/)
- Event guide: MongoDB × Give(a)Go Student Builder Day, 3 October 2026
