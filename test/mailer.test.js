import assert from 'node:assert/strict';
import test from 'node:test';
import { createMailer } from '../lib/mailer.js';

test('application receipt goes to both addresses and contains a safe application copy', async () => {
  let delivered;
  const config = {
    publicOrigin: 'https://example.test',
    admissionsEmails: ['admissions@example.test'],
    smtp: {
      host: 'smtp.example.test', port: 587, secure: false,
      user: 'smtp-user', pass: 'smtp-password', from: 'Compute Forward <hello@example.test>'
    }
  };
  const mailer = createMailer(config, {
    createTransport() {
      return {
        async sendMail(options) { delivered = options; },
        async verify() { return true; }
      };
    }
  });

  const result = await mailer.sendApplicationConfirmation({
    reference: 'CF-TEST-RECEIPT',
    level: 'Level 1 — Python Foundations',
    experienceLevel: 'exploring',
    codingTools: 'Scratch <script>alert(1)</script>',
    projectExperience: 'A maze game',
    learningGoals: 'Learn Python and build a study tool',
    applicant: {
      name: 'Student Example', email: 'student@example.test', grade: '7th', ageRange: 'under-13',
      guardianName: 'Guardian Example', guardianEmail: 'guardian@example.test'
    }
  });

  assert.equal(result.delivered, true);
  assert.deepEqual(delivered.to, ['student@example.test', 'guardian@example.test']);
  assert.match(delivered.text, /Learning goals: Learn Python/);
  assert.match(delivered.html, /Application copy/);
  assert.doesNotMatch(delivered.html, /<script>alert/);
  assert.match(delivered.html, /&lt;script&gt;alert/);
});

test('duplicate student and guardian addresses receive only one copy', async () => {
  let delivered;
  const config = {
    publicOrigin: 'https://example.test', admissionsEmails: [],
    smtp: { host: 'smtp.example.test', port: 587, secure: false, user: 'u', pass: 'p', from: 'from@example.test' }
  };
  const mailer = createMailer(config, {
    createTransport: () => ({ async sendMail(options) { delivered = options; }, async verify() { return true; } })
  });
  await mailer.sendApplicationConfirmation({
    reference: 'CF-TEST-DEDUPE', level: 'Level 1 — Python Foundations', experienceLevel: 'none',
    codingTools: '', projectExperience: '', learningGoals: 'Learn how to code from the beginning.',
    applicant: {
      name: 'Student', email: 'family@example.test', grade: '6th', ageRange: 'under-13',
      guardianName: 'Guardian', guardianEmail: 'FAMILY@example.test'
    }
  });
  assert.deepEqual(delivered.to, ['family@example.test']);
});

test('internal application alert goes only to the configured organization inbox', async () => {
  let delivered;
  const config = {
    publicOrigin: 'https://example.test',
    admissionsEmails: ['computeforward123@gmail.com'],
    smtp: { host: 'smtp.example.test', port: 587, secure: false, user: 'u', pass: 'p', from: 'from@example.test' }
  };
  const mailer = createMailer(config, {
    createTransport: () => ({ async sendMail(options) { delivered = options; }, async verify() { return true; } })
  });

  await mailer.sendAdmissionsNotification({
    reference: 'CF-TEST-ALERT',
    level: 'Level 3 — Algorithms & Competitive Programming'
  });

  assert.deepEqual(delivered.to, ['computeforward123@gmail.com']);
  assert.match(delivered.html, /computeforward123@gmail\.com/);
  assert.doesNotMatch(delivered.html, /anishkoppula@gmail\.com|kaushik\.atla@gmail\.com/);
});

test('acceptance email goes to the student and guardian without promising a scheduled seat', async () => {
  let delivered;
  const config = {
    publicOrigin: 'https://example.test',
    admissionsEmails: ['computeforward123@gmail.com'],
    smtp: { host: 'smtp.example.test', port: 587, secure: false, user: 'u', pass: 'p', from: 'from@example.test' }
  };
  const mailer = createMailer(config, {
    createTransport: () => ({ async sendMail(options) { delivered = options; }, async verify() { return true; } })
  });

  await mailer.sendAcceptanceNotification({
    reference: 'CF-TEST-ACCEPTED',
    level: 'Level 2 — Applied AI & Machine Learning',
    applicant: {
      name: 'Accepted Student', email: 'student@example.test',
      guardianName: 'Guardian', guardianEmail: 'guardian@example.test'
    }
  });

  assert.deepEqual(delivered.to, ['student@example.test', 'guardian@example.test']);
  assert.match(delivered.subject, /Application accepted/);
  assert.match(delivered.html, /application has been accepted/i);
  assert.match(delivered.text, /does not yet assign a scheduled cohort seat/i);
});
