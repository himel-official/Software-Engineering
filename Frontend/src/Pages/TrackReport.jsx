// src/Pages/TrackReport.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router";
import {
  Search,
  ShieldCheck,
  Clock,
  MapPin,
  TriangleAlert,
  CheckCircle2,
  History,
  Paperclip,
} from "lucide-react";
import api, { extractErrorMessage } from "../api/client";
import { listSavedReports, removeReport } from "../utils/savedReports";

const STATUS_STYLES = {
  submitted: "bg-gray-100 text-gray-700",
  "under-review": "bg-blue-100 text-blue-700",
  investigating: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-slate-200 text-slate-700",
};

export default function TrackReport() {
  const [searchParams] = useSearchParams();
  const [reference, setReference] = useState(searchParams.get("reference") || "");
  const [accessKey, setAccessKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const [saved, setSaved] = useState(listSavedReports());

  useEffect(() => {
    setSaved(listSavedReports());
  }, []);

  const handleLookup = async (event) => {
    event.preventDefault();
    setError("");

    if (!reference.trim() || !accessKey.trim()) {
      setError("Both the reference number and the access key are required.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get("/reports/track/", {
        params: {
          reference: reference.trim(),
          access_key: accessKey.trim(),
        },
      });
      setReport(data.data);
    } catch (err) {
      console.error(err);
      setReport(null);
      setError(
        extractErrorMessage(
          err,
          "No report matches that reference number and access key."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const applySaved = (entry) => {
    setReference(entry.reference_number);
    setAccessKey(entry.access_key);
    setError("");
  };

  const forget = (entry) => {
    removeReport(entry.reference_number);
    setSaved(listSavedReports());
  };

  return (
    <div className="w-full mt-20 min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 md:p-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Search size={24} className="text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Track Your Report</h1>
          </div>
          <p className="text-gray-600 mb-8">
            Enter the reference number and access key you were given when you
            submitted the report.
          </p>

          <form onSubmit={handleLookup} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Reference Number
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="SV-XXXXXXXXXX"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Access Key</label>
              <input
                type="text"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="Your private access key"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-semibold transition"
            >
              {loading ? "Looking up..." : "Track Report"}
            </button>
          </form>

          {saved.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Reports saved on this device
              </h2>
              <ul className="space-y-2">
                {saved.map((entry) => (
                  <li
                    key={entry.reference_number}
                    className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-semibold text-gray-900 text-sm">
                        {entry.reference_number}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {entry.category || "Report"} ·{" "}
                        {entry.submitted_at
                          ? new Date(entry.submitted_at).toLocaleDateString()
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => applySaved(entry)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-md hover:bg-indigo-50"
                    >
                      Use
                    </button>
                    <button
                      type="button"
                      onClick={() => forget(entry)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-md hover:bg-red-50"
                    >
                      Forget
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {report && (
          <div className="mt-6 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-900 px-8 py-6 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-widest">
                  Reference
                </p>
                <p className="text-white text-2xl font-bold tracking-widest">
                  {report.reference_number}
                </p>
              </div>
              <span
                className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  STATUS_STYLES[report.status_slug] || "bg-gray-200 text-gray-700"
                }`}
              >
                {report.status_name}
              </span>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <Detail icon={<TriangleAlert size={16} />} label="Category">
                  {report.category_name}
                </Detail>
                <Detail icon={<Clock size={16} />} label="Incident date">
                  {report.incident_datetime
                    ? new Date(report.incident_datetime).toLocaleString()
                    : "Not provided"}
                </Detail>
                <Detail icon={<MapPin size={16} />} label="Location">
                  {report.location_text || "Not provided"}
                </Detail>
                <Detail icon={<ShieldCheck size={16} />} label="Submitted">
                  {new Date(report.submitted_at).toLocaleString()}
                </Detail>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Description
                </h3>
                <p className="p-4 bg-gray-50 rounded-lg text-gray-800 whitespace-pre-wrap">
                  {report.description}
                </p>
              </div>

              {report.is_flagged && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
                  <strong>Flagged by an administrator.</strong>{" "}
                  {report.flag_reason}
                </div>
              )}

              {report.evidence?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-2">
                    <Paperclip size={14} /> Evidence ({report.evidence.length})
                  </h3>
                  <ul className="space-y-2">
                    {report.evidence.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5"
                      >
                        <Paperclip size={14} className="text-gray-400 shrink-0" />
                        <span className="text-sm text-gray-700 truncate flex-1">
                          {item.file_name}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {(item.file_size / 1024).toFixed(0)} KB
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.status_history?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-2">
                    <History size={15} /> Status history
                  </h3>
                  <ol className="space-y-3 border-l-2 border-gray-200 pl-5">
                    {report.status_history.map((entry, index) => (
                      <li key={`${entry.changed_at}-${index}`} className="relative">
                        <span className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-indigo-500" />
                        <p className="text-sm font-medium text-gray-900">
                          {entry.old_status_name
                            ? `${entry.old_status_name} → ${entry.new_status_name}`
                            : entry.new_status_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(entry.changed_at).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex items-start gap-2">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                <span>
                  Your identity was never collected. Tracking this report does
                  not reveal who submitted it.
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-gray-600">
          Lost your access key?{" "}
          <Link to="/report" className="text-indigo-600 font-semibold hover:underline">
            Submit a new report
          </Link>{" "}
          or check the{" "}
          <Link to="/guidelines" className="text-indigo-600 font-semibold hover:underline">
            safety guidelines
          </Link>
          .
        </div>
      </div>
    </div>
  );
}

const Detail = ({ icon, label, children }) => (
  <div className="flex items-start gap-3">
    <span className="text-indigo-500 mt-0.5">{icon}</span>
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 break-words">{children}</p>
    </div>
  </div>
);
