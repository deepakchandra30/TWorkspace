"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@/components/api";
import { Button, Card, Field, FormError } from "@/components/ui";

// The page a QR code opens: the invite is in the link, so only a nickname is asked for.
export default function JoinBySecret({ secret }: { secret: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const result = await apiFetch<{ id: string }>("/api/join", { secret, nickname: form.get("nickname") });
    if (result.ok) router.push(`/w/${result.data.id}`);
    else {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <Card title="You're invited to a workspace">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Your nickname" name="nickname" required autoFocus maxLength={32} placeholder="Liam" />
          <FormError message={error} />
          <Button type="submit" disabled={busy}>
            {busy ? "Joining…" : "Join"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
