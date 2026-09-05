import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: 'https://api.zhizengzeng.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/v1'),
          secure: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.VITE_KIZUNA_API_KEY) {
                proxyReq.setHeader('Authorization', `Bearer ${env.VITE_KIZUNA_API_KEY}`)
              }
            })
            proxy.on('error', (err, _req, res) => {
              console.error('LLM proxy error:', err.message)
              if (res && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'Failed to reach upstream API.' }))
              }
            })
          },
        },
      },
    },
  }
})
