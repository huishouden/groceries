import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startI18n } from './i18n';
import './index.css';

// Checks for a new deploy hourly so the always-on kitchen tablet picks up updates
// without anyone reinstalling; autoUpdate reloads the page once the new worker activates.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
  },
});

// The language's messages load before the first render, so no English flashes.
void startI18n().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  ),
);
