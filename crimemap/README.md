# SafeVoice

Anonymous crime reporting with a red dots on a map. React (Vite) frontend + Node.js/Express backend + **Supabase (PostgreSQL) database**.

## Database: Supabase (do this once, before the first start)
1. Create a free project at https://supabase.com (pick the region closest to your visitors, e.g. Singapore or Mumbai). Save the **database password** you choose.
2. In the project press **Connect** (top bar) -> **Session pooler** -> copy the URI. It looks like
   `postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`
   Replace `[YOUR-PASSWORD]` with your database password (if it contains symbols such as @ # / ?, URL-encode them, or just reset the password to letters and numbers).
   Use the *Session pooler* string, not "Direct connection": the direct one needs IPv6 and fails on many home networks.
3. Run `npm run setup` once (see "Quick start" below). It creates `backend/.env` with fresh secret keys. Open that file and put the URI after `DATABASE_URL=`
   (no spaces, no quotes; see `backend/.env.example`).
4. Run `npm run setup` again: it creates the tables in Supabase (safe to repeat any time).
   Or paste `backend/supabase/schema.sql` into Supabase -> SQL Editor -> Run.
5. Row Level Security is switched ON for every table with no policies, on purpose: only the SafeVoice backend can read the data, the public Supabase API cannot.
   Do NOT add policies, and never put the Supabase `service_role` key or the database password in the frontend.

Keeping your old data (accounts, reports, chats from the local SQLite version)? After step 4 run `npm run db:migrate-old-data` once, from the project folder (needs Node 22.5+; it reads backend/data/crimemap.db). Keep using the same `.env` keys.

## First admin account (manual, in Supabase)
There is no admin-creation script. Add the first admin yourself: Supabase -> SQL Editor -> paste the contents of `backend/supabase/create-first-admin.sql`
(change the username, email and password inside it) -> Run. Then log in on the website with that EMAIL and password.
Further admins can be made from the admin portal ("make admin", asks for your password and is written to the audit log).

## Quick start (Windows, Mac, Linux)
You need Node.js LTS from https://nodejs.org (18 or newer; 22.5+ only if you migrate old SQLite data). Open a terminal in this folder (the one with this README) and run:

    npm install          installs everything (root, backend and frontend) - first time only
    npm run setup        creates backend/.env with secret keys, then creates the Supabase tables
                         (the first time it stops and asks for DATABASE_URL: fill it in, then run it again)
    npm run dev          starts the backend (port 5000) and the website (port 5173) together

Then open http://localhost:5173. Press Ctrl+C in the terminal to stop both. There is nothing else to start or stop.
Add the first admin account in Supabase (see "First admin account" above) before you log in.

## Production
    npm run build        builds the website into frontend/dist
    npm start            runs the backend in production mode; it also serves the built website on port 5000
Run it behind HTTPS (nginx / Hostinger / any host that gives you a certificate). Set TRUST_PROXY (e.g. 1) so admin IPs are the real visitor IPs.

## All commands (run from this folder)
    npm run dev                    backend + website together, auto-reload
    npm run setup                  keys file + database tables (safe to repeat)
    npm run db:setup               only the database tables
    npm run db:migrate-old-data    one-time copy of an old local SQLite database into Supabase
    npm run build / npm start      production build / production server

## What's new in this version (SafeVoice)
- **Renamed to SafeVoice.**
- **Nearby crime alerts:** when a crime is reported, everyone whose last known location is within 5 km gets an alert (bell button, Alerts page,
  optional browser pop-up). Location is sent while the site is open; alerts are in-app only (no push when the site is closed).
- **Private chat files:** pictures, videos, PDFs and documents (max 25 MB). Stored encrypted; only the two chat members and admins can open them
  (admin opens are written to the audit log).
- **Crime report files:** up to 5 pictures / videos / PDFs / documents per report, publicly visible. GPS/camera data is stripped from JPEG photos.
- **All crime dots are red**, with no halo or extra radius. Home page reorganised (banner, numbers, map + filters, searchable posts).
- **Admins can remove admin rights** from other admins (needs your password, logged; you cannot remove yourself; at least one admin always remains).
- **Admins can see a user's last recorded location** (latest point only; every look is logged).
- **Investigators can report crimes** too.
- **Usernames no longer need to be unique** - only email and NID are. Because of that, **log in with your EMAIL** (admins too).

## Privacy notes for the new features
- Users are told on the registration page that their location is shared and visible to admins. Keep that notice if you change the page.
- Videos and documents are published exactly as uploaded (only JPEG photos are cleaned), so warn reporters about hidden metadata and faces.
- Tune limits in backend/config.js: MAX_FILE_MB, MAX_REPORT_FILES, NOTIFY_RADIUS_KM, NOTIFY_LOCATION_MAX_AGE_HOURS, NOTIFY_CATCHUP_HOURS.

## UPGRADING from the local-SQLite version
Copy these from your old backend folder into the new one:
    backend\.env      (secret keys - without it, encrypted data cannot be read; add DATABASE_URL to it)
    backend\storage   (encrypted ID cards, chat files, report files - these still live on disk)
    backend\data      (the old SQLite database - only needed once, for `npm run db:migrate-old-data`)
Then follow the "Database: Supabase" steps above. Everyone has to log in again after the move.

## Roles
- Regular user / reporter: registers with email, password, NID. Files and manages reports, chats with investigators.
- Investigator (police / journalist): registers with extra job info + ID card upload. Shows "Unverified" until an admin
  checks the ID. Only VERIFIED investigators see exact locations and can contact reporters.
- Admin: added by hand in the database, see "First admin account" below (cannot register on the website). Verifies investigators, sees all details and last locations,
  moderates reports, reads the audit log, makes/removes other admins.

## Security design
- NID: encrypted with AES-256-GCM, plus a keyed hash (HMAC) that enforces "one NID = one account".
- ID cards: stored as encrypted files on disk, decrypted only for admins.
- Chat messages and chat files: encrypted at rest; the database (PostgreSQL triggers) refuses to edit or delete the messages.
- Audit log: the database refuses to edit or delete entries; each entry is hash-chained to the previous one
  (admin page has "Check log integrity"). Admin IP addresses are stored ONLY in this log.
- Passwords: bcrypt. Login cookie: httpOnly, SameSite=Strict. Rate limits on login/register/report creation.
- Public map shows locations rounded to about 110 m. Reporters are never identified to the public or investigators.

## VERY IMPORTANT
- Back up backend/.env and backend/storage (Supabase keeps the database itself; enable its backups in the dashboard for real use). If ENCRYPTION_KEY is lost, NIDs, ID cards and chats can never be read again.
  If NID_HMAC_KEY is lost or changed, the "one NID per account" check breaks.
- Never upload backend/.env or backend/data or backend/storage to GitHub (the .gitignore already excludes them). backend/.env now also holds your database password.
- Files (ID cards, chat files, report files) are still stored in backend/storage on the server's disk, NOT in Supabase. Back that folder up too, and keep it on persistent disk when you deploy.
- Before real use: HTTPS, strong server security, legal review of storing NIDs, and a security review.

## Change things
- Crime types / fade time: backend/config.js
- Map start location: frontend/src/config.js
- NID format: NID_RE in backend/config.js
