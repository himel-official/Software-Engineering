import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../api";

// "Contact reporter" box. Shows nothing unless the viewer is an investigator (and the report is not their own).
export default function ContactBox({ report }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (user?.role !== "investigator" || report.mine) return null;
  if (user.investigator?.status !== "verified") {
    return <p className="note">Your ID is not verified yet. You can contact reporters once an admin verifies you.</p>;
  }
  if (sent) return <p className="ok">Message sent. Continue the conversation in <Link to="/messages">Messages</Link>.</p>;

  async function send() {
    setError("");
    try {
      await api("/chats", { method: "POST", body: { reportId: report.id, message: text } });
      setSent(true);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="stack">
      <textarea rows={3} placeholder="Write a question to the reporter..." value={text} onChange={(e) => setText(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="small" onClick={send} disabled={!text.trim()}>Contact reporter</button>
    </div>
  );
}
