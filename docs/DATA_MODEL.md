# Compute Forward Data Model

Last updated: 2026-07-18

The production schema is defined in `db/schema.sql`.

## Relationships

```text
cohort 1 ─── * application * ─── 1 applicant
                         │
                         └────── 1 consent

deletion_request ── verified by email token ── deletes matching applicant subtree
audit_event ── records restricted admin actions without application content
```

## Records

### Cohort

Stores the single operational source of truth: slug, name, status, application availability, dates, deadline, meeting schedule, time zone, workload, format, capacity, cost, and current status message.

### Applicant

Stores name, normalized student email, grade, age range, and guardian contact where required. The case-insensitive combination of student email and applicant name identifies a person, which also permits siblings to share a family email address.

### Consent

Stores the accepted privacy, terms, and safety versions; guardian authorization; under-13 submitter confirmation; optional future-announcement choice; one-way network-address hash; and timestamp.

### Application

Connects one applicant to one cohort and level. Stores a public reference, coding-experience level, languages/tools answer, project-experience answer, learning goals, human-reviewed status, source, applicant-confirmation status, internal-notification status, and timestamps. An active applicant/cohort/level combination is unique.

### Deletion request

Temporarily stores the readable email, one-way email and token hashes, one-hour expiration, and status. Completion clears the readable email and token while preserving a non-reversible fulfillment record.

### Audit event

Stores actor, action, target type and ID, privacy-safe request ID, and timestamp. It does not store applicant form fields or admin tokens.

## Development adapter

`stores/file-store.js` mirrors the model for local development only. It serializes mutations, writes atomically, keeps one backup, refuses to overwrite unparseable state, and imports the old `data/applications.json` records without deleting the source file. Production configuration blocks this adapter.
