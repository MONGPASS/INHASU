import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

// `npm run dev`의 API는 합성 자료 서버로 보낸다. 운영 D1·R2와 고객 발송에는 연결하지 않는다 (CLAUDE.md 로컬 실행).
const LOCAL_API_PORT = 8804
const LOCAL_API = `http://127.0.0.1:${LOCAL_API_PORT}`

function localAdminDev(): Plugin {
  return {
    name: 'local-admin-dev',
    apply: 'serve',
    configureServer(server) {
      const probe = net.connect(LOCAL_API_PORT, '127.0.0.1')
      probe.once('connect', () => probe.destroy())
      probe.once('error', () => {
        const api = spawn(process.execPath, ['scripts/check-reservation-workspace.mjs', '--serve', '--usability', '--customer-workspace', `--port=${LOCAL_API_PORT}`], { stdio: ['ignore', 'ignore', 'inherit'] })
        // 설정 변경으로 Vite만 재시작할 때는 합성 자료를 유지하고, dev 프로세스가 끝날 때 함께 끈다.
        process.once('exit', () => api.kill())
      })
      // 관리자가 iframe으로 여는 견적 문서는 확장자 없는 주소를 쓴다. 운영의 Pages처럼 public/*.html로 연결한다.
      const publicDir = path.resolve(server.config.publicDir)
      server.middlewares.use((req, _res, next) => {
        const [pathname, query] = (req.url || '').split(/\?(.*)/s)
        try {
          const file = path.join(publicDir, `${decodeURIComponent(pathname)}.html`)
          if (pathname !== '/' && !path.extname(pathname) && file.startsWith(publicDir + path.sep) && fs.existsSync(file)) {
            req.url = `${pathname}.html${query ? `?${query}` : ''}`
          }
        } catch { /* 잘못된 인코딩은 Vite 기본 처리에 맡긴다. */ }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    localAdminDev(),
    ViteImageOptimizer({
      // 견적 시스템 정적 이미지(public/img)는 원본 그대로 배포 — 견적서·확정일정표가 파일을 직접 참조
      exclude: /(^|[\\/])img[\\/]/,
      png: { quality: 80 },
      jpeg: { quality: 80 },
      jpg: { quality: 80 },
      webp: { quality: 80 },
    }),
  ],
  server: {
    proxy: {
      '/api': LOCAL_API,
      '/__local-admin': LOCAL_API,
    },
  },
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
