import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, {
  clearSession,
  extractErrorMessage,
  readStoredUser,
  readToken,
  storeSession,
} from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readToken());
  const [user, setUser] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(Boolean(readToken()));

  // Re-validate a stored session against the server on first mount so a
  // revoked or expired token never leaves the UI in a half-authenticated state.
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const storedToken = readToken();
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me/");
        if (!cancelled) {
          setUser(data.user);
          storeSession(storedToken, data.user);
        }
      } catch {
        if (!cancelled) {
          clearSession();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await api.post("/auth/login/", { email, password });
      storeSession(data.token, data.user);
      setToken(data.token);
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, message: extractErrorMessage(error, "Invalid email or password.") };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout/");
    } catch {
      // The local session is cleared either way.
    }
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      logout,
      isAuthenticated: Boolean(token),
      isAdmin: user?.role === "ADMIN",
      isInvestigator: user?.role === "INVESTIGATOR",
    }),
    [token, user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an <AuthProvider>.");
  }
  return context;
}
