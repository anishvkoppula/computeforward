import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import { config as baseConfig } from '../config.js';
import { PostgresStore } from '../stores/postgres-store.js';

const databaseUrl = process.env.TEST_DATABASE_URL || '';
const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
if (!databaseUrl || !/(?:_test|_audit)/.test(databaseName)) {
  throw new Error('TEST_DATABASE_URL must point to an isolated database whose name contains _test or _audit.');
}

const config = { ...baseConfig, databaseUrl, databaseSsl: false };
let store;

function application(overrides = {}) {
  const submittedAt = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    reference: `CF-TEST-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    name: 'Postgres Applicant',
    email: 'postgres@example.com',
    grade: '11th',
    ageRange: '18-plus',
    guardianName: '',
    guardianEmail: '',
    level: 'Level 1 — Python Foundations',
    experienceLevel: 'projects',
    codingTools: 'Python and Scratch',
    projectExperience: 'A small command-line game.',
    learningGoals: 'Build a larger project and improve problem solving.',
    cohortSlug: 'interest-2026',
    policyVersions: config.program.policyVersions,
    guardianConsent: false,
    submittedByGuardian: false,
    communicationsConsent: false,
    ipHash: 'test-hash',
    source: 'postgres-integration-test',
    submittedAt,
    ...overrides
  };
}

before(async () => {
  store = new PostgresStore(config);
  await store.pool.query('TRUNCATE audit_events, deletion_requests, applications, consents, applicants, cohorts CASCADE');
  await store.init();
});

after(async () => {
  await store.close();
});

test('PostgreSQL adapter persists, de-duplicates without overwrite, and supports siblings', async () => {
  const first = await store.createApplication(application());
  assert.equal(first.created, true);
  assert.equal(first.application.experienceLevel, 'projects');
  assert.equal(first.application.codingTools, 'Python and Scratch');
  const duplicate = await store.createApplication(application({ id: crypto.randomUUID(), reference: 'CF-TEST-DUPLICATE', grade: '12th' }));
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.application.applicant.grade, '11th');

  const sibling = await store.createApplication(application({
    id: crypto.randomUUID(), reference: 'CF-TEST-SIBLING', name: 'Postgres Sibling'
  }));
  assert.equal(sibling.created, true);
  assert.equal((await store.listApplications()).length, 2);
});

test('PostgreSQL adapter enforces cohort capacity during status changes', async () => {
  await store.pool.query("UPDATE cohorts SET seat_limit=1 WHERE slug='interest-2026'");
  const applications = await store.listApplications();
  await store.updateApplicationStatus(applications[0].id, 'accepted');
  await assert.rejects(
    store.updateApplicationStatus(applications[1].id, 'accepted'),
    error => error.code === 'COHORT_CAPACITY_REACHED'
  );
  await store.pool.query("UPDATE cohorts SET seat_limit=NULL WHERE slug='interest-2026'");
});

test('PostgreSQL deletion verification removes every matching family record', async () => {
  await store.createDeletionRequest({
    email: 'postgres@example.com',
    emailHash: 'email-hash',
    tokenHash: 'token-hash',
    requestedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  });
  const result = await store.completeDeletionRequest('token-hash');
  assert.equal(result.deletedApplicationCount, 2);
  assert.equal((await store.listApplications()).length, 0);
  assert.equal((await store.listDeletionRequests())[0].email, null);
});

test('PostgreSQL retention removes expired application subtrees', async () => {
  const created = await store.createApplication(application({
    id: crypto.randomUUID(), reference: 'CF-TEST-RETENTION', email: 'retention@example.com'
  }));
  await store.pool.query("UPDATE applications SET status='declined', updated_at='2020-01-01T00:00:00Z' WHERE id=$1", [created.application.id]);
  const result = await store.purgeExpiredRecords({
    now: new Date('2026-07-17T00:00:00Z'), unsuccessfulMonths: 12, enrolledMonths: 24
  });
  assert.equal(result.deletedApplications, 1);
  assert.equal(result.deletedApplicants, 1);
  assert.equal(result.deletedConsents, 1);
});
