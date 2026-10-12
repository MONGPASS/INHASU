import { StrictMode } from 'react'

// Fix for ReactQuill in Vite (global is not defined)
if (typeof window !== 'undefined') {
  (window as any).global = window;
}

import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import './i18n';
import { UserProvider } from './contexts/UserContext'

import { HelmetProvider } from 'react-helmet-async'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'




const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes (Data stays fresh)
      gcTime: 1000 * 60 * 30,   // 30 minutes (Keep in cache)
      retry: 1,
      refetchOnWindowFocus: false, // Don't refetch on window focus for better UX
    },
  },
})

import { ToastProvider } from './components/ui/Toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <BrowserRouter>
          <UserProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </UserProvider>
        </BrowserRouter>
      </HelmetProvider>
    </QueryClientProvider>
  </StrictMode>,
)
