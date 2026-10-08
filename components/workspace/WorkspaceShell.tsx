"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { DEFAULT_PREFS, layoutFor, type Panel, type Prefs } from "@/lib/layout";
import { displayPin } from "@/lib/pin";
import ChatPanel from "./ChatPanel";
import CloseDialog from "./CloseDialog";
import FilesPanel from "./FilesPanel";
import PeopleList from "./PeopleList";
import Receipt from "./Receipt";
import SearchBox from "./SearchBox";
import ShareDialog from "./ShareDialog";
import Viewer from "./Viewer";
import { useWorkspace, type Me, type WorkspaceInfo } from "./useWorkspace";

// Layout prefs reset on reload: persistence (3.2, 3.7) is cut for today.

type Tab = "files" | "chat";

export default function WorkspaceShell({ workspaceId, openShare }: { workspaceId: string; openShare: boolean }) {
  const { status, error, data, messages, hasMore, files, receipt, send, loadOlder, addFile, close } =
    useWorkspace(workspaceId);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [tab, setTab] = useState<Tab>("chat");
  const [sharing, setSharing] = useState(openShare);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { panels, columns } = layoutFor(prefs);

  // Closed by the host: the workspace is gone for everyone at once, and the receipt takes its place.
  if (status === "closed") return <Receipt counts={receipt} />;
  if (status !== "ready" || !data) return <Notice status={status} error={error} />;

  // Still in the list: a file can't vanish while the workspace is open, but guard anyway.
  const openFile = files.find((f) => f._id === openId) ?? null;

  // Files focus: the open file fills the page. Chat focus: the chat does. So switching to Chat focus
  // closes the file, and opening a file switches back to Files focus. Phones use tabs and ignore mode.
  const changePrefs = (next: Prefs) => {
    if (next.mode === "chat") setOpenId(null);
    setPrefs(next);
  };
  const openFileById = (id: string) => {
    setOpenId(id);
    if (prefs.mode === "chat") setPrefs({ ...prefs, mode: "files" });
  };

  const panelBody: Record<Panel, ReactNode> = {
    files: (
      <FilesPanel
        workspaceId={workspaceId}
        files={files}
        openId={openId}
        onOpen={(file) => openFileById(file._id)}
        onUploaded={addFile}
      />
    ),
    viewer: <Viewer file={openFile} />,
    chat: (
      <ChatPanel
        messages={messages}
        hasMore={hasMore}
        myId={data.me.id}
        onSend={send}
        onLoadOlder={loadOlder}
        files={files}
        onOpenFile={openFileById}
      />
    ),
  };

  // Phones show one tab at a time; from md (768px) up, every panel sits in the grid.
  const visibility = (panel: Panel) =>
    panel === tab ? "flex" : "hidden md:flex";

  return (
    <div
      className="flex h-dvh flex-col bg-canvas text-text"
      // A file dropped outside the Files window does nothing, instead of the browser opening it.
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDrop={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
    >
      <Header
        workspaceId={workspaceId}
        workspace={data.workspace}
        me={data.me}
        memberCount={data.memberCount}
        prefs={prefs}
        onPrefs={changePrefs}
        onShare={() => setSharing(true)}
        onClose={() => setConfirmingClose(true)}
      />
      <CloseDialog open={confirmingClose} onCancel={() => setConfirmingClose(false)} onConfirm={close} />
      <ShareDialog
        open={sharing}
        onClose={() => setSharing(false)}
        pin={data.workspace.pin}
        joinSecret={data.workspace.joinSecret}
      />

      <nav className="flex border-b border-border bg-surface md:hidden" aria-label="Panels">
        {(["files", "chat"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`flex-1 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-b-2 border-accent text-accent" : "text-text-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <main
        className="relative flex min-h-0 flex-1 md:grid md:grid-cols-(--panel-columns)"
        style={{ "--panel-columns": columns } as CSSProperties}
      >
        {panels.map((panel) => (
          <section
            key={panel}
            aria-label={panel}
            className={`${visibility(panel)} min-h-0 min-w-0 flex-1 flex-col border-border bg-surface md:border-x`}
          >
            {panelBody[panel]}
          </section>
        ))}
        {openFile && (
          // Phones, and Chat focus on desktop: the file opens in a panel over the chat. In Files focus
          // on desktop the grid's viewer panel shows it instead, so this hides from md up.
          <section
            aria-label="viewer"
            // Leaves the 240px file list (PANEL_WIDTH.files in lib/layout.ts) uncovered.
            className={`fixed inset-0 z-40 flex flex-col bg-surface md:absolute md:border-x md:border-border ${
              prefs.chatSide === "right" ? "md:left-[240px]" : "md:right-[240px]"
            } ${prefs.mode === "files" ? "md:hidden" : ""}`}
          >
            <Viewer file={openFile} onClose={() => setOpenId(null)} />
          </section>
        )}
      </main>
    </div>
  );
}

function Notice({ status, error }: { status: string; error: string | null }) {
  const text =
    status === "loading"
      ? "Opening the workspace…"
      : status === "missing"
        ? "This workspace doesn't exist."
        : (error ?? "Something went wrong.");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className={status === "loading" ? "text-text-muted" : "text-lg"}>{text}</p>
      {status !== "loading" && (
        <Link href="/" className="text-accent hover:underline">
          Join with a PIN, or create a workspace
        </Link>
      )}
    </main>
  );
}

function Header({
  workspaceId,
  workspace,
  me,
  memberCount,
  prefs,
  onPrefs,
  onShare,
  onClose,
}: {
  workspaceId: string;
  workspace: WorkspaceInfo;
  me: Me;
  memberCount: number;
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  onShare: () => void;
  onClose: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2">
      <h1 className="font-semibold">{workspace.name}</h1>
      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-sm text-accent">PIN {displayPin(workspace.pin)}</span>
      <span className="flex items-center gap-1 text-sm text-text-muted">
        <PeopleList workspaceId={workspaceId} count={memberCount} myId={me.id} /> · you are {me.nickname}
      </span>

      <div className="ml-auto flex w-full flex-wrap items-center gap-2 md:w-auto">
        <SearchBox workspaceId={workspaceId} />
        <Segmented
          label="Layout"
          value={prefs.mode}
          options={[
            ["files", "Files focus"],
            ["chat", "Chat focus"],
          ]}
          onChange={(mode) => onPrefs({ ...prefs, mode })}
        />
        <Segmented
          label="Chat side"
          value={prefs.chatSide}
          options={[
            ["left", "Chat left"],
            ["right", "Chat right"],
          ]}
          onChange={(chatSide) => onPrefs({ ...prefs, chatSide })}
        />
        <Countdown expiresAt={workspace.expiresAt} />
        <button
          type="button"
          onClick={onShare}
          className="rounded-md border border-border px-3 py-1 text-sm hover:bg-canvas"
        >
          QR
        </button>
        {me.role === "host" && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-danger px-3 py-1 text-sm text-danger hover:bg-danger hover:text-on-accent"
          >
            Close workspace
          </button>
        )}
      </div>
    </header>
  );
}

// Time left until MongoDB deletes the workspace, ticking every second.
function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = Math.max(0, new Date(expiresAt).getTime() - now);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const text = h > 0 ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2, "0")}s`;
  return (
    <span className="text-sm text-text-muted" title={new Date(expiresAt).toLocaleString()}>
      Deletes in <span className="tabular-nums">{text}</span>
    </span>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="hidden overflow-hidden rounded-md border border-border md:flex">
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`px-3 py-1 text-sm ${
            value === option ? "bg-accent text-on-accent" : "text-text-muted hover:bg-canvas"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
