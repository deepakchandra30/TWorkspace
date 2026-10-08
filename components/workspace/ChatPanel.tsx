"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MAX_MESSAGE_LENGTH } from "@/lib/input";
import {
  filterFiles,
  insertMention,
  mentionAt,
  refsInText,
  splitMentions,
  type FileRef,
  type Mention,
} from "@/lib/mentions";
import { KIND_ICON, fileKind, type FileMeta } from "./files";
import type { Message } from "./useWorkspace";

const NEAR_BOTTOM_PX = 120;
const NEAR_TOP_PX = 40;

// Only http(s) URLs become links, so a message can never carry a javascript: href.
const URL_PATTERN = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]}'])/g;

function Linkified({ text, mine }: { text: string; mine: boolean }) {
  return text.split(URL_PATTERN).map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline ${mine ? "text-on-accent" : "text-accent"}`}
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPanel({
  messages,
  hasMore,
  myId,
  onSend,
  onLoadOlder,
  files = [],
  onOpenFile,
}: {
  messages: Message[];
  hasMore: boolean;
  myId: string;
  onSend: (text: string, extra?: { refs?: FileRef[] }) => Promise<string | null>;
  onLoadOlder: () => Promise<void>;
  // For the @ picker: the files already loaded, and opening one from a chip.
  files?: FileMeta[];
  onOpenFile?: (fileId: string) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Distance from the bottom before older messages are prepended, so the view doesn't jump.
  const restoreFromBottom = useRef<number | null>(null);
  const lastId = useRef<string | undefined>(undefined);

  // The @ picker: the token at the caret, the highlighted match, and the files picked so far.
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [mention, setMention] = useState<Mention | null>(null);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<FileRef[]>([]);
  // Escape closes the picker for that @ token only; caret moves don't reopen it.
  const dismissed = useRef<number | null>(null);
  const matches = mention ? filterFiles(files, mention.query) : [];
  const form = useRef<HTMLFormElement>(null);

  // Close the picker on a tap or click outside the composer. Not on blur: on phones, tapping a
  // suggestion blurs the input first, which would close the picker before the tap lands.
  const pickerOpen = mention !== null;
  useEffect(() => {
    if (!pickerOpen) return;
    const outside = (e: PointerEvent) => {
      if (!form.current?.contains(e.target as Node)) setMention(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [pickerOpen]);

  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    if (restoreFromBottom.current !== null) {
      el.scrollTop = el.scrollHeight - restoreFromBottom.current;
      restoreFromBottom.current = null;
      return;
    }
    const newest = messages.at(-1);
    if (newest && newest._id !== lastId.current) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
      // First load, my own message, or already reading the bottom: follow the conversation.
      if (lastId.current === undefined || newest.memberId === myId || nearBottom) el.scrollTop = el.scrollHeight;
      lastId.current = newest._id;
    }
  }, [messages, myId]);

  async function loadOlder() {
    const el = list.current;
    if (!el || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    restoreFromBottom.current = el.scrollHeight - el.scrollTop;
    await onLoadOlder();
    setLoadingOlder(false);
  }

  // Re-read the @ token whenever the text or the caret moves.
  function track(el: HTMLInputElement) {
    let next = mentionAt(el.value, el.selectionStart ?? el.value.length);
    if (!next) dismissed.current = null;
    else if (next.start === dismissed.current) next = null;
    setMention(next);
    if (next?.query !== mention?.query) setActive(0);
  }

  function pick(file: FileMeta) {
    if (!mention) return;
    const result = insertMention(text, mention, file.filename);
    setText(result.text);
    setPicked((list) => [...list, { fileId: file._id, filename: file.filename }]);
    setMention(null);
    // Focus inside the tap's own handler, so phones reopen the keyboard.
    input.current?.focus();
    requestAnimationFrame(() => input.current?.setSelectionRange(result.caret, result.caret));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!mention) return;
    if (event.key === "Escape") {
      event.preventDefault();
      dismissed.current = mention.start;
      setMention(null);
    } else if (matches.length === 0) {
      return;
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + matches.length) % matches.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pick(matches[Math.min(active, matches.length - 1)]);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    // Only refs whose "@filename" is still in the text; the server keeps its own filename.
    const refs = refsInText(message, picked);
    setText("");
    setMention(null);
    const failure = await onSend(message, refs.length ? { refs } : undefined);
    setError(failure);
    if (failure) setText(message);
    else setPicked([]);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={list}
        onScroll={(e) => e.currentTarget.scrollTop < NEAR_TOP_PX && loadOlder()}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        {hasMore && (
          <button type="button" onClick={loadOlder} className="self-center text-sm text-accent hover:underline">
            {loadingOlder ? "Loading…" : "Load older messages"}
          </button>
        )}
        {messages.length === 0 && (
          <p className="m-auto text-sm text-text-muted">No messages yet. Say hello.</p>
        )}
        {messages.map((m) => {
          const mine = m.memberId === myId;
          return (
            <div key={m._id} className={`flex max-w-[80%] flex-col gap-1 ${mine ? "items-end self-end" : "items-start"}`}>
              <span className="text-xs text-text-muted">
                {mine ? "You" : m.nickname} · {time(m.createdAt)}
              </span>
              <p
                className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 ${
                  mine ? "bg-accent text-on-accent" : "bg-canvas text-text"
                }`}
              >
                {splitMentions(m.text, m.refs ?? []).map((segment, i) =>
                  "ref" in segment ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onOpenFile?.(segment.ref.fileId)}
                      title={`Open ${segment.ref.filename}`}
                      className={`mx-0.5 inline rounded-md px-1.5 py-0.5 font-medium underline-offset-2 hover:underline ${
                        mine ? "bg-on-accent/20 text-on-accent" : "bg-accent-soft text-accent"
                      }`}
                    >
                      @{segment.ref.filename}
                    </button>
                  ) : (
                    <Linkified key={i} text={segment.text} mine={mine} />
                  ),
                )}
              </p>
            </div>
          );
        })}
      </div>
      <form ref={form} className="relative flex flex-col gap-1 border-t border-border p-3" onSubmit={submit}>
        {mention && (
          <ul
            id="mention-picker"
            role="listbox"
            aria-label="Files"
            className="absolute inset-x-3 bottom-full mb-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
          >
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-text-muted">No files</li>
            ) : (
              matches.map((file, i) => (
                <li key={file._id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    tabIndex={-1}
                    // Desktop: keep the input focused. Phones: the click below still picks.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(file)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm md:py-2 ${
                      i === active ? "bg-accent-soft text-accent" : "hover:bg-canvas"
                    }`}
                  >
                    <span aria-hidden>{KIND_ICON[fileKind(file)]}</span>
                    <span className="truncate">{file.filename}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            ref={input}
            name="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              track(e.target);
            }}
            onSelect={(e) => track(e.currentTarget)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={mention !== null}
            aria-controls="mention-picker"
            aria-autocomplete="list"
            autoComplete="off"
            maxLength={MAX_MESSAGE_LENGTH}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Message · type @ to reference a file"
            aria-label="Message"
          />
          <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm text-on-accent hover:bg-accent-hover">
            Send
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
