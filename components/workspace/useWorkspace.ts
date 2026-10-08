"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { apiFetch } from "@/components/api";
import type { Prefs } from "@/lib/layout";
import type { FileRef } from "@/lib/mentions";
import type { FileMeta } from "./files";

export type Message = {
  _id: string;
  memberId: string;
  nickname: string;
  text: string;
  refs?: FileRef[];
  imageFileId?: string | null;
  createdAt: string;
};
export type WorkspaceInfo = { id: string; name: string; pin: string; joinSecret: string; expiresAt: string };
export type Me = { id: string; nickname: string; role: "host" | "guest"; prefs: Prefs };
// Documents left per collection while TTL deletes a closed workspace. Null until the first count.
export type Receipt = Record<string, number> | null;

type Loaded = {
  workspace: WorkspaceInfo;
  me: Me;
  memberCount: number;
  files: FileMeta[];
  messages: Message[];
  hasMore: boolean;
};
type Status = "loading" | "ready" | "closed" | "unauthorized" | "missing" | "error";

function addOnce<T extends { _id: string }>(list: T[], item: T) {
  return list.some((x) => x._id === item._id) ? list : [...list, item];
}

function mergeById<T extends { _id: string }>(list: T[], incoming: T[]) {
  return [...list, ...incoming.filter((x) => !list.some((y) => y._id === x._id))];
}

// A workspace's live state: loaded once over HTTP, then kept current by Socket.IO events.
export function useWorkspace(id: string) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Omit<Loaded, "messages" | "hasMore" | "files"> | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [receipt, setReceipt] = useState<Receipt>(null);
  const loaded = useRef(false);

  // First load, and again on every socket reconnect so a phone that slept catches up.
  const load = useCallback(async () => {
    const result = await apiFetch<Loaded>(`/api/workspaces/${id}`);
    if (!result.ok) {
      if (loaded.current) {
        // Already inside and now refused: the workspace closed while this device was away.
        if (result.status === 401) setStatus("closed");
        return;
      }
      setError(result.error);
      setStatus(result.status === 401 ? "unauthorized" : result.status === 404 ? "missing" : "error");
      return;
    }
    const { messages: page, hasMore: more, files: fileList, ...rest } = result.data;
    setData(rest);
    setFiles((list) => mergeById(fileList ?? [], list));
    if (loaded.current) {
      setMessages((list) => mergeById(list, page).sort((a, b) => (a._id < b._id ? -1 : 1)));
    } else {
      setMessages(page);
      setHasMore(more);
    }
    loaded.current = true;
    setStatus((s) => (s === "closed" ? s : "ready"));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching on mount is the point
    load();
  }, [load]);

  // Open the socket only once the session is known to be valid; the cookie authenticates it.
  const live = status === "ready" || status === "closed";
  useEffect(() => {
    if (!live) return;
    const socket = io();
    let connectedOnce = false;
    socket.on("connect", () => {
      if (connectedOnce) load();
      connectedOnce = true;
    });
    socket.on("message:new", (message: Message) => setMessages((list) => addOnce(list, message)));
    // Newest first, like the file list the server sends.
    socket.on("file:new", (file: FileMeta) => setFiles((list) => mergeById([file], list)));
    socket.on("member:joined", () => setData((d) => (d ? { ...d, memberCount: d.memberCount + 1 } : d)));
    socket.on("workspace:closed", () => setStatus("closed"));
    // { workspaces, members, messages, files, fileVersions }: documents left, every 3 s until all are 0.
    socket.on("receipt:update", (counts: Record<string, number>) => {
      setStatus("closed");
      setReceipt(counts);
    });
    return () => {
      socket.disconnect();
    };
    // Only (re)connect when the workspace becomes live, not on every reload of its data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const send = useCallback(
    async (text: string, extra: { refs?: FileRef[]; imageFileId?: string } = {}) => {
      const result = await apiFetch<Message>(`/api/workspaces/${id}/messages`, { text, ...extra });
      // Show it straight away; the socket echo is dropped as a duplicate.
      if (result.ok) setMessages((list) => addOnce(list, result.data));
      return result.ok ? null : result.error;
    },
    [id],
  );

  const addFile = useCallback((file: FileMeta) => setFiles((list) => mergeById([file], list)), []);

  const loadOlder = useCallback(async () => {
    const oldest = messages[0];
    if (!oldest) return;
    const result = await apiFetch<{ messages: Message[]; hasMore: boolean }>(
      `/api/workspaces/${id}/messages?before=${oldest._id}`,
    );
    if (!result.ok) return;
    setMessages((list) => [...result.data.messages.filter((m) => !list.some((x) => x._id === m._id)), ...list]);
    setHasMore(result.data.hasMore);
  }, [id, messages]);

  const close = useCallback(async () => {
    const result = await apiFetch<unknown>(`/api/workspaces/${id}/close`, {});
    if (result.ok) setStatus("closed");
    return result.ok ? null : result.error;
  }, [id]);

  return { status, error, data, messages, hasMore, files, receipt, send, loadOlder, addFile, close };
}
