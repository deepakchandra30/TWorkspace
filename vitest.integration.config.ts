import { defineConfig } from "vitest/config";

// Integration tests start the real server.js, so they get long timeouts and run one file at a time.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.integration.test.ts"],
    testTimeout: 90_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
