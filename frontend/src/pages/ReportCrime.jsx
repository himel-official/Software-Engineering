import { useNavigate } from "react-router-dom";
import ReportForm from "../components/ReportForm";
import { api } from "../api";

export default function ReportCrime() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <h1>Report a crime</h1>
      <p className="muted">Your name is never shown. The crime type, time, place, description and any files you attach appear publicly. People within 5 km of the place are alerted.</p>
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
