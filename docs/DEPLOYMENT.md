# Compute Forward Deployment Guide

Last updated: 2026-07-18

## Release model

The site and application API should share one HTTPS origin. The repository supports:

1. Vercel static pages plus the `api/index.js` serverless entry point and managed PostgreSQL.
2. A long-running Node host using `npm start`, with PostgreSQL and SMTP provided separately.

Static-only deployment is no longer enrollment-ready. The application form does not use Web3Forms or `mailto` as a success fallback because neither proves that an application was stored.

## Required services

- Approved canonical domain with HTTPS.
- PostgreSQL with encryption in transit, automated backups, point-in-time recovery where available, and restricted credentials.
- SMTP provider that permits transactional application-copy messages to both students and guardians.
- Optional alert webhook that accepts privacy-safe service events.

Record the chosen providers, region, subprocessors, retention settings, access owners, and deletion procedure in the private operational inventory before launch.

## Environment

Start from `.env.example`. In production set:

```text
NODE_ENV=production
PUBLIC_ORIGIN=https://approved-domain.example
TRUST_PROXY=1
DATABASE_URL=...
DATABASE_SSL=true
ADMIN_TOKEN=...
IP_HASH_SECRET=...
CRON_SECRET=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
FROM_EMAIL=...
ADMISSIONS_EMAILS=anishkoppula@gmail.com,kaushik.atla@gmail.com
```

Generate the admin, hashing, and retention-cron secrets independently. Do not reuse database, SMTP, hosting, or personal passwords.

## Database rollout

1. Create a production database and a least-privilege application credential.
2. Restrict inbound access to the deployment platform where the provider supports it.
3. Set `DATABASE_URL` and `DATABASE_SSL` in the deployment secret manager.
4. Run `npm run db:migrate` against the production database.
5. Verify that the `cohorts`, `applicants`, `consents`, `applications`, `deletion_requests`, and `audit_events` tables exist.
6. Start the service and check `/readyz` reports `postgresql` and `emailConfigured: true`.

Do not copy the development JSON datastore into a public directory. Legacy applications should be migrated through a reviewed one-time import, not by uploading `data/`.

## Vercel

`vercel.json` supplies clean-page rewrites, API routing, and browser security headers. `.vercelignore` excludes local applicant data and secrets.

Before promotion:

- Add all required environment variables to Production and Preview separately.
- Use a non-production database and SMTP sandbox for previews.
- Confirm `/data/store.json`, `/server.js`, and `/config.js` return 404.
- Confirm `/api/admin/applications` returns 401 without the header.
- Confirm a real production test application is stored, emailed, visible to admin, and then deleted through the verified privacy workflow.

## Long-running Node host

Build command:

```bash
npm ci
npm run db:migrate
```

Start command:

```bash
npm start
```

Configure the platform health check to `/readyz`. Ensure persistent runtime logs do not exceed the 30-day security-log target.

## Custom domain and canonical URLs

The HTML, sitemap, and robots file currently use `https://compute-forward.vercel.app`. When the permanent name and domain are approved:

1. Replace the canonical origin in all HTML files, `robots.txt`, and `sitemap.xml`.
2. Set `PUBLIC_ORIGIN` to the same HTTPS origin.
3. Redirect every alternate host to the canonical origin.
4. Configure branded email and SPF, DKIM, and DMARC.
5. Re-run link, form, SEO, and email tests.

## Rollback

- Keep the previous deployment artifact available.
- Database schema changes must be backward-compatible until the previous release is retired.
- If application storage or confirmation fails, close applications through `program-config.json` and deploy the status change; do not leave a form that can display success without storage.
- Do not restore deleted applicant data from backup without a documented legal reason and founder approval.
