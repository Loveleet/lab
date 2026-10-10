import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const LAN_API = 'http://192.168.29.128:10000'
const TAILSCALE_API = 'http://100.80.105.9:10000'
const CLOUD_API = 'http://167.104.222.209:10000'
const LOCAL_API = 'http://localhost:10000'

function probeHealth(baseUrl, timeoutMs) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/health`
  return new Promise((resolve) => {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), timeoutMs)
    fetch(url, { signal: ac.signal })
      .then((res) => resolve(res.ok))
      .catch(() => resolve(false))
      .finally(() => clearTimeout(t))
  })
}

async function resolveProxyTarget(explicit) {
  if (explicit) {
    console.log(`[vite] API proxy (env): ${explicit}`)
    return explicit
  }
  if (await probeHealth(LAN_API, 1500)) {
    console.log(`[vite] API proxy: LAN ${LAN_API}`)
    return LAN_API
  }
  if (await probeHealth(TAILSCALE_API, 4000)) {
    console.log(`[vite] API proxy: Tailscale ${TAILSCALE_API}`)
    return TAILSCALE_API
  }
  if (await probeHealth(CLOUD_API, 4000)) {
    console.log(`[vite] API proxy: cloud ${CLOUD_API}`)
    return CLOUD_API
  }
  console.log(`[vite] API proxy: fallback ${LOCAL_API} (LAN, Tailscale, and cloud not reachable)`)
  return LOCAL_API
}

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = await resolveProxyTarget((env.VITE_DEV_PROXY_TARGET || '').trim())

  return {
    base: env.VITE_BASE_PATH || './',
    esbuild: {
      minify: false,
    },
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: parseInt(env.VITE_DEV_PORT || '5174', 10),
      strictPort: true,
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
