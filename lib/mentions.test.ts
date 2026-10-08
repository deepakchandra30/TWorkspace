import { describe, expect, it } from "vitest";
import { filterFiles, insertMention, mentionAt, refsInText, splitMentions } from "./mentions";

describe("mentionAt", () => {
  it("finds the @ token ending at the caret", () => {
    expect(mentionAt("see @rep", 8)).toEqual({ start: 4, query: "rep" });
  });

  it("opens on a bare @ with an empty query", () => {
    expect(mentionAt("@", 1)).toEqual({ start: 0, query: "" });
  });

  it("uses the caret, not the end of the text", () => {
    expect(mentionAt("@sli and more", 4)).toEqual({ start: 0, query: "sli" });
  });

  it.each([
    ["an email address", "mail me@home", 12],
    ["no @ at all", "hello", 5],
    ["a space after the query", "@rep ", 5],
  ])("ignores %s", (_case, text, caret) => {
    expect(mentionAt(text, caret)).toBeNull();
  });
});

describe("insertMention", () => {
  it("replaces the token with the filename and a trailing space", () => {
    const result = insertMention("see @rep now", { start: 4, query: "rep" }, "report.pdf");
    expect(result).toEqual({ text: "see @report.pdf  now", caret: 16 });
  });
});

describe("filterFiles", () => {
  const files = [
    { _id: "1", filename: "slides.pdf" },
    { _id: "2", filename: "My Slides draft.md" },
    { _id: "3", filename: "notes.md" },
  ];

  it("puts prefix matches before matches inside the name, ignoring case", () => {
    expect(filterFiles(files, "SLI").map((f) => f._id)).toEqual(["1", "2"]);
  });

  it("returns everything up to the limit for an empty query", () => {
    expect(filterFiles(files, "", 2)).toHaveLength(2);
  });

  it("returns nothing when no name matches", () => {
    expect(filterFiles(files, "zzz")).toEqual([]);
  });
});

describe("refsInText", () => {
  const a = { fileId: "a", filename: "a.pdf" };
  const b = { fileId: "b", filename: "b.md" };

  it("keeps only refs still written in the text, once each", () => {
    expect(refsInText("look at @a.pdf and @a.pdf", [a, b, a])).toEqual([a]);
  });
});

describe("splitMentions", () => {
  const ref = { fileId: "a", filename: "deck v2.pdf" };

  it("splits text around each reference, including names with spaces", () => {
    expect(splitMentions("open @deck v2.pdf now", [ref])).toEqual([
      { text: "open " },
      { ref },
      { text: " now" },
    ]);
  });

  it("returns the text as is with no refs", () => {
    expect(splitMentions("plain @text", [])).toEqual([{ text: "plain @text" }]);
  });
});
