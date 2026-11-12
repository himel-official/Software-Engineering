// src/Pages/Complaints.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  Popup,
  useMap,
} from "react-leaflet";
import {
  Search,
  Filter,
  LayoutGrid,
  Map as MapIcon,
  Clock,
  MapPin,
  TriangleAlert,
  Loader2,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import api, { extractErrorMessage } from "../api/client";

const DEFAULT_CENTER = [23.81033, 90.412521];

const STATUS_STYLES = {
  submitted: "bg-gray-100 text-gray-700",
  "under-review": "bg-blue-100 text-blue-700",
  investigating: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-slate-200 text-slate-700",
};

function FitToMarkers({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.flyTo(points[0], 14, { duration: 1 });
      return;
    }
    map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
  }, [points, map]);
  return null;
}

export default function Complaints() {
  const [reports, setReports] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [view, setView] = useState("list");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (category) params.category = category;

      const { data } = await api.get("/reports/public/", { params });
      setReports(data.data || []);
    } catch (err) {
      console.error(err);
      setError(extractErrorMessage(err, "Could not load the public complaint list."));
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    api
      .get("/categories/")
      .then(({ data }) => setCategories(data.data || []))
      .catch(() => setCategories([]));
  }, []);

  const points = useMemo(
    () =>
      reports
        .filter(
          (report) => report.latitude != null && report.longitude != null
        )
        .map((report) => [Number(report.latitude), Number(report.longitude)]),
    [reports]
  );

  return (
    <div className="w-full mt-20 min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Public Complaints
            </h1>
            <p className="text-gray-600 mt-1">
              Reports that have been resolved and cleared for public display.
              Reporter identities are never shown.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
                view === "list"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <LayoutGrid size={16} /> List
            </button>
            <button
              type="button"
              onClick={() => setView("map")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
                view === "map"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <MapIcon size={16} /> Map
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by description, location or reference..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div className="relative sm:w-64">
            <Filter
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 gap-3">
            <Loader2 size={20} className="animate-spin" /> Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <TriangleAlert size={36} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 font-medium">No public reports to show</p>
            <p className="text-gray-400 text-sm mt-1">
              Reports appear here once an administrator has resolved them.
            </p>
          </div>
        ) : view === "map" ? (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={12}
              scrollWheelZoom
              className="w-full h-[70vh]"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitToMarkers points={points} />
              {reports.map((report) =>
                report.latitude != null && report.longitude != null ? (
                  <Circle
                    key={report.id}
                    center={[Number(report.latitude), Number(report.longitude)]}
                    radius={90}
                    pathOptions={{
                      color: "#4f46e5",
                      fillColor: "#6366f1",
                      fillOpacity: 0.35,
                    }}
                  >
                    <Popup>
                      <div className="font-sans min-w-[200px]">
                        <h3 className="font-bold text-sm">{report.category_name}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {report.reference_number}
                        </p>
                        <p className="text-xs mt-1">{report.location_text}</p>
                        <p className="text-xs mt-2">{report.description}</p>
                      </div>
                    </Popup>
                  </Circle>
                ) : null
              )}
            </MapContainer>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {reports.map((report) => (
              <article
                key={report.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition flex flex-col"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      STATUS_STYLES[report.status_slug] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {report.status_name}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {report.reference_number}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-gray-900 mb-2">
                  {report.category_name}
                </h2>

                <p className="text-sm text-gray-700 line-clamp-4 flex-1">
                  {report.description}
                </p>

                <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <MapPin size={13} />
                    <span className="truncate">{report.location_text || "Location withheld"}</span>
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <Clock size={13} />
                    {new Date(report.submitted_at).toLocaleDateString()}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
