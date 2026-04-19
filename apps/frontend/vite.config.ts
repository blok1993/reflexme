import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production preview (e.g. Railway): must listen on 0.0.0.0, use $PORT, and allow
// the public host — otherwise Vite returns "Blocked request. This host is not allowed."
const port = Number(process.env.PORT) || 4173;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
  },
  preview: {
    host: true,
    port,
    strictPort: false,
    allowedHosts: true,
  },
});
