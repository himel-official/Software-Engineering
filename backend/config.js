const fs = require("fs");
const path = require("path");

// ---------- Crime types ----------
// permanent: true  => the dot never fades (serious crimes)
// Colours are used by the map legend and dots.
const CRIME_TYPES = [
  { key: "theft",      label: "Theft",                  color: "#8b5cf6", permanent: false }, // purple
  { key: "mugging",    label: "Mugging / Snatching",    color: "#ec4899", permanent: false }, // pink
  { key: "burglary",   label: "Burglary",               color: "#f97316", permanent: false }, // orange
  { key: "assault",    label: "Assault",                color: "#ef4444", permanent: false }, // red
  { key: "vandalism",  label: "Vandalism",              color: "#eab308", permanent: false }, // yellow
  { key: "drugs",      label: "Drug activity",          color: "#22c55e", permanent: false }, // green
  { key: "harassment", label: "Harassment / Stalking",  color: "#14b8a6", permanent: false }, // teal
  { key: "fraud",      label: "Fraud / Scam",           color: "#0ea5e9", permanent: false }, // sky blue
  { key: "arson",      label: "Arson",                  color: "#b45309", permanent: false }, // brown
  { key: "kidnapping", label: "Kidnapping",             color: "#1e3a8a", permanent: true  }, // navy
  { key: "murder",     label: "Murder",                 color: "#7f1d1d", permanent: true  }, // maroon
  { key: "rape",       label: "Rape / Sexual assault",  color: "#111827", permanent: true  }, // near black
];

// Ordinary crime dots fade from fully visible to MIN_OPACITY over FADE_DAYS.
const FADE_DAYS = 90;
const MIN_OPACITY = 0.08;

// National ID number: digits only, 8-20 long. Change this if your country's format is stricter.
const NID_RE = /^\d{8,20}$/;

// Where uploaded (encrypted) investigator ID cards are stored.
const ID_DIR = process.env.ID_STORAGE_DIR || path.join(__dirname, "storage", "id-cards");
fs.mkdirSync(ID_DIR, { recursive: true });

module.exports = { CRIME_TYPES, FADE_DAYS, MIN_OPACITY, NID_RE, ID_DIR };
