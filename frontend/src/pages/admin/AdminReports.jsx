import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminNav from "../../components/AdminNav";
import { api } from "../../api";
import { fmtTime } from "../../utils";

export default function AdminReports() {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState("");
  const load = () => api("/admin/reports").then((d) => setReports(d.reports)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function act(id, action) {
    try {
      await api(`/admin/reports/${id}/${action}`, { method: "POST" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="page">
      <h1>Reports</h1>
      <AdminNav />
      <p className="muted">Hide reports that are abusive, fake or contain personal details. Hiding is written to the permanent log.</p>
      {error && <p className="error">{error}</p>}
      {!reports && <p>Loading...</p>}
      {reports && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Type</th><th>Reporter</th><th>When</th><th>Description</th><th>Files</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.typeLabel}</td>
                  <td><Link to={`/admin/users/${r.user_id}`}>{r.username}</Link></td>
                  <td>{fmtTime(r.occurred_at)}</td>
                  <td className="wrap">{r.description}</td>
                  <td>{r.files || "-"}</td>
                  <td>{r.status}</td>
                  <td>
                    {r.status === "hidden" ? (
                      <button className="small secondary" onClick={() => act(r.id, "unhide")}>Restore</button>
                    ) : (
                      <button className="small danger" onClick={() => act(r.id, "hide")}>Hide</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
