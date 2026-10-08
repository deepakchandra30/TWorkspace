"use client";

import Link from "next/link";
import type { Receipt as Counts } from "./useWorkspace";

// The order the server's COLLECTIONS list uses; anything else it sends goes after.
const ORDER = ["workspaces", "members", "messages", "files", "fileVersions"];
const LABEL: Record<string, string> = {
  workspaces: "Workspace",
  members: "People",
  messages: "Messages",
  files: "Files",
  fileVersions: "File versions",
};

// Shown to everyone once the host closes: the documents left per collection, falling live as TTL deletes them.
export default function Receipt({ counts }: { counts: Counts }) {
  const names = counts
    ? [...ORDER.filter((n) => n in counts), ...Object.keys(counts).filter((n) => !ORDER.includes(n))]
    : ORDER;
  const done = counts !== null && Object.values(counts).every((n) => n === 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas p-4 text-text">
      <section className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{done ? "Workspace deleted" : "Workspace closed"}</h2>
        <p className="text-sm text-text-muted">
          {done
            ? "MongoDB has deleted every document. Nothing is left."
            : "MongoDB's TTL index is deleting everything. This takes about a minute."}
        </p>
        <table className="w-full text-sm">
          <caption className="sr-only">Documents left in each collection</caption>
          <tbody aria-live="polite">
            {names.map((name) => {
              const left = counts?.[name];
              return (
                <tr key={name} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 text-left font-normal">
                    {LABEL[name] ?? name}
                  </th>
                  <td
                    className={`py-2 text-right font-mono text-lg tabular-nums ${
                      left === 0 ? "text-success" : "text-text"
                    }`}
                  >
                    {left === undefined ? "…" : left}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {counts === null && <p className="text-sm text-text-muted">Counting what&apos;s left…</p>}
        <Link href="/" className="self-center text-accent hover:underline">
          Back to the home page
        </Link>
      </section>
    </div>
  );
}
