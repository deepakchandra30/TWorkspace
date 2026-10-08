"use client";

import { useEffect, useRef, useState } from "react";
import { Button, FormError } from "@/components/ui";

// The confirm step before the host closes the workspace for everyone.
export default function CloseDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<string | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  async function confirm() {
    setClosing(true);
    setError(null);
    const failure = await onConfirm();
    setClosing(false);
    setError(failure);
  }

  return (
    <dialog
      ref={dialog}
      onClose={onCancel}
      className="m-auto w-[min(92vw,24rem)] rounded-xl border border-border bg-surface p-6 text-text backdrop:bg-text/40"
    >
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Close this workspace?</h2>
        <p className="text-sm text-text-muted">
          It disappears for everyone straight away, and every message and file is deleted within about a minute.
          This can&apos;t be undone.
        </p>
        <FormError message={error} />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={closing}>
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 !bg-danger hover:opacity-90"
            onClick={confirm}
            disabled={closing}
          >
            {closing ? "Closing…" : "Close workspace"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
