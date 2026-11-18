import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminNav from "../../components/AdminNav";
import { api } from "../../api";

export default function AdminDashboard() {
  const [s, setS] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/admin/stats").then(setS).catch((e) => setError(e.message)); }, []);

  const card = (label, value, to) => (
    <Link to={to} className="stat card" key={label}>
      <div className="num">{value}</div>
      <div className="muted">{label}</div>
    </Link>
  );

  return (
    <div className="page">
      <h1>Admin dashboard</h1>
      <AdminNav />
      {error && <p className="error">{error}</p>}
      {s && (
        <div className="stats">
          {card("Pending investigators", s.investigatorsPending, "/admin/users?role=investigator&status=unverified")}
          {card("Verified investigators", s.investigatorsVerified, "/admin/users?role=investigator&status=verified")}
          {card("Regular users", s.users, "/admin/users?role=user")}
          {card("Active reports", s.reportsActive, "/admin/reports")}
          {card("Chats", s.chats, "/admin/chats")}
          {card("Audit log entries", s.logEntries, "/admin/logs")}
        </div>
      )}
    </div>
  );
}
