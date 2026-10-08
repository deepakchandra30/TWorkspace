import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Guards the lint rule that keeps lib/ pure. If the rule is dropped or its glob drifts, this goes red.
const eslint = new ESLint();

async function restrictedImportErrors(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports");
}

describe("lib/ import boundary", () => {
  it.each(["next/server", "react", "mongodb", "socket.io"])("rejects %s inside lib/", async (source) => {
    const errors = await restrictedImportErrors(`import x from "${source}";\nexport default x;\n`, "lib/example.ts");
    expect(errors).toHaveLength(1);
  });

  it("allows the same import outside lib/", async () => {
    const errors = await restrictedImportErrors(`import x from "mongodb";\nexport default x;\n`, "server/example.ts");
    expect(errors).toHaveLength(0);
  });

  it("allows node built-ins inside lib/", async () => {
    const errors = await restrictedImportErrors(`import { randomInt } from "node:crypto";\nexport default randomInt;\n`, "lib/example.ts");
    expect(errors).toHaveLength(0);
  });
});
