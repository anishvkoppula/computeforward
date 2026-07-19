# Compute Forward Operations Runbook

Last updated: 2026-07-17

## Daily admissions workflow

1. Open `/admin` on a trusted device and enter the token from the secret manager.
2. Review new `submitted` applications without downloading data unless an export is operationally necessary.
3. Change the status to `reviewing`, then `contacted`, and record the response outside the public website only in an approved system.
4. Use the confirmation retry action for `failed` email records after checking SMTP status.
5. Aim to respond within 48 hours. If the commitment cannot be maintained, change the public copy before accepting more applications.
6. Lock the dashboard when finished; closing the tab clears its session token.

The dashboard's **Delete permanently** action is for confirmed test, spam, duplicate, or otherwise unnecessary individual applications. Read the confirmation carefully: the application and consent are erased immediately, and an applicant contact record is also erased when it has no other applications. This action cannot be undone. For a student or guardian privacy request, use the verified email-deletion workflow below so the request has the proper confirmation record.

## Application incident

Treat these as launch-blocking incidents:

- `/readyz` fails or reports a non-PostgreSQL production store.
- A user sees a success receipt without an application row.
- Confirmation delivery failures increase unexpectedly.
- Admin access works without the correct header token.
- Any applicant file is reachable through a public static URL.

Response:

1. Pause application intake by setting `applicationsOpen` to `false` in `program-config.json` and deploy.
2. Record the incident start time and a privacy-safe request ID.
3. Determine whether storage, email, routing, authentication, or provider availability failed.
4. Restore service and submit a synthetic production application.
5. Verify storage, applicant confirmation, internal notification, admin visibility, and verified deletion.
6. Document cause, affected time window, whether any applicant needs direct follow-up, and the prevention change.

## Privacy request

The preferred workflow is the public verified-deletion form.

1. The requester submits an application or guardian email.
2. The system returns the same response whether or not records exist.
3. If records exist, a one-hour link is emailed.
4. Confirmation deletes matching applicant, application, and consent records.
5. The readable email and token are cleared from the deletion request; a hash, completion time, and count remain.
6. The admin dashboard shows completion.

For correction, access, or withdrawal requests that cannot use the automated path, both founders should verify control of the associated email before disclosing or changing information.

## Retention job

Vercel invokes `/api/internal/retention` daily with `CRON_SECRET`. On another host,
schedule `npm run data:retention` at least daily. The job deletes
declined/withdrawn applications after 12 months, completed-participation applications
after 24 months, orphan applicant/consent records, and readable data from expired
deletion requests.

Also run a quarterly control review:

- Delete declined and withdrawn records older than 12 months.
- Delete enrolled records 24 months after participation ends.
- Confirm security-log retention is no more than 30 days.
- Confirm pending deletion links older than one hour were expired.
- Document the review without copying applicant PII into a public issue or repository file.

Alert on a failed scheduled run. The public policy deadlines remain binding even if automation fails.

## Secret rotation

Rotate immediately after suspected exposure or staff-access changes, and at least annually:

- `ADMIN_TOKEN`
- `CRON_SECRET`
- `IP_HASH_SECRET` only with a migration/retention plan because changing it affects email-hash matching
- Database credential
- SMTP credential
- Alert webhook credential

After rotating the admin token, existing dashboard tabs lose access. Never send a token through query strings, issue comments, screenshots, or application email.

## Backup and restore

- Enable managed PostgreSQL backups and test restore to an isolated non-production environment.
- Restrict restored data to the smallest authorized group.
- Never use production applicant data for screenshots, demos, development fixtures, or automated tests.
- A privacy deletion should propagate through normal provider backup expiration. Do not selectively restore deleted records into the active database.

## Cohort launch content gate

Before changing status from `interest-list` to `open`, the accountable owners must provide:

- Start/end dates, deadline, meeting schedule, time zone, workload, format, and capacity.
- Founder biographies and profiles.
- Active mentor roster, screening status, training, and conduct acknowledgement.
- Named safeguarding adult and escalation coverage.
- Qualified review of privacy, terms, safety, consent, and minor-participation rules.
- Current provider inventory and deletion contacts.

The website must be updated from the same `program-config.json` decision before promotion.
