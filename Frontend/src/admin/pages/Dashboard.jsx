// src/admin/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import {
  FileText,
  Flag,
  CalendarDays,
  UserX,
  TrendingUp,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import api, { extractErrorMessage } from "../../api/client";

const PIE_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#ef4444",
  "#14b8a6",
  "#22c55e",
  "#eab308",
  "#64748b",
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/statistics/");
      setStats(data.data);
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not load the dashboard statistics."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 gap-3">
        <Loader2 size={20} className="animate-spin" /> Loading statistics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 flex items-center justify-between">
        <span>{error}</span>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1 font-semibold text-sm"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const cards = [
    {
      label: "Total Reports",
      value: stats.total_reports,
      icon: FileText,
      tone: "bg-indigo-100 text-indigo-600",
    },
    {
      label: "Submitted Today",
      value: stats.today_reports,
      icon: CalendarDays,
      tone: "bg-blue-100 text-blue-600",
    },
    {
      label: "Flagged Reports",
      value: stats.flagged_reports,
      icon: Flag,
      tone: "bg-red-100 text-red-600",
    },
    {
      label: "Unassigned",
      value: stats.unassigned_reports,
      icon: UserX,
      tone: "bg-amber-100 text-amber-600",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Live statistics derived from the report, status and category tables.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
            >
              <div className={`w-11 h-11 rounded-xl ${card.tone} flex items-center justify-center`}>
                <Icon size={22} />
              </div>
              <p className="mt-4 text-3xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm text-gray-500">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Reports by status
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.by_status}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-20} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Reports by category
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.by_category}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label={({ name }) => name}
                >
                  {stats.by_category.map((entry, index) => (
                    <Cell
                      key={entry.id}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-500" />
            Top locations
          </h2>
          {stats.top_locations.length === 0 ? (
            <p className="text-sm text-gray-500">No location data recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {stats.top_locations.map((row) => (
                <li key={row.location_text} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-700 truncate">{row.location_text}</span>
                  <span className="text-sm font-semibold text-gray-900 bg-gray-100 rounded-full px-3 py-1 shrink-0">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Latest reports
          </h2>
          {stats.recent_reports.length === 0 ? (
            <p className="text-sm text-gray-500">No reports have been submitted yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {stats.recent_reports.map((report) => (
                <li key={report.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-gray-900">
                      {report.reference_number}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{report.category_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-gray-700">{report.status_name}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(report.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
