BEGIN;

CREATE TABLE IF NOT EXISTS cohorts (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('interest-list', 'open', 'closed', 'active', 'completed')),
  applications_open boolean NOT NULL DEFAULT false,
  start_date date,
  end_date date,
  application_deadline timestamptz,
  meeting_schedule text NOT NULL,
  timezone text NOT NULL,
  weekly_workload text NOT NULL,
  delivery_format text NOT NULL,
  seat_limit integer CHECK (seat_limit IS NULL OR seat_limit > 0),
  cost_cents integer NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  status_message text NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS cohorts_one_current_idx ON cohorts (is_current) WHERE is_current;

CREATE TABLE IF NOT EXISTS applicants (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (char_length(email) <= 254),
  grade text NOT NULL CHECK (char_length(grade) <= 40),
  age_range text NOT NULL,
  guardian_name text CHECK (guardian_name IS NULL OR char_length(guardian_name) <= 120),
  guardian_email text CHECK (guardian_email IS NULL OR char_length(guardian_email) <= 254),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP INDEX IF EXISTS applicants_email_ci_idx;
CREATE UNIQUE INDEX IF NOT EXISTS applicants_identity_ci_idx ON applicants (lower(email), lower(name));

CREATE TABLE IF NOT EXISTS consents (
  id uuid PRIMARY KEY,
  applicant_id uuid NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  privacy_version text NOT NULL,
  terms_version text NOT NULL,
  safety_version text NOT NULL,
  guardian_consent boolean NOT NULL DEFAULT false,
  submitted_by_guardian boolean NOT NULL DEFAULT false,
  communications_consent boolean NOT NULL DEFAULT false,
  ip_hash text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  applicant_id uuid NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES cohorts(id),
  consent_id uuid REFERENCES consents(id) ON DELETE SET NULL,
  level text NOT NULL,
  experience_level text NOT NULL DEFAULT 'not-collected' CHECK (
    experience_level IN ('none', 'exploring', 'projects', 'independent', 'not-collected')
  ),
  coding_tools text NOT NULL DEFAULT '' CHECK (char_length(coding_tools) <= 300),
  project_experience text NOT NULL DEFAULT '' CHECK (char_length(project_experience) <= 600),
  learning_goals text NOT NULL DEFAULT '' CHECK (char_length(learning_goals) <= 600),
  status text NOT NULL DEFAULT 'submitted' CHECK (
    status IN ('submitted', 'reviewing', 'contacted', 'accepted', 'enrolled', 'completed', 'waitlisted', 'declined', 'withdrawn')
  ),
  source text NOT NULL,
  confirmation_status text NOT NULL DEFAULT 'pending' CHECK (
    confirmation_status IN ('pending', 'sent', 'failed', 'not-applicable')
  ),
  internal_notification_status text NOT NULL DEFAULT 'pending' CHECK (
    internal_notification_status IN ('pending', 'sent', 'failed', 'not-applicable')
  ),
  acceptance_status text NOT NULL DEFAULT 'not-applicable' CHECK (
    acceptance_status IN ('pending', 'sent', 'failed', 'not-applicable')
  ),
  participation_ended_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backward-compatible additions for databases created before application background questions.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS experience_level text NOT NULL DEFAULT 'not-collected'
  CHECK (experience_level IN ('none', 'exploring', 'projects', 'independent', 'not-collected'));
ALTER TABLE applications ADD COLUMN IF NOT EXISTS coding_tools text NOT NULL DEFAULT ''
  CHECK (char_length(coding_tools) <= 300);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS project_experience text NOT NULL DEFAULT ''
  CHECK (char_length(project_experience) <= 600);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS learning_goals text NOT NULL DEFAULT ''
  CHECK (char_length(learning_goals) <= 600);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS acceptance_status text NOT NULL DEFAULT 'not-applicable'
  CHECK (acceptance_status IN ('pending', 'sent', 'failed', 'not-applicable'));

CREATE UNIQUE INDEX IF NOT EXISTS active_application_unique_idx
  ON applications (applicant_id, cohort_id, level)
  WHERE status <> 'withdrawn';
CREATE INDEX IF NOT EXISTS applications_submitted_at_idx ON applications (submitted_at DESC);
CREATE INDEX IF NOT EXISTS applications_status_idx ON applications (status);

CREATE TABLE IF NOT EXISTS deletion_requests (
  id uuid PRIMARY KEY,
  email text,
  email_hash text NOT NULL,
  token_hash text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  deleted_application_count integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deletion_requests_email_hash_idx ON deletion_requests (email_hash);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON audit_events (created_at DESC);

COMMIT;
