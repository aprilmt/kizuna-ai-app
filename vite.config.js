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
          },
        },
      },
    },
  }
})
