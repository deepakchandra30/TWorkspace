"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui";
import { displayPin } from "@/lib/pin";

// QR code, PIN and invite link, for putting on a projector or a phone screen.
export default function ShareDialog({
  open,
  onClose,
  pin,
  joinSecret,
}: {
  open: boolean;
  onClose: () => void;
  pin: string;
  joinSecret: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteLink = () => `${window.location.origin}/j/${joinSecret}`;

  useEffect(() => {
    QRCode.toDataURL(inviteLink(), { width: 280, margin: 1 }).then(setQr, () => setQr(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inviteLink depends only on joinSecret
  }, [joinSecret]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  async function copy() {
    await navigator.clipboard.writeText(inviteLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      className="m-auto w-[min(92vw,22rem)] rounded-xl border border-border bg-surface p-6 text-text backdrop:bg-text/40"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-lg font-semibold">Invite people</h2>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL; next/image adds nothing here
          <img src={qr} alt="QR code that opens the invite link" width={280} height={280} />
        ) : (
          <div className="h-[280px] w-[280px] rounded-md bg-canvas" />
        )}
        <p className="text-sm text-text-muted">Scan, or enter this PIN on the home page</p>
        <p className="font-mono text-3xl font-semibold tracking-widest text-accent">{displayPin(pin)}</p>
        <div className="flex w-full gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={copy}>
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button type="button" className="flex-1" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </dialog>
  );
}
