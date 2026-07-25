import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import './ui/theme.css';
import { App } from './App.js';
import { Landing } from './ui/Landing/Landing.js';

const root = document.getElementById('ui-root');
if (!root) throw new Error('#ui-root not found');

// Маршрутизация без роутера: /app* → игра (грузит Phaser), всё остальное → лендинг.
// Deep-link на /app работает за счёт SPA-rewrite в vercel.json и Vite dev-fallback.
const isApp = window.location.pathname.startsWith('/app');

createRoot(root).render(
  <StrictMode>
    {isApp ? <App /> : <Landing />}
    {/* ТЗ-18: визиты/страны/источники в дашборде Vercel. Скрипт грузится
        только на Vercel-деплое (локально — no-op), собственных данных не
        собирает и на поведение приложения не влияет. */}
    <Analytics />
  </StrictMode>
);
