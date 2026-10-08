import { describe, expect, it } from "vitest";
import {
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_NICKNAME_LENGTH,
  cleanMessageText,
  cleanNickname,
  cleanWorkspaceName,
} from "./input";

const cases = [
  { name: "cleanNickname", clean: cleanNickname, max: MAX_NICKNAME_LENGTH },
  { name: "cleanWorkspaceName", clean: cleanWorkspaceName, max: MAX_NAME_LENGTH },
  { name: "cleanMessageText", clean: cleanMessageText, max: MAX_MESSAGE_LENGTH },
];

describe.each(cases)("$name", ({ clean, max }) => {
  it("trims surrounding whitespace", () => {
    expect(clean("  Aoife  ")).toBe("Aoife");
  });

  it("accepts exactly the maximum length and rejects one more", () => {
    expect(clean("a".repeat(max))).toBe("a".repeat(max));
    expect(clean("a".repeat(max + 1))).toBeNull();
  });

  it.each(["", "   ", null, undefined, 42, {}])("rejects %j", (input) => {
    expect(clean(input)).toBeNull();
  });
});
