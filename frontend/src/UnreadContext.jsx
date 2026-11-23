import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { api } from "./api";

const UnreadContext = createContext({ count: 0, refresh: () => {} });

// Keeps the number of unread messages up to date (shown on the Messages button).
export function UnreadProvider({ children }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const enabled = !!user && (user.role === "user" || user.role === "investigator");

  const refresh = useCallback(() => {
    if (!enabled) return;
    api("/chats/unread").then((d) => setCount(d.count)).catch(() => {});
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    refresh();
    const t = setInterval(refresh, 8000); // check every 8 seconds
    return () => clearInterval(t);
  }, [enabled, refresh]);

  // Also show the number in the browser tab title
  useEffect(() => {
    document.title = count > 0 ? `(${count}) CrimeMap` : "CrimeMap - report and see crime in your area";
  }, [count]);

  return <UnreadContext.Provider value={{ count, refresh }}>{children}</UnreadContext.Provider>;
}

export const useUnread = () => useContext(UnreadContext);
