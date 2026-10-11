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

- **Postgres** holds users, sites, crews and password-reset tokens. Tables are
  created and migrated on start (`ensureSchema()` in `src/config/postgres.js`).
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
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | optional | Without SMTP the reset link is printed to the server log. |

## API

All routes except auth need the session cookie.

| | |
|---|---|
| `POST /auth/register`, `/auth/login`, `/auth/logout` | |
| `POST /auth/forgot-password`, `/auth/reset-password` | rate limited |
| `GET /auth/me` | `{ id, currency }` |
| `PUT /auth/currency` | `{ currency }` |
| `GET/POST /sites`, `PUT/DELETE /sites/:id` | |
| `GET/POST /crews`, `PUT/DELETE /crews/:id` | |
| `POST /records`, `PUT/DELETE /records/:id` | per-worker `entries[]` |
| `GET /records?siteId&from&to` | `from`/`to` are `YYYY-MM-DD`, inclusive |
| `GET /records/payroll?from&to`, `/records/payroll.csv` | |
| `GET /records/report?from&to&lang`, `/records/export.csv` | PDF / CSV |
| `GET /records/monthly-stats`, `/records/worker-directory` | |
| `POST /receipts/upload`, `GET /receipts?siteId` | |

## Tests and CI

```bash
npm test      # node:test, no extra dependencies
```

Covers the lunch-break and hours maths, record validation, payroll, date ranges,
sessions and currencies. GitHub Actions (`.github/workflows/ci.yml`) runs the
tests and `npm audit --audit-level=high` on every push and pull request.

## Deploy (Railway)

The `buildtrack` Railway project has two services: `buildtrack-api` (GitHub
`main`, started with `npm start`) and `Postgres`. Pushing to `main` deploys.
Variables are set on the `buildtrack-api` service. The frontend's `vercel.json`
points its `/api` rewrite at the API's public domain.

## Backups

Neither database backs itself up on its own, so set both up:

1. **Postgres on Railway:** open the `Postgres` service → **Backups** and turn on
   scheduled backups (included in the Hobby plan).
2. **MongoDB Atlas:** the free M0 tier has no backups. Either upgrade the cluster
   or take dumps yourself with `scripts/backup.sh` (needs `pg_dump` and
   `mongodump`):

   ```bash
   DATABASE_URL=<public postgres url> MONGO_URI=<atlas uri> ./scripts/backup.sh
   ```

   Railway's Postgres is private; to dump it from your computer, give the
   service a temporary TCP proxy (Settings → Networking), run the script with the
   proxy's URL, then remove the proxy again.

Check a restore now and then: a backup nobody has tried to restore is a guess.
