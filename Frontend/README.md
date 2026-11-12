# SafeVoice — Frontend

React 19 + Vite 7 + Tailwind 4 client for the SafeVoice anonymous crime
reporting platform.

The backend is the source of truth. There is no local mock data — every
screen talks to the Django API over `/api`.

---

## Run it

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:5173**.

The Vite dev server proxies `/api` to `http://127.0.0.1:8000`, so the browser
never makes a cross-origin request. Start the backend first (see the
[project README](../README.md)), or point the proxy elsewhere:

```bash
VITE_DEV_API_TARGET=http://127.0.0.1:8000 npm run dev
```

For a production bundle:

```bash
VITE_API_BASE_URL=https://api.example.com npm run build
```

---

## Layout

```
src/
├── Pages/          public pages
│   ├── HomePage.jsx          landing page + live incident map
│   ├── ReportComplaint.jsx   4-step anonymous report form
│   ├── TrackReport.jsx       look up a report with reference + key
│   ├── Complaints.jsx        public list + map of visible reports
│   ├── EmergencyContacts.jsx published hotlines
│   ├── Guidelines.jsx        published safety guidelines
│   └── Login.jsx             staff sign-in
├── admin/
│   ├── AdminLayout.jsx       console shell
│   ├── AdminSidebar.jsx      navigation
│   └── pages/                Dashboard, AllReports, Categories,
│                             Guidelines, EmergencyContacts, Users, Settings
├── api/
│   ├── client.js             axios instance, token storage, error helpers
│   └── helpers.js            unwrapList() / readMessage()
├── context/        AuthContext, PrivateRoute, AdminRoute
├── components/     Hero, HowItWorks, MapView, Navbar, …
├── Layout/         RootLayout
├── Routes/         routes.jsx
└── utils/          savedReports.js — local access-key storage
```

---

## How the API is called

`src/api/client.js` owns a single axios instance. The DRF token is read from
`localStorage` on every request and attached as an `Authorization: Token <key>`
header. A `401` clears the stored session so the UI falls back to the login
screen instead of silently failing.

```js
import api from "../api/client";

const { data } = await api.get("/reports/manage/");
```

### Two response shapes

The API returns list payloads in one of two ways, and `unwrapList()` from
`src/api/helpers.js` normalises both:

```js
import { unwrapList } from "../api/helpers";

const { data } = await api.get("/admin/categories/");
const items = unwrapList(data); // works for {results:[…]} and {data:[…]}
```

- Custom API views return `{ success: true, data: [...] }`
- DRF router endpoints return paginated `{ count, next, previous, results: [...] }`

---

## Access control

| Route | Who |
| --- | --- |
| `/`, `/report`, `/track`, `/complaints`, `/emergency`, `/guidelines` | everyone, no login |
| `/admin/all-reports` | any signed-in staff member |
| `/admin` and every other console screen | `ADMIN` only |

`PrivateRoute` redirects to `/admin-login` when there is no session;
`AdminRoute` additionally checks `user.role === "ADMIN"`.

---

## Anonymous reporting on the client

The report form submits `multipart/form-data` so photos and videos can be
attached in the same request as the report body:

```js
const payload = new FormData();
payload.append("category_id", formData.category_id);
payload.append("description", formData.description.trim());
payload.append("incident_datetime", new Date(formData.incident_datetime).toISOString());
payload.append("location_text", formData.location_text.trim());
files.forEach((file) => payload.append("evidence_files", file));

const { data } = await api.post("/reports/", payload);
```

The server answers with a `reference_number` and a one-time `access_key`.
The key is saved locally (`src/utils/savedReports.js`) so the citizen can
track their own report later without ever creating an account. **The key is
never sent back to the server in the clear** — only a hash of it is stored,
and tracking requires both values.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR on http://127.0.0.1:5173 |
| `npm run build` | Production bundle into `dist/` |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | ESLint over the whole project |
