import './lib/i18n'
import * as Sentry from "@sentry/react";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary'

Sentry.init({
  dsn: "https://1f5bcbfb694d98ee4295f12d9a28364a@o4509807562653696.ingest.us.sentry.io/4509807568224256",
  environment: import.meta.env.MODE, // "development" or "production"
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Performance monitoring (10% sample rate for free plan)
  tracesSampleRate: 0.1,
  // Session replay (10% sample rate)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0, // 100% when error occurs
  // Only send errors in production
  enabled: import.meta.env.PROD,
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
