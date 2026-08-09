import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    // Ilova asosiy backendning /app yo'lida beriladi (Tailscale funnel portlari
    // to'lgan: 443 → TDIU, 8443 → backend, 10000 → LiveKit). Asset yo'llari shu
    // prefiks bilan chiqishi shart, aks holda 404 bo'ladi.
    base: '/app/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // 500 kB chegarasi ogohlantirish beradi; bundle ~555 kB (react-markdown,
      // motion, lucide). Kod bo'lish keyingi optimizatsiya bosqichida.
      chunkSizeWarningLimit: 700,
    },
  };
});
