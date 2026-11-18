# CrimeMap

Anonymous crime reporting with a dotted heatmap. React (Vite) frontend + Node.js/Express backend.

## Run on Windows (easiest)
1. Install Node.js LTS (version 22.5 or newer) from https://nodejs.org
2. Double-click start.bat
   - first time: installs libraries, creates secret keys, asks you to create the first ADMIN account
   - then opens http://localhost:5173
3. Double-click stop.bat to stop.

## Run manually
    cd backend
    npm install
    node scripts/setup-env.js        (creates .env with random secret keys)
    node scripts/create-admin.js     (creates the first admin)
    npm run dev

    cd frontend      (second terminal)
    npm install
    npm run dev

## What's new in this version
- Home page: map with a blue "You are here" marker, crime statistics list beside it (filter by period and by distance
  from you), and a feed of public posts (newest / nearest, "Show on map" button on every post).
  The old full-screen map is still available under "Full map".
- Investigator profile page (public bio, role, verification status). Private details stay admin-only.
- Admins can make any user an admin (confirmed with the admin's own password, written to the permanent log).
- Unread message counter on the Messages button (and in the browser tab title), plus a counter per chat.

## UPGRADING from the previous version
Your accounts, reports, chats and keys live in THREE places inside the old backend folder.
Copy these into the new backend folder BEFORE running start.bat:
    backend\.env      (secret keys - without it, encrypted data cannot be read)
    backend\data      (database)
    backend\storage   (encrypted ID cards)
The database upgrades itself automatically on first start.

## Roles
- Regular user / reporter: registers with email, password, NID. Files and manages reports, chats with investigators.
- Investigator (police / journalist): registers with extra job info + ID card upload. Shows "Unverified" until an admin
  checks the ID. Only VERIFIED investigators see exact locations and can contact reporters.
- Admin: created only with create-admin (cannot register on the website). Verifies investigators, sees all details,
  moderates reports, reads the audit log.

## Security design
- NID: encrypted with AES-256-GCM, plus a keyed hash (HMAC) that enforces "one NID = one account".
- ID cards: stored as encrypted files on disk, decrypted only for admins.
- Chat messages: encrypted at rest; the database refuses to edit or delete them.
- Audit log: the database refuses to edit or delete entries; each entry is hash-chained to the previous one
  (admin page has "Check log integrity"). Admin IP addresses are stored ONLY in this log.
- Passwords: bcrypt. Login cookie: httpOnly, SameSite=Strict. Rate limits on login/register/report creation.
- Public map shows locations rounded to about 110 m. Reporters are never identified to the public or investigators.

## VERY IMPORTANT
- Back up backend/.env. If ENCRYPTION_KEY is lost, NIDs, ID cards and chats can never be read again.
  If NID_HMAC_KEY is lost or changed, the "one NID per account" check breaks.
- Never upload backend/.env or backend/data or backend/storage to GitHub (the .gitignore already excludes them).
- Before real use: HTTPS, strong server security, legal review of storing NIDs, and a security review.

## Change things
- Crime types / colours / fade time: backend/config.js
- Map start location: frontend/src/config.js
- NID format: NID_RE in backend/config.js

## Production
    cd frontend && npm run build
    cd ../backend && set NODE_ENV=production && node server.js
Run it behind HTTPS (nginx / Hostinger). Set TRUST_PROXY (e.g. 1) so admin IPs are the real visitor IPs.
