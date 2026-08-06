import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

const UPDATE_INTERVAL_MS = 5 * 60 * 1000

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Activate the new service worker as soon as it is detected.
    updateSW(true)
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    registration.update()
    window.setInterval(() => {
      registration.update()
    }, UPDATE_INTERVAL_MS)
  },
})

if (typeof window !== 'undefined') {
  console.log('[NAV_TRACE]', new Date().toISOString(), 'main:initial-url', {
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
