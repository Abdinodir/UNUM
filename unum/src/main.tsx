import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Service worker — ilovani o'rnatiladigan qiladi va qobiqni oflayn ochadi.
// Faqat HTTPS'da (yoki localhost'da) ro'yxatdan o'tadi.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(() => {
      /* SW bo'lmasa ilova baribir ishlaydi — jim o'tamiz */
    });
  });
}
