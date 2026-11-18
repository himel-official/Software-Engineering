import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AdminNav from "../../components/AdminNav";
import Badge from "../../components/Badge";
import { useAuth } from "../../AuthContext";
import { api } from "../../api";
import { fmtTime } from "../../utils";

export default function AdminUserDetail() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const [u, setU] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [password, setPassword] = useState("");
  const loadedFor = useRef(null);

  // Opening this page is written to the permanent audit log (it shows the NID).
  // The ref makes sure it loads (and logs) only once per visit, even in development mode.
  useEffect(() => {
    if (loadedFor.current === id) return;
    loadedFor.current = id;
    api(`/admin/users/${id}`).then((d) => setU(d.user)).catch((e) => setError(e.message));
  }, [id]);

  async function setVerified(action) {
    setBusy(true);
    setError("");
    try {
      await api(`/admin/investigators/${id}/${action}`, { method: "POST" });
      const verified = action === "verify";
      // update the screen directly (reloading would add another "viewed" line to the log)
      setU((prev) => ({
        ...prev,
        investigator: { ...prev.investigator, status: verified ? "verified" : "unverified", verifiedBy: verified ? me.username : null, verifiedAt: verified ? new Date().toISOString() : null },
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function makeAdmin(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/admin/users/${id}/make-admin`, { method: "POST", body: { password } });
      setU((prev) => ({ ...prev, role: "admin" }));
      setInfo(`${u.username} is now an admin. They must log in again.`);
      setPromoting(false);
      setPassword("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const inv = u?.investigator;
  const cardUrl = `/api/admin/users/${id}/id-card`;

  return (
    <div className="page">
      <h1>User details</h1>
      <AdminNav />
      <p><Link to="/admin/users">← Back to users</Link></p>
      {error && <p className="error">{error}</p>}
      {info && <p className="ok">{info}</p>}
      {!u && !error && <p>Loading...</p>}
      {u && (
        <>
          <div className="card">
            <p className="note">Viewing this page was recorded in the permanent admin log.</p>
            <dl className="details">
              <dt>Username</dt><dd>{u.username}</dd>
              <dt>Email</dt><dd>{u.email}</dd>
              <dt>Role</dt><dd>{u.role}</dd>
              <dt>NID</dt><dd><code>{u.nid || "-"}</code></dd>
              <dt>Joined</dt><dd>{fmtTime(u.createdAt)}</dd>
              <dt>Account</dt><dd>{u.isActive ? "Active" : "Disabled"}</dd>
            </dl>

            {u.role !== "admin" && !promoting && (
              <div className="row top-gap">
                <button className="danger" onClick={() => setPromoting(true)}>Make admin...</button>
              </div>
            )}
            {u.role !== "admin" && promoting && (
              <form onSubmit={makeAdmin} className="stack danger-box">
                <strong>Make {u.username} an admin?</strong>
                <p className="small-text">
                  Admins can see every NID, ID card and chat, verify investigators and make other admins. {u.username} will be
                  logged out and must log in again. This is written to the permanent log and cannot be undone from this website.
                </p>
                <input type="password" placeholder="Confirm with YOUR admin password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                <div className="row">
                  <button className="danger" disabled={busy || !password}>Yes, make admin</button>
                  <button type="button" className="secondary" onClick={() => { setPromoting(false); setPassword(""); }}>Cancel</button>
                </div>
              </form>
            )}
          </div>

          {inv && (
            <div className="card">
              <div className="row between">
                <h2>Investigator details</h2>
                <Badge status={inv.status} jobType={inv.jobType} />
              </div>
              <dl className="details">
                <dt>Full name</dt><dd>{inv.fullName}</dd>
                <dt>Job type</dt><dd>{inv.jobType}</dd>
                <dt>Organization</dt><dd>{inv.organization}</dd>
                <dt>Job title</dt><dd>{inv.jobTitle}</dd>
                <dt>Work ID number</dt><dd>{inv.workIdNumber || "-"}</dd>
                <dt>About (private)</dt><dd>{inv.about || "-"}</dd>
                {inv.verifiedBy && (<><dt>Verified by</dt><dd>{inv.verifiedBy} at {fmtTime(inv.verifiedAt)}</dd></>)}
              </dl>

              <h3>ID card</h3>
              {inv.idCardMime.startsWith("image/") ? (
                <a href={cardUrl} target="_blank" rel="noreferrer"><img className="idcard" src={cardUrl} alt="ID card" /></a>
              ) : (
                <a href={cardUrl} target="_blank" rel="noreferrer" className="btn">Open ID card (PDF)</a>
              )}
              <p className="muted small-text">Each time the ID card is opened, it is written to the permanent log.</p>

              {u.role === "investigator" && (
                <div className="row">
                  {inv.status === "unverified" ? (
                    <button disabled={busy} onClick={() => setVerified("verify")}>✓ Mark as verified</button>
                  ) : (
                    <button disabled={busy} className="danger" onClick={() => setVerified("revoke")}>Mark as unverified</button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <h2>Reports by this user ({u.reports.length})</h2>
            {u.reports.length === 0 && <p className="muted">None.</p>}
            {u.reports.map((r) => (
              <p key={r.id}>
                <strong>#{r.id} {r.typeLabel}</strong> ({r.status}) - {fmtTime(r.occurred_at)} - {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
                <br />{r.description}
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
