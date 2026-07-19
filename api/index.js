import { config, validateRuntimeConfig } from '../config.js';
import { createStore } from '../store.js';
import { createMailer } from '../lib/mailer.js';
import { createApp } from '../app.js';

let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const problems = validateRuntimeConfig(config);
      if (problems.length) throw new Error(`Unsafe production configuration: ${problems.join(' ')}`);
      const store = await createStore(config);
      return createApp({ store, mailer: createMailer(config), config });
    })();
  }
  return appPromise;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    appPromise = undefined;
    console.error(JSON.stringify({
      event: 'api_initialization_failed',
      code: error?.code || 'STARTUP_ERROR',
      message: error?.message || 'The API could not initialize.'
    }));
    if (res.headersSent) return;
    res.setHeader('cache-control', 'no-store');
    return res.status(503).json({
      success: false,
      error: 'The service is temporarily unavailable because it could not start.',
      code: 'SERVICE_UNAVAILABLE'
    });
  }
}
