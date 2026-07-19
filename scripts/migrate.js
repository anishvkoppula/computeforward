import { promises as fs } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { config, validateRuntimeConfig } from '../config.js';

const { Pool } = pg;

if (!config.databaseUrl) {
  console.error('DATABASE_URL is required to run database migrations.');
  process.exitCode = 1;
} else {
  const productionProblems = validateRuntimeConfig(config).filter(problem => problem.startsWith('DATABASE_URL'));
  if (productionProblems.length) {
    console.error(productionProblems.join('\n'));
    process.exitCode = 1;
  } else {
    const pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : false
    });
    try {
      const sql = await fs.readFile(path.join(config.rootDir, 'db', 'schema.sql'), 'utf8');
      await pool.query(sql);
      console.log('Compute Forward database schema is ready.');
    } finally {
      await pool.end();
    }
  }
}
