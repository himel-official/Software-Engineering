require("dotenv").config(); // must be first: loads the secret keys from .env
require("express-async-errors"); // lets "async" route handlers send errors to the error handler below (needed now that the database is async)

const path = require("path");
const fs = require("fs");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const { authenticate } = require("./middleware/auth");
const csrf = require("./middleware/csrf");

const app = express();

// In development the Vite dev server forwards requests to us, so we trust the loopback proxy
// to read the real visitor IP (only used for admin audit logs). Behind nginx etc. set TRUST_PROXY.
app.set("trust proxy", process.env.TRUST_PROXY || "loopback");
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "https://*.tile.openstreetmap.org"], // map tiles
      },
    },
  })
);
app.use(express.json({ limit: "50kb" }));
app.use(cookieParser());

app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 1500, standardHeaders: true, legacyHeaders: false }));
app.use("/api", csrf);
app.use("/api", authenticate);

app.use("/api/meta", require("./routes/meta"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/chats", require("./routes/chats"));
app.use("/api/location", require("./routes/location"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/investigators", require("./routes/investigators"));
app.use("/api/admin", require("./routes/admin"));

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Production: also serve the built React site (run "npm run build" in frontend first)
const dist = path.join(__dirname, "..", "frontend", "dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err, req, res, next) => {
  // Garbage in the URL (e.g. an id that is not a number) is the visitor's mistake, not a server crash.
  if (err && (err.code === "22P02" || err.code === "22003")) return res.status(400).json({ error: "Invalid request" });
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

const PORT = process.env.PORT || 5000;
// Check the Supabase connection at start-up, so a wrong DATABASE_URL is obvious right away.
require("./db")
  .get("SELECT 1 AS ok")
  .then(() => console.log("Connected to the Supabase database."))
  .catch((e) => console.error("\n!!! Cannot connect to the database:", e.message, "\n    Check DATABASE_URL in backend/.env (use the Session pooler string) and run: npm run db:setup\n"));

// Check Supabase Storage too (creates the private bucket the first time).
require("./storage")
  .init()
  .then(() => console.log(`Connected to Supabase Storage (private bucket "${require("./storage").BUCKET}").`))
  .catch((e) => console.error("\n!!! Supabase Storage problem:", e.message, "\n    Check SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env\n"));

app.listen(PORT, () => console.log(`SafeVoice server running on http://localhost:${PORT}`));
