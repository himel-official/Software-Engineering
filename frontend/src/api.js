// One helper for every backend call. The login cookie is sent automatically by the browser.
export async function api(path, { method = "GET", body } = {}) {
  const headers = { "X-Requested-With": "crimemap" }; // required by the backend (CSRF protection)
  let payload;
  if (body instanceof FormData) {
    payload = body; // file upload: the browser sets the content type itself
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch("/api" + path, { method, headers, body: payload });
  } catch {
    throw new Error("Cannot reach the server. Is the Backend window running?");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status >= 500 && !data.error) throw new Error("Cannot reach the backend. Is the Backend window running?");
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}
