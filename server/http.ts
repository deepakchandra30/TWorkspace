// Small helpers shared by the route handlers.

export function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

// A malformed or missing body reads as {}, so validation reports it like any other bad input.
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

// MongoDB duplicate-key error on a unique index that includes this field.
export function isDuplicateKey(err: unknown, field: string): boolean {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> };
  return e?.code === 11000 && e.keyPattern?.[field] !== undefined;
}
