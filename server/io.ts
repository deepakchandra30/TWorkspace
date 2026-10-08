import type { Server } from "socket.io";

// The Socket.IO server that server.js puts on globalThis. Route handlers are bundled apart from
// server.js, so this is how they reach the sockets. Undefined when a route runs without server.js.
export function getIo(): Server | undefined {
  return (globalThis as { __workspaceIo?: Server }).__workspaceIo;
}
