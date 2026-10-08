import { defineConfig } from "vitest/config";

// Unit tests: pure functions in lib/ only. No database, no server.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
