import { loadE2eEnv } from './lib/env';
import { cleanupTestData } from './lib/test-data';

export default async function globalTeardown() {
  loadE2eEnv();
  await cleanupTestData();
}
