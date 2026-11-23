import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { api } from "./api";

const NotificationContext = createContext({ unread: 0, items: [], refresh: () => {}, markRead: async () => {} });

// "Crime near you" alerts. Polled every 10 seconds while the site is open.
// If the person allowed browser notifications, a new alert also pops up as a system notification.
export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const seen = useRef(null); // ids already known (null until the first load, so old alerts do not pop up)
  const enabled = !!user && (user.role === "user" || user.role === "investigator");

  const refresh = useCallback(() => {
    if (!enabled) return;
    api("/notifications")
      .then((d) => {
        setUnread(d.unread);
        setItems(d.notifications);
        if (seen.current === null) {
          seen.current = new Set(d.notifications.map((n) => n.id));
          return;
        }
        const fresh = d.notifications.filter((n) => !n.read && !seen.current.has(n.id));
        fresh.forEach((n) => seen.current.add(n.id));
        if (fresh.length && typeof Notification !== "undefined" && Notification.permission === "granted") {
          const n = fresh[0];
          const body = `${n.typeLabel} reported about ${n.distanceKm < 1 ? Math.round(n.distanceKm * 1000) + " m" : n.distanceKm + " km"} from you`;
          try {
            new Notification(fresh.length > 1 ? `SafeVoice: ${fresh.length} new crimes near you` : "SafeVoice: crime near you", { body, tag: "safevoice-alert" });
          } catch { /* some browsers only allow notifications from a service worker */ }
        }
      })
      .catch(() => {});
  }, [enabled]);

  useEffect(() => {
    seen.current = null;
    if (!enabled) {
      setUnread(0);
      setItems([]);
      return;
    }
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [enabled, refresh]);

  const markRead = useCallback(
    async (body) => {
      await api("/notifications/read", { method: "POST", body });
      refresh();
    },
    [refresh]
  );

  return <NotificationContext.Provider value={{ unread, items, refresh, markRead }}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => useContext(NotificationContext);
