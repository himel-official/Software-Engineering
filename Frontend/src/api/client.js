import axios from "axios";

/**
 * Single axios instance for the whole app.
 *
 * The token is read from localStorage on every request and attached as a
 * `Token` header, which is what Django REST Framework's TokenAuthentication
 * expects. A 401 response clears the stored session so the UI falls back to
 * the login screen instead of silently failing.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

export const TOKEN_KEY = "safevoice.token";
export const USER_KEY = "safevoice.user";

export const readToken = () => localStorage.getItem(TOKEN_KEY);
export const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const storeSession = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

api.interceptors.request.use((config) => {
  const token = readToken();
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
    }
    return Promise.reject(error);
  }
);

/** Normalise DRF error payloads into a single readable string. */
export const extractErrorMessage = (error, fallback = "Something went wrong.") => {
  const data = error?.response?.data;
  if (!data) return error?.message || fallback;
  if (typeof data === "string") return data;
  if (data.message) return data.message;
  if (data.errors && typeof data.errors === "object") {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first) && first.length) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return fallback;
};

export default api;
