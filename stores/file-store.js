import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const EMPTY_STATE = () => ({
  schemaVersion: 2,
  cohorts: [],
  applicants: [],
  consents: [],
  applications: [],
  deletionRequests: [],
  auditEvents: []
});

export class FileStore {
  constructor(config) {
    this.config = config;
    this.kind = 'file-development-only';
    this.file = path.join(config.dataDir, 'store.json');
    this.backup = path.join(config.dataDir, 'store.backup.json');
    this.legacyFile = path.join(config.dataDir, 'applications.json');
    this.writeChain = Promise.resolve();
  }

  async init() {
    await fs.mkdir(this.config.dataDir, { recursive: true, mode: 0o700 });
    await fs.chmod(this.config.dataDir, 0o700);
    try {
      await fs.access(this.file);
    } catch {
      const initial = EMPTY_STATE();
      this.seedCohort(initial);
      await this.importLegacy(initial);
      await fs.writeFile(this.file, JSON.stringify(initial, null, 2), { encoding: 'utf8', mode: 0o600 });
    }
    await fs.chmod(this.file, 0o600);
    try { await fs.chmod(this.legacyFile, 0o600); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const state = await this.read();
    this.seedCohort(state);
    await this.write(state);
  }

  seedCohort(state) {
    const current = this.config.program.currentCohort;
    const existing = state.cohorts.find(cohort => cohort.slug === current.slug);
    const hasCurrent = state.cohorts.some(cohort => cohort.isCurrent);
    const record = {
      id: existing?.id || crypto.randomUUID(),
      ...current,
      isCurrent: existing?.isCurrent ?? !hasCurrent,
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString()
    };
    if (existing) Object.assign(existing, record);
    else state.cohorts.push(record);
  }

  async importLegacy(state) {
    try {
      const legacy = JSON.parse(await fs.readFile(this.legacyFile, 'utf8'));
      if (!Array.isArray(legacy)) return;
      const cohort = state.cohorts[0];
      for (const entry of legacy) {
        if (!entry?.email || !entry?.name) continue;
        const applicantId = crypto.randomUUID();
        state.applicants.push({
          id: applicantId,
          name: String(entry.name).slice(0, 120),
          email: String(entry.email).toLowerCase().slice(0, 254),
          grade: String(entry.grade || 'Not specified').slice(0, 40),
          ageRange: 'not-collected-legacy',
          guardianName: null,
          guardianEmail: null,
          createdAt: entry.submittedAt || new Date().toISOString(),
          updatedAt: entry.submittedAt || new Date().toISOString()
        });
        state.applications.push({
          id: entry.id || crypto.randomUUID(),
          reference: `LEGACY-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          applicantId,
          cohortId: cohort.id,
          level: String(entry.level || 'Legacy application').slice(0, 120),
          experienceLevel: 'not-collected',
          codingTools: '',
          projectExperience: '',
          learningGoals: '',
          status: 'submitted',
          source: 'legacy-import',
          confirmationStatus: 'not-applicable',
          internalNotificationStatus: 'not-applicable',
          acceptanceStatus: 'not-applicable',
          participationEndedAt: null,
          submittedAt: entry.submittedAt || new Date().toISOString(),
          updatedAt: entry.submittedAt || new Date().toISOString()
        });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  async read() {
    const raw = await fs.readFile(this.file, 'utf8');
    const state = JSON.parse(raw);
    if (!state || ![1, 2].includes(state.schemaVersion) || !Array.isArray(state.applications)) {
      throw new Error('Unsupported or corrupted local datastore. Refusing to overwrite it.');
    }
    if (state.schemaVersion === 1) {
      for (const application of state.applications) {
        application.experienceLevel ??= 'not-collected';
        application.codingTools ??= '';
        application.projectExperience ??= '';
        application.learningGoals ??= '';
      }
      state.schemaVersion = 2;
    }
    for (const application of state.applications) {
      application.acceptanceStatus ??= 'not-applicable';
    }
    return state;
  }

  async write(state) {
    const operation = this.writeChain.then(async () => {
      const tempFile = `${this.file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      try {
        await fs.copyFile(this.file, this.backup);
        await fs.chmod(this.backup, 0o600);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      await fs.writeFile(tempFile, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tempFile, this.file);
    });
    this.writeChain = operation.catch(() => {});
    return operation;
  }

  async mutate(callback) {
    const operation = this.writeChain.then(async () => {
      const state = await this.read();
      const result = await callback(state);
      const tempFile = `${this.file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      await fs.copyFile(this.file, this.backup);
      await fs.chmod(this.backup, 0o600);
      await fs.writeFile(tempFile, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tempFile, this.file);
      return result;
    });
    this.writeChain = operation.catch(() => {});
    return operation;
  }

  async health() {
    await this.read();
    return { ok: true, store: this.kind };
  }

  async getCurrentCohort() {
    const state = await this.read();
    return state.cohorts.find(cohort => cohort.isCurrent) || null;
  }

  async listCohorts() {
    const state = await this.read();
    return state.cohorts
      .map(cohort => ({
        ...cohort,
        applicationCount: state.applications.filter(application => application.cohortId === cohort.id).length
      }))
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || new Date(b.createdAt) - new Date(a.createdAt));
  }

  async setCurrentCohort(id) {
    return this.mutate(state => {
      const target = state.cohorts.find(cohort => cohort.id === id);
      if (!target) return null;
      const updatedAt = new Date().toISOString();
      for (const cohort of state.cohorts) cohort.isCurrent = cohort.id === id;
      target.updatedAt = updatedAt;
      return { ...target };
    });
  }

  async createApplication(record) {
    return this.mutate(state => {
      const normalizedEmail = record.email.toLowerCase();
      let applicant = state.applicants.find(item =>
        item.email.toLowerCase() === normalizedEmail && item.name.toLowerCase() === record.name.toLowerCase()
      );
      const cohort = state.cohorts.find(item => item.slug === record.cohortSlug);
      if (!cohort) throw Object.assign(new Error('Cohort not found.'), { code: 'COHORT_NOT_FOUND' });

      if (applicant) {
        const duplicate = state.applications.find(application =>
          application.applicantId === applicant.id &&
          application.cohortId === cohort.id &&
          application.level === record.level &&
          application.status !== 'withdrawn'
        );
        if (duplicate) return { created: false, application: this.join(state, duplicate) };
      }

      if (!applicant) {
        applicant = {
          id: crypto.randomUUID(),
          name: record.name,
          email: normalizedEmail,
          grade: record.grade,
          ageRange: record.ageRange,
          guardianName: record.guardianName || null,
          guardianEmail: record.guardianEmail || null,
          createdAt: record.submittedAt,
          updatedAt: record.submittedAt
        };
        state.applicants.push(applicant);
      } else {
        Object.assign(applicant, {
          name: record.name,
          grade: record.grade,
          ageRange: record.ageRange,
          guardianName: record.guardianName || null,
          guardianEmail: record.guardianEmail || null,
          updatedAt: record.submittedAt
        });
      }

      const consent = {
        id: crypto.randomUUID(),
        applicantId: applicant.id,
        privacyVersion: record.policyVersions.privacy,
        termsVersion: record.policyVersions.terms,
        safetyVersion: record.policyVersions.safety,
        guardianConsent: record.guardianConsent,
        submittedByGuardian: record.submittedByGuardian,
        communicationsConsent: record.communicationsConsent,
        ipHash: record.ipHash,
        consentedAt: record.submittedAt
      };
      state.consents.push(consent);

      const application = {
        id: record.id,
        reference: record.reference,
        applicantId: applicant.id,
        cohortId: cohort.id,
        consentId: consent.id,
        level: record.level,
        experienceLevel: record.experienceLevel,
        codingTools: record.codingTools,
        projectExperience: record.projectExperience,
        learningGoals: record.learningGoals,
        status: 'submitted',
        source: record.source,
        confirmationStatus: 'pending',
        internalNotificationStatus: 'pending',
        acceptanceStatus: 'not-applicable',
        participationEndedAt: null,
        submittedAt: record.submittedAt,
        updatedAt: record.submittedAt
      };
      state.applications.push(application);
      return { created: true, application: this.join(state, application) };
    });
  }

  join(state, application) {
    const applicant = state.applicants.find(item => item.id === application.applicantId) || {};
    const cohort = state.cohorts.find(item => item.id === application.cohortId) || {};
    const storedConsent = state.consents.find(item => item.id === application.consentId) || null;
    const consent = storedConsent ? {
      id: storedConsent.id,
      privacyVersion: storedConsent.privacyVersion,
      termsVersion: storedConsent.termsVersion,
      safetyVersion: storedConsent.safetyVersion,
      guardianConsent: storedConsent.guardianConsent,
      submittedByGuardian: storedConsent.submittedByGuardian,
      communicationsConsent: storedConsent.communicationsConsent,
      consentedAt: storedConsent.consentedAt
    } : null;
    return { ...application, applicant, cohort, consent };
  }

  async listApplications() {
    const state = await this.read();
    return state.applications
      .map(application => this.join(state, application))
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }

  async getApplication(id) {
    const state = await this.read();
    const application = state.applications.find(item => item.id === id);
    return application ? this.join(state, application) : null;
  }

  async deleteApplication(id) {
    return this.mutate(state => {
      const application = state.applications.find(item => item.id === id);
      if (!application) return null;
      const consentCount = state.consents.length;
      state.applications = state.applications.filter(item => item.id !== id);
      state.consents = state.consents.filter(consent => consent.id !== application.consentId);

      const applicantHasOtherApplications = state.applications.some(item => item.applicantId === application.applicantId);
      if (!applicantHasOtherApplications) {
        state.applicants = state.applicants.filter(applicant => applicant.id !== application.applicantId);
        state.consents = state.consents.filter(consent => consent.applicantId !== application.applicantId);
      }

      return {
        id: application.id,
        reference: application.reference,
        deletedApplicant: !applicantHasOtherApplications,
        deletedConsent: state.consents.length < consentCount
      };
    });
  }

  async updateApplicationStatus(id, status) {
    return this.mutate(state => {
      const application = state.applications.find(item => item.id === id);
      if (!application) return null;
      if (['accepted', 'enrolled'].includes(status)) {
        const cohort = state.cohorts.find(item => item.id === application.cohortId);
        const occupied = state.applications.filter(item =>
          item.id !== application.id && item.cohortId === application.cohortId &&
          ['accepted', 'enrolled', 'completed'].includes(item.status)
        ).length;
        if (cohort?.seatLimit && occupied >= cohort.seatLimit) {
          throw Object.assign(new Error('Cohort capacity has been reached.'), { code: 'COHORT_CAPACITY_REACHED' });
        }
      }
      application.status = status;
      if (status === 'accepted' && application.acceptanceStatus !== 'sent') {
        application.acceptanceStatus = 'pending';
      }
      if (status === 'completed' && !application.participationEndedAt) {
        application.participationEndedAt = new Date().toISOString();
      } else if (status !== 'completed') {
        application.participationEndedAt = null;
      }
      application.updatedAt = new Date().toISOString();
      return this.join(state, application);
    });
  }

  async updateNotificationStatus(id, field, status) {
    const allowed = new Set(['confirmationStatus', 'internalNotificationStatus', 'acceptanceStatus']);
    if (!allowed.has(field)) throw new Error('Unsupported notification field.');
    return this.mutate(state => {
      const application = state.applications.find(item => item.id === id);
      if (!application) return null;
      application[field] = status;
      application.updatedAt = new Date().toISOString();
      return this.join(state, application);
    });
  }

  async recordAudit(event) {
    return this.mutate(state => {
      state.auditEvents.push({ id: crypto.randomUUID(), ...event, createdAt: new Date().toISOString() });
      if (state.auditEvents.length > 5000) state.auditEvents = state.auditEvents.slice(-5000);
    });
  }

  async hasApplicantEmail(value) {
    const state = await this.read();
    const normalized = value.toLowerCase();
    return state.applicants.some(applicant =>
      applicant.email.toLowerCase() === normalized || applicant.guardianEmail?.toLowerCase() === normalized
    );
  }

  async createDeletionRequest(record) {
    return this.mutate(state => {
      const existing = state.deletionRequests.find(item =>
        item.email?.toLowerCase() === record.email.toLowerCase() && item.status === 'pending'
      );
      if (existing) Object.assign(existing, record, { updatedAt: record.requestedAt });
      else state.deletionRequests.push({ id: crypto.randomUUID(), status: 'pending', ...record });
    });
  }

  async completeDeletionRequest(tokenHash) {
    return this.mutate(state => {
      const request = state.deletionRequests.find(item => item.tokenHash === tokenHash && item.status === 'pending');
      if (!request || new Date(request.expiresAt) < new Date()) return null;
      const normalized = request.email.toLowerCase();
      const applicantIds = state.applicants
        .filter(applicant => applicant.email.toLowerCase() === normalized || applicant.guardianEmail?.toLowerCase() === normalized)
        .map(applicant => applicant.id);
      const applicationIds = state.applications
        .filter(application => applicantIds.includes(application.applicantId))
        .map(application => application.id);
      state.applications = state.applications.filter(application => !applicationIds.includes(application.id));
      state.consents = state.consents.filter(consent => !applicantIds.includes(consent.applicantId));
      state.applicants = state.applicants.filter(applicant => !applicantIds.includes(applicant.id));
      const email = request.email;
      request.email = null;
      request.tokenHash = null;
      request.status = 'completed';
      request.completedAt = new Date().toISOString();
      request.deletedApplicationCount = applicationIds.length;
      return { email, deletedApplicationCount: applicationIds.length };
    });
  }

  async listDeletionRequests() {
    const state = await this.read();
    return state.deletionRequests
      .map(({ tokenHash: _tokenHash, ...request }) => request)
      .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  }

  async metrics() {
    const state = await this.read();
    const byStatus = {};
    const byLevel = {};
    const byCohort = {};
    const confirmation = {};
    const acceptance = {};
    for (const application of state.applications) {
      byStatus[application.status] = (byStatus[application.status] || 0) + 1;
      byLevel[application.level] = (byLevel[application.level] || 0) + 1;
      const cohort = state.cohorts.find(item => item.id === application.cohortId);
      if (cohort) byCohort[cohort.slug] = (byCohort[cohort.slug] || 0) + 1;
      confirmation[application.confirmationStatus] = (confirmation[application.confirmationStatus] || 0) + 1;
      acceptance[application.acceptanceStatus] = (acceptance[application.acceptanceStatus] || 0) + 1;
    }
    for (const cohort of state.cohorts) byCohort[cohort.slug] ??= 0;
    return { total: state.applications.length, byStatus, byLevel, byCohort, confirmation, acceptance };
  }

  async purgeExpiredRecords({ now = new Date(), unsuccessfulMonths, enrolledMonths }) {
    return this.mutate(state => {
      const unsuccessfulCutoff = new Date(now);
      unsuccessfulCutoff.setUTCMonth(unsuccessfulCutoff.getUTCMonth() - unsuccessfulMonths);
      const enrolledCutoff = new Date(now);
      enrolledCutoff.setUTCMonth(enrolledCutoff.getUTCMonth() - enrolledMonths);
      const expiredIds = state.applications.filter(application =>
        (['declined', 'withdrawn'].includes(application.status) && new Date(application.updatedAt) < unsuccessfulCutoff) ||
        (application.status === 'completed' && application.participationEndedAt && new Date(application.participationEndedAt) < enrolledCutoff)
      ).map(application => application.id);
      const expiredConsentIds = state.applications
        .filter(application => expiredIds.includes(application.id))
        .map(application => application.consentId)
        .filter(Boolean);
      state.applications = state.applications.filter(application => !expiredIds.includes(application.id));
      state.consents = state.consents.filter(consent => !expiredConsentIds.includes(consent.id));
      const activeApplicantIds = new Set(state.applications.map(application => application.applicantId));
      const beforeApplicants = state.applicants.length;
      state.applicants = state.applicants.filter(applicant => activeApplicantIds.has(applicant.id));
      let expiredDeletionRequests = 0;
      for (const request of state.deletionRequests) {
        if (request.status === 'pending' && new Date(request.expiresAt) < now) {
          request.status = 'expired';
          request.email = null;
          request.tokenHash = null;
          request.updatedAt = now.toISOString();
          expiredDeletionRequests += 1;
        }
      }
      return {
        deletedApplications: expiredIds.length,
        deletedApplicants: beforeApplicants - state.applicants.length,
        deletedConsents: expiredConsentIds.length,
        expiredDeletionRequests
      };
    });
  }

  async close() {}
}
