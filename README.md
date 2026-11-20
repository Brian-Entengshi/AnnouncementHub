# DLL Elite Student Club Events & Announcement Hub

A campus workspace for published club announcements, activities, weekly events, team information, resources and venue schedules. Students can browse the public dashboard. Members sign in to request venues, and officers and advisers review requests and manage the organization.

## Run locally on Windows

Use Python 3.13 and Node.js 24 with npm. The workspace already contains a Django virtual environment and a Vite project. From the project root, open two PowerShell terminals.

**Terminal 1 — Django**

```powershell
cd backend
# On a fresh checkout, first create the environment:
# python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item -LiteralPath .env.example -Destination .env -ErrorAction Stop
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py createsuperuser
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Copy the example only on first setup. Keep an existing configured `.env`. Using the environment’s Python directly also works when PowerShell script activation is disabled. On macOS or Linux, use `venv/bin/python`.

**Terminal 2 — React**

```powershell
cd frontend
npm ci
npm run dev
```

Open [the local dashboard](http://localhost:5173/dashboard) using the port printed by Vite. The Vite server proxies `/api/` to Django, so login, CSRF and media downloads share the browser origin.

**Demonstration data.** The initialized development database includes sample campus records. On a fresh checkout, run `python manage.py seed_demo` with the virtual environment active to add these samples to an empty hub. The command skips a hub with existing content. Its sample author is inactive and has no usable password. Core teams are installed by migration independently of the demonstration.

To add the extended demonstration program to an existing local database, run `python manage.py seed_program --adviser <existing-adviser-username>` from `backend/`. It schedules seven activities and related events from tomorrow in Philippine time. Each booking goes through the same availability, capacity and overlap checks as a normal approval. The command preserves existing content and records each installed item so it can be rerun safely.

## Accounts and access

| Role | Access |
| --- | --- |
| Visitor | Open Hub Help and view published announcements, activities, events, team directory, useful links, venues, notices and the availability calendar. Private bookings appear as reserved slots. |
| Staff | Public features, personal reservation requests, status history and notifications. The server assigns the requester’s team. |
| Officer | Manage organization content, edit existing venues, and manage notices and reservations. Provision and manage staff accounts and team assignments. |
| Adviser | Officer capabilities, venue creation, archiving and deletion, officer account management, audit logs and organization settings. |

The first adviser signs in using the username and password entered at `createsuperuser`. Repeat that command to provision another adviser. There is no public registration endpoint. The Django admin at `/admin/` provides superusers with read-only inspection of hub records. The web workspace handles changes and records their history.

1. An adviser opens **Account Management → New account**, enters the member’s full name and username, selects Officer or Staff, and supplies an initial password. Staff require one of the four core teams. Officer and adviser accounts have no team.
2. An officer follows the same process for Staff. The API also checks the requested role and prevents promotion through an edit.
3. Initial and replacement passwords may be any non-empty value. Deliver temporary passwords privately. The member must choose a permanent password that passes Django validation before accessing protected pages. Subsequent sessions use an HTTP-only Django session cookie, with CSRF checks on writes.
4. Use the Account Management table to search and filter accounts by role, status or team. Open the row actions to edit details, replace a temporary password, activate or deactivate access. Deactivated members disappear from the active team directory.

## Reserving a venue and publishing an event

The default venues are Audio-Visual Room (AVR), DLL Grounds, and ComLab 1 through ComLab 5. The initial capacities and general campus location are editable defaults. Advisers can add venues from **Venues → Add Venue**. Managers can review retired venues under **Archived venues**. Existing bookings and notices keep their original venue references.

An adviser can permanently delete a venue with no dependent records. If any bookings or notices reference it, choose **Archive venue** instead. Existing schedules and history remain visible, and new bookings cannot select the archived venue.

In **Weekly Events**, choose **Dates With Events Only** to show dates with published scheduled or ongoing events in the selected week. Choose **All Dates** to see the full week, including cancelled events and empty dates.

1. Open **Venue Availability**, select a venue and inspect the week or month. Notices identify maintenance and other closure periods.
2. Sign in and open **Reservations → New reservation**. Enter a future date, start and end times, attendance, responsible person and contact details. All schedules use Philippine time.
3. The request is recorded as **Pending**. Pending requests can compete for a slot. The requester and reviewers receive notifications.
4. An officer or adviser opens the request and confirms approval or rejection. Rejection requires a reason. Staff can cancel their own pending or approved bookings. Reviewers can mark approved bookings completed once their scheduled time has elapsed.
5. To publish a scheduled event, open **Weekly Events → New event**, choose an approved reservation, optionally link an organization activity, and select **Publish event**. The booking supplies date, time and venue. Cancelling the booking marks the linked event cancelled on the public schedule.

Approvals recheck capacity, venue availability, closure periods and overlapping approved bookings inside a database transaction. Two intervals overlap when the existing start precedes the proposed end and the existing end follows the proposed start. Back-to-back bookings are allowed. New closures and capacity reductions are also checked against approved bookings.

SQLite uses `BEGIN IMMEDIATE` for these transactions. Writers take turns across the entire database, including when two reviewers approve simultaneously. A writer can time out under heavy contention. For a multi-instance deployment, move the schedule transactions to a shared database and implement venue-level locking or a database-enforced exclusion constraint. Re-run the competing-approval test when changing database engines.

## Content, drafts and privacy

- **Manage Announcements** supports drafts, publication, pinning, expiration, archiving, images and optional PDF attachments. Every public list excludes expired and unpublished announcements.
- **Organization Activities** tracks date-based upcoming, ongoing and completed initiatives. Multiple scheduled events can link to one activity.
- **Organization Teams** displays current members and roles. The four core teams keep their names. Managers can edit descriptions, add other teams, and move staff through Account Management.
- **Notifications** contains read status, links and reservation decisions. **Audit Logs** gives advisers a searchable, paginated history of sign-ins, sign-outs and administrative changes. A failed sign-in records the failure without the submitted credentials. Settings controls the contact details shown in Student Access Hub Help.
- Resource forms save drafts per account, form and record in the current tab’s session storage. Drafts expire after seven days and clear on successful save, cancellation or sign-out. Passwords and uploaded file contents are excluded. Reselect a file after refreshing.
- File uploads support JPEG, PNG and WebP images and PDF announcement attachments, up to 5 MB each. Django checks access when serving uploaded files.

## Project structure

```text
backend/
  config/                 Settings, routing, shared API permissions and media access
  users/                  Accounts, sessions and password changes
  teams/                  Team directory and membership
  announcements/          Publication and attachments
  activities/             Date-based organizational initiatives
  events/                 Events linked to approved bookings
  reservations/           Request validation, transitions and history
  venues/                 Venues, closure notices and availability
  useful_links/           Resource directory
  notifications/          Per-member inbox
  audit_logs/             Administrative records
  dashboard/              Dashboard aggregation, settings and demo command
frontend/
  src/pages/              Routed pages
  src/components/         Layout, calendar, forms, details and workflow controls
  src/context/            Session restoration and role state
  src/hooks/              Requests and draft persistence
  src/services/           API client and resource form definitions
  src/styles/             Responsive layout, dashboard and resource styles
  public/brand/           Supplied seal, install icons and campus illustration
  public/                 Manifest and service worker
  tests/                  Browser integration tests
```

Django REST Framework handles validation, authorization, pagination and JSON responses. React Router handles browser navigation. The frontend uses JSX, native fetch and Lucide React with the existing Vite and TypeScript entry point. SQLite data, uploads, environment files and generated development secrets are excluded from version control.

## Configuration and deployment

| Variable | Purpose |
| --- | --- |
| `DJANGO_DEBUG` | Use `true` for local development and `false` for production. |
| `DJANGO_SECRET_KEY` | Supply a unique secret in production. Local development generates an ignored key file. |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hostnames served by Django. |
| `DJANGO_BEHIND_HTTPS_PROXY` | Set to `true` only behind a trusted reverse proxy that overwrites the forwarded protocol header. |
| `VITE_API_BASE_URL` | Defaults to `/api`. A same-origin API path is recommended for session authentication. |
| `DJANGO_PROXY_TARGET` | Backend target for Vite dev and preview. Defaults to `http://127.0.0.1:8000`. |

Use `backend/.env.example` and `frontend/.env.example` as templates. Vite environment values are public build configuration. Keep credentials out of frontend files.

For deployment, build the frontend with `npm run build`, serve `frontend/dist/` over HTTPS and run Django using a production WSGI or ASGI server. Configure the same host to proxy `/api/` and `/admin/` to Django. Run `manage.py collectstatic` and serve `/static/` from `backend/staticfiles/`. Preserve the public host and protocol at the proxy, enable secure cookies with debug disabled and keep the database and media on persistent storage. Keep uploaded files behind the Django media endpoint.

**SPA fallback.** Serve existing frontend files directly and rewrite other frontend navigation requests to `/index.html`. For example, use `try_files $uri $uri/ /index.html;` in the frontend location of an nginx server. Give the API, admin and static routes their own locations before applying this fallback. This preserves a route such as `/reservations/new` after refresh.

## Install the PWA

Start Django, then run `npm run build` and `npm run preview` in the frontend folder. Open the preview URL printed by Vite. In supported Chrome or Edge browsers, use **Install app** from the browser menu. On supported iOS devices, use Safari’s **Share → Add to Home Screen**. A real device accessing a network host needs HTTPS.

The production build precaches the app shell, icons, JavaScript and CSS. An offline device can reopen the interface and see the connection state. API responses, credentials, private records and uploads stay outside the service-worker cache. Submitting changes requires a connection.

## Verification

```powershell
# backend/
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\venv\Scripts\python.exe manage.py migrate --check
.\venv\Scripts\python.exe manage.py test

# frontend/
npm run lint
npm run build
npm run test:e2e
```

The backend suite uses an isolated file-backed SQLite database for simultaneous-approval testing. Playwright builds the frontend and starts its own preview and Django servers on ports 4187 and 8037. It provisions temporary accounts with a generated password in a separate database. The browser suite defaults to installed Google Chrome. Set `ELITE_BROWSER_CHANNEL=msedge` to use Edge or `ELITE_TEST_PYTHON` to select a different backend Python executable.

The optional `tests/local-regression.spec.js` test takes a disposable, migrated copy of the local SQLite database with the demonstration program installed. Set `ELITE_BROWSER_TEST_DB_COPY` to the copy and pass the adviser and officer credentials at runtime with `ELITE_LOCAL_ADMIN_USER`, `ELITE_LOCAL_ADMIN_PASSWORD`, `ELITE_LOCAL_OFFICER_USER` and `ELITE_LOCAL_OFFICER_PASSWORD`. Run `npx playwright test tests/local-regression.spec.js` after building the frontend. The test makes changes to its copy, including a venue deletion. Discard the copy afterward.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Dashboard cannot reach the hub | Start Django, check the Vite proxy target, and reload the same frontend origin. |
| Login or write returns a CSRF error | Open the app through Vite or the same-origin production proxy. Check the public host, protocol and cookie settings. |
| A booking cannot be approved | Check the latest venue availability, capacity, closure notices and approved slots. The request must still be pending and start in the future. |
| A team or venue cannot be deleted | Review linked records. Reassign team members where appropriate, or archive a linked venue to retain booking history. |
| Recent operations are missing from Audit Logs, or writes fail immediately after migrating | Restart any Django process still serving older code and check that Vite proxies to the restarted process. Confirm the target database with `manage.py migrate --check`. |
| A page works by clicking but fails on refresh | Check the frontend host’s SPA fallback and API route precedence. |
| Install option is missing | Use the production preview or HTTPS deployment, check browser support, and confirm the manifest and service worker load. |
| Vite or Python dependencies are missing | Run `npm ci` in frontend and install `backend/requirements.txt` with the backend environment’s interpreter. |
