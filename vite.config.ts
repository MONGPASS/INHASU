import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

export default defineConfig({
  plugins: [
    react(),
    ViteImageOptimizer({
      // 견적 시스템 정적 이미지(public/img)는 원본 그대로 배포 — 견적서·확정일정표가 파일을 직접 참조
      exclude: /(^|[\\/])img[\\/]/,
      png: { quality: 80 },
      jpeg: { quality: 80 },
      jpg: { quality: 80 },
      webp: { quality: 80 },
    }),
  ],
  build: {
    // dist 비우기는 scripts/clean-dist.mjs 가 한다 (Node 24 의 rmSync 가 한글 파일명에서 충돌)
    emptyOutDir: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts', '@fullcalendar/react', '@fullcalendar/core', '@fullcalendar/daygrid'],
          'vendor-utils': ['@tanstack/react-query', 'dexie', 'dexie-react-hooks'],
        }
      }
    }
  }
})
