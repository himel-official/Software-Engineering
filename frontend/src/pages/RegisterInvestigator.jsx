import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function RegisterInvestigator() {
  const { registerInvestigator } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "", email: "", password: "", nid: "",
    fullName: "", jobType: "police", organization: "", jobTitle: "", workIdNumber: "", about: "",
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!file) return setError("Please upload your ID card (JPG, PNG or PDF)");
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.append(k, v));
    data.append("idCard", file); // the file goes last
    setBusy(true);
    try {
      await registerInvestigator(data);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <h1>Investigator registration</h1>
      <p className="muted">
        For police officers and journalists. An administrator will manually check your ID card. Until then your account shows as
        <strong> Unverified</strong> and you cannot contact reporters.
      </p>
      <form onSubmit={submit} className="stack card">
        {error && <p className="error">{error}</p>}
        <label>Username <input name="username" value={form.username} onChange={set} /></label>
        <label>Email <input name="email" type="email" value={form.email} onChange={set} /></label>
        <label>Password <small>(at least 10 characters)</small>
          <input name="password" type="password" value={form.password} onChange={set} autoComplete="new-password" />
        </label>
        <label>National ID (NID) number <input name="nid" value={form.nid} onChange={set} inputMode="numeric" autoComplete="off" /></label>

        <hr />
        <label>Full name <input name="fullName" value={form.fullName} onChange={set} /></label>
        <label>I am a
          <select name="jobType" value={form.jobType} onChange={set}>
            <option value="police">Police officer</option>
            <option value="journalist">Journalist</option>
          </select>
        </label>
        <label>Organization <small>(police station / unit, or news outlet)</small>
          <input name="organization" value={form.organization} onChange={set} />
        </label>
        <label>Job title / rank <input name="jobTitle" value={form.jobTitle} onChange={set} /></label>
        <label>Work ID / badge / press card number <small>(optional)</small>
          <input name="workIdNumber" value={form.workIdNumber} onChange={set} />
        </label>
        <label>Anything else we should know? <small>(optional)</small>
          <textarea name="about" rows={3} maxLength={500} value={form.about} onChange={set} />
        </label>
        <label>Photo or scan of your ID card <small>(JPG, PNG or PDF, max 5 MB)</small>
          <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setFile(e.target.files[0] || null)} />
        </label>

        <div className="note">Your NID and ID card are stored encrypted and can only be viewed by administrators.</div>
        <button disabled={busy}>{busy ? "Submitting..." : "Submit for verification"}</button>
        <p><Link to="/register">Register as a regular user instead</Link></p>
      </form>
    </div>
  );
}
