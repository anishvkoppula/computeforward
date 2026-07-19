import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

function mapCohort(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    applicationsOpen: row.applications_open,
    startDate: row.start_date,
    endDate: row.end_date,
    applicationDeadline: row.application_deadline,
    meetingSchedule: row.meeting_schedule,
    timezone: row.timezone,
    weeklyWorkload: row.weekly_workload,
    deliveryFormat: row.delivery_format,
    seatLimit: row.seat_limit,
    costCents: row.cost_cents,
    statusMessage: row.status_message,
    isCurrent: row.is_current,
    applicationCount: Number(row.application_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    level: row.level,
    experienceLevel: row.experience_level,
    codingTools: row.coding_tools,
    projectExperience: row.project_experience,
    learningGoals: row.learning_goals,
    status: row.status,
    source: row.source,
    confirmationStatus: row.confirmation_status,
    internalNotificationStatus: row.internal_notification_status,
    participationEndedAt: row.participation_ended_at,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    applicant: {
      id: row.applicant_id,
      name: row.applicant_name,
      email: row.applicant_email,
      grade: row.grade,
      ageRange: row.age_range,
      guardianName: row.guardian_name,
      guardianEmail: row.guardian_email
    },
    cohort: {
      id: row.cohort_id,
      slug: row.cohort_slug,
      name: row.cohort_name,
      status: row.cohort_status
    }
  };
}

const APPLICATION_SELECT = `
  SELECT a.*, p.id AS applicant_id, p.name AS applicant_name, p.email AS applicant_email,
    p.grade, p.age_range, p.guardian_name, p.guardian_email,
    c.id AS cohort_id, c.slug AS cohort_slug, c.name AS cohort_name, c.status AS cohort_status
  FROM applications a
  JOIN applicants p ON p.id = a.applicant_id
  JOIN cohorts c ON c.id = a.cohort_id`;

export class PostgresStore {
  constructor(config) {
    this.config = config;
    this.kind = 'postgresql';
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
      max: Number.parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    });
  }

  async init() {
    const result = await this.pool.query("SELECT to_regclass('public.applications') AS applications");
    if (!result.rows[0].applications) {
      throw new Error('Database schema is missing. Run `npm run db:migrate` before starting the service.');
    }
    const cohort = this.config.program.currentCohort;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('LOCK TABLE cohorts IN SHARE ROW EXCLUSIVE MODE');
      await client.query(`
        INSERT INTO cohorts (
          id, slug, name, status, applications_open, start_date, end_date, application_deadline,
          meeting_schedule, timezone, weekly_workload, delivery_format, seat_limit, cost_cents, status_message
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (slug) DO UPDATE SET
          name=EXCLUDED.name, status=EXCLUDED.status, applications_open=EXCLUDED.applications_open,
          start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
          application_deadline=EXCLUDED.application_deadline, meeting_schedule=EXCLUDED.meeting_schedule,
          timezone=EXCLUDED.timezone, weekly_workload=EXCLUDED.weekly_workload,
          delivery_format=EXCLUDED.delivery_format, seat_limit=EXCLUDED.seat_limit,
          cost_cents=EXCLUDED.cost_cents, status_message=EXCLUDED.status_message, updated_at=now()`, [
        crypto.randomUUID(), cohort.slug, cohort.name, cohort.status, cohort.applicationsOpen,
        cohort.startDate, cohort.endDate, cohort.applicationDeadline, cohort.meetingSchedule,
        cohort.timezone, cohort.weeklyWorkload, cohort.deliveryFormat, cohort.seatLimit,
        cohort.costCents, cohort.statusMessage
      ]);
      await client.query(`
        UPDATE cohorts SET is_current=true, updated_at=now()
        WHERE slug=$1 AND NOT EXISTS (SELECT 1 FROM cohorts WHERE is_current=true)`, [cohort.slug]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async health() {
    await this.pool.query('SELECT 1');
    return { ok: true, store: this.kind };
  }

  async getCurrentCohort() {
    const result = await this.pool.query('SELECT * FROM cohorts WHERE is_current=true LIMIT 1');
    return mapCohort(result.rows[0]);
  }

  async listCohorts() {
    const result = await this.pool.query(`
      SELECT c.*, count(a.id)::int AS application_count
      FROM cohorts c LEFT JOIN applications a ON a.cohort_id=c.id
      GROUP BY c.id ORDER BY c.is_current DESC, c.created_at DESC`);
    return result.rows.map(mapCohort);
  }

  async setCurrentCohort(id) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('LOCK TABLE cohorts IN SHARE ROW EXCLUSIVE MODE');
      const target = await client.query('SELECT id FROM cohorts WHERE id=$1', [id]);
      if (!target.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query('UPDATE cohorts SET is_current=false WHERE is_current=true');
      const result = await client.query('UPDATE cohorts SET is_current=true, updated_at=now() WHERE id=$1 RETURNING *', [id]);
      await client.query('COMMIT');
      return mapCohort(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createApplication(record) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const cohortResult = await client.query('SELECT * FROM cohorts WHERE slug=$1 FOR SHARE', [record.cohortSlug]);
      const cohort = cohortResult.rows[0];
      if (!cohort) throw Object.assign(new Error('Cohort not found.'), { code: 'COHORT_NOT_FOUND' });

      const existingResult = await client.query(`
        SELECT * FROM applicants WHERE lower(email)=lower($1) AND lower(name)=lower($2) FOR UPDATE`, [record.email, record.name]);
      let applicant = existingResult.rows[0];
      if (applicant) {
        const duplicate = await client.query(`${APPLICATION_SELECT}
          WHERE a.applicant_id=$1 AND a.cohort_id=$2 AND a.level=$3 AND a.status <> 'withdrawn'`, [
          applicant.id, cohort.id, record.level
        ]);
        if (duplicate.rows[0]) {
          await client.query('COMMIT');
          return { created: false, application: mapApplication(duplicate.rows[0]) };
        }
        const updated = await client.query(`
          UPDATE applicants SET grade=$2, age_range=$3, guardian_name=$4, guardian_email=$5, updated_at=$6
          WHERE id=$1 RETURNING *`, [
          applicant.id, record.grade, record.ageRange, record.guardianName || null,
          record.guardianEmail || null, record.submittedAt
        ]);
        applicant = updated.rows[0];
      } else {
        const inserted = await client.query(`
          INSERT INTO applicants (id, name, email, grade, age_range, guardian_name, guardian_email, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`, [
          crypto.randomUUID(), record.name, record.email, record.grade, record.ageRange,
          record.guardianName || null, record.guardianEmail || null, record.submittedAt
        ]);
        applicant = inserted.rows[0];
      }

      const consentId = crypto.randomUUID();
      await client.query(`
        INSERT INTO consents (
          id, applicant_id, privacy_version, terms_version, safety_version, guardian_consent,
          submitted_by_guardian, communications_consent, ip_hash, consented_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
        consentId, applicant.id, record.policyVersions.privacy, record.policyVersions.terms,
        record.policyVersions.safety, record.guardianConsent, record.submittedByGuardian,
        record.communicationsConsent, record.ipHash, record.submittedAt
      ]);
      await client.query(`
        INSERT INTO applications (
          id, reference, applicant_id, cohort_id, consent_id, level, experience_level,
          coding_tools, project_experience, learning_goals, status, source,
          confirmation_status, internal_notification_status, submitted_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'submitted',$11,'pending','pending',$12,$12)`, [
        record.id, record.reference, applicant.id, cohort.id, consentId, record.level,
        record.experienceLevel, record.codingTools, record.projectExperience, record.learningGoals,
        record.source, record.submittedAt
      ]);
      const created = await client.query(`${APPLICATION_SELECT} WHERE a.id=$1`, [record.id]);
      await client.query('COMMIT');
      return { created: true, application: mapApplication(created.rows[0]) };
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') {
        const duplicate = await this.pool.query(`${APPLICATION_SELECT}
          WHERE lower(p.email)=lower($1) AND lower(p.name)=lower($2) AND c.slug=$3 AND a.level=$4 AND a.status <> 'withdrawn'`, [
          record.email, record.name, record.cohortSlug, record.level
        ]);
        if (duplicate.rows[0]) return { created: false, application: mapApplication(duplicate.rows[0]) };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async listApplications() {
    const result = await this.pool.query(`${APPLICATION_SELECT} ORDER BY a.submitted_at DESC`);
    return result.rows.map(mapApplication);
  }

  async getApplication(id) {
    const result = await this.pool.query(`${APPLICATION_SELECT} WHERE a.id=$1`, [id]);
    return mapApplication(result.rows[0]);
  }

  async deleteApplication(id) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const targetResult = await client.query(`
        SELECT a.id, a.reference, a.applicant_id, a.consent_id
        FROM applications a JOIN applicants p ON p.id=a.applicant_id
        WHERE a.id=$1 FOR UPDATE OF a, p`, [id]);
      const target = targetResult.rows[0];
      if (!target) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query('DELETE FROM applications WHERE id=$1', [target.id]);
      const consentResult = target.consent_id
        ? await client.query('DELETE FROM consents WHERE id=$1 RETURNING id', [target.consent_id])
        : { rowCount: 0 };
      const applicantResult = await client.query(`
        DELETE FROM applicants p
        WHERE p.id=$1 AND NOT EXISTS (
          SELECT 1 FROM applications a WHERE a.applicant_id=p.id
        ) RETURNING id`, [target.applicant_id]);

      await client.query('COMMIT');
      return {
        id: target.id,
        reference: target.reference,
        deletedApplicant: applicantResult.rowCount > 0,
        deletedConsent: consentResult.rowCount > 0
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateApplicationStatus(id, status) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const targetResult = await client.query(`
        SELECT a.id, a.cohort_id, c.seat_limit FROM applications a
        JOIN cohorts c ON c.id=a.cohort_id WHERE a.id=$1 FOR UPDATE OF a, c`, [id]);
      const target = targetResult.rows[0];
      if (!target) {
        await client.query('ROLLBACK');
        return null;
      }
      if (target.seat_limit && ['accepted', 'enrolled'].includes(status)) {
        const occupiedResult = await client.query(`
          SELECT count(*)::int AS count FROM applications
          WHERE cohort_id=$1 AND id<>$2 AND status IN ('accepted','enrolled','completed')`, [target.cohort_id, id]);
        if (occupiedResult.rows[0].count >= target.seat_limit) {
          throw Object.assign(new Error('Cohort capacity has been reached.'), { code: 'COHORT_CAPACITY_REACHED' });
        }
      }
      await client.query(`
        UPDATE applications SET status=$2,
          participation_ended_at=CASE
            WHEN $2='completed' THEN COALESCE(participation_ended_at, now())
            ELSE NULL
          END,
          updated_at=now()
        WHERE id=$1`, [id, status]);
      await client.query('COMMIT');
      return this.getApplication(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateNotificationStatus(id, field, status) {
    const columns = {
      confirmationStatus: 'confirmation_status',
      internalNotificationStatus: 'internal_notification_status'
    };
    const column = columns[field];
    if (!column) throw new Error('Unsupported notification field.');
    const result = await this.pool.query(`UPDATE applications SET ${column}=$2, updated_at=now() WHERE id=$1 RETURNING id`, [id, status]);
    return result.rows[0] ? this.getApplication(id) : null;
  }

  async recordAudit(event) {
    await this.pool.query(`
      INSERT INTO audit_events (id, actor, action, target_type, target_id, request_id)
      VALUES ($1,$2,$3,$4,$5,$6)`, [
      crypto.randomUUID(), event.actor, event.action, event.targetType, event.targetId || null, event.requestId || null
    ]);
  }

  async hasApplicantEmail(value) {
    const result = await this.pool.query(`
      SELECT EXISTS(SELECT 1 FROM applicants WHERE lower(email)=lower($1) OR lower(guardian_email)=lower($1)) AS found`, [value]);
    return result.rows[0].found;
  }

  async createDeletionRequest(record) {
    await this.pool.query(`
      WITH invalidated AS (
        UPDATE deletion_requests SET email=NULL, token_hash=NULL, status='expired', updated_at=$5
        WHERE email_hash=$3 AND status='pending'
      )
      INSERT INTO deletion_requests (id, email, email_hash, token_hash, status, requested_at, expires_at, updated_at)
      VALUES ($1,$2,$3,$4,'pending',$5,$6,$5)
      ON CONFLICT (token_hash) DO NOTHING`, [
      crypto.randomUUID(), record.email, record.emailHash, record.tokenHash, record.requestedAt, record.expiresAt
    ]);
  }

  async completeDeletionRequest(tokenHash) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const requestResult = await client.query(`
        SELECT * FROM deletion_requests
        WHERE token_hash=$1 AND status='pending' AND expires_at > now() FOR UPDATE`, [tokenHash]);
      const request = requestResult.rows[0];
      if (!request) {
        await client.query('ROLLBACK');
        return null;
      }
      const countResult = await client.query(`
        SELECT count(*)::int AS count FROM applications a JOIN applicants p ON p.id=a.applicant_id
        WHERE lower(p.email)=lower($1) OR lower(p.guardian_email)=lower($1)`, [request.email]);
      await client.query('DELETE FROM applicants WHERE lower(email)=lower($1) OR lower(guardian_email)=lower($1)', [request.email]);
      await client.query(`
        UPDATE deletion_requests SET email=NULL, token_hash=NULL, status='completed', completed_at=now(),
          deleted_application_count=$2, updated_at=now() WHERE id=$1`, [request.id, countResult.rows[0].count]);
      await client.query('COMMIT');
      return { email: request.email, deletedApplicationCount: countResult.rows[0].count };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listDeletionRequests() {
    const result = await this.pool.query(`
      SELECT id, email, email_hash AS "emailHash", status, requested_at AS "requestedAt",
        expires_at AS "expiresAt", completed_at AS "completedAt",
        deleted_application_count AS "deletedApplicationCount"
      FROM deletion_requests ORDER BY requested_at DESC LIMIT 500`);
    return result.rows;
  }

  async metrics() {
    const [total, statuses, levels, cohorts, confirmations] = await Promise.all([
      this.pool.query('SELECT count(*)::int AS count FROM applications'),
      this.pool.query('SELECT status, count(*)::int AS count FROM applications GROUP BY status'),
      this.pool.query('SELECT level, count(*)::int AS count FROM applications GROUP BY level'),
      this.pool.query(`SELECT c.slug, count(a.id)::int AS count FROM cohorts c
        LEFT JOIN applications a ON a.cohort_id=c.id GROUP BY c.slug`),
      this.pool.query('SELECT confirmation_status, count(*)::int AS count FROM applications GROUP BY confirmation_status')
    ]);
    return {
      total: total.rows[0].count,
      byStatus: Object.fromEntries(statuses.rows.map(row => [row.status, row.count])),
      byLevel: Object.fromEntries(levels.rows.map(row => [row.level, row.count])),
      byCohort: Object.fromEntries(cohorts.rows.map(row => [row.slug, row.count])),
      confirmation: Object.fromEntries(confirmations.rows.map(row => [row.confirmation_status, row.count]))
    };
  }

  async purgeExpiredRecords({ now = new Date(), unsuccessfulMonths, enrolledMonths }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const expiredResult = await client.query(`
        DELETE FROM applications
        WHERE (status IN ('declined','withdrawn') AND updated_at < $1::timestamptz - ($2 || ' months')::interval)
           OR (status='completed' AND participation_ended_at < $1::timestamptz - ($3 || ' months')::interval)
        RETURNING applicant_id, consent_id`, [now.toISOString(), unsuccessfulMonths, enrolledMonths]);
      const consentIds = expiredResult.rows.map(row => row.consent_id).filter(Boolean);
      const consentResult = consentIds.length
        ? await client.query('DELETE FROM consents WHERE id = ANY($1::uuid[]) RETURNING id', [consentIds])
        : { rowCount: 0 };
      const applicantResult = await client.query(`
        DELETE FROM applicants p WHERE NOT EXISTS (SELECT 1 FROM applications a WHERE a.applicant_id=p.id)
        RETURNING id`);
      const deletionResult = await client.query(`
        UPDATE deletion_requests SET status='expired', email=NULL, token_hash=NULL, updated_at=$1
        WHERE status='pending' AND expires_at < $1 RETURNING id`, [now.toISOString()]);
      await client.query('COMMIT');
      return {
        deletedApplications: expiredResult.rowCount,
        deletedApplicants: applicantResult.rowCount,
        deletedConsents: consentResult.rowCount,
        expiredDeletionRequests: deletionResult.rowCount
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}
