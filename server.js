// Custom server: Next.js and Socket.IO share one HTTP server, so Render serves one URL.
// Plain JavaScript on purpose: this file does not go through the Next.js compiler.
import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
import { connectDb } from './server/db.js';
import { SESSION_COOKIE, findMember, parseCookie } from './server/auth.js';

const dev = process.env.NODE_ENV !== 'production';
const port = Number.parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

await app.prepare();
// Only available once prepare() has run.
const handleNextUpgrade = app.getUpgradeHandler();

const httpServer = createServer((req, res) => handle(req, res));
const io = new Server(httpServer);

// Route handlers reach sockets through this, since Next bundles them apart from this file.
globalThis.__workspaceIo = io;

// Socket.IO and Next's dev reload socket both upgrade on this port. Send each upgrade to its
// owner; otherwise Socket.IO drops every upgrade that isn't its own.
httpServer.removeAllListeners('upgrade');
httpServer.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/socket.io/')) io.engine.handleUpgrade(req, socket, head);
  else handleNextUpgrade(req, socket, head);
});

// A socket with a valid session cookie joins its workspace's room. Without one it still connects,
// for the health ping, but joins no room and so receives nothing.
io.use(async (socket, nextMiddleware) => {
  try {
    const token = parseCookie(socket.request.headers.cookie, SESSION_COOKIE);
    const member = token ? await findMember(await connectDb(), token) : null;
    if (member) {
      socket.data.member = { id: String(member._id), nickname: member.nickname, role: member.role };
      socket.join(String(member.workspaceId));
    }
    nextMiddleware();
  } catch (err) {
    nextMiddleware(err);
  }
});

io.on('connection', (socket) => {
  socket.on('health:ping', (ack) => {
    if (typeof ack === 'function') ack('pong');
  });
});

// One change stream for the whole app (the Free tier allows 5). New documents fan out to the
// room named after their workspaceId. Secrets and file bytes never travel through sockets.
const EVENTS = { messages: 'message:new', members: 'member:joined', files: 'file:new', fileVersions: 'file:updated' };

async function watchDatabase() {
  let stream;
  try {
    const db = await connectDb();
    stream = db.watch([
      { $match: { operationType: 'insert', 'ns.coll': { $in: Object.keys(EVENTS) } } },
      { $project: { 'fullDocument.tokenHash': 0, 'fullDocument.content': 0 } },
    ]);
  } catch (err) {
    console.error('change stream: database unreachable, retrying in 5 s:', err.message);
    setTimeout(watchDatabase, 5_000);
    return;
  }

  stream.on('change', (event) => {
    const doc = event.fullDocument;
    if (doc?.workspaceId) io.to(String(doc.workspaceId)).emit(EVENTS[event.ns.coll], doc);
  });
  stream.on('error', (err) => {
    console.error('change stream error, restarting in 1 s:', err.message);
    stream.close().catch(() => {});
    setTimeout(watchDatabase, 1_000);
  });
}

httpServer.listen(port, () => {
  console.log(`> Ready on port ${port} (${dev ? 'development' : 'production'})`);
  watchDatabase();
});
