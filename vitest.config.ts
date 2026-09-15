import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_OPENHEX_AGENT_ID': JSON.stringify('test-agent-id'),
    'import.meta.env.VITE_OPENHEX_API_BASE_URL': JSON.stringify('https://api.openhex.tech'),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
