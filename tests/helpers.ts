import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";

// Starts the real server.js in production mode, exactly as Render runs it. Production mode also
// takes no dev lock, so these tests run while someone has `pnpm dev` open.

export type RunningServer = { child: ChildProcess; url: string };

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

export async function startServer(extraArgs: string[], env: Record<string, string>): Promise<RunningServer> {
  if (!existsSync(".next/BUILD_ID")) {
    throw new Error("No production build. Run `pnpm test:integration`, which builds first.");
  }
  const port = await freePort();
  const child = spawn(process.execPath, [...extraArgs, "server.js"], {
    env: { ...process.env, ...env, PORT: String(port), NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  await new Promise<void>((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes("> Ready on port")) resolve();
    };
    child.stdout!.on("data", onData);
    child.stderr!.on("data", onData);
    child.once("exit", (code) => reject(new Error(`server.js exited with ${code} before ready:\n${output}`)));
  });

  return { child, url: `http://localhost:${port}` };
}

export async function stopServer(child?: ChildProcess) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await exited;
}
