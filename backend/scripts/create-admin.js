// Creates an admin account.
//   Interactive:      node scripts/create-admin.js
//   Only if none yet: node scripts/create-admin.js --if-none
//   Non-interactive:  set ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const readline = require("readline/promises");
const bcrypt = require("bcryptjs");
const db = require("../db");

async function main() {
  const ifNone = process.argv.includes("--if-none");
  const count = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
  if (ifNone && count > 0) return;

  let { ADMIN_USERNAME: username, ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
  if (!username) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log("\n=== Create an admin account ===");
    console.log("(your typing is visible on screen, so make sure nobody is watching)\n");
    username = await rl.question("Admin username (e.g. admin123): ");
    email = await rl.question("Admin email: ");
    password = await rl.question("Admin password (min 12 characters): ");
    rl.close();
  }
  username = (username || "").trim();
  email = (email || "").trim().toLowerCase();

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) throw new Error("Username must be 3-20 letters, numbers or underscores");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
  if (!password || password.length < 12) throw new Error("Admin password must be at least 12 characters");

  const hash = await bcrypt.hash(password, 12);
  db.prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')").run(username, email, hash);
  console.log(`\nAdmin "${username}" created. You can now log in on the website.`);
}

main().catch((e) => {
  console.error("\nCould not create admin:", e.message);
  process.exit(1);
});
