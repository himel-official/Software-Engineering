// Encryption helpers. Needs ENCRYPTION_KEY and NID_HMAC_KEY in .env (created by scripts/setup-env.js).
const crypto = require("crypto");

function loadKey(name) {
  const hex = process.env[name];
  if (!hex || hex.length !== 64) {
    throw new Error(`${name} is missing in backend/.env. Run:  node scripts/setup-env.js`);
  }
  return Buffer.from(hex, "hex");
}

const ENC_KEY = loadKey("ENCRYPTION_KEY");
const HMAC_KEY = loadKey("NID_HMAC_KEY");

// AES-256-GCM: encrypts AND detects tampering. Output = iv(12) + authTag(16) + ciphertext
function encryptBuffer(buf) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

function decryptBuffer(buf) {
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

const encrypt = (text) => encryptBuffer(Buffer.from(text, "utf8")).toString("base64");
const decrypt = (b64) => decryptBuffer(Buffer.from(b64, "base64")).toString("utf8");

// Keyed hash used ONLY to check "is this NID already registered?" without storing it in readable form.
const blindIndex = (value) => crypto.createHmac("sha256", HMAC_KEY).update(value).digest("hex");

module.exports = { encrypt, decrypt, encryptBuffer, decryptBuffer, blindIndex };
