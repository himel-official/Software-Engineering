export const fmtTime = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d < 60 ? `${d} days ago` : `${Math.round(d / 30)} months ago`;
}

// Dot opacity: 1.0 when fresh, fades to minOpacity as the crime gets older.
// Permanent crimes (murder, rape, ...) never fade.
export function dotOpacity(report, type, meta) {
  if (type.permanent) return 0.95;
  const days = (Date.now() - new Date(report.occurred_at).getTime()) / 86400000;
  const t = Math.min(Math.max(days / meta.fadeDays, 0), 1);
  return Math.max(meta.minOpacity, 1 - t * (1 - meta.minOpacity));
}

// Distance in km between two {lat, lng} points (haversine formula)
export function distanceKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

// What the file pickers accept (the server checks the real content again) and the size limit shown to people.
export const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.txt";
export const MAX_FILE_MB = 25;
