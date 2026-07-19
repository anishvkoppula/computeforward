import { config } from '../config.js';
import { createStore } from '../store.js';

if (!config.databaseUrl) {
  console.error('DATABASE_URL is required. Production retention never runs against the development file store.');
  process.exitCode = 1;
} else {
  const store = await createStore(config);
  try {
    const result = await store.purgeExpiredRecords({
      unsuccessfulMonths: config.retention.unsuccessfulApplicationMonths,
      enrolledMonths: config.retention.enrolledApplicationMonths
    });
    console.log(JSON.stringify({ event: 'retention_completed', ...result }));
  } finally {
    await store.close();
  }
}
