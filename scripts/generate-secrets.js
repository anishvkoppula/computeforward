import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const envFile = path.join(config.rootDir, '.env');
const names = ['ADMIN_TOKEN', 'IP_HASH_SECRET', 'CRON_SECRET'];
let contents = '';

try {
  contents = await fs.readFile(envFile, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const lines = contents ? contents.split(/\r?\n/) : [];
const generated = [];

for (const name of names) {
  const index = lines.findIndex(line => line.startsWith(`${name}=`));
  const existing = index >= 0 ? lines[index].slice(name.length + 1).trim() : '';
  if (existing.length >= 32 && !existing.includes('replace-with')) continue;
  const value = crypto.randomBytes(48).toString('base64url');
  const line = `${name}=${value}`;
  if (index >= 0) lines[index] = line;
  else lines.push(line);
  generated.push(name);
}

await fs.writeFile(envFile, `${lines.filter((line, index) => line || index < lines.length - 1).join('\n')}\n`, { mode: 0o600 });
await fs.chmod(envFile, 0o600);
console.log(generated.length ? `Generated ${generated.join(', ')}.` : 'Production secrets already exist; no values changed.');
