import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await login(email, password);
      navigate(u.role === "admin" ? "/admin" : "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <h1>Login to SafeVoice</h1>
      <form onSubmit={submit} className="stack card">
        {error && <p className="error">{error}</p>}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <button disabled={busy}>{busy ? "Logging in..." : "Login"}</button>
        <p>No account? <Link to="/register">Register</Link></p>
      </form>
    </div>
  );
}
