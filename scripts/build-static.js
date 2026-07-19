import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const output = path.join(config.rootDir, 'dist');
const publicFiles = [
  'index.html',
  'programs.html',
  'parents.html',
  'team.html',
  'privacy.html',
  'terms.html',
  'safety.html',
  'delete.html',
  'admin.html',
  '404.html',
  'robots.txt',
  'sitemap.xml'
];

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
for (const file of publicFiles) {
  await fs.copyFile(path.join(config.rootDir, file), path.join(output, file));
}
await fs.cp(config.assetsDir, path.join(output, 'assets'), { recursive: true });

const emitted = await fs.readdir(output);
console.log(`Built ${emitted.length} allowlisted public entries in dist/.`);
