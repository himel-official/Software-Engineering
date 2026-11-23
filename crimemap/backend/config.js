const fs = require("fs");
const path = require("path");

// ---------- Crime types ----------
// permanent: true  => the dot never fades (serious crimes)
// Every type uses the same red on purpose (SafeVoice shows all crimes as red dots).
const RED = "#dc2626"; // every crime dot is red
const CRIME_TYPES = [
  { key: "theft",      label: "Theft",                  color: RED, permanent: false },
  { key: "mugging",    label: "Mugging / Snatching",    color: RED, permanent: false },
  { key: "burglary",   label: "Burglary",               color: RED, permanent: false },
  { key: "assault",    label: "Assault",                color: RED, permanent: false },
  { key: "vandalism",  label: "Vandalism",              color: RED, permanent: false },
  { key: "drugs",      label: "Drug activity",          color: RED, permanent: false },
  { key: "harassment", label: "Harassment / Stalking",  color: RED, permanent: false },
  { key: "fraud",      label: "Fraud / Scam",           color: RED, permanent: false },
  { key: "arson",      label: "Arson",                  color: RED, permanent: false },
  { key: "kidnapping", label: "Kidnapping",             color: RED, permanent: true  },
  { key: "murder",     label: "Murder",                 color: RED, permanent: true  },
  { key: "rape",       label: "Rape / Sexual assault",  color: RED, permanent: true  },
];

// Ordinary crime dots fade from fully visible to MIN_OPACITY over FADE_DAYS.
const FADE_DAYS = 90;
const MIN_OPACITY = 0.08;

// National ID number: digits only, 8-20 long. Change this if your country's format is stricter.
const NID_RE = /^\d{8,20}$/;

// ---------- file storage ----------
const STORAGE = path.join(__dirname, "storage");
const ID_DIR = path.join(STORAGE, "id-cards");          // investigator ID cards (encrypted)
const CHAT_FILE_DIR = path.join(STORAGE, "chat-files");  // private chat attachments (encrypted)
const REPORT_FILE_DIR = path.join(STORAGE, "report-files"); // public crime-report attachments (plain: they are public anyway)
for (const d of [ID_DIR, CHAT_FILE_DIR, REPORT_FILE_DIR]) fs.mkdirSync(d, { recursive: true });

// ---------- uploads ----------
const MAX_FILE_MB = 25;          // per file (chat attachment or report attachment)
const MAX_REPORT_FILES = 5;      // attachments per crime report

// ---------- nearby-crime notifications ----------
const NOTIFY_RADIUS_KM = 5;               // notify users whose last location is within this distance of a new crime
const NOTIFY_LOCATION_MAX_AGE_HOURS = 72; // ignore locations older than this when a report is posted
const NOTIFY_CATCHUP_HOURS = 24;          // when a user's location updates, also alert them about crimes posted in the last X hours nearby

module.exports = {
  CRIME_TYPES, FADE_DAYS, MIN_OPACITY, NID_RE,
  ID_DIR, CHAT_FILE_DIR, REPORT_FILE_DIR,
  MAX_FILE_MB, MAX_REPORT_FILES,
  NOTIFY_RADIUS_KM, NOTIFY_LOCATION_MAX_AGE_HOURS, NOTIFY_CATCHUP_HOURS,
};
