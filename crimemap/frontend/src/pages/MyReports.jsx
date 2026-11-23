import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ReportForm from "../components/ReportForm";
import Attachments from "../components/Attachments";
import { useMeta } from "../MetaContext";
import { api } from "../api";
import { fmtTime } from "../utils";

const STATUS = { active: "Visible on map", withdrawn: "Withdrawn", hidden: "Hidden by a moderator" };

export default function MyReports() {
  const meta = useMeta();
  const [reports, setReports] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = () => api("/reports/mine").then((d) => setReports(d.reports)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function withdraw(id) {
    if (!confirm("Remove this report from the map?")) return;
    try {
      await api(`/reports/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const label = (key) => meta?.crimeTypes.find((t) => t.key === key)?.label || key;
  const color = (key) => meta?.crimeTypes.find((t) => t.key === key)?.color || "#dc2626";

  return (
    <div className="page">
      <div className="row between">
        <h1>My reports</h1>
        <Link to="/report" className="btn">+ New report</Link>
      </div>
      {error && <p className="error">{error}</p>}
      {!reports && <p>Loading...</p>}
      {reports && reports.length === 0 && <p className="muted">You have not reported anything yet.</p>}

      {reports?.map((r) => (
        <div key={r.id} className="card">
          {editing === r.id ? (
            <ReportForm
              initial={r}
              submitLabel="Save changes"
              onCancel={() => setEditing(null)}
              onSubmit={async (values) => {
                await api(`/reports/${r.id}`, { method: "PUT", body: values });
                setEditing(null);
                load();
              }}
            />
          ) : (
            <>
              <div className="row between">
                <strong><span className="dot" style={{ background: color(r.type) }} /> {label(r.type)}</strong>
                <span className={`tag ${r.status}`}>{STATUS[r.status]}</span>
              </div>
              <div className="muted">Happened {fmtTime(r.occurred_at)}</div>
              <p>{r.description}</p>
              <Attachments files={r.files} urlFor={(f) => `/api/reports/files/${f.id}`} />
              {r.investigators_contacted > 0 && (
                <p className="note">{r.investigators_contacted} investigator(s) contacted you about this report. See <Link to="/messages">Messages</Link>.</p>
              )}
              {r.status !== "hidden" && (
                <div className="row">
                  <button className="secondary small" onClick={() => setEditing(r.id)}>Edit</button>
                  {r.status === "active" && <button className="danger small" onClick={() => withdraw(r.id)}>Remove from map</button>}
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
