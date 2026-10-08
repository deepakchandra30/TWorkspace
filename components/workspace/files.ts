import { MAX_FILE_BYTES } from "@/lib/content";

// Files as the browser sees them: metadata only. The bytes come from /api/files/:id when opened.

export type FileMeta = {
  _id: string;
  filename: string;
  mime: string;
  size: number;
  encoding?: "utf8" | "base64";
  memberId?: string;
  nickname?: string;
  createdAt: string;
};

export { MAX_FILE_BYTES };

export const fileUrl = (id: string, download = false) => `/api/files/${id}${download ? "?download=1" : ""}`;

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export type Kind = "image" | "pdf" | "text" | "other";

// Browsers send an empty or generic mime for many code files, and the upload response has no encoding.
const TEXT_EXTENSIONS = /\.(md|markdown|txt|csv|tsv|json|ya?ml|toml|ini|log|js|mjs|cjs|jsx|ts|tsx|py|rb|go|rs|java|kt|c|h|cpp|cs|php|sh|sql|css|scss|html?|xml|svg)$/i;

// HTML and SVG count as text: they are shown as source, never rendered.
export function fileKind(file: Pick<FileMeta, "mime" | "encoding" | "filename">): Kind {
  const mime = file.mime.toLowerCase();
  if (mime === "image/svg+xml" || mime === "text/html") return "text";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (
    file.encoding === "utf8" ||
    mime.startsWith("text/") ||
    /json|javascript|xml|yaml|markdown/.test(mime) ||
    TEXT_EXTENSIONS.test(file.filename)
  ) {
    return "text";
  }
  return "other";
}

export const KIND_ICON: Record<Kind, string> = { image: "🖼️", pdf: "📕", text: "📄", other: "📦" };

export function tooLarge(file: File) {
  return file.size > MAX_FILE_BYTES;
}

export const TOO_LARGE_MESSAGE = `File too large: the limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`;

// Uploads as multipart/form-data, raw bytes: the server picks utf8 or base64.
export async function uploadFile(
  workspaceId: string,
  file: File,
): Promise<{ ok: true; file: FileMeta } | { ok: false; error: string }> {
  if (tooLarge(file)) return { ok: false, error: TOO_LARGE_MESSAGE };
  const form = new FormData();
  form.append("file", file, file.name || "pasted-image.png");
  try {
    const res = await fetch(`/api/workspaces/${workspaceId}/files`, { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    if (res.ok) return { ok: true, file: data as FileMeta };
    if (res.status === 413) return { ok: false, error: TOO_LARGE_MESSAGE };
    return { ok: false, error: data?.error ?? "Upload failed. Try again." };
  } catch {
    return { ok: false, error: "You're offline, or the server can't be reached." };
  }
}
