import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNotifications } from "../NotificationContext";
import { fmtTime, timeAgo, fmtKm } from "../utils";

// "A crime happened near you" alerts
export default function Notifications() {
  const { items, unread, markRead, refresh } = useNotifications();
  const [perm, setPerm] = useState(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [geo, setGeo] = useState("unknown"); // granted | denied | prompt | unknown

  useEffect(() => {
    refresh();
    navigator.permissions?.query({ name: "geolocation" }).then((s) => {
      setGeo(s.state);
      s.onchange = () => setGeo(s.state);
    }).catch(() => {});
  }, [refresh]);

  async function enableBrowser() {
    setPerm(await Notification.requestPermission());
  }

  return (
    <div className="page">
      <div className="row between">
        <h1>🔔 Crime alerts near you</h1>
        {unread > 0 && <button className="secondary small" onClick={() => markRead({ all: true })}>Mark all as read</button>}
      </div>
      <p className="muted">
        You are alerted when a crime is reported within 5 km of your last known location. Your location updates while SafeVoice is open in your browser.
      </p>

      {geo === "denied" && (
        <p className="note warn">Location is blocked for this site, so SafeVoice cannot tell when a crime happens near you. Allow location access in your browser settings.</p>
      )}
      {perm === "default" && (
        <div className="note row between">
          <span>Want a pop-up when a new alert arrives (while SafeVoice is open in a tab)?</span>
          <button className="small" onClick={enableBrowser}>Turn on pop-ups</button>
        </div>
      )}
      {perm === "denied" && <p className="muted small-text">Pop-up notifications are blocked in your browser. Alerts still appear here and on the 🔔 button.</p>}

      {items.length === 0 && (
        <div className="card empty">
          <strong>No alerts yet</strong>
          <p className="muted">When a crime is reported near you, it will show up here.</p>
        </div>
      )}
      <div className="alerts">
        {items.map((n) => (
          <div key={n.id} className={"alert card" + (n.read ? "" : " unread-alert")}>
            <div className="row between">
              <strong><span className="dot red" /> {n.typeLabel} reported {fmtKm(n.distanceKm)} from you</strong>
              <span className="muted small-text">{timeAgo(n.createdAt)}</span>
            </div>
            <div className="muted small-text">Happened {fmtTime(n.occurredAt)}</div>
            <div className="row top-gap">
              <Link className="btn small" to={`/?report=${n.reportId}`} onClick={() => !n.read && markRead({ ids: [n.id] })}>📍 View on map</Link>
              {!n.read && <button className="secondary small" onClick={() => markRead({ ids: [n.id] })}>Mark as read</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
