/**
 * Normalise the different list response shapes used by the API.
 *
 * Custom APIViews return `{ success, data: [...] }` while the DRF routers
 * return the paginated `{ count, next, previous, results: [...] }`.
 */
export function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

/** Read a human readable message out of an API error payload. */
export function readMessage(payload, fallback = "Request failed.") {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (payload.message) return payload.message;
  if (payload.errors && typeof payload.errors === "object") {
    const first = Object.values(payload.errors)[0];
    if (Array.isArray(first) && first.length) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return fallback;
}
