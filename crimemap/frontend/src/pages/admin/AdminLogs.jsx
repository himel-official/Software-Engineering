import { useEffect, useState } from "react";
import AdminNav from "../../components/AdminNav";
import { api } from "../../api";
import { fmtTime } from "../../utils";

export default function AdminLogs() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/admin/logs?page=${page}`).then(setData).catch((e) => setError(e.message));
  }, [page]);

  async function check() {
    setIntegrity(null);
    try {
      setIntegrity(await api("/admin/logs/verify"));
    } catch (e) {
      setError(e.message);
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="page">
      <h1>Admin audit log</h1>
      <AdminNav />
      <p className="muted">
        Permanent record of admin activity, including IP addresses. Entries cannot be edited or deleted, and each one is chained
        to the previous entry by a hash so any tampering can be detected. Only admins can see this page.
      </p>

      <div className="row">
        <button className="secondary" onClick={check}>🔒 Check log integrity</button>
        {integrity && (
          integrity.ok
            ? <span className="ok">Chain intact - {integrity.count} entries verified, no tampering found.</span>
            : <span className="error">TAMPERING DETECTED at entry #{integrity.brokenAtId}!</span>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p>Loading...</p>}
      {data && (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Time</th><th>Event</th><th>IP address</th><th>Entry hash</th></tr></thead>
              <tbody>
                {data.logs.map((l) => (
                  <tr key={l.id}>
                    <td>{l.id}</td>
                    <td className="nowrap">{fmtTime(l.ts)}</td>
                    <td className="wrap">{l.message}</td>
                    <td><code>{l.ip || "-"}</code></td>
                    <td><code title={l.hash}>{l.hash.slice(0, 10)}…</code></td>
                  </tr>
                ))}
                {data.logs.length === 0 && <tr><td colSpan={5} className="muted">No entries yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="row">
            <button className="secondary small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Newer</button>
            <span>Page {page} of {pages}</span>
            <button className="secondary small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older →</button>
          </div>
        </>
      )}
    </div>
  );
}
