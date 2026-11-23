import { Fragment, useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Tooltip, Popup, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_CENTER, MAP_ZOOM } from "../config";
import { dotOpacity } from "../utils";

// Pulsing blue dot for the visitor's current location (styled in index.css)
const meIcon = L.divIcon({
  className: "me-marker",
  html: '<span class="me-pulse"></span><span class="me-dot"></span>',
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

// Dotted heatmap: every report is a dot with a soft halo.
// Colour = crime type. Opacity = how recent (permanent crimes never fade).
// me = {lat, lng, accuracy} -> blue "You are here" marker.  highlightId -> ring around one report.
export default function CrimeMap({ reports = [], meta, onMapClick, picked, renderPopup, flyTo, me, highlightId, height = "100%" }) {
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
          return (
            <Fragment key={r.id}>
              <CircleMarker center={[r.lat, r.lng]} radius={18} pathOptions={{ stroke: false, fillColor: t.color, fillOpacity: op * 0.22, interactive: false }} />
              <CircleMarker
                center={[r.lat, r.lng]}
                radius={7}
                pathOptions={{ color: "#ffffff", weight: t.permanent ? 2 : 0, opacity: op, fillColor: t.color, fillOpacity: op }}
              >
                {renderPopup && <Popup>{renderPopup(r, t)}</Popup>}
              </CircleMarker>
              {highlightId === r.id && (
                <CircleMarker center={[r.lat, r.lng]} radius={15} pathOptions={{ color: "#111827", weight: 2, dashArray: "4 3", fill: false, interactive: false }} />
              )}
            </Fragment>
          );
        })}

      {picked && (
        <CircleMarker center={[picked.lat, picked.lng]} radius={10} pathOptions={{ color: "#111827", weight: 3, fillColor: "#ffffff", fillOpacity: 0.9 }} />
      )}

      {me && (
        <>
          {me.accuracy > 0 && me.accuracy < 3000 && (
            <Circle center={[me.lat, me.lng]} radius={me.accuracy} pathOptions={{ color: "#2563eb", weight: 1, fillColor: "#2563eb", fillOpacity: 0.08, interactive: false }} />
          )}
          <Marker position={[me.lat, me.lng]} icon={meIcon} keyboard={false}>
            <Tooltip permanent direction="top" offset={[0, -12]}>You are here</Tooltip>
          </Marker>
        </>
      )}
    </MapContainer>
  );
}
