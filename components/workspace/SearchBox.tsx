"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/components/api";
import { SEARCH_DEBOUNCE_MS, cleanSearchQuery } from "@/lib/search";
import type { Message } from "./useWorkspace";

type Results = { messages: Message[]; mode: string };

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Search the workspace's chat by meaning and by words. Files are not searched.
export default function SearchBox({ workspaceId }: { workspaceId: string }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const q = cleanSearchQuery(text);

  // Debounced; an empty box never sends a request.
  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await apiFetch<Results>(`/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(q)}`);
      if (cancelled) return;
      if (result.ok) {
        setResults(result.data);
        setError(null);
      } else setError(result.error);
      setOpen(true);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, workspaceId]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div ref={box} className="relative w-full md:w-72">
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => results && setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Search the chat"
        aria-label="Search the chat"
        className="w-full rounded-md border border-border bg-surface px-3 py-1 text-sm outline-none focus:border-accent"
      />
      {open && q && (results || error) && (
        <div className="absolute right-0 left-0 z-50 mt-1 max-h-96 overflow-y-auto rounded-md border border-border bg-surface p-2 shadow-lg">
          {error ? (
            <p className="p-2 text-sm text-danger">{error}</p>
          ) : results && results.messages.length === 0 ? (
            <p className="p-2 text-sm text-text-muted">No messages match</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {results?.messages.map((m) => (
                <li key={m._id} className="rounded-md px-2 py-1 hover:bg-canvas">
                  <span className="text-xs text-text-muted">
                    {m.nickname} · {time(m.createdAt)}
                  </span>
                  <p className="text-sm break-words whitespace-pre-wrap">{m.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
