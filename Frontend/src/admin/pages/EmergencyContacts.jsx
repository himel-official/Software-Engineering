// src/admin/pages/EmergencyContacts.jsx
import React, { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  X,
  PhoneCall,
  ExternalLink,
} from "lucide-react";
import api, { extractErrorMessage } from "../../api/client";
import { unwrapList } from "../../api/helpers";

const blank = { name: "", phone: "", description: "" };

export default function EmergencyContacts() {
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
      const { data } = await api.get("/admin/emergency-contacts/");
      setItems(unwrapList(data));
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not load emergency contacts."));
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
    setForm({
      name: item.name,
      phone: item.phone,
      description: item.description || "",
    });
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
        await api.post("/admin/emergency-contacts/", form);
      } else {
        await api.patch(`/admin/emergency-contacts/${editing}/`, form);
      }
      setNotice(editing === "new" ? "Contact created." : "Contact updated.");
      close();
      load();
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not save the contact."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    setError("");
    try {
      await api.delete(`/admin/emergency-contacts/${item.id}/`);
      setNotice("Contact deleted.");
      load();
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not delete the contact."));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Emergency Contacts</h1>
          <p className="text-gray-600 mt-1">
            Hotlines published for guests and citizens on the public site.
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
            <Plus size={16} /> New contact
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
              {editing === "new" ? "New contact" : "Edit contact"}
            </h2>
            <button type="button" onClick={close} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Service name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone number</label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-semibold text-sm"
          >
            {saving ? "Saving..." : "Save contact"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
            <Loader2 size={18} className="animate-spin" /> Loading contacts...
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <PhoneCall size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No emergency contacts published yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 text-left">
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3 font-semibold">Service</th>
                <th className="px-5 py-3 font-semibold">Number</th>
                <th className="px-5 py-3 font-semibold hidden md:table-cell">Description</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{item.name}</td>
                  <td className="px-5 py-3.5">
                    <a
                      href={`tel:${item.phone.replace(/\s+/g, "")}`}
                      className="font-mono font-semibold text-red-600 hover:underline inline-flex items-center gap-1.5"
                    >
                      {item.phone}
                      <ExternalLink size={13} />
                    </a>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 hidden md:table-cell">
                    {item.description || "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
                        aria-label={`Edit ${item.name}`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
