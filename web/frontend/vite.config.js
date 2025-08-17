import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from root directory
  const envFile = mode === 'production' ? '.env.prod' : '.env.dev'
  const env = loadEnv(mode, '../../', '')
  
  return {
    plugins: [react()],
    envDir: '../../',  // Point to root directory for .env files
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    }
  }
})
