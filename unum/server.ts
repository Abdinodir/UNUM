/**
 * UNUM web ilovasining host serveri.
 *
 * Bu server AI'ga to'g'ridan-to'g'ri murojaat QILMAYDI va o'z bazasi ham yo'q.
 * Barcha AI va ma'lumot so'rovlari asosiy UNUM backend'iga (UNUM_API_URL)
 * proksilanadi — u yerda autentifikatsiya, kunlik AI limiti, o'zbek taomlari
 * bazasi va Score dvigateli allaqachon mavjud. Ikkinchi AI qatlamini saqlash
 * xavfsizlik va xarajat jihatidan xato bo'lardi.
 *
 * Xavfsizlik choralari SECURITY.md da batafsil.
 */
import 'dotenv/config';

import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = Number(process.env.PORT || 3020);
const IS_PROD = process.env.NODE_ENV === 'production';

/** Serverda barcha interfeyslarda, aks holda faqat loopback */
const HOST = process.env.HOST || (IS_PROD ? '0.0.0.0' : '127.0.0.1');

/** Asosiy UNUM backend manzili (public funnel URL). Bo'sh bo'lsa proksi o'chiq. */
const API_URL = (process.env.UNUM_API_URL || '').replace(/\/+$/, '');

/** Reverse proxy (Tailscale Funnel) ortida haqiqiy IP ko'rinsin */
app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ------------------------------------------------------------------ */
/* Xavfsizlik sarlavhalari                                             */
/* ------------------------------------------------------------------ */

const CSP = [
  "default-src 'self'",
  // Vite dev rejimida inline/eval kerak; prodda faqat o'z bundle'imiz
  IS_PROD ? "script-src 'self'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // Taom rasmi kameradan blob: sifatida ko'rsatiladi
  "img-src 'self' data: blob:",
  IS_PROD ? "connect-src 'self'" : "connect-src 'self' ws: wss:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  // Sog'liq ilovasi: kamera va mikrofon o'zimizga, qolgan API'lar hech kimga
  res.setHeader(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()'
  );
  if (IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

/* ------------------------------------------------------------------ */
/* Cheklovlar                                                          */
/* ------------------------------------------------------------------ */

app.use(
  '/api/',
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Juda ko'p so'rov. Biroz kuting." },
  })
);

// AI so'rovlari qimmat — bu yerda ham cheklov (asosiy kunlik limit backendda)
app.use(
  '/api/ai/',
  rateLimit({
    windowMs: 60_000,
    max: 12,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Juda ko'p AI so'rovi. Bir daqiqadan keyin urinib ko'ring." },
  })
);

/* ------------------------------------------------------------------ */
/* Asosiy backend'ga proksi                                            */
/* ------------------------------------------------------------------ */

/**
 * Oq ro'yxat: mijoz yo'li → asosiy backenddagi haqiqiy yo'l.
 * Ro'yxatda yo'q har qanday so'rov 404 — bu ochiq proksi emas.
 * Backend tarixiy sabablarga ko'ra `/api/gemini/*` nomini saqlab qolgan
 * (u OpenAI ishlatadi); mijoz tomonida toza `/api/ai/*` ko'rinadi.
 */
const PROXY_ROUTES: Record<string, string> = {
  '/api/ai/coach': '/api/gemini/coach-chat',
  '/api/ai/analyze-photo': '/api/gemini/analyze-photo',
  '/api/ai/transcribe': '/api/gemini/transcribe',
  '/api/ai/parse-meal': '/api/gemini/parse-meal',
  '/api/profile': '/api/profile',
  '/api/summary/today': '/api/summary/today',
  '/api/auth/oauth/google': '/api/auth/oauth/google',
  '/api/auth/oauth/apple': '/api/auth/oauth/apple',
};

app.use('/api/', async (req: Request, res: Response) => {
  if (!API_URL) {
    return res
      .status(503)
      .json({ error: "Backend ulanmagan. .env dagi UNUM_API_URL ni to'ldiring." });
  }

  const route = `/api${req.path === '/' ? '' : req.path}`;
  const upstreamPath = PROXY_ROUTES[route];
  if (!upstreamPath) {
    return res.status(404).json({ error: 'Endpoint topilmadi' });
  }

  try {
    // Faqat zarur sarlavhalar uzatiladi — Cookie, Host, X-Forwarded-* o'tmaydi
    const headers: Record<string, string> = {};
    const auth = req.headers.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) headers.Authorization = auth;
    const contentType = req.headers['content-type'];
    if (typeof contentType === 'string') headers['Content-Type'] = contentType;

    const upstream = await fetch(`${API_URL}${upstreamPath}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : (req as any),
      // Node fetch oqim tanasi uchun majburiy
      duplex: 'half',
      signal: AbortSignal.timeout(30_000),
    } as RequestInit);

    res.status(upstream.status);
    const upstreamType = upstream.headers.get('content-type');
    if (upstreamType) res.setHeader('Content-Type', upstreamType);
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    // Tafsilot faqat serverda qoladi — mijozga ichki ma'lumot bermaymiz
    console.error('proxy error:', err);
    res.status(502).json({ error: "Backend bilan aloqa yo'q" });
  }
});

app.get('/healthz', (_req, res) => res.json({ status: 'ok', app: 'unum-web' }));

/* ------------------------------------------------------------------ */
/* Statik / Vite                                                       */
/* ------------------------------------------------------------------ */

async function start() {
  if (IS_PROD) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { maxAge: '1h', index: false }));
    app.get('*all', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`UNUM web: ${HOST}:${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
    if (!API_URL) console.warn("⚠️  UNUM_API_URL yo'q — /api/* 503 qaytaradi.");
  });
}

void start();
