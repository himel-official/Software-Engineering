import { useNavigate } from "react-router-dom";
import ReportForm from "../components/ReportForm";
import { api } from "../api";

export default function ReportCrime() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <h1>Report a crime</h1>
      <p className="muted">Your name is never shown. Only the crime type, time, place and description appear on the map.</p>
      <div className="card">
        <ReportForm
          submitLabel="Submit report"
          onSubmit={async (values) => {
            await api("/reports", { method: "POST", body: values });
            navigate("/my-reports");
          }}
        />
      </div>
    </div>
  );
}
