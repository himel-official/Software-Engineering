// Creates backend/.env with fresh random secret keys (only if it does not exist yet).
// Uses only built-in Node modules, so it can run before "npm install".
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  console.log(".env already exists - keeping your existing keys.");
  process.exit(0);
}

const key = () => crypto.randomBytes(32).toString("hex");
const content = [
  "PORT=5000",
  "NODE_ENV=development",
  `JWT_SECRET=${key()}`,
  `ENCRYPTION_KEY=${key()}`,
  `NID_HMAC_KEY=${key()}`,
  "",
].join("\n");

fs.writeFileSync(envPath, content);
console.log("Created backend/.env with new random secret keys.");
console.log("IMPORTANT: back this file up. If ENCRYPTION_KEY is lost, stored NIDs and ID cards can never be read again.");
