# DLL Elite Student Club Events & Announcement Hub

A campus workspace for club announcements, organization activities, weekly events, useful links, venues, and venue notices. Student Access is the public landing page. Members sign in to use the organization workspace.

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

Open [Student Access](http://localhost:5173/student) using the port printed by Vite. The Vite server proxies `/api/` to Django, so login, CSRF and media downloads share the browser origin.

**Demonstration data.** Run `python manage.py seed_demo` from `backend/` to add sample announcements, events, activities, links, and a venue notice to an empty hub. Its sample author has an unusable password. Migrations install the core teams separately.

To add the extended demonstration program to an existing local database, run `python manage.py seed_program --adviser <existing-adviser-username>` from `backend/`. It schedules seven activities and related events from tomorrow in Philippine time. The command preserves existing content and records each installed item so it can be rerun safely.

Run `python manage.py seed_venue_notices` to install the demonstration notices. It adds ten records across the seven default venues when all venues are active. Managers can filter **Venue Notices** to see the expired example. The command skips records already installed, including records edited since seeding.

Run `python manage.py seed_demo_staff` to bring each active team to 17 active Staff members. It uses fictional names and `@example.test` addresses, leaves existing accounts and assignments intact, and gives some members a second team. Demo accounts have unusable passwords.

## Accounts and access

| Role | Access |
| --- | --- |
| Visitor | Browse published announcements and Club Events on Student Access, read venue notices linked to events, and view configured public contacts. |
| Staff | Use the member dashboard, view organization activities, schedules, team rosters, useful links, venues, published notices, and personal notifications. |
| Officer | Manage organization content, edit existing venues and teams, and manage notices, Staff accounts, and team assignments. |
| Adviser | Officer capabilities, creation of teams and venues, venue archiving and deletion, officer account management, audit logs, and organization settings. |

The first adviser signs in using the username and password entered at `createsuperuser`. Repeat that command to provision another adviser. There is no public registration endpoint. The Django admin at `/admin/` provides superusers with read-only inspection of hub records. The web workspace handles changes and records their history.

1. An adviser opens **Account Management → New account**, enters the member’s full name and username, selects Officer or Staff, and supplies an initial password. Staff require at least one team and can have multiple assignments. Officer and adviser accounts have no Staff assignments.
2. An officer follows the same process for Staff. The API also checks the requested role and prevents promotion through an edit.
3. Initial and replacement passwords may be any non-empty value. Leave the replacement field blank to keep the current password. Deliver temporary passwords privately. The member must choose a permanent password that passes Django validation before accessing protected pages. Subsequent sessions use an HTTP-only Django session cookie, with CSRF checks on writes.
4. Use the Account Management table to search and filter accounts by role, status or team. Open the row actions to edit details, replace a temporary password, activate or deactivate access. Deactivation preserves team memberships and the roster shows the account as inactive.

The account API returns 15 accounts per page. Scroll inside the table to reach the rest of a page. The column headers stay visible on desktop, and the pager sits below the scroll area.

## Venue schedules and publishing

The seven default venues are Audio-Visual Room (AVR), DLL Grounds, and ComLab 1 through ComLab 5. Advisers add venues through **Venues → Add Venue**. Use the Active, Inactive, and Archived filters to review venue records. An adviser can archive a venue linked to events or notices. Their existing dates and venue details stay accessible on the records.

Create an event in **Weekly Events → New event**. Select an active venue, enter its date and start and end times in Philippine time, and optionally link an organization activity. Select **Publish event** to share it. Mark it cancelled from Edit when the event is called off.

Use **Venue Notices** to draft, publish, unpublish, or archive venue announcements. **Venue Availability** combines published notices and events at active venues. Filter by venue, show events or notices, and browse weekly or monthly periods.

When upgrading from the previous release, back up SQLite before running migrations. The event migration copies each existing date, time, venue, and cancellation state before dropping the old reservation tables. It keeps the saved names of retired venues on historical records.

## Content, drafts and privacy

- **Apply filters** runs the selected search and filters together. **Clear** removes the search and filters and returns paginated lists to page one. In Venue Availability, Clear returns the schedule to the current period while keeping the chosen calendar view.
- The current tab remembers the last applied filters, search, list page, venue status tab and calendar preferences separately for each signed-in account. Browser history retains each visited view, and Account Management restores the internal scroll position when reopening the same results. Search terms stay out of URLs.
- **Announcements** includes draft management, publication, pinning, expiration, archiving, images and optional PDF attachments for advisers and officers. Student Access and Staff see published, current announcements. Existing `/manage-announcements` links redirect to the equivalent `/announcements` route.
- **Organization Activities** tracks date-based upcoming, ongoing and completed initiatives. Multiple scheduled events can link to one activity.
- **Organization Teams** shows paginated rosters to signed-in members. Tabs come from the active teams in Django and remember the selected team and roster page. Advisers can create teams. Advisers and officers can edit teams, remove individual memberships, and assign Staff through Account Management. Inactive teams remain available for managers to review and are removed from new assignment choices. The four core teams keep their names and stay active.
- **Notifications** contains read status and links to organization updates. **Audit Logs** gives advisers a searchable, paginated history of sign-ins, sign-outs and administrative changes. A failed sign-in records the failure without the submitted credentials.
- Resource forms save drafts per account, form and record in the current tab’s session storage. Drafts expire after seven days and clear on successful save, cancellation or sign-out. Passwords and uploaded file contents are excluded. Reselect a file after refreshing.
- File uploads support JPEG, PNG and WebP images and PDF announcement attachments, up to 5 MB each. Django checks access when serving uploaded files.

## Managing Student Access

Advisers can open **Settings → Landing Page Management** to edit Home, About, Contacts, and announcement display preferences. The editor previews Home, About, and Contacts as you type. **Save and publish** updates the public page immediately and logs the sections changed. Optional fields can be left blank.

Use **Announcements** to edit publication status and pin a post. In Landing Page Management, advisers can highlight the newest published pinned post and choose how many announcements students see per page. Back up uploaded hero images with the rest of the media files.

## Database backup and restore

From `backend/`, run `python manage.py export_hub_fixture` to regenerate `backup.json`. The fixture preserves accounts, roles, groups, permissions, team memberships, event schedules, venue notices, and the rest of the application's database records. Account passwords in the export are unusable, and active sessions are excluded. The fixture contains private application data.

To restore to a new database:

1. Create an empty target database and configure Django to use it. Local development uses SQLite in `config/settings.py`. For a cloud database, install the target driver, such as Psycopg for PostgreSQL, and define its connection in a deployment settings module using environment variables for credentials.
2. With Django pointed at the target, run the following commands from `backend/`. Use the same settings module for each command. Run `flush` only against the dedicated new target. It removes the default rows inserted by migrations so the fixture can restore the original venue and team IDs.

   ```bash
   python manage.py migrate
   python manage.py flush --noinput
   python manage.py loaddata backup.json
   ```

3. Verify restored users, teams, memberships, venues, event schedules, and audit history before opening the new database to users. Run `python manage.py changepassword <adviser-username>` to recover adviser access, then issue temporary passwords to members who need sign-in. Demo accounts can stay disabled for sign-in.
4. Back up and restore `backend/media/` or your deployed media storage separately. The fixture stores paths for uploads. Copy the files into the target media storage with the same paths.

## Project structure

```text
backend/
  config/                 Settings, routing, shared API permissions and media access
  users/                  Accounts, sessions and password changes
  teams/                  Team directory and membership
  announcements/          Publication and attachments
  activities/             Date-based organizational initiatives
  events/                 Independent event schedules and publication
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

**SPA fallback.** Serve existing frontend files directly and rewrite other frontend navigation requests to `/index.html`. For example, use `try_files $uri $uri/ /index.html;` in the frontend location of an nginx server. Give the API, admin and static routes their own locations before applying this fallback. This preserves a route such as `/student/announcements/1` after refresh.

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
| A team or venue cannot be deleted | Review linked records. Make a team inactive or archive a venue to retain its history. |
| Recent operations are missing from Audit Logs, or writes fail immediately after migrating | Restart any Django process still serving older code and check that Vite proxies to the restarted process. Confirm the target database with `manage.py migrate --check`. |
| A page works by clicking but fails on refresh | Check the frontend host’s SPA fallback and API route precedence. |
| Install option is missing | Use the production preview or HTTPS deployment, check browser support, and confirm the manifest and service worker load. |
| Vite or Python dependencies are missing | Run `npm ci` in frontend and install `backend/requirements.txt` with the backend environment’s interpreter. |
