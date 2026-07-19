import crypto from 'node:crypto';

const ALLOWED_DETAIL_KEYS = new Set([
  'requestId', 'method', 'path', 'status', 'durationMs', 'code', 'store',
  'notificationStatus', 'applicationStatus', 'count', 'reason'
]);

function sanitizeDetails(details = {}) {
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => ALLOWED_DETAIL_KEYS.has(key))
  );
}

function write(level, event, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitizeDetails(details)
  };
  const output = JSON.stringify(entry);
  if (level === 'error') console.error(output);
  else console.log(output);
}

export const logger = {
  info(event, details) { write('info', event, details); },
  warn(event, details) { write('warn', event, details); },
  error(event, details) { write('error', event, details); }
};

export function requestContext(req, res, next) {
  const startedAt = performance.now();
  const requestPath = req.path;
  req.requestId = req.get('x-request-id')?.slice(0, 80) || crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  res.on('finish', () => {
    logger.info('http_request', {
      requestId: req.requestId,
      method: req.method,
      path: requestPath,
      status: res.statusCode,
      durationMs: Math.round(performance.now() - startedAt)
    });
  });
  next();
}

export async function alertOperations(config, event, details = {}) {
  logger.error(event, details);
  if (!config.alertWebhookUrl) return;
  try {
    await fetch(config.alertWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        service: 'computeforward',
        event,
        timestamp: new Date().toISOString(),
        ...sanitizeDetails(details)
      }),
      signal: AbortSignal.timeout(5000)
    });
  } catch {
    logger.error('alert_delivery_failed', { requestId: details.requestId, code: 'ALERT_WEBHOOK_FAILED' });
  }
}
