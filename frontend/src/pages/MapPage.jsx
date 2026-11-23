import { useEffect, useState } from "react";
import CrimeMap from "../components/CrimeMap";
import ContactBox from "../components/ContactBox";
import { useAuth } from "../AuthContext";
import { useMeta } from "../MetaContext";
import { api } from "../api";
import { fmtTime, timeAgo } from "../utils";

// Full-screen map version (no posts or statistics)
export default function MapPage() {
  const { user } = useAuth();
  const meta = useMeta();
  const [reports, setReports] = useState([]);
  const [me, setMe] = useState(null);
  const [fly, setFly] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/reports/map").then((d) => setReports(d.reports)).catch((e) => setError(e.message));
  }, [user]);

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        setMe(here);
        setFly([here.lat, here.lng]);
      },
      () => setError("Could not get your location")
    );
  }
  useEffect(() => { locate(); }, []);

  return (
    <div className="map-wrap">
      <CrimeMap
        reports={reports}
        meta={meta}
        me={me}
        flyTo={fly}
        renderPopup={(r, t) => (
          <div className="popup">
            <strong style={{ color: t.color }}>{t.label}</strong>
            <div className="muted">Happened {fmtTime(r.occurred_at)} ({timeAgo(r.occurred_at)})</div>
            <p>{r.description}</p>
            <ContactBox report={r} />
          </div>
        )}
      />
      <aside className="legend">
        <div className="row between">
          <strong>Full map</strong>
          <button className="secondary small" onClick={locate}>📍 My location</button>
        </div>
        {error && <p className="error">{error}</p>}
        <ul>
          {meta?.crimeTypes.map((t) => (
            <li key={t.key} style={{ cursor: "default" }}>
              <span className="dot" style={{ background: t.color }} />
              <span className="grow">{t.label}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
