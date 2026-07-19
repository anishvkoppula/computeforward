# Compute Forward

Compute Forward is a free, student-led, cohort-based computer science education program. This repository contains the public program site and the secure application intake and admissions service.

- Live website: <https://computeforward-beige.vercel.app/>
- GitHub repository: <https://github.com/anishvkoppula/computeforward>

Do not promote an active cohort until the operational launch gates in [`docs/roadmap.md`](./docs/roadmap.md) are complete.

## What is implemented

- Public pages for the four-level curriculum, placement, families, team accountability, privacy, terms, and student safety.
- Accessible application form with a 6th–12th grade selector, short coding-background questions, a no-JavaScript path, parent/guardian rules, policy-version consent records, and truthful receipt states.
- PostgreSQL production storage for cohorts, applicants, consents, applications, statuses, notification delivery, deletion requests, and admin audit events.
- Development-only file storage with atomic writes, backups, and one-time preservation of the old `data/applications.json` records.
- Duplicate handling, input allowlists, request-size limits, origin checks, honeypot spam defense, and route-specific rate limiting.
- Transactional application-copy confirmation to every student and guardian address provided, plus an internal admissions email through SMTP.
- Verified data-deletion links that remove matching applicant, application, and consent records.
- Restricted admissions dashboard with status updates, confirmation retry, permanent application deletion with confirmation, metrics, deletion-request visibility, and explicit CSV export.
- CSP and security headers, privacy-safe structured logs, health/readiness endpoints, optional incident webhook alerts, and production configuration gates.
- Automated behavior and security regression tests.

## Local development

Requires Node.js 18 or newer.

```bash
npm install
cp .env.example .env
npm start
```

Set a long random `ADMIN_TOKEN` in `.env` to use the local admin dashboard. The local server uses `data/store.json`; this mode is blocked in production.

- Site: <http://localhost:3000>
- Admin: <http://localhost:3000/admin>
- Health: <http://localhost:3000/healthz>
- Readiness: <http://localhost:3000/readyz>

Email is intentionally marked pending when SMTP is not configured. An application is still successful only after it is durably stored; the UI never treats `mailto` or an opened email client as proof of submission. The protected admin dashboard shows contact details and every application answer even when email delivery is pending.

## Production requirements

Production refuses to start unless all of these are configured:

- `DATABASE_URL` for PostgreSQL.
- `ADMIN_TOKEN` with at least 32 random characters.
- A separate `IP_HASH_SECRET` with at least 32 random characters.
- A third independent `CRON_SECRET` for scheduled retention.
- HTTPS `PUBLIC_ORIGIN`.
- `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS`.

Use a different generated value for every secret:

```bash
openssl rand -base64 48
```

Run the database migration before the first deployment:

```bash
npm run db:migrate
```

See [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) and [`docs/OPERATIONS.md`](./docs/OPERATIONS.md) for the complete launch and incident workflow.

## Commands

| Command | Purpose |
|---|---|
| `npm start` | Start the Node service |
| `npm run dev` | Restart on backend file changes |
| `npm run db:migrate` | Create or update the PostgreSQL schema |
| `npm run data:retention` | Enforce application and expired deletion-request retention rules |
| `npm test` | Run the application/security regression suite |
| `npm run check` | Syntax-check the service and run tests |

## Important security properties

- The server never serves the repository root. Only `/assets` and an explicit HTML allowlist are public.
- `data/`, source code, config files, and docs return 404 through the Node service.
- Admin credentials are accepted only in the `x-admin-token` header and live in browser `sessionStorage`, never a query string or persistent local storage.
- Production never uses the file datastore or a default admin token.
- Applicant PII is excluded from structured logs and internal notification emails.
- Application success means the record was stored. Email status is reported separately.
- Deletion requires control of an application or guardian email address.

Report a suspected vulnerability privately to both founders rather than opening a public issue containing applicant information:

- anishkoppula@gmail.com
- kaushik.atla@gmail.com

## Repository map

| Path | Purpose |
|---|---|
| `index.html` | Public homepage and application form |
| `programs.html`, `parents.html`, `team.html` | Program and trust content |
| `privacy.html`, `terms.html`, `safety.html` | Versioned public policies |
| `admin.html` | Restricted admissions operations UI |
| `assets/` | Public CSS and JavaScript only |
| `app.js` | Express routes and security middleware |
| `server.js` | Long-running Node process entry point |
| `api/index.js` | Serverless entry point |
| `stores/` | PostgreSQL and development file adapters |
| `db/schema.sql` | Production data model |
| `scripts/migrate.js` | Schema migration command |
| `test/` | Automated regression tests |
| `docs/` | Product, safety, deployment, and operations context |

Applicant data under `data/` is ignored by Git and Vercel. Never commit exports, database dumps, email lists, screenshots, or application fixtures containing real people.
