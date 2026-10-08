import { describe, expect, it } from "vitest";
import { MAX_QUERY_LENGTH, cleanSearchQuery } from "./search";

describe("cleanSearchQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanSearchQuery("  wifi \n  pw ")).toBe("wifi pw");
  });

  it("caps the length", () => {
    expect(cleanSearchQuery("x".repeat(MAX_QUERY_LENGTH + 50))).toHaveLength(MAX_QUERY_LENGTH);
  });

  // An empty box must never fire a request: each one costs an embedding.
  it.each(["", "   ", "\n\t", null, undefined, 42])("returns null for %j", (input) => {
    expect(cleanSearchQuery(input)).toBeNull();
  });
});
