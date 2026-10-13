# Sanjo (BuildTrack) — API

Work tracking for construction crews: who worked on which site, for how many
hours, in which crew, what was done, what everyone is owed, and the receipts
for what was bought.

| | |
|---|---|
| **App** | https://buildtrack-frontend-ten.vercel.app |
| **Frontend repo** | [`buildtrack-frontend`](https://github.com/kuzmavasil74/buildtrack-frontend) |
| **API** | Express on Railway, reached by the app through its `/api` proxy |
| **Access** | Invitation only: a company owner invites people from the Team page |

## Features

- **Daily records.** One record is one day on one site: a description of the
  work, an optional crew, and a line per worker with start/end time or hours,
  hourly rate and a note. Hours computed from start/end subtract a 30-minute
  lunch break.
- **Crews and sites.** Crews with members and hourly rates, QR codes for quick
  check-in, sites with an address and map coordinates.
- **Payroll.** Monthly pay per person from their real hours, in the company's
  currency (UAH, EUR, PLN, CZK, USD), with PDF and CSV exports.
- **Receipts.** Photos are compressed in the browser, stored in a private S3
  bucket and opened through links signed for one hour.
- **Companies and roles.** All data belongs to a company. The owner invites
  foremen by link (valid 14 days) and decides what they can do (see below).
- **Your data.** Users can download everything they have access to as JSON and
  delete their own account. The privacy policy lives in the frontend at `/privacy`.
- **Admin page.** For the emails in `ADMIN_EMAILS`: number of users and
  companies, who was active recently, and how many records each person has.
  It never shows record content.
- **Backups.** A nightly job copies both databases to S3.

### Roles

| | Owner | Foreman |
|---|:---:|:---:|
| See the company's sites, crews, records and receipts | ✓ | ✓ |
| Add records and receipts, download PDF/CSV reports | ✓ | ✓ |
| Edit and delete records | all | only their own |
| Create, edit and delete sites and crews | ✓ | |
| Payroll and the payroll currency | ✓ | |
| Invite and remove people, rename the company | ✓ | |

The API enforces this (`requireOwner` in `src/utils/permissions.js`); the
frontend only hides what a role cannot use. Removing a foreman keeps
everything they entered in the company and moves them back to a company of
their own.

## Architecture

```
browser ──► Vercel (React SPA) ──/api/*──► Railway: Express API ──► Postgres  users, companies, invitations, sites, crews
                                                              ├──► MongoDB   daily records, receipt metadata
                                                              └──► S3        receipt photos, nightly backups
```

- **Postgres** tables are created and migrated when the server starts
  (`ensureSchema()` and `ensureCompanies()` in `src/config/postgres.js`).
  `users` and `companies` point at each other: a user has a `company_id` and a
  `role`, a company has an `owner_id`.
- **MongoDB** (Atlas) documents carry `userId` (who entered it) and
  `companyId` (who may see it). They point at sites and crews by numeric id,
  so the API guards that link: a site that still has records or receipts
  cannot be deleted (`409 SITE_IN_USE`), and deleting a crew unlinks it from
  its records but keeps their worker lines.
- **Auth** is a JWT in an `HttpOnly` cookie, valid for 14 days and renewed
  while the user is active. On every request the middleware reloads the
  user's company and role from Postgres, so a change of role or removal from
  a company applies immediately. The frontend calls the API through Vercel's
  same-origin `/api` rewrite, so the cookie is first-party (Safari blocks
  third-party ones).

## Run locally

```bash
cp .env.example .env              # then edit; see the table below
docker compose up -d              # Postgres on 5432 and MongoDB on 27017
npm install
OPEN_REGISTRATION=true npm start  # http://localhost:4000
```

Sign-up needs an invitation unless `OPEN_REGISTRATION=true`, so set it to
create the first account on an empty database. Then run the frontend with
`VITE_API_URL=http://localhost:4000`.

### Environment variables

| Variable | Needed | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres URL. SSL is on unless `PGSSL=disable` (local Docker). |
| `MONGO_URI` | yes | MongoDB connection string. |
| `JWT_SECRET` | yes | Long random string. Changing it signs everyone out. |
| `FRONTEND_URL` | yes | Allowed CORS origin and the base of reset and invitation links. |
| `PORT` | no | Railway sets it. |
| `NODE_ENV` | production | `production` turns on secure cookies and proxy trust. |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME` | for receipts and backups | |
| `S3_ENDPOINT` | local tests only | An S3-compatible server (e.g. `adobe/s3mock` in Docker). Leave unset in production. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | optional | Without SMTP, reset and invitation links are printed to the server log. The owner always gets the invitation link to pass on by hand. |
| `OPEN_REGISTRATION` | optional | `true` lets anyone sign up and start a company. Otherwise only invitation links create accounts. |
| `ADMIN_EMAILS` | optional | Comma-separated emails that may open the admin page. |

## API

Every route except sign-up, sign-in, password reset and the invitation
preview needs the session cookie. "Owner" marks routes a foreman gets `403` on.

| Route | Notes |
|---|---|
| `POST /auth/register` | `{ email, password, inviteToken }`; without a token only when `OPEN_REGISTRATION=true` |
| `POST /auth/login`, `/auth/logout` | sign-in is rate limited |
| `POST /auth/forgot-password`, `/auth/reset-password` | rate limited; reset links last 1 hour |
| `GET /auth/me` | `{ id, email, role, isAdmin, company, currency }` |
| `PUT /auth/currency` | owner; the company's payroll currency |
| `GET /sites`, `GET /crews` | the company's sites and crews |
| `POST/PUT/DELETE /sites[/:id]`, `/crews[/:id]` | owner |
| `GET /records?siteId&from&to` | `from`/`to` are `YYYY-MM-DD`, inclusive |
| `POST /records`, `PUT/DELETE /records/:id` | per-worker `entries[]`; a foreman can change only their own |
| `GET /records/report?from&to&lang`, `/records/export.csv` | PDF / CSV |
| `GET /records/monthly-stats`, `/records/worker-directory` | |
| `GET /records/payroll?from&to`, `/records/payroll.csv` | owner |
| `POST /receipts/upload`, `GET /receipts?siteId` | each receipt has a `viewUrl` signed for 1 hour |
| `GET/PUT /company` | owner; members, open invitations, company name |
| `POST /company/invites`, `DELETE /company/invites/:id` | owner; returns the link and whether it was emailed |
| `DELETE /company/members/:id` | owner |
| `GET /company/invites/:token` | public preview: company, email, whether an account exists |
| `POST /company/invites/accept` | the signed-in user joins (the email must match) |
| `GET /account/export` | JSON download: an owner gets the company's data, a foreman their account and what they entered |
| `DELETE /account` | body `{ email }`, typed again to confirm; see below |
| `GET /admin/stats` | `ADMIN_EMAILS` only |

### Deleting an account

- A **foreman**'s account, reset tokens and sent invitations are deleted. What
  they entered stays with the company with `userId` set to `null`.
- An **owner** whose company still has other members gets
  `409 OWNER_HAS_MEMBERS` and must remove them first. Otherwise the company is
  deleted with its sites, crews, records, receipts, invitations and receipt
  photos in S3, and then the account.
- A company the person owns but left earlier is deleted the same way, or handed
  to its oldest member if someone joined it.
- Deleted data leaves the backups as they expire (30 days).

## Tests and CI

```bash
npm test      # node:test, no extra dependencies
```

Unit tests cover hours and lunch-break maths, record validation, payroll, date
ranges, sessions, currencies, roles and permissions, invitations, closed
sign-up, signed receipt links, account export and backups. GitHub Actions
(`.github/workflows/ci.yml`) runs them and `npm audit --audit-level=high` on
every push and pull request.

## Deploy

The Railway project `buildtrack` has three services:

| Service | What it runs |
|---|---|
| `buildtrack-api` | `npm start`, public domain used by the frontend's `/api` rewrite |
| `Postgres` | the database, with a volume |
| `buildtrack-backup` | `node scripts/backup-to-s3.js` on cron `0 2 * * *` |

Both code services follow `main` and redeploy on every push. That needs the
Railway GitHub App to have access to this repository (GitHub → Settings →
Applications → Railway). Variables are set per service; `buildtrack-backup`
references the API's values. Schema changes run automatically on start.

## Backups

Railway volume backups are not available on the Hobby plan and the free
MongoDB Atlas tier has none, so the app backs itself up.

- **Every night** (02:00 UTC) `buildtrack-backup` writes every Postgres table
  and MongoDB collection into one gzip file,
  `s3://<S3_BUCKET_NAME>/backups/buildtrack-<UTC timestamp>.json.gz`
  (server-side encrypted). It checks that the file reads back with the same
  row counts and deletes backups older than 30 days, always keeping the newest
  7. A failed run shows as a failed deployment in Railway.
- **A local copy** at any time:
  `DATABASE_URL=... MONGO_URI=... node scripts/backup-to-s3.js --file out.json.gz`
- **Restore** goes into *empty* databases only:
  `node scripts/restore-backup.js <file.json.gz>` shows what is inside, and
  `--apply` writes it (`--s3 <key>` reads straight from the bucket). It
  refuses to touch a database that already has data.
- Backups contain password hashes, so the bucket must stay private.

Do a test restore into scratch databases now and then.
