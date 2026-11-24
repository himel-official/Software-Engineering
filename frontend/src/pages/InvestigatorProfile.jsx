import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Badge from "../components/Badge";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import { fmtTime } from "../utils";

export default function InvestigatorProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const isMe = user?.role === "investigator" && String(user.id) === String(id);

  useEffect(() => {
    setP(null);
    setError("");
    api(`/investigators/${encodeURIComponent(id)}`)
      .then((d) => { setP(d.profile); setBio(d.profile.bio || ""); })
      .catch((e) => setError(e.message));
  }, [id]);

  async function save(e) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/investigators/me", { method: "PUT", body: { bio } });
      setP({ ...p, bio: bio.trim() });
      setMsg("Profile saved");
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <div className="page narrow">
      {error && <p className="error">{error}</p>}
      {!p && !error && <p>Loading...</p>}
      {p && (
        <>
          <div className="card profile-head">
            <div className="avatar">{p.username[0].toUpperCase()}</div>
            <div>
              <h1>{p.username}</h1>
              <Badge status={p.status} jobType={p.jobType} />
            </div>
          </div>

          {isMe && p.status !== "verified" && (
            <p className="note">
              Your account is <strong>unverified</strong>. An administrator is checking your ID card. Until then you can browse the map but cannot contact reporters.
            </p>
          )}

          <div className="card">
            <h2>About</h2>
            <p className="pre">{p.bio || <span className="muted">This investigator has not written anything yet.</span>}</p>
            <dl className="details">
              <dt>Role</dt><dd>{p.jobType === "police" ? "Police officer" : "Journalist"}</dd>
              <dt>Verification</dt>
              <dd>{p.status === "verified" ? `Verified by an administrator on ${fmtTime(p.verifiedAt).split(",").slice(0, 2).join(",")}` : "Not verified yet"}</dd>
              <dt>Member since</dt><dd>{fmtTime(p.memberSince).split(",").slice(0, 2).join(",")}</dd>
              <dt>Conversations started</dt><dd>{p.conversations}</dd>
            </dl>
            <p className="muted small-text">Real name, organization and ID documents are never shown here. Only administrators can see them.</p>
          </div>

          {isMe && (
            <form className="card stack" onSubmit={save}>
              <h2>Edit your public bio</h2>
              <textarea rows={5} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell reporters who you are and what you investigate. Do not include private contact details." />
              <small className="muted">{bio.length}/500</small>
              <div className="row">
                <button>Save</button>
                {msg && <span className={msg === "Profile saved" ? "ok" : "error"}>{msg}</span>}
              </div>
            </form>
          )}
          <p><Link to="/messages">← Back to messages</Link></p>
        </>
      )}
    </div>
  );
}
