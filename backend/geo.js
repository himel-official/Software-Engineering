// Distance helpers (haversine). Used for "crime within 5 km" alerts.
const rad = (x) => (x * Math.PI) / 180;

function distanceKm(aLat, aLng, bLat, bLng) {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

// A rectangle around a point that is guaranteed to contain the circle of radius km (cheap SQL pre-filter).
function boundingBox(lat, lng, km) {
  const dLat = km / 110.574;
  const dLng = km / (111.32 * Math.max(0.01, Math.cos(rad(lat))));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

// ~110 m precision: what the public (and alerts) are allowed to know about a report's position.
const round3 = (n) => Math.round(n * 1000) / 1000;

module.exports = { distanceKm, boundingBox, round3 };
