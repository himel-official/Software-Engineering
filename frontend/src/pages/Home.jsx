import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CrimeMap from "../components/CrimeMap";
import ContactBox from "../components/ContactBox";
import { useAuth } from "../AuthContext";
import { useMeta } from "../MetaContext";
import { api } from "../api";
import { fmtTime, timeAgo, distanceKm } from "../utils";

const PERIODS = [
  { key: "all", label: "All time", days: null },
  { key: "30", label: "30 days", days: 30 },
  { key: "7", label: "7 days", days: 7 },
];
const NEAR_KM = 5;
const PAGE = 10;

export default function Home() {
  const { user } = useAuth();
  const meta = useMeta();
  const mapRef = useRef(null);

  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [me, setMe] = useState(null); // visitor's current location {lat, lng, accuracy}
  const [geoMsg, setGeoMsg] = useState("");
  const [fly, setFly] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [hidden, setHidden] = useState(new Set()); // crime types switched off by clicking them
  const [period, setPeriod] = useState("all");
  const [scope, setScope] = useState("all"); // "all" or "near"
  const [sort, setSort] = useState("new");
  const [shown, setShown] = useState(PAGE);

  // Public posts (reload when login state changes: verified investigators get exact locations)
  useEffect(() => {
    api("/reports/map").then((d) => setReports(d.reports)).catch((e) => setError(e.message));
  }, [user]);

  function locate() {
    if (!navigator.geolocation) return setGeoMsg("Your browser does not support location.");
    setGeoMsg("Finding your location...");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        setMe(here);
        setFly([here.lat, here.lng]);
        setGeoMsg("");
      },
      () => setGeoMsg("Location is blocked. Allow location access in your browser to see where you are on the map."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
  useEffect(() => { locate(); }, []); // ask for location once when the page opens

  // Add distance from me to every post
  const posts = useMemo(() => reports.map((r) => ({ ...r, dist: me ? distanceKm(me, r) : null })), [reports, me]);

  // ----- statistics -----
  const statPosts = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period).days;
    return posts.filter((r) => {
      if (days && Date.now() - new Date(r.occurred_at).getTime() > days * 86400000) return false;
      if (scope === "near" && !(r.dist !== null && r.dist <= NEAR_KM)) return false;
      return true;
    });
  }, [posts, period, scope]);

  const statRows = useMemo(() => {
    if (!meta) return [];
    const counts = {};
    statPosts.forEach((r) => (counts[r.type] = (counts[r.type] || 0) + 1));
    return meta.crimeTypes.map((t) => ({ ...t, n: counts[t.key] || 0 })).sort((a, b) => b.n - a.n);
  }, [meta, statPosts]);

  // ----- map + feed (filtered by the clicked crime types) -----
  const visible = useMemo(() => posts.filter((r) => !hidden.has(r.type)), [posts, hidden]);
  const feed = useMemo(() => {
    const list = [...visible];
    if (sort === "near" && me) list.sort((a, b) => a.dist - b.dist);
    else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return list;
  }, [visible, sort, me]);

  const typeOf = (key) => meta?.crimeTypes.find((t) => t.key === key);

  function toggle(key) {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    setShown(PAGE);
  }

  function showOnMap(r) {
    setFocusId(r.id);
    setFly([r.lat, r.lng]);
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="page wide">
      <section className="hero">
        <div>
          <h1>Crime in your area</h1>
          <p className="muted">Reports from your community, shown without anyone's identity. Dots fade as crimes get older.</p>
        </div>
        {!user && <Link to="/register" className="btn">Register to report a crime</Link>}
        {user?.role === "user" && <Link to="/report" className="btn">+ Report a crime</Link>}
      </section>

      {error && <p className="error">{error}</p>}

      <div className="home-grid" ref={mapRef}>
        <div className="home-map">
          <CrimeMap
            reports={visible}
            meta={meta}
            me={me}
            flyTo={fly}
            highlightId={focusId}
            renderPopup={(r, t) => (
              <div className="popup">
                <strong style={{ color: t.color }}>{t.label}</strong>
                <div className="muted">Happened {fmtTime(r.occurred_at)} ({timeAgo(r.occurred_at)})</div>
                <p>{r.description}</p>
                <ContactBox report={r} />
              </div>
            )}
          />
          <button className="secondary small locate-btn" onClick={locate}>📍 My location</button>
        </div>

        <aside className="stats-panel card">
          <h2>Crime statistics</h2>

          <div className="seg">
            {PERIODS.map((p) => (
              <button key={p.key} className={period === p.key ? "on" : ""} onClick={() => setPeriod(p.key)}>{p.label}</button>
            ))}
          </div>
          <div className="seg">
            <button className={scope === "all" ? "on" : ""} onClick={() => setScope("all")}>Everywhere</button>
            <button className={scope === "near" ? "on" : ""} onClick={() => setScope("near")} disabled={!me} title={me ? "" : "Allow location to use this"}>
              Within {NEAR_KM} km of me
            </button>
          </div>

          <p className="total"><strong>{statPosts.length}</strong> {statPosts.length === 1 ? "crime" : "crimes"} reported</p>

          <ul className="stat-list">
            {statRows.map((t) => (
              <li key={t.key} className={(hidden.has(t.key) ? "off " : "") + (t.n === 0 ? "zero" : "")} onClick={() => toggle(t.key)} style={{ "--c": t.color }}>
                <strong>{t.label}:</strong> {t.n}
              </li>
            ))}
          </ul>
          <p className="muted small-text">Click a crime type to hide or show it on the map and in the posts.</p>
          {geoMsg && <p className="note">{geoMsg}</p>}
        </aside>
      </div>

      <div className="row between posts-head">
        <h2>Public posts <span className="muted">({feed.length})</span></h2>
        <label className="inline">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="new">Newest</option>
            <option value="near" disabled={!me}>Nearest to me</option>
          </select>
        </label>
      </div>

      {feed.length === 0 && <p className="muted">No posts to show.</p>}
      <div className="posts">
        {feed.slice(0, shown).map((r) => {
          const t = typeOf(r.type);
          return (
            <article key={r.id} className="post card">
              <div className="row between">
                <strong>
                  <span className="dot" style={{ background: t?.color }} /> {t?.label || r.type}
                  {t?.permanent && <span className="tag serious">Serious</span>}
                </strong>
                <span className="muted small-text">Posted {timeAgo(r.created_at)}</span>
              </div>
              <div className="muted small-text">
                Happened {fmtTime(r.occurred_at)}
                {r.dist !== null && ` · ${r.dist < 1 ? Math.round(r.dist * 1000) + " m" : r.dist.toFixed(1) + " km"} from you`}
              </div>
              <p>{r.description}</p>
              <div className="row">
                <button className="secondary small" onClick={() => showOnMap(r)}>📍 Show on map</button>
              </div>
              {user?.role === "investigator" && (
                <details className="contact">
                  <summary>Contact the reporter</summary>
                  <ContactBox report={r} />
                </details>
              )}
            </article>
          );
        })}
      </div>
      {feed.length > shown && (
        <div className="center"><button className="secondary" onClick={() => setShown(shown + PAGE)}>Show more posts</button></div>
      )}
    </div>
  );
}
