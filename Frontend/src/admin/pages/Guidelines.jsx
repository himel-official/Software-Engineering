// src/admin/pages/Guidelines.jsx
import React, { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, RefreshCw, X, BookOpenText } from "lucide-react";
import api, { extractErrorMessage } from "../../api/client";
import { unwrapList } from "../../api/helpers";

const blank = { title: "", content: "" };

export default function Guidelines() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/guidelines/");
      setItems(unwrapList(data));
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not load guidelines."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing("new");
    setForm(blank);
    setError("");
  };

  const openEdit = (item) => {
    setEditing(item.id);
    setForm({ title: item.title, content: item.content });
    setError("");
  };

  const close = () => {
    setEditing(null);
    setForm(blank);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing === "new") {
        await api.post("/admin/guidelines/", form);
      } else {
        await api.patch(`/admin/guidelines/${editing}/`, form);
      }
      setNotice(editing === "new" ? "Guideline created." : "Guideline updated.");
      close();
      load();
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not save the guideline."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setError("");
    try {
      await api.delete(`/admin/guidelines/${item.id}/`);
      setNotice("Guideline deleted.");
      load();
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not delete the guideline."));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Safety Guidelines</h1>
          <p className="text-gray-600 mt-1">
            Guidance published for guests and citizens on the public site.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold"
          >
            <Plus size={16} /> New guideline
          </button>
        </div>
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

      {editing !== null && (
        <form
          onSubmit={save}
          className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {editing === "new" ? "New guideline" : "Edit guideline"}
            </h2>
            <button type="button" onClick={close} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Content</label>
            <textarea
              rows={5}
              required
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-semibold text-sm"
          >
            {saving ? "Saving..." : "Save guideline"}
          </button>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {loading ? (
          <div className="col-span-full flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
            <Loader2 size={18} className="animate-spin" /> Loading guidelines...
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-gray-200 py-16 text-center text-gray-500">
            <BookOpenText size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No guidelines published yet.</p>
          </div>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-gray-900">{item.title}</h2>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="p-2 rounded-lg text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
                    aria-label={`Edit ${item.title}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap line-clamp-5">
                {item.content}
              </p>
              <p className="mt-3 text-xs text-gray-400">
                Updated {new Date(item.updated_at).toLocaleString()}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
