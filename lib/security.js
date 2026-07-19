import crypto from 'node:crypto';

export function secureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashValue(value, secret = '') {
  return crypto.createHash('sha256').update(`${secret}:${value}`).digest('hex');
}

export function safeTokenEqual(provided, expected) {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(String(provided));
  const expectedBuffer = Buffer.from(String(expected));
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

export function applicationReference() {
  const year = new Date().getUTCFullYear();
  return `CF-${year}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}
