import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Plugin: treat .geojson files as JSON modules (same as .json)
const geojsonPlugin = {
  name: 'vite-plugin-geojson',
  transform(src, id) {
    if (id.endsWith('.geojson')) {
      return { code: `export default ${src}`, map: null }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), geojsonPlugin],
  server: {
    port: 5173,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})
