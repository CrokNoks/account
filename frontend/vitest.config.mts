import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // e2e/**/*.test.ts : tests unitaires du garde-fou Playwright ; les parcours (*.spec.ts) restent à Playwright.
    include: ['src/**/*.test.{ts,tsx}', 'e2e/**/*.test.ts'],
    restoreMocks: true,
  },
});
