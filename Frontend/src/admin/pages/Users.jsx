// src/admin/pages/Users.jsx
import React, { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  X,
  Users as UsersIcon,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import api, { extractErrorMessage } from "../../api/client";
import { unwrapList } from "../../api/helpers";
import { useAuth } from "../../context/AuthContext";

const blank = { full_name: "", email: "", password: "", role: "INVESTIGATOR", is_active: true };

export default function Users() {
  const { user: currentUser } = useAuth();

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
      const { data } = await api.get("/admin/users/");
      setItems(unwrapList(data));
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not load accounts."));
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
      full_name: item.full_name,
      email: item.email,
      password: "",
      role: item.role,
      is_active: item.is_active,
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
        await api.post("/admin/users/", form);
      } else {
        const payload = {
          full_name: form.full_name,
          email: form.email,
          role: form.role,
          is_active: form.is_active,
        };
        if (form.password) payload.password = form.password;
        await api.patch(`/admin/users/${editing}/`, payload);
      }
      setNotice(editing === "new" ? "Account created." : "Account updated.");
      close();
      load();
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not save the account."));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item) => {
    setError("");
    try {
      await api.patch(`/admin/users/${item.id}/`, {
        full_name: item.full_name,
        email: item.email,
        role: item.role,
        is_active: !item.is_active,
      });
      setNotice(item.is_active ? "Account disabled." : "Account enabled.");
      load();
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not update the account."));
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete the account for ${item.full_name}?`)) return;
    setError("");
    try {
      await api.delete(`/admin/users/${item.id}/`);
      setNotice("Account deleted.");
      load();
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not delete the account."));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Accounts</h1>
          <p className="text-gray-600 mt-1">
            Investigators and administrators who can sign in to the dashboard.
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
            <Plus size={16} /> New account
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
              {editing === "new" ? "New account" : "Edit account"}
            </h2>
            <button type="button" onClick={close} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Full name</label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Password {editing !== "new" && "(leave blank to keep current)"}
              </label>
              <input
                type="password"
                required={editing === "new"}
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="INVESTIGATOR">Investigator</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            Active (can sign in)
          </label>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-semibold text-sm"
          >
            {saving ? "Saving..." : "Save account"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
            <Loader2 size={18} className="animate-spin" /> Loading accounts...
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <UsersIcon size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No accounts found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 text-left">
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold hidden md:table-cell">Email</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-gray-900">{item.full_name}</span>
                    {currentUser?.id === item.id && (
                      <span className="ml-2 text-xs text-indigo-600 font-medium">(you)</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600 hidden md:table-cell">
                    {item.email}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        item.role === "ADMIN"
                          ? "bg-red-100 text-red-700"
                          : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {item.role === "ADMIN" ? (
                        <ShieldCheck size={12} />
                      ) : (
                        <UserCheck size={12} />
                      )}
                      {item.role === "ADMIN" ? "Admin" : "Investigator"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        item.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {item.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => toggleActive(item)}
                        disabled={currentUser?.id === item.id}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                      >
                        {item.is_active ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
                        aria-label={`Edit ${item.full_name}`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        disabled={currentUser?.id === item.id}
                        className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        aria-label={`Delete ${item.full_name}`}
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
