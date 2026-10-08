"use client";

import { useEffect, useState } from "react";
import { KIND_ICON, fileKind, fileUrl, formatSize, type FileMeta } from "./files";

// Google Docs feel: a top bar, then the file filling the pane.
// Images and PDF render; text, code, Markdown, HTML and SVG show as source in <pre> (2.8 is cut to this).
export default function Viewer({ file, onClose }: { file: FileMeta | null; onClose?: () => void }) {
  const [copied, setCopied] = useState(false);

  if (!file) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-sm">
          <span className="font-medium">No file open</span>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-text-muted">Pick a file to view it here</div>
      </div>
    );
  }

  async function copyRef() {
    await navigator.clipboard.writeText(`@${file!.filename}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const uploaded = new Date(file.createdAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2 text-sm">
        {onClose && (
          <button type="button" onClick={onClose} className="text-accent hover:underline" aria-label="Close file">
            ← Back
          </button>
        )}
        <span className="min-w-0 truncate font-medium">{file.filename}</span>
        <span className="text-text-muted">
          {file.nickname ? `${file.nickname} · ` : ""}
          {formatSize(file.size)} · {uploaded}
        </span>
        <span className="ml-auto flex gap-3">
          <a href={fileUrl(file._id, true)} className="text-accent hover:underline">
            Download
          </a>
          <button type="button" onClick={copyRef} className="text-accent hover:underline">
            {copied ? "Copied" : "Copy @ reference"}
          </button>
        </span>
      </div>
      <div className="flex min-h-0 flex-1 overflow-auto bg-canvas">
        <Body key={file._id} file={file} />
      </div>
    </div>
  );
}

function Body({ file }: { file: FileMeta }) {
  const kind = fileKind(file);
  const [zoomed, setZoomed] = useState(false);

  if (kind === "image") {
    return (
      <button
        type="button"
        onClick={() => setZoomed((z) => !z)}
        className={`m-auto p-4 ${zoomed ? "cursor-zoom-out" : "cursor-zoom-in"}`}
        aria-label={zoomed ? "Fit to pane" : "Show at full size"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a user upload served by our API */}
        <img
          src={fileUrl(file._id)}
          alt={file.filename}
          className={zoomed ? "max-w-none" : "max-h-[75dvh] max-w-full object-contain"}
        />
      </button>
    );
  }
  if (kind === "pdf") {
    return <iframe src={fileUrl(file._id)} title={file.filename} className="min-h-[70dvh] w-full flex-1 bg-surface" />;
  }
  if (kind === "text") return <TextBody file={file} />;
  return (
    <div className="m-auto flex flex-col items-center gap-3 p-6 text-center">
      <span className="text-5xl" aria-hidden>
        {KIND_ICON.other}
      </span>
      <p className="text-sm text-text-muted">No preview for this type of file.</p>
      <a href={fileUrl(file._id, true)} className="rounded-md bg-accent px-4 py-2 text-on-accent hover:bg-accent-hover">
        Download {file.filename}
      </a>
    </div>
  );
}

function TextBody({ file }: { file: FileMeta }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(fileUrl(file._id))
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then(
        (body) => !cancelled && setText(body),
        () => !cancelled && setFailed(true),
      );
    return () => {
      cancelled = true;
    };
  }, [file._id]);

  if (failed) return <p className="m-auto text-sm text-danger">Couldn&apos;t load this file.</p>;
  if (text === null) return <p className="m-auto text-sm text-text-muted">Loading…</p>;
  return (
    <pre className="w-full self-start whitespace-pre-wrap break-words bg-surface p-4 font-mono text-sm">{text}</pre>
  );
}
