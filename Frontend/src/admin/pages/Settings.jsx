// src/admin/pages/Settings.jsx
import React, { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  X,
  Settings as SettingsIcon,
  Info,
} from "lucide-react";
import api, { extractErrorMessage } from "../../api/client";
import { unwrapList } from "../../api/helpers";

const blank = { setting_key: "", setting_value: "" };

const SETTING_HELP = {
  public_visible_statuses:
    "Comma separated status slugs whose reports appear on the public complaints page. Slugs: submitted, under-review, investigating, resolved, closed.",
  site_name: "Name shown in the browser title and site header.",
  support_email: "Contact address shown to users.",
  max_evidence_size_mb: "Maximum size in megabytes for a single uploaded evidence file.",
};

export default function Settings() {
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
      const { data } = await api.get("/admin/settings/");
      setItems(unwrapList(data));
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not load settings."));
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
    setForm({ setting_key: item.setting_key, setting_value: item.setting_value });
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
        await api.post("/admin/settings/", form);
      } else {
        await api.patch(`/admin/settings/${editing}/`, {
          setting_key: form.setting_key,
          setting_value: form.setting_value,
        });
      }
      setNotice(editing === "new" ? "Setting created." : "Setting updated.");
      close();
      load();
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not save the setting."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete the setting "${item.setting_key}"?`)) return;
    setError("");
    try {
      await api.delete(`/admin/settings/${item.id}/`);
      setNotice("Setting deleted.");
      load();
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not delete the setting."));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-1">
            Key/value configuration for the running system.
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
            <Plus size={16} /> New setting
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
              {editing === "new" ? "New setting" : "Edit setting"}
            </h2>
            <button type="button" onClick={close} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Key</label>
            <input
              type="text"
              required
              disabled={editing !== "new"}
              value={form.setting_key}
              onChange={(e) => setForm({ ...form, setting_key: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-100 font-mono"
            />
            {editing === "new" && (
              <p className="mt-1.5 text-xs text-gray-500">
                Use snake_case, for example <code>maintenance_mode</code>.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Value</label>
            <input
              type="text"
              required
              value={form.setting_value}
              onChange={(e) => setForm({ ...form, setting_value: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {form.setting_key && SETTING_HELP[form.setting_key] && (
            <p className="text-xs text-gray-500 flex items-start gap-1.5">
              <Info size={13} className="mt-0.5 shrink-0" />
              {SETTING_HELP[form.setting_key]}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-semibold text-sm"
          >
            {saving ? "Saving..." : "Save setting"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
            <Loader2 size={18} className="animate-spin" /> Loading settings...
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <SettingsIcon size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No settings configured.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item.id} className="px-5 py-4 hover:bg-gray-50 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-semibold text-gray-900">
                    {item.setting_key}
                  </p>
                  <p className="text-sm text-gray-700 mt-1 break-words">
                    {item.setting_value || "—"}
                  </p>
                  {SETTING_HELP[item.setting_key] && (
                    <p className="text-xs text-gray-400 mt-1">{SETTING_HELP[item.setting_key]}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Updated {new Date(item.updated_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="p-2 rounded-lg text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
                    aria-label={`Edit ${item.setting_key}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete ${item.setting_key}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
