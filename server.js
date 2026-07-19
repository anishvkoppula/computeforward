import { pathToFileURL } from 'node:url';
import { config, validateRuntimeConfig } from './config.js';
import { createStore } from './store.js';
import { createMailer } from './lib/mailer.js';
import { logger } from './lib/monitoring.js';
import { createApp } from './app.js';

export async function startServer(runtimeConfig = config) {
  const problems = validateRuntimeConfig(runtimeConfig);
  if (problems.length) throw new Error(`Unsafe production configuration:\n- ${problems.join('\n- ')}`);

  const store = await createStore(runtimeConfig);
  const mailer = createMailer(runtimeConfig);
  const app = createApp({ store, mailer, config: runtimeConfig });
  const server = app.listen(runtimeConfig.port, () => {
    logger.info('server_started', { status: 200, store: store.kind });
  });

  const shutdown = signal => {
    logger.info('server_stopping', { reason: signal });
    server.close(async () => {
      await store.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return { app, server, store };
}

const launchedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (launchedDirectly) {
  startServer().catch(error => {
    logger.error('server_start_failed', { code: error.code || 'STARTUP_ERROR' });
    console.error(error.message);
    process.exitCode = 1;
  });
}
