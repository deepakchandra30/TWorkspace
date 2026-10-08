// The search box's query. Every request embeds the query (billed), so empty input never sends one.

export const MAX_QUERY_LENGTH = 200;
export const SEARCH_DEBOUNCE_MS = 250;

export function cleanSearchQuery(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const query = input.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
  return query.length > 0 ? query : null;
}
