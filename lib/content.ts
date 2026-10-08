// How a file's bytes are stored in its document (assets/PLAN.md, File storage): valid UTF-8 as
// readable text, anything else as base64. Buffer is used inside functions only, so the browser
// can import MAX_FILE_BYTES from here.

// 5 MB, measured on the raw bytes. Matches the files validator in scripts/setup.js.
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type Encoding = "utf8" | "base64";
export type StoredContent = { encoding: Encoding; content: string };

export function chooseEncoding(bytes: Uint8Array): Encoding {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "utf8";
  } catch {
    return "base64";
  }
}

// ignoreBOM keeps a leading byte-order mark, so the round trip stays byte-identical.
export function encode(bytes: Uint8Array): StoredContent {
  const encoding = chooseEncoding(bytes);
  const content =
    encoding === "utf8" ? new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes) : Buffer.from(bytes).toString("base64");
  return { encoding, content };
}

export function decode({ encoding, content }: StoredContent): Uint8Array<ArrayBuffer> {
  return encoding === "utf8" ? new TextEncoder().encode(content) : new Uint8Array(Buffer.from(content, "base64"));
}

// Characters stored for n bytes of base64: 4 for every 3 bytes, padded.
export function storedLength(n: number): number {
  return 4 * Math.ceil(n / 3);
}
