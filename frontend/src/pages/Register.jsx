import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Register() {
  const { registerUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "", nid: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await registerUser(form);
      navigate("/report");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <h1>Create an account</h1>
      <form onSubmit={submit} className="stack card">
        {error && <p className="error">{error}</p>}
        <label>Username <small>(shown only to you and admins, never on reports)</small>
          <input name="username" value={form.username} onChange={set} autoComplete="username" />
        </label>
        <label>Email <input name="email" type="email" value={form.email} onChange={set} autoComplete="email" /></label>
        <label>Password <small>(at least 10 characters)</small>
          <input name="password" type="password" value={form.password} onChange={set} autoComplete="new-password" />
        </label>
        <label>National ID (NID) number
          <input name="nid" value={form.nid} onChange={set} inputMode="numeric" autoComplete="off" />
        </label>

        <div className="note">
          <strong>How your privacy works</strong>
          <ul>
            <li>Your NID is encrypted and is used only to make sure each person has one account.</li>
            <li>The public map and investigators never see your name, email, username or NID. Reports are shown without any identity.</li>
            <li>Site administrators can see account details when needed. Every time they look, it is written to a permanent log.</li>
          </ul>
        </div>

        <button disabled={busy}>{busy ? "Creating..." : "Register"}</button>
        <p>Already registered? <Link to="/login">Login</Link></p>
        <p>Are you a police officer or journalist? <Link to="/register/investigator">Register as an investigator</Link></p>
      </form>
    </div>
  );
}
