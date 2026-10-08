// Browser-side JSON calls to our own API. Cookies go automatically: same origin.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export async function apiFetch<T>(url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: data as T };
    return { ok: false, status: res.status, error: data?.error ?? "Something went wrong. Try again." };
  } catch {
    return { ok: false, status: 0, error: "You're offline, or the server can't be reached." };
  }
}
