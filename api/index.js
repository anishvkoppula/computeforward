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
  const app = await getApp();
  return app(req, res);
}
