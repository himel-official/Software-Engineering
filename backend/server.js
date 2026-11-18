require("dotenv").config(); // must be first: loads the secret keys from .env

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
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CrimeMap server running on http://localhost:${PORT}`));
