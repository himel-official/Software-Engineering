import { useEffect, useState } from "react";
import AdminNav from "../../components/AdminNav";
import { api } from "../../api";
import { fmtTime } from "../../utils";

export default function AdminChats() {
  const [threads, setThreads] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api("/admin/chats").then((d) => setThreads(d.threads)).catch((e) => setError(e.message)); }, []);

  async function view(id) {
    setError("");
    try {
      setOpen(await api(`/admin/chats/${id}`)); // reading a chat is written to the audit log
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="page">
      <h1>Chats</h1>
      <AdminNav />
      <p className="muted">Read-only. Opening a chat is written to the permanent audit log.</p>
      {error && <p className="error">{error}</p>}
      <div className="chat-layout">
        <div className="chat-list card">
          {!threads && <p>Loading...</p>}
          {threads?.length === 0 && <p className="muted">No chats yet.</p>}
          {threads?.map((t) => (
            <div key={t.id} className={"chat-item" + (open?.thread.id === t.id ? " active" : "")} onClick={() => view(t.id)}>
              <strong>#{t.id} {t.investigator} ↔ {t.reporter}</strong>
              <div className="muted small-text">Report #{t.report_id} ({t.typeLabel}) - {t.messages} messages</div>
            </div>
          ))}
        </div>
        <div className="chat-window card">
          {!open && <p className="muted">Select a chat to read it.</p>}
          {open && (
            <div className="messages">
              {open.messages.map((m) => (
                <div key={m.id} className="admin-msg">
                  <strong>{m.from}</strong> <small>{fmtTime(m.createdAt)}</small>
                  <div>{m.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
