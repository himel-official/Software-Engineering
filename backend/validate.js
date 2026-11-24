const { NID_RE } = require("./config");

// Usernames do not have to be unique. Only the email and the NID are unique per account.
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanNid = (n) => String(n || "").replace(/[\s-]/g, "");

// Returns an error message, or null if everything is fine.
function validateAccount(b) {
  if (!USERNAME_RE.test(String(b.username || ""))) return "Username must be 3-20 letters, numbers or underscores";
  if (/^admin/i.test(b.username)) return "That username is reserved";
  if (!EMAIL_RE.test(String(b.email || "")) || b.email.length > 120) return "Please enter a valid email";
  if (typeof b.password !== "string" || b.password.length < 10) return "Password must be at least 10 characters";
  if (Buffer.byteLength(b.password) > 72) return "Password is too long (max 72 characters)";
  if (!NID_RE.test(cleanNid(b.nid))) return "Please enter a valid NID number (digits only)";
  return null;
}

// Returns the trimmed text if its length is between min and max, otherwise null.
function text(value, min, max) {
  const s = String(value || "").trim();
  return s.length >= min && s.length <= max ? s : null;
}

module.exports = { validateAccount, cleanNid, text };
