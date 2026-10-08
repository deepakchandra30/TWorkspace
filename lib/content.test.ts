import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, chooseEncoding, decode, encode, storedLength } from "./content";

const bytes = (...values: number[]) => new Uint8Array(values);
const utf8 = (text: string) => new TextEncoder().encode(text);

describe("storedLength", () => {
  it("gives the base64 length of a maximum-size file", () => {
    expect(storedLength(MAX_FILE_BYTES)).toBe(6_990_508);
  });

  it("is 0 for an empty file", () => {
    expect(storedLength(0)).toBe(0);
  });
});

describe("chooseEncoding", () => {
  it("stores a PNG as base64", () => {
    expect(chooseEncoding(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("base64");
  });

  it("stores valid UTF-8 Markdown, emoji included, as text", () => {
    expect(chooseEncoding(utf8("# Notes 🎉\n\n- café\n"))).toBe("utf8");
  });

  it("falls back to base64 when one byte is not valid UTF-8", () => {
    expect(chooseEncoding(new Uint8Array([...utf8("plain text "), 0xff, ...utf8(" more")]))).toBe("base64");
  });
});

describe("encode then decode", () => {
  it.each([
    ["random bytes", randomBytes(4096)],
    ["empty input", bytes()],
    ["1 byte", bytes(0xff)],
    ["2 bytes", bytes(0xff, 0x00)],
    ["3 bytes", bytes(0xff, 0x00, 0x80)],
    ["UTF-8 text", utf8("héllo 👋")],
    ["UTF-8 text with a byte-order mark", bytes(0xef, 0xbb, 0xbf, ...utf8("hi"))],
  ])("returns byte-identical output for %s", (_label, input) => {
    const stored = encode(new Uint8Array(input));
    expect(Buffer.from(decode(stored))).toEqual(Buffer.from(input));
  });

  it("stores text as readable text", () => {
    expect(encode(utf8("# Title"))).toEqual({ encoding: "utf8", content: "# Title" });
  });
});
