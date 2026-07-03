import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this project from /economic-freedom-simulator-web/.
export default defineConfig({
  base: '/economic-freedom-simulator-web/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  plugins: [react()],
})
