"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@/components/api";
import { Button, Card, Field, FormError } from "@/components/ui";
import { MAX_HOURS, MIN_HOURS } from "@/lib/expiry";

const DEFAULT_HOURS = 4;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Workspace</h1>
        <p className="max-w-xl text-text-muted">
          Share files and chat with everyone in the room. No accounts: join with a QR code or a PIN. When the time is
          up, everything is deleted.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        <CreateForm />
        <JoinForm />
      </div>
    </main>
  );
}

function CreateForm() {
  const router = useRouter();
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const result = await apiFetch<{ id: string }>("/api/workspaces", {
      name: form.get("name"),
      hours,
      nickname: form.get("nickname"),
    });
    if (result.ok) router.push(`/w/${result.data.id}?share=1`);
    else {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <Card title="Create a workspace">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Workspace name" name="name" required maxLength={80} placeholder="Weekend study group" />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            Deletes after {hours} {hours === 1 ? "hour" : "hours"}
          </span>
          <input
            type="range"
            min={MIN_HOURS}
            max={MAX_HOURS}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="accent-accent"
          />
        </label>
        <Field label="Your nickname" name="nickname" required maxLength={32} placeholder="Aoife" />
        <FormError message={error} />
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create workspace"}
        </Button>
      </form>
    </Card>
  );
}

function JoinForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const result = await apiFetch<{ id: string }>("/api/join", {
      pin: form.get("pin"),
      nickname: form.get("nickname"),
    });
    if (result.ok) router.push(`/w/${result.data.id}`);
    else {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <Card title="Join with a PIN">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="PIN"
          name="pin"
          required
          inputMode="numeric"
          autoComplete="off"
          maxLength={7}
          placeholder="482 913"
          hint="The 6-digit PIN shown by the host"
        />
        <Field label="Your nickname" name="nickname" required maxLength={32} placeholder="Liam" />
        <FormError message={error} />
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy ? "Joining…" : "Join"}
        </Button>
      </form>
    </Card>
  );
}
