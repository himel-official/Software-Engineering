// src/components/MapView.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  Popup,
  Marker,
  useMap,
} from "react-leaflet";
import { LocateFixed, Clock, AlertTriangle, Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";
import api from "../api/client";

const DEFAULT_CENTER = [23.8103, 90.4125];

function FlyToLocation({ position, zoom = 16 }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, zoom, { duration: 1.2 });
  }, [position, zoom, map]);
  return null;
}

function MyLocationButton({ setCurrentLocation }) {
  const map = useMap();

  const goToMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setCurrentLocation(coords);
        map.flyTo(coords, 16, { duration: 1.5 });
      },
      () => alert("Unable to get your current location.")
    );
  };

  return (
    <button
      type="button"
      onClick={goToMyLocation}
      aria-label="Show my location"
      className="absolute bottom-4 left-4 z-[1000] bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg transition-transform hover:scale-110"
    >
      <LocateFixed size={20} />
    </button>
  );
}

function SafetyMap({ reports, selectedLocation, setSelectedLocation }) {
  const [currentLocation, setCurrentLocation] = useState(DEFAULT_CENTER);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCurrentLocation([pos.coords.latitude, pos.coords.longitude]),
      () => setCurrentLocation(DEFAULT_CENTER)
    );
  }, []);

  const mapped = useMemo(
    () =>
      reports.filter(
        (report) => report.latitude != null && report.longitude != null
      ),
    [reports]
  );

  return (
    <div className="relative h-[50vh] sm:h-[60vh] lg:h-full w-full rounded-xl shadow-2xl overflow-hidden border border-gray-200">
      <MapContainer center={currentLocation} zoom={14} className="h-full w-full">
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {selectedLocation && <FlyToLocation position={selectedLocation} />}

        <Marker position={currentLocation}>
          <Popup>You are here</Popup>
        </Marker>

        {mapped.map((report) => (
          <Circle
            key={report.id}
            center={[Number(report.latitude), Number(report.longitude)]}
            radius={90}
            pathOptions={{
              color: "#4f46e5",
              fillColor: "#6366f1",
              fillOpacity: 0.35,
            }}
            eventHandlers={{
              click: () =>
                setSelectedLocation([
                  Number(report.latitude),
                  Number(report.longitude),
                ]),
            }}
          >
            <Popup>
              <div className="font-sans min-w-[200px]">
                <h3 className="font-bold text-sm">{report.category_name}</h3>
                <p className="text-xs mt-1">{report.location_text}</p>
                <p className="text-xs mt-1 font-medium">
                  Status: {report.status_name}
                </p>
                <p className="text-xs mt-1">
                  {new Date(report.submitted_at).toLocaleString()}
                </p>
                <p className="text-sm mt-1">{report.description}</p>
              </div>
            </Popup>
          </Circle>
        ))}

        <MyLocationButton setCurrentLocation={setCurrentLocation} />
      </MapContainer>
    </div>
  );
}

export default function MapView() {
  const [reports, setReports] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchReports = async () => {
      try {
        const { data } = await api.get("/reports/public/");
        if (active) setReports(data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchReports();
    const interval = setInterval(fetchReports, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="py-24 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl sm:text-4xl font-bold text-indigo-600 text-center mb-4">
          Live Safety Dashboard
        </h2>

        <p className="text-center text-gray-600 mb-10 max-w-2xl mx-auto">
          Resolved incidents published for public awareness. Click a marker to
          jump to its location. Your own location is shown separately and is
          never sent to the server.
        </p>

        <div className="flex flex-col lg:flex-row gap-8 w-full lg:h-[75vh]">
          <div className="lg:w-2/3">
            <SafetyMap
              reports={reports}
              selectedLocation={selectedLocation}
              setSelectedLocation={setSelectedLocation}
            />
          </div>

          <div className="lg:w-1/3 flex flex-col gap-6 lg:max-h-[75vh]">
            <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
              <h3 className="text-xl font-semibold mb-4">Legend</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-indigo-500 opacity-40"></div>
                  <span className="text-gray-600">Publicly listed incident</span>
                </div>
                <div className="flex items-center gap-3">
                  <LocateFixed size={16} />
                  <span className="text-gray-600">Your location</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow border border-gray-200 flex-1 overflow-y-auto">
              <h3 className="text-xl font-semibold mb-4">
                Recent Reports ({reports.length})
              </h3>

              {loading ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 size={16} className="animate-spin" /> Loading...
                </div>
              ) : reports.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No public incidents have been published yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => (
                    <button
                      type="button"
                      key={report.id}
                      onClick={() =>
                        setSelectedLocation([
                          Number(report.latitude),
                          Number(report.longitude),
                        ])
                      }
                      className="w-full text-left cursor-pointer hover:bg-gray-50 transition p-4 bg-gray-100 rounded-lg border border-gray-200 flex gap-4"
                    >
                      <AlertTriangle size={20} className="text-indigo-600 mt-1 shrink-0" />
                      <div className="min-w-0">
                        <h4 className="font-semibold">{report.category_name}</h4>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(report.submitted_at).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {report.description}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {report.location_text}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
