"use client";

import { useRef, useState, type DragEvent } from "react";
import { KIND_ICON, MAX_FILE_BYTES, fileKind, formatSize, uploadFile, type FileMeta } from "./files";

const isFileDrag = (event: DragEvent) => event.dataTransfer.types.includes("Files");

// The Files window is the upload area: drop anywhere in it, or click. Empty, it shows one drop
// zone in its middle; with files, the list fills it. Newest first, live through file:new.
export default function FilesPanel({
  workspaceId,
  files,
  openId,
  onOpen,
  onUploaded,
}: {
  workspaceId: string;
  files: FileMeta[];
  openId: string | null;
  onOpen: (file: FileMeta) => void;
  onUploaded: (file: FileMeta) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // dragenter/dragleave fire for every child row; count them so the overlay doesn't flicker.
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setUploading((n) => n + list.length);
    const failures: string[] = [];
    const landed: FileMeta[] = [];
    await Promise.all(
      Array.from(list).map(async (file) => {
        const result = await uploadFile(workspaceId, file);
        if (result.ok) {
          onUploaded(result.file);
          landed.push(result.file);
        } else failures.push(`${file.name}: ${result.error}`);
        setUploading((n) => n - 1);
      }),
    );
    setError(failures.length ? failures.join(" ") : null);
    // Open what just landed, so the person sees it.
    const last = landed.at(-1);
    if (last) onOpen(last);
  }

  const pick = () => input.current?.click();

  const dragHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver: (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      depth.current = 0;
      setDragging(false);
      upload(e.dataTransfer.files);
    },
  };

  const status = (
    <>
      {uploading > 0 && <p className="text-sm text-accent">Uploading {uploading}…</p>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );

  return (
    <div {...dragHandlers} className="relative flex min-h-0 flex-1 flex-col">
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          upload(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
      />

      {files.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
          <button
            type="button"
            onClick={pick}
            className="flex w-full max-w-xs flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-10 text-center text-text-muted transition-colors hover:border-accent hover:bg-canvas"
          >
            <span className="text-4xl" aria-hidden>
              ⬆️
            </span>
            <span className="font-medium text-text">Drop files here or click to upload</span>
            <span className="text-sm">Up to {MAX_FILE_BYTES / 1024 / 1024} MB each</span>
          </button>
          <div className="text-center">{status}</div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          <div className="flex items-center gap-2">
            <p className="text-sm text-text-muted">Files · {files.length}</p>
            <button
              type="button"
              onClick={pick}
              className="ml-auto rounded-md border border-accent px-3 py-1 text-sm text-accent hover:bg-accent-soft"
            >
              Upload
            </button>
          </div>
          {status}
          <ul className="flex flex-col gap-1">
            {files.map((file) => (
              <li key={file._id}>
                <button
                  type="button"
                  onClick={() => onOpen(file)}
                  aria-current={file._id === openId}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                    file._id === openId ? "bg-accent-soft" : "hover:bg-canvas"
                  }`}
                >
                  <span aria-hidden>{KIND_ICON[fileKind(file)]}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{file.filename}</span>
                    <span className="truncate text-xs text-text-muted">
                      {file.nickname ? `${file.nickname} · ` : ""}
                      {formatSize(file.size)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="pt-2 text-center text-xs text-text-muted">Drop files anywhere here to upload</p>
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-accent-soft/90 text-center font-medium text-accent">
          Drop to upload
        </div>
      )}
    </div>
  );
}
