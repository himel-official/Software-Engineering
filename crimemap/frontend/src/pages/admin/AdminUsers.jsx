import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminNav from "../../components/AdminNav";
import Badge from "../../components/Badge";
import { api } from "../../api";
import { fmtTime } from "../../utils";

export default function AdminUsers() {
  const [params, setParams] = useSearchParams();
  const role = params.get("role") || "";
  const status = params.get("status") || "";
  const [q, setQ] = useState("");
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const qs = new URLSearchParams({ role, status, q }).toString();
    api(`/admin/users?${qs}`).then((d) => setUsers(d.users)).catch((e) => setError(e.message));
  }, [role, status, q]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next);
  };

  return (
    <div className="page">
      <h1>Users</h1>
      <AdminNav />
      <div className="row filters">
        <select value={role} onChange={(e) => setFilter("role", e.target.value)}>
          <option value="">All roles</option>
          <option value="user">Regular users</option>
          <option value="investigator">Investigators</option>
          <option value="admin">Admins</option>
        </select>
        <select value={status} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">Any verification</option>
          <option value="unverified">Unverified</option>
          <option value="verified">Verified</option>
        </select>
        <input placeholder="Search username or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="error">{error}</p>}
      {!users && <p>Loading...</p>}
      {users && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Username</th><th>Email</th><th>Role</th><th>Verification</th><th>Joined</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td><Link to={`/admin/users/${u.id}`}>{u.username}</Link></td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.role === "investigator" ? <Badge status={u.inv_status} jobType={u.job_type} /> : "-"}</td>
                  <td>{fmtTime(u.created_at)}</td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6} className="muted">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
