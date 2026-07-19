import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { applicationReference, escapeHtml, hashValue, safeTokenEqual, secureToken } from './lib/security.js';
import { validateApplication, validateEmail, validateId, validateStatus } from './lib/validation.js';
import { alertOperations, logger, requestContext } from './lib/monitoring.js';

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function wantsHtml(req) {
  return req.is('application/x-www-form-urlencoded') || (!req.is('application/json') && req.accepts(['html', 'json']) === 'html');
}

function messagePage({ title, eyebrow, message, detail = '', actionHref = '/', actionLabel = 'Return home' }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex"><title>${escapeHtml(title)} — Compute Forward</title>
    <link rel="stylesheet" href="/assets/site.css"></head><body class="message-page">
    <main class="message-card"><a class="brand" href="/">Compute<span>Forward</span></a>
    <p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>
    ${detail ? `<p class="reference">${escapeHtml(detail)}</p>` : ''}
    <a class="button button-primary" href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a></main></body></html>`;
}

function limiter(options) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, error: options.message, code: 'RATE_LIMITED' }
  });
}

export function createApp({ store, mailer, config }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: config.isProduction ? undefined : false
  }));
  app.use(requestContext);
  app.use(express.json({ limit: '24kb', strict: true }));
  app.use(express.urlencoded({ limit: '24kb', extended: false, parameterLimit: 40 }));

  const globalLimiter = limiter({ windowMs: 15 * 60_000, limit: config.globalRateLimit, message: 'Too many requests. Please wait and try again.' });
  const applyLimiter = limiter({ windowMs: 60 * 60_000, limit: config.applicationRateLimit, message: 'Too many application attempts. Please wait before trying again.' });
  const adminLimiter = limiter({ windowMs: 15 * 60_000, limit: config.adminRateLimit, message: 'Too many admin requests.' });
  const deletionLimiter = limiter({ windowMs: 60 * 60_000, limit: config.deletionRateLimit, message: 'Too many privacy requests. Please wait before trying again.' });
  app.use(globalLimiter);

  async function getProgram() {
    const currentCohort = await store.getCurrentCohort();
    if (!currentCohort) throw new Error('No current application cohort is configured.');
    return { ...config.program, currentCohort };
  }

  app.use('/assets', express.static(config.assetsDir, {
    dotfiles: 'deny',
    fallthrough: true,
    index: false,
    maxAge: config.isProduction ? '1h' : 0,
    immutable: false
  }));

  const pages = new Map([
    ['/', 'index.html'],
    ['/programs', 'programs.html'],
    ['/team', 'team.html'],
    ['/parents', 'parents.html'],
    ['/privacy', 'privacy.html'],
    ['/terms', 'terms.html'],
    ['/safety', 'safety.html'],
    ['/privacy/delete', 'delete.html'],
    ['/admin', 'admin.html']
  ]);
  for (const [route, file] of pages) {
    app.get(route, (_req, res) => res.sendFile(path.join(config.rootDir, file)));
  }
  app.get('/robots.txt', (_req, res) => res.sendFile(path.join(config.rootDir, 'robots.txt')));
  app.get('/sitemap.xml', (_req, res) => res.sendFile(path.join(config.rootDir, 'sitemap.xml')));

  app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'computeforward', version: 1 }));
  app.get('/readyz', asyncRoute(async (_req, res) => {
    const health = await store.health();
    res.json({ ok: true, store: health.store, emailConfigured: mailer.configured });
  }));
  app.get('/api/program', asyncRoute(async (_req, res) => res.json(await getProgram())));

  function verifyOrigin(req, res, next) {
    const origin = req.get('origin');
    if (origin && origin !== config.publicOrigin) {
      return res.status(403).json({ success: false, error: 'Request origin was not accepted.', code: 'ORIGIN_REJECTED' });
    }
    next();
  }

  async function deliverApplicationNotifications(application, requestId) {
    try {
      const result = await mailer.sendApplicationConfirmation(application);
      await store.updateNotificationStatus(application.id, 'confirmationStatus', result.delivered ? 'sent' : 'failed');
      if (!result.delivered) {
        await alertOperations(config, 'confirmation_email_pending', {
          requestId, code: result.reason || 'EMAIL_NOT_DELIVERED', notificationStatus: 'failed'
        });
      }
    } catch {
      await store.updateNotificationStatus(application.id, 'confirmationStatus', 'failed');
      await alertOperations(config, 'confirmation_email_failed', { requestId, code: 'SMTP_DELIVERY_FAILED' });
    }

    try {
      const result = await mailer.sendAdmissionsNotification(application);
      await store.updateNotificationStatus(application.id, 'internalNotificationStatus', result.delivered ? 'sent' : 'failed');
      if (!result.delivered) throw new Error(result.reason);
    } catch {
      await store.updateNotificationStatus(application.id, 'internalNotificationStatus', 'failed');
      await alertOperations(config, 'admissions_notification_failed', { requestId, code: 'INTERNAL_EMAIL_FAILED' });
    }
    return store.getApplication(application.id);
  }

  app.post('/api/apply', applyLimiter, verifyOrigin, asyncRoute(async (req, res) => {
    const program = await getProgram();
    if (!program.currentCohort.applicationsOpen) {
      const message = 'Applications are not open right now. Please use the contact email for current information.';
      if (wantsHtml(req)) return res.status(403).send(messagePage({ title: 'Applications are paused.', eyebrow: 'Enrollment', message }));
      return res.status(403).json({ success: false, error: message, code: 'APPLICATIONS_CLOSED' });
    }

    const { input, errors, valid } = validateApplication(req.body || {}, program);
    if (input.website) {
      return res.status(202).json({ success: true, message: 'Thank you. Your request has been received.' });
    }
    if (!valid) {
      if (wantsHtml(req)) {
        return res.status(400).send(messagePage({
          title: 'Please review the application.',
          eyebrow: 'Application not submitted',
          message: Object.values(errors)[0],
          actionHref: '/#apply',
          actionLabel: 'Return to the form'
        }));
      }
      return res.status(400).json({ success: false, error: 'Review the highlighted fields.', fieldErrors: errors, code: 'VALIDATION_FAILED' });
    }

    const submittedAt = new Date().toISOString();
    const result = await store.createApplication({
      id: crypto.randomUUID(),
      reference: applicationReference(),
      ...input,
      policyVersions: program.policyVersions,
      ipHash: hashValue(req.ip || 'unknown', config.ipHashSecret || 'development-only'),
      source: wantsHtml(req) ? 'web-form-no-js' : 'web-form',
      submittedAt
    });

    let application = result.application;
    if (result.created) application = await deliverApplicationNotifications(application, req.requestId);
    const confirmationStatus = application.confirmationStatus;

    if (wantsHtml(req)) {
      const params = new URLSearchParams({
        reference: application.reference,
        duplicate: String(!result.created),
        confirmation: confirmationStatus
      });
      return res.redirect(303, `/application-received?${params}`);
    }
    return res.status(result.created ? 201 : 200).json({
      success: true,
      duplicate: !result.created,
      reference: application.reference,
      confirmationStatus,
      message: result.created ? 'Your application was securely saved.' : 'We already have this application.'
    });
  }));

  app.get('/application-received', (req, res) => {
    const reference = String(req.query.reference || '').slice(0, 40);
    const duplicate = req.query.duplicate === 'true';
    const confirmation = req.query.confirmation === 'sent';
    res.setHeader('cache-control', 'no-store');
    res.send(messagePage({
      title: duplicate ? 'Your application is already on file.' : 'Your application is saved.',
      eyebrow: 'Application status',
      message: confirmation
        ? 'A confirmation and application copy was emailed to every student and parent or guardian address provided. We aim to respond within 48 hours.'
        : 'The application is safely stored and visible in the protected admissions dashboard. Email could not be sent yet; the team can retry delivery after email service is available.',
      detail: reference ? `Reference: ${reference}` : '',
      actionHref: '/',
      actionLabel: 'Return home'
    }));
  });

  app.post('/api/privacy/deletion-requests', deletionLimiter, verifyOrigin, asyncRoute(async (req, res) => {
    const candidate = validateEmail(req.body?.email);
    if (!candidate.valid) {
      if (wantsHtml(req)) return res.status(400).send(messagePage({ title: 'Enter a valid email.', eyebrow: 'Privacy request', message: 'Use the email associated with the application.', actionHref: '/privacy#delete', actionLabel: 'Try again' }));
      return res.status(400).json({ success: false, error: 'Enter a valid email.', code: 'VALIDATION_FAILED' });
    }
    const token = secureToken();
    const tokenHash = hashValue(token, config.ipHashSecret || 'development-only');
    const emailHash = hashValue(candidate.value, config.ipHashSecret || 'development-only');
    const hasRecord = await store.hasApplicantEmail(candidate.value);
    if (hasRecord) {
      const requestedAt = new Date();
      await store.createDeletionRequest({
        email: candidate.value,
        emailHash,
        tokenHash,
        requestedAt: requestedAt.toISOString(),
        expiresAt: new Date(requestedAt.getTime() + 60 * 60_000).toISOString()
      });
      try {
        await mailer.sendDeletionConfirmation(candidate.value, token);
      } catch {
        await alertOperations(config, 'deletion_confirmation_failed', { requestId: req.requestId, code: 'SMTP_DELIVERY_FAILED' });
      }
    }
    const message = 'If matching records exist, a confirmation link will arrive by email. The link expires in one hour.';
    if (wantsHtml(req)) return res.status(202).send(messagePage({ title: 'Check your email.', eyebrow: 'Privacy request', message, actionHref: '/privacy', actionLabel: 'Return to Privacy Policy' }));
    return res.status(202).json({ success: true, message });
  }));

  app.post('/api/privacy/deletion-confirmations', deletionLimiter, verifyOrigin, asyncRoute(async (req, res) => {
    const token = String(req.body?.token || '').trim();
    if (token.length < 32 || token.length > 100) {
      return res.status(400).json({ success: false, error: 'This confirmation link is invalid.', code: 'INVALID_TOKEN' });
    }
    const result = await store.completeDeletionRequest(hashValue(token, config.ipHashSecret || 'development-only'));
    if (!result) return res.status(410).json({ success: false, error: 'This confirmation link is invalid or expired.', code: 'TOKEN_EXPIRED' });
    try { await mailer.sendDeletionComplete(result.email, result.deletedApplicationCount); } catch {
      await alertOperations(config, 'deletion_receipt_failed', { requestId: req.requestId, code: 'SMTP_DELIVERY_FAILED' });
    }
    logger.info('privacy_deletion_completed', { requestId: req.requestId, count: result.deletedApplicationCount });
    return res.json({ success: true, deletedApplicationCount: result.deletedApplicationCount });
  }));

  app.get('/api/internal/retention', asyncRoute(async (req, res) => {
    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!safeTokenEqual(token, config.cronSecret)) {
      return res.status(401).json({ success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' });
    }
    const result = await store.purgeExpiredRecords({
      unsuccessfulMonths: config.retention.unsuccessfulApplicationMonths,
      enrolledMonths: config.retention.enrolledApplicationMonths
    });
    logger.info('retention_completed', { count: result.deletedApplications, status: 200 });
    return res.json({ success: true, ...result });
  }));

  function requireAdmin(req, res, next) {
    const token = req.get('x-admin-token');
    if (!safeTokenEqual(token, config.adminToken)) {
      return res.status(401).json({ success: false, error: 'Unauthorized.', code: 'UNAUTHORIZED' });
    }
    next();
  }

  app.use('/api/admin', adminLimiter, requireAdmin);
  app.get('/api/admin/applications', asyncRoute(async (_req, res) => {
    const applications = await store.listApplications();
    res.setHeader('cache-control', 'no-store');
    res.json({ success: true, count: applications.length, applications });
  }));
  app.get('/api/admin/cohorts', asyncRoute(async (_req, res) => {
    const cohorts = await store.listCohorts();
    res.setHeader('cache-control', 'no-store');
    res.json({ success: true, count: cohorts.length, cohorts });
  }));
  app.patch('/api/admin/cohorts/:id/current', asyncRoute(async (req, res) => {
    const id = validateId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid cohort.' });
    const cohort = await store.setCurrentCohort(id);
    if (!cohort) return res.status(404).json({ success: false, error: 'Cohort not found.' });
    await store.recordAudit({ actor: 'admin', action: 'current_cohort_changed', targetType: 'cohort', targetId: id, requestId: req.requestId });
    res.json({ success: true, cohort });
  }));
  app.patch('/api/admin/applications/:id/status', asyncRoute(async (req, res) => {
    const id = validateId(req.params.id);
    const status = validateStatus(req.body?.status);
    if (!id || !status.valid) return res.status(400).json({ success: false, error: 'Invalid application or status.' });
    let application;
    try {
      application = await store.updateApplicationStatus(id, status.value);
    } catch (error) {
      if (error.code === 'COHORT_CAPACITY_REACHED') {
        return res.status(409).json({ success: false, error: 'Cohort capacity is full. Use waitlisted or increase the approved seat limit.', code: error.code });
      }
      throw error;
    }
    if (!application) return res.status(404).json({ success: false, error: 'Application not found.' });
    await store.recordAudit({ actor: 'admin', action: 'status_changed', targetType: 'application', targetId: id, requestId: req.requestId });
    res.json({ success: true, application });
  }));
  app.delete('/api/admin/applications/:id', verifyOrigin, asyncRoute(async (req, res) => {
    const id = validateId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid application.' });
    const deleted = await store.deleteApplication(id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Application not found.' });
    await store.recordAudit({ actor: 'admin', action: 'application_deleted', targetType: 'application', targetId: id, requestId: req.requestId });
    logger.info('admin_application_deleted', { requestId: req.requestId, status: 200 });
    res.json({ success: true, deleted });
  }));
  app.post('/api/admin/applications/:id/resend-confirmation', asyncRoute(async (req, res) => {
    const id = validateId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid application.' });
    const application = await store.getApplication(id);
    if (!application) return res.status(404).json({ success: false, error: 'Application not found.' });
    const result = await mailer.sendApplicationConfirmation(application);
    await store.updateNotificationStatus(id, 'confirmationStatus', result.delivered ? 'sent' : 'failed');
    await store.recordAudit({ actor: 'admin', action: 'confirmation_resent', targetType: 'application', targetId: id, requestId: req.requestId });
    res.json({ success: result.delivered, confirmationStatus: result.delivered ? 'sent' : 'failed' });
  }));
  app.get('/api/admin/deletion-requests', asyncRoute(async (_req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.json({ success: true, requests: await store.listDeletionRequests() });
  }));
  app.get('/api/admin/metrics', asyncRoute(async (_req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.json({ success: true, metrics: await store.metrics() });
  }));

  app.use('/api', (_req, res) => res.status(404).json({ success: false, error: 'API route not found.', code: 'NOT_FOUND' }));
  app.use((_req, res) => res.status(404).sendFile(path.join(config.rootDir, '404.html')));
  app.use((error, req, res, _next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, error: 'Request body is not valid JSON.', code: 'INVALID_JSON' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ success: false, error: 'Request body is too large.', code: 'PAYLOAD_TOO_LARGE' });
    }
    alertOperations(config, 'unhandled_request_error', { requestId: req.requestId, code: error.code || 'INTERNAL_ERROR' });
    if (res.headersSent) return;
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ success: false, error: 'Something went wrong. Use the request ID when contacting support.', requestId: req.requestId, code: 'INTERNAL_ERROR' });
    }
    res.status(500).send(messagePage({ title: 'Something went wrong.', eyebrow: 'Request error', message: `Contact us with request ID ${req.requestId}.` }));
  });
  return app;
}
