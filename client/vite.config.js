import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

//Defines a dev route
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/search': 'http://localhost:3000',
    },
  },
})
