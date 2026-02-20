import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 3000,
    host: true
  },
  define: {
    'import.meta.env.RUNNINGHUB_API_KEY': JSON.stringify(process.env.RUNNINGHUB_API_KEY)
  }
})
