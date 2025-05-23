import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/orders': 'http://localhost:3001',
      '/api/invoices': 'http://localhost:3003'
    }
  }
})
