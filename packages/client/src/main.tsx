import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/theme.css';
import { App } from './App.js';
import { Landing } from './ui/Landing/Landing.js';

const root = document.getElementById('ui-root');
if (!root) throw new Error('#ui-root not found');

// Routing without a router: /app* → the game (loads Phaser), everything else → the landing.
// Deep links to /app work thanks to the SPA rewrite in nginx.conf and the Vite dev fallback.
const isApp = window.location.pathname.startsWith('/app');

createRoot(root).render(
  <StrictMode>
    {isApp ? <App /> : <Landing />}
  </StrictMode>
);
