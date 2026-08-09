/**
 * UNUM service worker.
 *
 * Vazifasi: ilovani o'rnatiladigan (installable) qilish va qobiqni oflayn ochish.
 *
 * Muhim: `/api/*` so'rovlari HECH QACHON keshlanmaydi — sog'liq ma'lumotlari va
 * AI javoblari qurilmada eskirgan holda qolib ketmasligi kerak. Faqat statik
 * qobiq (index.html, JS, CSS, ikonkalar) keshlanadi.
 */
// Har deployda oshiring — eski kesh o'chadi va foydalanuvchi eski bundle'da
// qolib ketmaydi. (v1 da aynan shu bo'lgan: soxta kirishli eski kod keshda qolgan.)
const VERSION = 'unum-v16';
const SHELL = '/app/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll([SHELL])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API — hech qachon keshdan berilmaydi
  if (url.pathname.startsWith('/api/')) return;

  // Faqat /app/ doirasidagi statik fayllar
  if (!url.pathname.startsWith('/app/')) return;

  // Navigatsiya: avval tarmoq, ishlamasa keshdagi qobiq (oflayn).
  // `cache: 'no-store'` — brauzerning HTTP keshi ham chetlab o'tiladi,
  // aks holda eski index.html eski bundle'ga ishora qilib qolishi mumkin.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(SHELL, copy));
          return res;
        })
        .catch(() => caches.match(SHELL).then((hit) => hit || Response.error()))
    );
    return;
  }

  // Assetlar hash bilan nomlangan — kesh birinchi, keyin tarmoq
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return res;
        })
    )
  );
});
