import { useEffect } from "react";
import { useAuth } from "../AuthContext";
import { useNotifications } from "../NotificationContext";
import { api } from "../api";

// Sends the device location to SafeVoice every 2 minutes while the site is open (and when the tab comes back to the front).
// This is what makes "crime within 5 km of you" alerts possible. Only the latest point is stored.
// Renders nothing. Only for regular users and investigators.
export default function LocationTracker() {
  const { user } = useAuth();
  const { refresh } = useNotifications();
  const enabled = !!user && (user.role === "user" || user.role === "investigator");

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;
    let last = 0;

    function send() {
      if (Date.now() - last < 20000) return; // never more often than every 20 seconds
      last = Date.now();
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          try {
            const d = await api("/location", { method: "POST", body: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy } });
            if (d.newNotifications) refresh();
          } catch { /* try again next time */ }
        },
        () => {}, // location blocked or unavailable: nothing to send
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
      );
    }

    send();
    const timer = setInterval(send, 2 * 60 * 1000);
    const onVisible = () => document.visibilityState === "visible" && send();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, refresh]);

  return null;
}
