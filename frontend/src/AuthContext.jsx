import { createContext, useContext, useState, useEffect } from "react";
import { api } from "./api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On page load, ask the backend who is logged in (the cookie tells it)
  useEffect(() => {
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function login(identifier, password) {
    const d = await api("/auth/login", { method: "POST", body: { identifier, password } });
    setUser(d.user);
    return d.user;
  }
  async function registerUser(form) {
    const d = await api("/auth/register", { method: "POST", body: form });
    setUser(d.user);
  }
  async function registerInvestigator(formData) {
    const d = await api("/auth/register-investigator", { method: "POST", body: formData });
    setUser(d.user);
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, registerUser, registerInvestigator, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
