import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build output is consumed by the admin worker via the [assets] binding.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../workers/admin/public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
