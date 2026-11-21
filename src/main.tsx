import { StrictMode } from 'react'

// Fix for ReactQuill in Vite (global is not defined)
if (typeof window !== 'undefined') {
  (window as any).global = window;
}

import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import './i18n';
import { UserProvider } from './contexts/UserContext'

import { HelmetProvider } from 'react-helmet-async'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isPublicContentQuery, subscribeContentSaved } from './lib/publicContent'




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

subscribeContentSaved(() => {
  void queryClient.invalidateQueries({ predicate: query => isPublicContentQuery(query.queryKey) });
});

import { ToastProvider } from './components/ui/Toast'

// A data router allows editors to protect both normal navigation and browser Back.
// The existing App route tree and provider order remain the same.
const router = createBrowserRouter([{
  path: '*',
  element: <UserProvider><ToastProvider><App /></ToastProvider></UserProvider>,
}]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <RouterProvider router={router} />
      </HelmetProvider>
    </QueryClientProvider>
  </StrictMode>,
)
