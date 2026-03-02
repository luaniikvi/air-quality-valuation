import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load .env so proxy can follow API_PORT (and still allow overriding via VITE_PROXY_* env vars).
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.API_PORT || '8080';

  const apiTarget = env.VITE_PROXY_API_TARGET || `http://localhost:${apiPort}`;
  const wsTarget = env.VITE_PROXY_WS_TARGET || `ws://localhost:${apiPort}`;

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      // Make local dev match production URLs (same-origin)
      // - Frontend calls /api
      // - Frontend connects WS at /ws
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/ws': {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
