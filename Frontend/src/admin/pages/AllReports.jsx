// src/admin/pages/AllReports.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Flag,
  FlagOff,
  Loader2,
  X,
  MapPin,
  Calendar,
  Paperclip,
  NotebookPen,
  History,
  Download,
  Upload,
  UserCheck,
  ShieldAlert,
} from "lucide-react";
import api, { extractErrorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const STATUS_TONES = {
  submitted: "bg-gray-100 text-gray-700",
  "under-review": "bg-blue-100 text-blue-700",
  investigating: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-slate-200 text-slate-700",
};

export default function AllReports() {
  const { isAdmin } = useAuth();

  const [reports, setReports] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [investigators, setInvestigators] = useState([]);

  const [filters, setFilters] = useState({
    status: "",
    category: "",
    flagged: "",
    search: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [statusDraft, setStatusDraft] = useState("");
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [noteText, setNoteText] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.flagged) params.flagged = filters.flagged;
      if (filters.search.trim()) params.search = filters.search.trim();

      const { data } = await api.get("/reports/manage/", { params });
      setReports(data.data || []);
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not load the reports."));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(loadReports, filters.search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [loadReports, filters.search]);

  useEffect(() => {
    api.get("/report-statuses/").then(({ data }) => setStatuses(data.data || [])).catch(() => {});
    api.get("/categories/").then(({ data }) => setCategories(data.data || [])).catch(() => {});
    api
      .get("/reports/manage/investigators/")
      .then(({ data }) => setInvestigators(data.data || []))
      .catch(() => {});
  }, []);

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/reports/manage/${id}/`);
      setDetail(data.data);
      setStatusDraft(String(data.data.status.id));
      setAssigneeDraft(
        data.data.assigned_investigator_id ? String(data.data.assigned_investigator_id) : ""
      );
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not load the report details."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const statusOptions = useMemo(() => statuses, [statuses]);

  const saveStatus = async () => {
    if (!detail) return;
    setSavingStatus(true);
    setNotice("");
    setError("");
    try {
      const payload = { status_id: Number(statusDraft) };
      if (assigneeDraft) payload.assigned_investigator_id = Number(assigneeDraft);
      else payload.assigned_investigator_id = null;

      const { data } = await api.patch(`/reports/manage/${detail.id}/status/`, payload);
      setDetail(data.data);
      setNotice("Report status updated.");
      loadReports();
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not update the status."));
    } finally {
      setSavingStatus(false);
    }
  };

  const addNote = async (event) => {
    event.preventDefault();
    if (!detail || !noteText.trim()) return;

    setSavingNote(true);
    setNotice("");
    setError("");
    try {
      await api.post(`/reports/manage/${detail.id}/notes/`, { note_text: noteText.trim() });
      setNoteText("");
      await loadDetail(detail.id);
      setNotice("Investigation note added.");
      loadReports();
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not save the note."));
    } finally {
      setSavingNote(false);
    }
  };

  const toggleFlag = async (flagged, reason = "") => {
    if (!detail) return;
    setError("");
    try {
      const { data } = await api.patch(`/admin/reports/${detail.id}/flag/`, {
        is_flagged: flagged,
        flag_reason: reason,
      });
      setDetail(data.data);
      setShowFlagForm(false);
      setFlagReason("");
      setNotice(flagged ? "Report flagged." : "Report unflagged.");
      loadReports();
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not update the flag."));
    }
  };

  const uploadEvidence = async (event) => {
    const fileList = event.target.files;
    if (!detail || !fileList?.length) return;

    setUploading(true);
    setError("");
    try {
      const payload = new FormData();
      Array.from(fileList).forEach((file) => payload.append("evidence_files", file));
      await api.post(`/reports/manage/${detail.id}/evidence/`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadDetail(detail.id);
      setNotice("Evidence uploaded.");
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not upload the evidence."));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Reports</h1>
          <p className="text-gray-600 mt-1">
            Review, assign, annotate and progress every submitted report.
          </p>
        </div>
        <button
          type="button"
          onClick={loadReports}
          className="flex items-center gap-2 self-start px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search reference, description..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status.id} value={status.slug}>
              {status.name}
            </option>
          ))}
        </select>

        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <select
          value={filters.flagged}
          onChange={(e) => setFilters({ ...filters, flagged: e.target.value })}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          <option value="">Flagged &amp; unflagged</option>
          <option value="true">Flagged only</option>
          <option value="false">Unflagged only</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
          {notice}
        </div>
      )}

      <div className="grid xl:grid-cols-5 gap-6 items-start">
        {/* LIST */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 font-semibold text-gray-900">
            {reports.length} report{reports.length === 1 ? "" : "s"}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
              <Loader2 size={18} className="animate-spin" /> Loading reports...
            </div>
          ) : reports.length === 0 ? (
            <p className="py-16 text-center text-gray-500 text-sm">
              No reports match the current filters.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
              {reports.map((report) => (
                <li key={report.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(report.id)}
                    className={`w-full text-left px-5 py-4 hover:bg-gray-50 transition ${
                      selectedId === report.id ? "bg-indigo-50 border-l-4 border-indigo-500" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        {report.reference_number}
                      </span>
                      {report.is_flagged && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                          <Flag size={12} /> Flagged
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 text-sm font-semibold text-gray-900">
                      {report.category_name}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                      {report.description}
                    </p>

                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          STATUS_TONES[report.status_slug] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {report.status_name}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {report.assigned_investigator_name || "Unassigned"}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* DETAIL */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-200 p-6 min-h-[400px]">
          {!selectedId ? (
            <div className="h-full min-h-[340px] flex flex-col items-center justify-center text-gray-400">
              <FileText size={40} className="mb-3" />
              <p className="text-sm">Select a report to review its details.</p>
            </div>
          ) : detailLoading ? (
            <div className="flex items-center justify-center py-24 text-gray-500 gap-2">
              <Loader2 size={18} className="animate-spin" /> Loading report...
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="font-mono text-xl font-bold text-gray-900">
                      {detail.reference_number}
                    </h2>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        STATUS_TONES[detail.status.slug] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {detail.status.name}
                    </span>
                    {detail.is_flagged && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 flex items-center gap-1">
                        <Flag size={12} /> Flagged
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {detail.category.name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                  aria-label="Close report"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 bg-gray-50 rounded-xl p-4">
                <Meta icon={<MapPin size={15} />} label="Location">
                  {detail.location_text || "Not provided"}
                </Meta>
                <Meta icon={<Calendar size={15} />} label="Incident date">
                  {detail.incident_datetime
                    ? new Date(detail.incident_datetime).toLocaleString()
                    : "Not provided"}
                </Meta>
                <Meta icon={<UserCheck size={15} />} label="Assigned to">
                  {detail.assigned_investigator || "Unassigned"}
                </Meta>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Description
                </h3>
                <p className="p-4 bg-gray-50 rounded-lg text-gray-800 whitespace-pre-wrap">
                  {detail.description}
                </p>
              </div>

              {/* STATUS CONTROL */}
              <div className="border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Update status</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Status
                    </label>
                    <select
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      {statusOptions.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Assigned investigator
                    </label>
                    <select
                      value={assigneeDraft}
                      onChange={(e) => setAssigneeDraft(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      <option value="">Unassigned</option>
                      {investigators.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.full_name} ({person.role.toLowerCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={saveStatus}
                  disabled={savingStatus}
                  className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-semibold text-sm"
                >
                  {savingStatus ? "Saving..." : "Save changes"}
                </button>
              </div>

              {/* EVIDENCE */}
              <div className="border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Paperclip size={16} /> Evidence ({detail.evidence.length})
                  </h3>
                  <label className="flex items-center gap-2 text-sm font-medium text-indigo-600 cursor-pointer hover:text-indigo-800">
                    {uploading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Upload size={15} />
                    )}
                    {uploading ? "Uploading..." : "Upload"}
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={uploadEvidence}
                      accept="image/*,video/*,application/pdf,text/plain"
                    />
                  </label>
                </div>

                {detail.evidence.length === 0 ? (
                  <p className="text-sm text-gray-500">No evidence attached.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.evidence.map((item) => (
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
                        {item.file_url && (
                          <a
                            href={item.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 shrink-0"
                            aria-label="Download evidence"
                          >
                            <Download size={15} />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* NOTES */}
              <div className="border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <NotebookPen size={16} /> Investigation notes ({detail.notes.length})
                </h3>

                <form onSubmit={addNote} className="flex flex-col sm:flex-row gap-2 mb-4">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={2}
                    placeholder="Record what you found or did..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={savingNote || !noteText.trim()}
                    className="self-start px-4 py-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold"
                  >
                    {savingNote ? "Saving..." : "Add note"}
                  </button>
                </form>

                {detail.notes.length === 0 ? (
                  <p className="text-sm text-gray-500">No notes recorded yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {detail.notes.map((note) => (
                      <li key={note.id} className="bg-gray-50 rounded-lg px-4 py-3">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.note_text}</p>
                        <p className="text-xs text-gray-500 mt-1.5">
                          {note.investigator_name} ·{" "}
                          {new Date(note.created_at).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* HISTORY */}
              <div className="border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <History size={16} /> Status history ({detail.status_history.length})
                </h3>

                {detail.status_history.length === 0 ? (
                  <p className="text-sm text-gray-500">No status changes recorded yet.</p>
                ) : (
                  <ol className="space-y-3 border-l-2 border-gray-200 pl-5">
                    {detail.status_history.map((entry) => (
                      <li key={entry.id} className="relative">
                        <span className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-indigo-500" />
                        <p className="text-sm font-medium text-gray-900">
                          {entry.old_status_name
                            ? `${entry.old_status_name} → ${entry.new_status_name}`
                            : entry.new_status_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {entry.changed_by_name} ·{" "}
                          {new Date(entry.changed_at).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* ADMIN: FLAG */}
              {isAdmin && (
                <div className="border border-red-200 bg-red-50 rounded-xl p-5">
                  <h3 className="font-semibold text-red-900 flex items-center gap-2 mb-3">
                    <ShieldAlert size={16} /> Moderation
                  </h3>

                  {detail.is_flagged ? (
                    <>
                      <p className="text-sm text-red-800 mb-3">
                        Flagged: {detail.flag_reason || "No reason recorded."}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleFlag(false)}
                        className="px-4 py-2 bg-white border border-red-300 hover:bg-red-100 text-red-700 rounded-lg text-sm font-semibold flex items-center gap-2"
                      >
                        <FlagOff size={15} /> Unflag report
                      </button>
                    </>
                  ) : showFlagForm ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={flagReason}
                        onChange={(e) => setFlagReason(e.target.value)}
                        placeholder="Reason for flagging (required)"
                        className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFlag(true, flagReason.trim())}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold"
                        >
                          Confirm flag
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowFlagForm(false)}
                          className="px-4 py-2 bg-white border border-red-300 text-red-700 rounded-lg text-sm font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowFlagForm(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
                    >
                      <Flag size={15} /> Flag report
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Meta = ({ icon, label, children }) => (
  <div className="flex items-start gap-2">
    <span className="text-indigo-500 mt-0.5 shrink-0">{icon}</span>
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 break-words">{children}</p>
    </div>
  </div>
);
