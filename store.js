import { FileStore } from './stores/file-store.js';
import { PostgresStore } from './stores/postgres-store.js';

export async function createStore(config) {
  const store = config.databaseUrl
    ? new PostgresStore(config)
    : new FileStore(config);
  await store.init();
  return store;
}
