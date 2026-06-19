// ComputeForward backend
// ------------------------
// Serves the static website AND accepts program applications.
//
//   • POST /api/apply            → validates + stores an application
//   • GET  /api/applications     → JSON list of applications (admin token required)
//   • GET  /admin                → simple admin dashboard to view applications
//   • everything else            → static files (index.html, etc.)
//
// Run it:   npm install   then   npm start
// Then open http://localhost:3000

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addApplication, readAll } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
// Change this (or set the ADMIN_TOKEN environment variable) to protect the admin page.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me';

const app = express();
app.use(express.json());

const VALID_LEVELS = [
  'Level 1 — Python Foundations',
  'Level 2 — Data Structures',
  'Level 3 — Algorithms'
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Accept an application ──
app.post('/api/apply', async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const grade = String(body.grade || '').trim() || 'Not specified';
    const level = String(body.level || '').trim();

    if (!name || name.length > 120) {
      return res.status(400).json({ success: false, error: 'A valid name is required.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, error: 'A valid email is required.' });
    }
    if (!VALID_LEVELS.includes(level)) {
      return res.status(400).json({ success: false, error: 'Please choose a program level.' });
    }

    const record = await addApplication({ name, email, grade, level });
    console.log(`[apply] ${name} <${email}> — ${level}`);
    return res.status(201).json({ success: true, id: record.id });
  } catch (err) {
    console.error('[apply] error:', err);
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

// ── Admin: list applications (token required) ──
function checkAdmin(req, res, next) {
  const token = req.query.token || req.get('x-admin-token');
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Provide the admin token.' });
  }
  next();
}

app.get('/api/applications', checkAdmin, async (_req, res) => {
  const all = await readAll();
  // newest first
  all.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json({ success: true, count: all.length, applications: all });
});

// ── Admin dashboard page ──
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ── Static website (index.html and assets) ──
app.use(express.static(__dirname, { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`\n  ComputeForward running → http://localhost:${PORT}`);
  console.log(`  Admin dashboard        → http://localhost:${PORT}/admin`);
  if (ADMIN_TOKEN === 'change-me') {
    console.log(`  ⚠  Admin token is still the default ("change-me"). Set ADMIN_TOKEN to secure it.\n`);
  } else {
    console.log('');
  }
});
