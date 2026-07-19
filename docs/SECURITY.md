# Compute Forward Security Model

Last updated: 2026-07-17

## Protected assets

- Applicant and guardian contact information.
- Consent versions and timestamps.
- Application status and references.
- Deletion confirmation tokens.
- Admin, database, SMTP, and monitoring secrets.

## Trust boundaries

The public browser is untrusted. Client validation improves usability only; the server repeats every validation. PostgreSQL, SMTP, hosting, and monitoring providers are privileged subprocessors and must be inventoried before launch. Admin access is restricted by a high-entropy bearer token stored in the browser tab session only.

## Implemented controls

- Explicit public-file allowlist. Repository source, docs, config, and `data/` are not statically served.
- Helmet security headers and a same-origin Content Security Policy.
- JSON and form request-size limits and parameter limits.
- Server allowlists for levels, cohort, status, age range, field lengths, and policy consent.
- Global, application, admin, and deletion rate limits.
- Honeypot spam field and duplicate application constraint.
- HTTPS and strong-secret production startup requirements.
- PostgreSQL production requirement with prepared queries.
- Constant-time admin-token comparison; no query-string token support.
- Request IDs and structured logs that exclude applicant PII and secrets.
- One-way network-address hashes for abuse correlation.
- One-hour, hashed deletion tokens and enumeration-resistant request responses.
- Independently authenticated scheduled retention that removes expired records.
- Audit events for admin status and confirmation actions.
- Automated tests for public-data isolation, authorization, validation, duplicate handling, consent, status, and deletion.

## Known operational dependencies

These cannot be solved by repository code alone:

- Least-privilege database credentials and provider access controls.
- SPF, DKIM, DMARC, and SMTP reputation.
- Secret-manager access policy and rotation.
- Backup retention and restore testing.
- Safeguarding/legal review and named incident owners.
- Domain and naming review.
- Production monitoring destination and on-call coverage.

## Vulnerability reporting

Do not publish applicant data, live secrets, or exploit details in a public issue. Email both founders with a concise description and a privacy-safe request ID where available:

- anishkoppula@gmail.com
- kaushik.atla@gmail.com

## Security review checklist

- Run `npm audit` and `npm test` before deployment.
- Verify production refuses to start when a required secret or service is missing.
- Verify public requests to `/data/store.json`, `/server.js`, and `/config.js` return 404.
- Verify admin requests without the header return 401.
- Verify CSP, HSTS, no-sniff, frame, referrer, and permissions headers.
- Verify form success only after storage.
- Test duplicate, rate-limit, SMTP failure, database failure, and deletion paths.
- Review all logs for PII before connecting a third-party log processor.
