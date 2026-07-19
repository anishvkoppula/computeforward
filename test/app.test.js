import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { config as baseConfig, validateRuntimeConfig } from '../config.js';
import { FileStore } from '../stores/file-store.js';
import { createApp } from '../app.js';

let store;
let server;
let baseUrl;
let tempDir;
let deletionToken;
let acceptanceNotifications = 0;

const testConfig = {
  ...baseConfig,
  isProduction: false,
  trustProxy: 0,
  publicOrigin: 'http://127.0.0.1',
  adminToken: 'test-admin-token-that-is-longer-than-32-characters',
  cronSecret: 'test-cron-secret-that-is-longer-than-32-characters',
  ipHashSecret: 'test-ip-secret-that-is-longer-than-32-characters',
  applicationRateLimit: 100,
  adminRateLimit: 100,
  deletionRateLimit: 100
};

const mailer = {
  configured: true,
  async sendApplicationConfirmation() { return { delivered: true }; },
  async sendAdmissionsNotification() { return { delivered: true }; },
  async sendAcceptanceNotification() { acceptanceNotifications += 1; return { delivered: true }; },
  async sendDeletionConfirmation(_email, token) { deletionToken = token; return { delivered: true }; },
  async sendDeletionComplete() { return { delivered: true }; }
};

const validApplication = {
  name: 'Test Applicant',
  email: 'student@example.com',
  grade: '9th',
  ageRange: '18-plus',
  level: 'Level 1 — Python Foundations',
  experienceLevel: 'exploring',
  codingTools: 'Scratch and a little Python',
  projectExperience: 'Built a small guessing game.',
  learningGoals: 'I want to understand Python and build a useful study tool.',
  cohortSlug: 'interest-2026',
  privacyConsent: true,
  termsConsent: true,
  safetyConsent: true,
  communicationsConsent: false,
  website: ''
};

async function request(pathname, options = {}) {
  return fetch(`${baseUrl}${pathname}`, options);
}

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'computeforward-test-'));
  testConfig.dataDir = tempDir;
  store = new FileStore(testConfig);
  await store.init();
  const app = createApp({ store, mailer, config: testConfig });
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  await store.close();
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('serves public pages and security headers', async () => {
  const response = await request('/');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(await response.text(), /A clear path into/);
});

test('never serves repository source or application data as static content', async () => {
  for (const pathname of ['/data/applications.json', '/data/store.json', '/server.js', '/config.js', '/program-config.json']) {
    const response = await request(pathname);
    assert.equal(response.status, 404, pathname);
  }
});

test('requires an admin token header and ignores query-string tokens', async () => {
  const noToken = await request('/api/admin/applications');
  assert.equal(noToken.status, 401);
  const queryToken = await request(`/api/admin/applications?token=${encodeURIComponent(testConfig.adminToken)}`);
  assert.equal(queryToken.status, 401);
});

test('exposes the database-backed current cohort and lets an admin change it', async () => {
  const original = await store.getCurrentCohort();
  const alternate = {
    ...testConfig.program.currentCohort,
    id: crypto.randomUUID(),
    slug: 'fall-2026',
    name: 'Fall 2026 Interest List',
    isCurrent: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await store.mutate(state => state.cohorts.push(alternate));

  const list = await request('/api/admin/cohorts', { headers: { 'x-admin-token': testConfig.adminToken } });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).count, 2);

  const update = await request(`/api/admin/cohorts/${alternate.id}/current`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-admin-token': testConfig.adminToken },
    body: '{}'
  });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).cohort.slug, alternate.slug);

  const program = await request('/api/program');
  assert.equal(program.status, 200);
  assert.equal((await program.json()).currentCohort.slug, alternate.slug);

  const restore = await request(`/api/admin/cohorts/${original.id}/current`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-admin-token': testConfig.adminToken },
    body: '{}'
  });
  assert.equal(restore.status, 200);
});

test('rejects invalid application fields and consent', async () => {
  const response = await request('/api/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...validApplication, level: 'Not a real level', privacyConsent: false })
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.code, 'VALIDATION_FAILED');
  assert.ok(body.fieldErrors.level);
  assert.ok(body.fieldErrors.privacyConsent);
});

test('requires an allowed grade, experience answer, and meaningful learning goal', async () => {
  const response = await request('/api/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...validApplication, grade: 'College', experienceLevel: 'expert', learningGoals: 'short' })
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(body.fieldErrors.grade);
  assert.ok(body.fieldErrors.experienceLevel);
  assert.ok(body.fieldErrors.learningGoals);
});

test('rejects malformed and oversized request bodies', async () => {
  const malformed = await request('/api/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not-json'
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).code, 'INVALID_JSON');

  const oversized = await request('/api/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload: 'x'.repeat(30_000) })
  });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).code, 'PAYLOAD_TOO_LARGE');
});

test('silently discards honeypot submissions without storing a record', async () => {
  const response = await request('/api/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...validApplication, website: 'https://spam.example' })
  });
  assert.equal(response.status, 202);
  assert.equal((await store.listApplications()).length, 0);
});

test('requires guardian authorization for a minor', async () => {
  const response = await request('/api/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...validApplication, email: 'minor@example.com', ageRange: '13-17' })
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(body.fieldErrors.guardianEmail);
  assert.ok(body.fieldErrors.guardianConsent);
});

test('persists a valid application, consent versions, and email status', async () => {
  const response = await request('/api/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(validApplication)
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.match(body.reference, /^CF-\d{4}-[A-F0-9]{8}$/);
  assert.equal(body.confirmationStatus, 'sent');

  const saved = await store.listApplications();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].consent.privacyVersion, '2026-07-18');
  assert.equal(saved[0].confirmationStatus, 'sent');
  assert.equal(saved[0].experienceLevel, 'exploring');
  assert.equal(saved[0].codingTools, 'Scratch and a little Python');
  assert.match(saved[0].learningGoals, /study tool/);
});

test('de-duplicates the same email, cohort, and level', async () => {
  const response = await request('/api/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...validApplication, grade: '10th' })
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.duplicate, true);
  const saved = await store.listApplications();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].applicant.grade, '9th', 'duplicate submissions must not overwrite applicant data');
  assert.equal(saved[0].learningGoals, validApplication.learningGoals, 'duplicate submissions must not overwrite application answers');
});

test('supports no-JavaScript form submission with a truthful receipt', async () => {
  const form = new URLSearchParams({
    ...validApplication,
    email: 'form@example.com',
    level: 'Level 2 — Applied AI & Machine Learning',
    privacyConsent: 'on', termsConsent: 'on', safetyConsent: 'on'
  });
  const response = await request('/api/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'text/html' },
    body: form,
    redirect: 'manual'
  });
  assert.equal(response.status, 303);
  assert.match(response.headers.get('location'), /^\/application-received\?/);
});

test('allows authorized status changes and records metrics', async () => {
  const applications = await store.listApplications();
  const id = applications[0].id;
  const response = await request(`/api/admin/applications/${id}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-admin-token': testConfig.adminToken },
    body: JSON.stringify({ status: 'reviewing' })
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).application.status, 'reviewing');
  const metrics = await request('/api/admin/metrics', { headers: { 'x-admin-token': testConfig.adminToken } });
  assert.equal(metrics.status, 200);
  const metricBody = await metrics.json();
  assert.equal(metricBody.metrics.byStatus.reviewing, 1);
  assert.equal(metricBody.metrics.byCohort['interest-2026'], 2);
});

test('acceptance email requires accepted status and records successful delivery', async () => {
  const applications = await store.listApplications();
  const target = applications.find(application => application.status === 'reviewing');
  const notAccepted = applications.find(application => application.id !== target.id);

  const blocked = await request(`/api/admin/applications/${notAccepted.id}/send-acceptance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-token': testConfig.adminToken },
    body: '{}'
  });
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).code, 'ACCEPTANCE_REQUIRES_ACCEPTED_STATUS');

  const accepted = await request(`/api/admin/applications/${target.id}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-admin-token': testConfig.adminToken },
    body: JSON.stringify({ status: 'accepted' })
  });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).application.acceptanceStatus, 'pending');

  const sent = await request(`/api/admin/applications/${target.id}/send-acceptance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-token': testConfig.adminToken },
    body: '{}'
  });
  assert.equal(sent.status, 200);
  assert.equal((await sent.json()).acceptanceStatus, 'sent');
  assert.equal(acceptanceNotifications, 1);
  assert.equal((await store.getApplication(target.id)).acceptanceStatus, 'sent');
  const state = await store.read();
  assert.ok(state.auditEvents.some(event => event.action === 'acceptance_email_sent' && event.targetId === target.id));
});

test('admin can permanently delete one application and its orphaned personal records', async () => {
  const createdResponse = await request('/api/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...validApplication,
      name: 'Admin Deletion Test',
      email: 'admin-delete@example.com',
      level: 'Level 4 — Passion Project'
    })
  });
  assert.equal(createdResponse.status, 201);
  const createdBody = await createdResponse.json();
  const application = (await store.listApplications()).find(item => item.reference === createdBody.reference);
  assert.ok(application);

  const unauthorized = await request(`/api/admin/applications/${application.id}`, { method: 'DELETE' });
  assert.equal(unauthorized.status, 401);

  const response = await request(`/api/admin/applications/${application.id}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': testConfig.adminToken }
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.deleted.reference, application.reference);
  assert.equal(result.deleted.deletedApplicant, true);
  assert.equal(result.deleted.deletedConsent, true);

  const state = await store.read();
  assert.equal(state.applications.some(item => item.id === application.id), false);
  assert.equal(state.applicants.some(item => item.email === 'admin-delete@example.com'), false);
  assert.equal(state.consents.some(item => item.id === application.consent.id), false);
  assert.ok(state.auditEvents.some(event => event.action === 'application_deleted' && event.targetId === application.id));

  const missing = await request(`/api/admin/applications/${application.id}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': testConfig.adminToken }
  });
  assert.equal(missing.status, 404);
});

test('uses email verification before deleting matching records', async () => {
  const start = await request('/api/privacy/deletion-requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: validApplication.email })
  });
  assert.equal(start.status, 202);
  assert.ok(deletionToken);
  assert.equal((await store.listApplications()).length, 2);

  const confirm = await request('/api/privacy/deletion-confirmations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: deletionToken })
  });
  assert.equal(confirm.status, 200);
  assert.equal((await confirm.json()).deletedApplicationCount, 1);
  const remaining = await store.listApplications();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].applicant.email, 'form@example.com');
  const deletionRequests = await store.listDeletionRequests();
  assert.equal(deletionRequests[0].email, null, 'completed requests must clear readable email');
});

test('retention enforcement removes expired applications and orphan records', async () => {
  await store.mutate(state => {
    state.applications[0].status = 'declined';
    state.applications[0].updatedAt = '2020-01-01T00:00:00.000Z';
  });
  const result = await store.purgeExpiredRecords({
    now: new Date('2026-07-17T00:00:00.000Z'),
    unsuccessfulMonths: 12,
    enrolledMonths: 24
  });
  assert.equal(result.deletedApplications, 1);
  assert.equal(result.deletedApplicants, 1);
  assert.equal(result.deletedConsents, 1);
  assert.equal((await store.listApplications()).length, 0);
});

test('scheduled retention endpoint requires its independent bearer secret', async () => {
  const unauthorized = await request('/api/internal/retention');
  assert.equal(unauthorized.status, 401);
  const authorized = await request('/api/internal/retention', {
    headers: { authorization: `Bearer ${testConfig.cronSecret}` }
  });
  assert.equal(authorized.status, 200);
  assert.equal((await authorized.json()).success, true);
});

test('production configuration refuses unsafe defaults', () => {
  const problems = validateRuntimeConfig({
    ...testConfig,
    isProduction: true,
    databaseUrl: '',
    adminToken: 'short',
    ipHashSecret: '',
    cronSecret: '',
    publicOrigin: 'http://example.com',
    smtp: { host: '', user: '', pass: '' }
  });
  assert.ok(problems.some(problem => problem.includes('DATABASE_URL')));
  assert.ok(problems.some(problem => problem.includes('ADMIN_TOKEN')));
  assert.ok(problems.some(problem => problem.includes('IP_HASH_SECRET')));
  assert.ok(problems.some(problem => problem.includes('CRON_SECRET')));
  assert.ok(problems.some(problem => problem.includes('HTTPS')));
  assert.ok(problems.some(problem => problem.includes('SMTP_HOST')));
});
