import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // ספריות כבדות בקבצים נפרדים: נשמרות במטמון בין גרסאות, ומתעדכנות רק כשהן עצמן משתנות
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'firebase'
          if (id.includes('/@hebcal/')) return 'hebcal'
          if (id.includes('/framer-motion/') || id.includes('/react') || id.includes('/scheduler/')) return 'ui'
          return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
