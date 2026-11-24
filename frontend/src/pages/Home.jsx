import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CrimeMap from "../components/CrimeMap";
import ContactBox from "../components/ContactBox";
import Attachments from "../components/Attachments";
import { useAuth } from "../AuthContext";
import { useMeta } from "../MetaContext";
import { useNotifications } from "../NotificationContext";
import { api } from "../api";
import { fmtTime, timeAgo, distanceKm, fmtKm } from "../utils";

const PERIODS = [
  { key: "all", label: "All time", days: null },
  { key: "30", label: "30 days", days: 30 },
  { key: "7", label: "7 days", days: 7 },
];
const NEAR_KM = 5;
const PAGE = 8;
const fileUrl = (f) => `/api/reports/files/${f.id}`;

export default function Home() {
  const { user } = useAuth();
  const meta = useMeta();
  const { unread: alerts } = useNotifications();
  const [params, setParams] = useSearchParams();
  const mapRef = useRef(null);
  const canReport = user?.role === "user" || user?.role === "investigator";

  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [me, setMe] = useState(null); // visitor's current location {lat, lng}
  const [geoMsg, setGeoMsg] = useState("");
  const [fly, setFly] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [hidden, setHidden] = useState(new Set()); // crime types switched off
  const [period, setPeriod] = useState("all");
  const [scope, setScope] = useState("all"); // "all" or "near"
  const [sort, setSort] = useState("new");
  const [search, setSearch] = useState("");
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
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        setMe(here);
        setFly([here.lat, here.lng]);
        setGeoMsg("");
      },
      () => setGeoMsg("Location is blocked. Allow location access in your browser to see where you are and what is near you."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
  useEffect(() => { locate(); }, []); // ask for location once when the page opens

  // Coming from an alert ("/?report=12"): jump to that crime on the map
  const wanted = Number(params.get("report")) || null;
  useEffect(() => {
    if (!wanted) return;
    const r = reports.find((x) => x.id === wanted);
    if (!r) return;
    setFocusId(r.id);
    setFly([r.lat, r.lng]);
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setParams({}, { replace: true });
  }, [wanted, reports, setParams]);

  // Add distance from me to every post
  const posts = useMemo(() => reports.map((r) => ({ ...r, dist: me ? distanceKm(me, r) : null })), [reports, me]);

  // ----- headline numbers (never change with the filters) -----
  const tiles = useMemo(() => {
    const week = posts.filter((r) => Date.now() - new Date(r.occurred_at).getTime() <= 7 * 86400000).length;
    const near = me ? posts.filter((r) => r.dist <= NEAR_KM).length : null;
    const serious = posts.filter((r) => meta?.crimeTypes.find((t) => t.key === r.type)?.permanent).length;
    return { total: posts.length, week, near, serious };
  }, [posts, me, meta]);

  // ----- statistics list (period + area) -----
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
  const maxN = Math.max(1, ...statRows.map((t) => t.n));

  // ----- map + feed (filtered by switched-off crime types and the search box) -----
  const visible = useMemo(() => posts.filter((r) => !hidden.has(r.type)), [posts, hidden]);
  const feed = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = visible.filter((r) => !q || r.description.toLowerCase().includes(q) || (typeOf(r.type)?.label || "").toLowerCase().includes(q));
    if (sort === "near" && me) list.sort((a, b) => a.dist - b.dist);
    else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sort, me, search, meta]);

  function typeOf(key) {
    return meta?.crimeTypes.find((t) => t.key === key);
  }

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

  const popup = (r, t) => (
    <div className="popup">
      <strong className="red-text">{t.label}</strong>
      <div className="muted">Happened {fmtTime(r.occurred_at)} ({timeAgo(r.occurred_at)})</div>
      <p>{r.description}</p>
      <Attachments files={r.files} urlFor={fileUrl} compact />
      <ContactBox report={r} />
    </div>
  );

  return (
    <div className="page wide home">
      {/* 1. Welcome banner */}
      <section className="hero2">
        <div>
          <h1>SafeVoice</h1>
          <p>Report crime without being identified, and see what is happening around you.</p>
        </div>
        <div className="row">
          {!user && <Link to="/register" className="btn light">Create an account</Link>}
          {!user && <Link to="/login" className="btn ghost">Login</Link>}
          {canReport && <Link to="/report" className="btn light">+ Report a crime</Link>}
          <Link to="/map" className="btn ghost">Full map</Link>
        </div>
      </section>

      {canReport && alerts > 0 && (
        <Link to="/notifications" className="alert-strip">
          🔔 <strong>{alerts}</strong> new crime {alerts === 1 ? "alert" : "alerts"} within {NEAR_KM} km of you <span>View →</span>
        </Link>
      )}
      {error && <p className="error">{error}</p>}

      {/* 2. Headline numbers */}
      <section className="tiles">
        <div className="tile"><div className="num">{tiles.total}</div><div className="muted">Crimes reported</div></div>
        <div className="tile"><div className="num">{tiles.week}</div><div className="muted">In the last 7 days</div></div>
        <div className="tile">
          <div className="num">{tiles.near ?? "–"}</div>
          <div className="muted">{me ? `Within ${NEAR_KM} km of you` : "Near you (allow location)"}</div>
        </div>
        <div className="tile"><div className="num">{tiles.serious}</div><div className="muted">Serious crimes</div></div>
      </section>

      {/* 3. Map + filters */}
      <section className="home-grid" ref={mapRef}>
        <div className="home-map">
          <CrimeMap reports={visible} meta={meta} me={me} flyTo={fly} highlightId={focusId} renderPopup={popup} />
          <button className="secondary small locate-btn" onClick={locate}>📍 My location</button>
          <div className="map-key"><span className="dot red" /> Crime <span className="dot blue" /> You</div>
        </div>

        <aside className="filters card">
          <h2>Crime statistics</h2>
          <div className="filter-group">
            <span className="filter-label">Period</span>
            <div className="seg">
              {PERIODS.map((p) => (
                <button key={p.key} className={period === p.key ? "on" : ""} onClick={() => setPeriod(p.key)}>{p.label}</button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span className="filter-label">Area</span>
            <div className="seg">
              <button className={scope === "all" ? "on" : ""} onClick={() => setScope("all")}>Everywhere</button>
              <button className={scope === "near" ? "on" : ""} onClick={() => setScope("near")} disabled={!me} title={me ? "" : "Allow location to use this"}>
                Within {NEAR_KM} km
              </button>
            </div>
          </div>

          <p className="total"><strong>{statPosts.length}</strong> {statPosts.length === 1 ? "crime" : "crimes"} in this selection</p>

          <ul className="type-list">
            {statRows.map((t) => (
              <li key={t.key} className={(hidden.has(t.key) ? "off " : "") + (t.n === 0 ? "zero" : "")} onClick={() => toggle(t.key)}>
                <div className="row between"><span>{t.label}</span><strong>{t.n}</strong></div>
                <div className="bar"><span style={{ width: `${(t.n / maxN) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          <p className="muted small-text">Click a crime type to hide or show it on the map and in the posts.</p>
          {geoMsg && <p className="note">{geoMsg}</p>}
        </aside>
      </section>

      {/* 4. Public posts */}
      <section>
        <div className="feed-head">
          <h2>Public posts <span className="muted">({feed.length})</span></h2>
          <div className="row">
            <input className="search" type="search" placeholder="Search posts..." value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE); }} />
            <label className="inline">
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="new">Newest</option>
                <option value="near" disabled={!me}>Nearest to me</option>
              </select>
            </label>
          </div>
        </div>

        {feed.length === 0 && <div className="card empty"><strong>No posts to show</strong><p className="muted">Try another period, crime type or search.</p></div>}
        <div className="posts">
          {feed.slice(0, shown).map((r) => {
            const t = typeOf(r.type);
            return (
              <article key={r.id} className="post card">
                <div className="row between">
                  <strong className="post-title">
                    <span className="dot red" /> {t?.label || r.type}
                    {t?.permanent && <span className="tag serious">Serious</span>}
                    {r.mine && <span className="tag mine">Your report</span>}
                  </strong>
                  <span className="muted small-text">Posted {timeAgo(r.created_at)}</span>
                </div>
                <div className="muted small-text">
                  Happened {fmtTime(r.occurred_at)}
                  {r.dist !== null && ` · ${fmtKm(r.dist)} from you`}
                </div>
                <p>{r.description}</p>
                <Attachments files={r.files} urlFor={fileUrl} />
                <div className="row">
                  <button className="secondary small" onClick={() => showOnMap(r)}>📍 Show on map</button>
                </div>
                {user?.role === "investigator" && !r.mine && (
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
      </section>
    </div>
  );
}
