"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/components/api";

type Person = { _id: string; nickname: string; role: "host" | "guest" };

// "N people" in the header: click to see who is here. Fetched each time it opens.
export default function PeopleList({ workspaceId, count, myId }: { workspaceId: string; count: number; myId: string }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  async function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    const result = await apiFetch<{ members: Person[] }>(`/api/workspaces/${workspaceId}/members`);
    if (result.ok) setPeople(result.data.members);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={toggle} aria-expanded={open} className="text-sm text-accent hover:underline">
        {count} {count === 1 ? "person" : "people"}
      </button>
      {open && (
        <ul className="absolute left-0 z-50 mt-1 min-w-48 rounded-md border border-border bg-surface p-2 text-sm shadow-lg">
          {people === null ? (
            <li className="text-text-muted">Loading…</li>
          ) : (
            people.map((p) => (
              <li key={p._id} className="px-2 py-1">
                {p.nickname}
                {p.role === "host" && <span className="text-text-muted"> (host)</span>}
                {p._id === myId && <span className="text-text-muted"> (you)</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
