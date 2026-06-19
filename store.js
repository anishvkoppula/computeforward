// Tiny, dependency-free JSON store for applications.
// Each application is appended to data/applications.json as one object in an array.
// Writes are atomic (write to a temp file, then rename) so the file can't be
// left half-written if the process is interrupted.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'applications.json');

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

export async function readAll() {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Simple in-process lock so two requests arriving at once don't clobber each other.
let writeChain = Promise.resolve();

export function addApplication(app) {
  writeChain = writeChain.then(async () => {
    const all = await readAll();
    const record = {
      id: crypto.randomUUID(),
      ...app,
      submittedAt: new Date().toISOString()
    };
    all.push(record);
    const tmp = DATA_FILE + '.' + process.pid + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(all, null, 2), 'utf8');
    await fs.rename(tmp, DATA_FILE);
    return record;
  });
  return writeChain;
}
