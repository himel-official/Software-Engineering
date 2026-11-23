// "A crime happened near you" alerts.
//  - notifyNearbyUsers(report): called when a crime is reported. Alerts everyone whose LAST recorded location is within
//    NOTIFY_RADIUS_KM of it (and was recorded recently).
//  - catchUp(userId, lat, lng): called when a user's location arrives. Alerts them about crimes posted in the last
//    NOTIFY_CATCHUP_HOURS nearby, so people who open the site later still get the alert.
// Distance is measured to the report's PUBLIC (rounded, ~110 m) position, so alerts never reveal more than the map does.
const db = require("./db");
const { distanceKm, boundingBox, round3 } = require("./geo");
const { NOTIFY_RADIUS_KM, NOTIFY_LOCATION_MAX_AGE_HOURS, NOTIFY_CATCHUP_HOURS } = require("./config");

const hoursAgoIso = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

const INSERT_SQL = "INSERT INTO notifications (user_id, report_id, distance_km) VALUES (?, ?, ?) ON CONFLICT DO NOTHING";

async function insertMany(rows) {
  if (!rows.length) return 0;
  return db.tx(async (t) => {
    let added = 0;
    for (const r of rows) added += await t.run(INSERT_SQL, [r.userId, r.reportId, r.km]);
    return added;
  });
}

// report: { id, user_id, lat, lng }  (exact coordinates as saved)
async function notifyNearbyUsers(report) {
  const lat = round3(report.lat);
  const lng = round3(report.lng);
  const box = boundingBox(lat, lng, NOTIFY_RADIUS_KM);
  const candidates = await db.all(
    `SELECT l.user_id, l.lat, l.lng FROM user_locations l JOIN users u ON u.id = l.user_id
     WHERE u.is_active = 1 AND u.role IN ('user','investigator') AND u.id != ?
       AND l.updated_at >= ? AND l.lat BETWEEN ? AND ? AND l.lng BETWEEN ? AND ?`,
    [report.user_id, hoursAgoIso(NOTIFY_LOCATION_MAX_AGE_HOURS), box.minLat, box.maxLat, box.minLng, box.maxLng]
  );

  const rows = [];
  for (const c of candidates) {
    const km = distanceKm(c.lat, c.lng, lat, lng);
    if (km <= NOTIFY_RADIUS_KM) rows.push({ userId: c.user_id, reportId: report.id, km });
  }
  return insertMany(rows);
}

async function catchUp(userId, lat, lng) {
  const box = boundingBox(lat, lng, NOTIFY_RADIUS_KM);
  const recent = await db.all(
    `SELECT id, lat, lng FROM reports
     WHERE status = 'active' AND user_id != ? AND created_at >= ?
       AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`,
    [userId, hoursAgoIso(NOTIFY_CATCHUP_HOURS), box.minLat - 0.002, box.maxLat + 0.002, box.minLng - 0.002, box.maxLng + 0.002]
  );

  const rows = [];
  for (const r of recent) {
    const km = distanceKm(lat, lng, round3(r.lat), round3(r.lng));
    if (km <= NOTIFY_RADIUS_KM) rows.push({ userId, reportId: r.id, km });
  }
  return insertMany(rows);
}

module.exports = { notifyNearbyUsers, catchUp };
