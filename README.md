# Sanjo (BuildTrack) — API

Daily work tracking for a construction firm: who worked where, for how many
hours, in which crew, what was done, and what everyone is owed.

- **Frontend:** https://buildtrack-frontend-ten.vercel.app (repo `buildtrack-frontend`)
- **API:** Railway, `https://buildtrack-api-production-d9b2.up.railway.app`
  (the frontend reaches it through its own `/api` proxy, see below)

## What it does

- One **record** = one day on one site, with a description of the work, an
  optional crew (with its own description), and a line **per worker**: start /
  end time or hours, hourly rate and a note. A 30-minute lunch break is
  deducted automatically when hours are computed from start/end.
- **Crews** with members and hourly rates; QR codes for quick check-in.
- **Payroll** per month, from the real hours of each person, in the user's
  currency (UAH, EUR, PLN, CZK, USD). PDF and CSV exports.
- Receipt photos (S3), 5 UI languages, installable as a PWA (frontend).

## Architecture

```
browser ──► Vercel (React SPA) ──/api/*──► Railway: Express API ──► Postgres  (users, sites, crews)
                                                              └──► MongoDB   (daily records, receipts)
                                                              └──► S3        (receipt photos)
```

- **Postgres** holds users, companies, invitations, sites, crews and
  password-reset tokens. Tables are created and migrated on start
  (`ensureSchema()` and `ensureCompanies()` in `src/config/postgres.js`).
- **Companies:** all data belongs to a company, not to a person. Every user is
  in exactly one company as `owner` or `foreman`. Registering starts a new
  company; an invitation link (`/invite?token=`, valid 14 days) adds a foreman
  instead. The owner manages sites, crews, payroll, currency and the team; a
  foreman sees the company's sites, crews, records and receipts, adds records
  and receipts, and edits or deletes only the records they entered. Removing a
  foreman keeps their records in the company and sends them back to a company
  of their own. Records and receipts carry both `userId` (who entered it) and
  `companyId` (who can see it); older documents are stamped on start.
- **MongoDB** (Atlas) holds daily records and receipts. They point at a site or
  crew by numeric id only, so the API protects that link: a site that still has
  records or receipts cannot be deleted (`409 SITE_IN_USE`), and deleting a crew
  removes the link from its records but keeps their worker entries.
- **Auth:** JWT in an `HttpOnly; Secure; SameSite=None` cookie. A session lasts
  14 days and renews while the user is active. The frontend proxies `/api`
  through Vercel so the cookie is first-party (Safari blocks third-party ones).

## Run locally

```bash
cp .env.example .env        # then edit
docker compose up -d        # Postgres on 5432 (MongoDB: run your own or use Atlas)
npm install
npm start                   # http://localhost:4000
npm test
```

### Environment variables

| Variable | Needed | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres URL. SSL is on unless `PGSSL=disable` (local Docker). |
| `MONGO_URI` | yes | MongoDB connection string. |
| `JWT_SECRET` | yes | Long random string. Changing it logs everyone out. |
| `FRONTEND_URL` | yes | Allowed CORS origin and base of password-reset links. |
| `PORT` | no | Railway sets it. |
| `NODE_ENV` | prod | `production` turns on secure cookies and proxy trust. |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME` | for receipts | |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | optional | Without SMTP reset and invitation links are printed to the server log (the owner also gets the invitation link to share by hand). |
| `OPEN_REGISTRATION` | optional | `true` lets anyone sign up and start a company; otherwise only invitation links can create accounts. |
| `ADMIN_EMAILS` | optional | Comma-separated emails that may open `/admin` (site-wide user stats). |

## API

All routes except auth need the session cookie.

| | |
|---|---|
| `POST /auth/register`, `/auth/login`, `/auth/logout` | |
| `POST /auth/forgot-password`, `/auth/reset-password` | rate limited |
| `GET /auth/me` | `{ id, email, role, isAdmin, company, currency }` |
| `PUT /auth/currency` | owner; the company's payroll currency |
| `GET/POST /sites`, `PUT/DELETE /sites/:id` | writes: owner |
| `GET/POST /crews`, `PUT/DELETE /crews/:id` | writes: owner |
| `POST /records`, `PUT/DELETE /records/:id` | per-worker `entries[]` |
| `GET /records?siteId&from&to` | `from`/`to` are `YYYY-MM-DD`, inclusive |
| `GET /records/payroll?from&to`, `/records/payroll.csv` | owner |
| `GET /records/report?from&to&lang`, `/records/export.csv` | PDF / CSV |
| `GET /records/monthly-stats`, `/records/worker-directory` | |
| `POST /receipts/upload`, `GET /receipts?siteId` | each receipt carries a `viewUrl` signed for 1 hour (the bucket is private) |
| `GET/PUT /company`, `POST /company/invites`, `DELETE /company/invites/:id`, `DELETE /company/members/:id` | owner |
| `GET /company/invites/:token` (public), `POST /company/invites/accept` | invitation preview / accept |
| `GET /admin/stats` | `ADMIN_EMAILS` only: counts per user, never record content |

## Tests and CI

```bash
npm test      # node:test, no extra dependencies
```

Covers the lunch-break and hours maths, record validation, payroll, date ranges,
sessions and currencies. GitHub Actions (`.github/workflows/ci.yml`) runs the
tests and `npm audit --audit-level=high` on every push and pull request.

## Deploy (Railway)

The `buildtrack` Railway project has three services: `buildtrack-api` (started
with `npm start`), `Postgres`, and `buildtrack-backup` (the nightly cron job,
see Backups). Both code services follow the GitHub `main` branch and redeploy on
every push; this needs the Railway GitHub App to have access to this repository
(GitHub -> Settings -> Applications -> Railway -> Repository access). Variables
are set per service; `buildtrack-backup` reuses the API's values by reference.
The frontend's `vercel.json` points its `/api` rewrite at the API's public domain.

## Backups

Railway's own volume backups are not available on the Hobby plan, and the free
MongoDB Atlas tier has none, so the app backs itself up:

- **Nightly job:** the Railway cron service `buildtrack-backup` runs
  `node scripts/backup-to-s3.js` every night (02:00 UTC). It writes every
  Postgres table and MongoDB collection into one gzip file,
  `s3://<S3_BUCKET_NAME>/backups/buildtrack-<UTC timestamp>.json.gz`
  (server-side encrypted), checks that the file reads back to the same row
  counts, and deletes backups older than 30 days (never the newest 7).
  A failed run shows up as a failed deployment in Railway.
- **Local copy any time:** `DATABASE_URL=... MONGO_URI=... node scripts/backup-to-s3.js --file out.json.gz`
- **Restore:** into *empty* databases only, with
  `node scripts/restore-backup.js <file.json.gz>` (dry run: shows what is inside) and
  `... --apply` (writes). Download the file with `aws s3 cp`, or pass `--s3 <key>`.
  It refuses to touch a database that already has data.
  Tested: a restored copy logs in with the old passwords and produces an identical payroll.
- The backup contains password hashes, so keep the bucket private.

Do a test restore into scratch databases now and then.
