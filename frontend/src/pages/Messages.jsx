import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Badge from "../components/Badge";
import Attachments from "../components/Attachments";
import FilePicker from "../components/FilePicker";
import { useUnread } from "../UnreadContext";
import { fmtTime } from "../utils";

export default function Messages() {
  const { refresh: refreshUnread } = useUnread();
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]); // at most one attachment per message
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const lastId = useRef(0);
  const bottom = useRef(null);

  const loadThreads = useCallback(() => api("/chats").then((d) => setThreads(d.threads)).catch(() => {}), []);

  // Chat list: refresh every 8 seconds
  useEffect(() => {
    loadThreads();
    const t = setInterval(loadThreads, 8000);
    return () => clearInterval(t);
  }, [loadThreads]);

  // Fetch only messages newer than the last one we have. Opening a chat marks its messages as read.
  const loadMessages = useCallback(async () => {
    if (!active) return;
    try {
      const d = await api(`/chats/${active}?after=${lastId.current}`);
      setThread(d.thread);
      if (d.messages.length) {
        lastId.current = d.messages[d.messages.length - 1].id;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...d.messages.filter((m) => !seen.has(m.id))];
        });
        refreshUnread(); // the counter on the Messages button goes down
        loadThreads();
      }
    } catch { /* ignore, will retry */ }
  }, [active, refreshUnread, loadThreads]);

  // Open chat: refresh every 3 seconds
  useEffect(() => {
    if (!active) return;
    lastId.current = 0;
    setMessages([]);
    setThread(null);
    setFiles([]);
    setError("");
    loadMessages();
    const t = setInterval(loadMessages, 3000);
    return () => clearInterval(t);
  }, [active, loadMessages]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim() && files.length === 0) return;
    setError("");
    const data = new FormData();
    data.append("message", text);
    if (files[0]) data.append("file", files[0]);
    setSending(true);
    try {
      await api(`/chats/${active}/messages`, { method: "POST", body: data });
      setText("");
      setFiles([]);
      loadMessages();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page">
      <h1>Messages</h1>
      <p className="muted">Chats are private and permanent: messages cannot be edited or deleted. Pictures, videos, PDFs and documents you share here are encrypted and can only be opened by the two of you and by site administrators (every admin look is logged). Investigators start the conversation.</p>
      <div className="chat-layout">
        <div className="chat-list card">
          {threads.length === 0 && <p className="muted">No conversations yet.</p>}
          {threads.map((t) => (
            <div key={t.id} className={"chat-item" + (active === t.id ? " active" : "")} onClick={() => setActive(t.id)}>
              <div className="row between">
                <strong>{t.title}</strong>
                <span className="row tight">
                  {t.status && <Badge status={t.status} jobType={t.jobType} />}
                  {t.unread > 0 && <span className="unread">{t.unread}</span>}
                </span>
              </div>
              <div className="muted small-text">{t.subtitle}</div>
              <div className={"preview" + (t.unread > 0 ? " bold" : "")}>{t.lastMessage}</div>
            </div>
          ))}
        </div>

        <div className="chat-window card">
          {!active && <p className="muted">Select a conversation.</p>}
          {active && (
            <>
              {thread && (
                <div className="chat-head">
                  {thread.username ? <Link to={`/investigators/${thread.investigatorId}`}><strong>{thread.title}</strong></Link> : <strong>{thread.title}</strong>}{" "}
                  {thread.status && <Badge status={thread.status} jobType={thread.jobType} />}
                  <div className="muted small-text">{thread.subtitle}{thread.username && " · click the name to see their profile"}</div>
                </div>
              )}
              <div className="messages">
                {messages.map((m) => (
                  <div key={m.id} className={"bubble " + (m.mine ? "mine" : "theirs")}>
                    {m.text && <div>{m.text}</div>}
                    <Attachments files={m.file ? [m.file] : []} urlFor={(f) => `/api/chats/${active}/files/${f.id}`} />
                    <small>{fmtTime(m.createdAt)}</small>
                  </div>
                ))}
                <div ref={bottom} />
              </div>
              {error && <p className="error">{error}</p>}
              <form onSubmit={send} className="stack tight">
                <FilePicker files={files} onChange={setFiles} max={1} onError={setError} label="📎 Attach" disabled={sending} />
                <div className="row">
                  <input className="grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." maxLength={2000} />
                  <button disabled={sending}>{sending ? "Sending..." : "Send"}</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
