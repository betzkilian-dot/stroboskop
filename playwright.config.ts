import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  projects: [
    {
      name: 'edge',
      testIgnore: 'offline.spec.ts',
      use: { channel: 'msedge', baseURL: 'http://localhost:5173' },
    },
    {
      // Offline/PWA-Test gegen den gebauten Stand (Service Worker gibt es nur dort)
      name: 'edge-preview',
      testMatch: 'offline.spec.ts',
      use: { channel: 'msedge', baseURL: 'http://localhost:4173' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
    },
    {
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
