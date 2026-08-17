import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Relative base so assets work on GitHub Pages (e.g. loveleet.github.io/lab_live/) and anywhere
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Local dev: proxy /api and /auth to Node. Default localhost:10000; set VITE_DEV_PROXY_TARGET for cloud.
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:10000'

  return {
    base: env.VITE_BASE_PATH || './',
    esbuild: {
      minify: false,
    },
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        '/api/': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/auth/': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
