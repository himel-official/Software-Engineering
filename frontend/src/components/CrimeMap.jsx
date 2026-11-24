import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip, Popup, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_CENTER, MAP_ZOOM } from "../config";
import { dotOpacity } from "../utils";

// Every crime is a plain RED dot (no halo, no extra radius).
const RED = "#dc2626";

// Blue dot for the visitor's current location (styled in index.css)
const meIcon = L.divIcon({
  className: "me-marker",
  html: '<span class="me-dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function ClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView(target, Math.max(map.getZoom(), 14));
  }, [target, map]);
  return null;
}

// Every report is a red dot. Opacity = how recent (serious crimes such as murder never fade).
// me = {lat, lng} -> blue marker.  highlightId -> that report's dot is drawn bigger with a dark outline.
export default function CrimeMap({ reports = [], meta, onMapClick, picked, renderPopup, flyTo, me, meLabel = "You are here", highlightId, height = "100%" }) {
  const types = useMemo(() => Object.fromEntries((meta?.crimeTypes || []).map((t) => [t.key, t])), [meta]);

  return (
    <MapContainer center={picked ? [picked.lat, picked.lng] : MAP_CENTER} zoom={MAP_ZOOM} preferCanvas style={{ height, width: "100%" }}>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {onMapClick && <ClickHandler onClick={onMapClick} />}
      <FlyTo target={flyTo} />

      {meta &&
        reports.map((r) => {
          const t = types[r.type];
          if (!t) return null;
          const op = dotOpacity(r, t, meta);
          const hl = highlightId === r.id;
          return (
            <CircleMarker
              key={r.id}
              center={[r.lat, r.lng]}
              radius={hl ? 10 : 7}
              pathOptions={{ color: hl ? "#111827" : RED, weight: hl ? 2 : 0, opacity: 1, fillColor: RED, fillOpacity: op }}
            >
              {renderPopup && <Popup>{renderPopup(r, t)}</Popup>}
            </CircleMarker>
          );
        })}

      {picked && <CircleMarker center={[picked.lat, picked.lng]} radius={8} pathOptions={{ color: "#ffffff", weight: 2, fillColor: RED, fillOpacity: 1 }} />}

      {me && (
        <Marker position={[me.lat, me.lng]} icon={meIcon} keyboard={false}>
          <Tooltip permanent direction="top" offset={[0, -12]}>{meLabel}</Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}
