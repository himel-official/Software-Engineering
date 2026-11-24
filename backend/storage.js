// File storage: Supabase Storage (a PRIVATE bucket). Replaces the old backend/storage folder on disk.
// Only this backend can reach the bucket (it uses the secret key); the browser never talks to Supabase Storage.
//   await storage.save(folder, name, buffer, contentType)   -> uploads a file
//   await storage.load(folder, name)                        -> Buffer, or null when the file does not exist
//   await storage.remove(folder, name)                      -> deletes a file (never throws: it is used for clean-up)
//   await storage.init()                                    -> makes sure the private bucket exists (called at start-up)
// Uses plain "fetch" (built into Node 18+), so there is no extra package to install.
const URL_RAW = (process.env.SUPABASE_URL || "").trim();
const KEY = (process.env.SUPABASE_SERVICE_KEY || "").trim();
const BUCKET = (process.env.SUPABASE_BUCKET || "safevoice-files").trim();

if (!URL_RAW || !KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_KEY are missing in backend/.env.\n" +
      "Supabase > Project Settings > API: copy the Project URL (https://xxxx.supabase.co) and the SECRET key (service_role / sb_secret_...), then add:\n" +
      "  SUPABASE_URL=https://xxxx.supabase.co\n  SUPABASE_SERVICE_KEY=..."
  );
}
const BASE = URL_RAW.replace(/\/+$/, "").replace(/\/storage\/v1$/, "");
if (!/^https?:\/\//.test(BASE)) throw new Error("SUPABASE_URL must start with https:// (example: https://abcdefghijklmnop.supabase.co)");

const TRANSFER_TIMEOUT_MS = 120000; // big videos can take a while
const headers = (extra = {}) => ({ apikey: KEY, Authorization: `Bearer ${KEY}`, ...extra });
const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");
const objectPath = (folder, name) => `${folder}/${name}`;

async function request(url, options, what) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS) });
  } catch (e) {
    throw new Error(`${what}: cannot reach Supabase Storage (${e.cause?.code || e.name}: ${e.message})`);
  }
}
async function detail(res) {
  const text = await res.text().catch(() => "");
  try { const j = JSON.parse(text); return j.message || j.error || text; } catch { return text; }
}

async function save(folder, name, buffer, contentType = "application/octet-stream") {
  const url = `${BASE}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encPath(objectPath(folder, name))}`;
  const res = await request(url, {
    method: "POST",
    headers: headers({ "Content-Type": contentType, "x-upsert": "false", "Cache-Control": "max-age=3600" }),
    body: buffer,
  }, "Upload");
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await detail(res)}`);
}

async function load(folder, name) {
  const url = `${BASE}/storage/v1/object/authenticated/${encodeURIComponent(BUCKET)}/${encPath(objectPath(folder, name))}`;
  const res = await request(url, { headers: headers() }, "Download");
  if (res.status === 404 || res.status === 400) {
    const msg = await detail(res);
    if (/not.?found/i.test(msg)) return null; // some Supabase versions answer 400 for a missing object
    throw new Error(`Download failed (${res.status}): ${msg}`);
  }
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${await detail(res)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function remove(folder, name) {
  try {
    const res = await request(`${BASE}/storage/v1/object/${encodeURIComponent(BUCKET)}`, {
      method: "DELETE",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: [objectPath(folder, name)] }),
    }, "Delete");
    if (!res.ok) console.error(`Could not delete ${folder}/${name} from storage (${res.status}): ${await detail(res)}`);
  } catch (e) {
    console.error(e.message);
  }
}

// Start-up check: the bucket must exist and must be PRIVATE. It is created for you the first time.
async function init() {
  const res = await request(`${BASE}/storage/v1/bucket/${encodeURIComponent(BUCKET)}`, { headers: headers() }, "Bucket check");
  if (res.status === 401 || res.status === 403) {
    throw new Error("Supabase rejected SUPABASE_SERVICE_KEY. Use the SECRET key (service_role / sb_secret_...), not the anon/publishable key.");
  }
  if (res.ok) {
    const b = await res.json();
    if (b.public) {
      console.warn(`\n!!! WARNING: the Supabase bucket "${BUCKET}" is PUBLIC. Make it private: Supabase > Storage > ${BUCKET} > Edit bucket > turn off "Public bucket".\n`);
    }
    return;
  }
  const made = await request(`${BASE}/storage/v1/bucket`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  }, "Bucket create");
  if (!made.ok) throw new Error(`Could not create the storage bucket "${BUCKET}" (${made.status}): ${await detail(made)}`);
}

module.exports = { save, load, remove, init, BUCKET };
