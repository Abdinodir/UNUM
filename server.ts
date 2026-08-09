// MUST be the first import: it loads .env as a side effect, before any other
// module body runs. db.ts reads DB_PATH and auth.ts reads JWT_SECRET, and
// module evaluation happens in import order — calling dotenv.config() further
// down the file would be too late for both of them.
import 'dotenv/config';

import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import { Profiles, Items, isCollection, Telegram, Users, isPremiumActive } from './db';
import { billingStatus, createCheckout, orderStatus } from './billing';
import { clickPrepare, clickComplete } from './click';
import { listGoals, createGoal, updateGoal, deleteGoal } from './goals';
import {
  listTasks, createTask, updateTask, toggleTask, moveTask, deleteTask,
} from './tasks';
import {
  listHabits, createHabit, updateHabit, checkHabit, deleteHabit,
} from './habits';
import { todayKey, isToday, dayKeyOf } from './day';
import { sanitizeItem, sanitizeSleep } from './sanitize';
import { computeLifeScore, lifeScoreTrend } from './lifescore';
import { listFocus, createFocus, deleteFocus } from './focus';
import { buildReview, predictAll } from './review';
import {
  reviewPrompt, breakdownPrompt, coachPrompt, sanitizeMilestones, sanitizeReview,
  extractJson as extractCoachJson,
} from './coach';
import { PRICE_ANCHORS } from './foods';
import { computeScore } from './score';
import { UnumBot } from './bot';
import {
  register, login, requireAuth, deleteAccount, changePassword,
  assertAuthConfig, mintToken, AuthedRequest,
} from './auth';
import { requestCode, verifyCode } from './otp';
import {
  appleConfigured, googleConfigured, googleLoginStart, googleLoginCallback,
  appleLoginStart, appleLoginCallback,
  oauthTokenLogin, integrationStart, integrationCallback, integrationList,
  integrationDisconnect, clearSessionCookie,
} from './oauth';
import { smsConfigured, balance as smsBalance } from './sms';

// Fail immediately on a bad config rather than at the first login attempt.
assertAuthConfig();

// Create Express app
const app = express();
const PORT = Number(process.env.PORT || 3000);

// Trust the reverse proxy (Tailscale Funnel / nginx) so rate limiting sees the
// real client IP instead of 127.0.0.1.
app.set('trust proxy', 1);

// 6mb covers a compressed phone photo as base64 with headroom; anything larger
// is either a mistake or an attempt to exhaust memory.
app.use(express.json({ limit: '6mb' }));

// Web sessiyasi httpOnly cookie'da keladi (oauth.ts). Mobil ilova Bearer ishlatadi.
app.use(cookieParser());

// CORS. Mobil ilova Bearer sarlavhasi bilan keladi (cookie yubormaydi), shuning
// uchun `*` origin unga xavf tug'dirmaydi — o'g'irlangan token baribir ishlagan
// bo'lardi. Cookie esa HECH QACHON cross-origin yuborilmaydi:
// `Access-Control-Allow-Credentials` berilmaydi va SameSite=Lax qo'yilgan.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/**
 * CSRF himoyasi. Cookie sessiyasi bilan holat o'zgartiruvchi so'rov faqat o'z
 * saytimizdan kelishi mumkin. `SameSite=Lax` allaqachon cross-site POST'da
 * cookie yubormaydi, bu esa ikkinchi qatlam: Origin/Referer boshqa saytniki
 * bo'lsa rad etamiz. Bearer bilan kelgan so'rovlarga tegilmaydi — ularda
 * brauzer avtomatik hech narsa qo'shmaydi, ya'ni CSRF mumkin emas.
 */
app.use('/api/', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

  const usesCookie = !req.headers.authorization && Boolean((req as any).cookies?.unum_session);
  if (!usesCookie) return next();

  const self = (process.env.APP_PUBLIC_URL || '').replace(/\/+$/, '');
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const ok = (origin && origin === self) || (!origin && referer.startsWith(`${self}/`));

  if (!ok) return res.status(403).json({ error: "So'rov manbasi tasdiqlanmadi" });
  next();
});

// ==================== RATE LIMITS ====================
const rl = (windowMs: number, max: number, message: string) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });

// Brute-force / mass-signup protection, keyed by IP.
const authLimiter = rl(
  15 * 60 * 1000, 12,
  "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring."
);

// AI calls cost real money — cap them per account, not per IP.
// Premium accounts get a much higher ceiling; the free tier is what the
// paywall in the app advertises.
const FREE_DAILY_AI = Number(process.env.AI_DAILY_LIMIT_FREE || 12);
const PREMIUM_DAILY_AI = Number(process.env.AI_DAILY_LIMIT || 120);

// Muddati o'tgan obuna premium hisoblanmaydi — `isPremiumActive` buni
// `premiumUntil` bo'yicha hal qiladi.
const isPremium = (userId?: number): boolean =>
  userId != null && isPremiumActive(userId);

const aiLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: (req: any) => (isPremium(req.userId) ? PREMIUM_DAILY_AI : FREE_DAILY_AI),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => `u${req.userId ?? 'anon'}`,
  message: {
    error:
      "Bugungi bepul AI so'rovlari tugadi. Ertaga yangilanadi — yoki Premium bilan cheksiz qiling.",
  },
});

// Broad backstop against scripted abuse of the CRUD endpoints.
const apiLimiter = rl(60 * 1000, 240, "Juda ko'p so'rov. Biroz kuting.");
app.use('/api/', apiLimiter);

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', authLimiter, register);
app.post('/api/auth/login', authLimiter, login);
app.post('/api/auth/change-password', requireAuth, changePassword);
app.delete('/api/account', requireAuth, deleteAccount);

app.get('/api/me', requireAuth, (req: AuthedRequest, res) => {
  const user = Users.byId(req.userId!);
  res.json({ id: req.userId, email: user?.email, name: user?.name });
});

// ==================== GOOGLE / APPLE ORQALI KIRISH ====================
// Ilova qaysi usullarni ko'rsatishini shundan biladi — sozlanmagan tugmani
// ko'rsatib, keyin xato berish yomon tajriba.
app.get('/api/auth/providers', (_req, res) => {
  res.json({ google: googleConfigured(), apple: appleConfigured() });
});

// Web oqimi: brauzer Google'ga ketadi va cookie bilan qaytadi
app.get('/api/auth/oauth/google', authLimiter, googleLoginStart);
app.get('/api/auth/oauth/google/callback', googleLoginCallback(mintToken));

// Apple web oqimi. Qaytish GET emas, POST (form_post) — Apple `scope`
// so'ralganda shuni majburiy qiladi, shuning uchun alohida body parser.
app.get('/api/auth/oauth/apple', authLimiter, appleLoginStart);
app.post(
  '/api/auth/oauth/apple/callback',
  express.urlencoded({ extended: false, limit: '32kb' }),
  appleLoginCallback(mintToken)
);

// Mobil oqimi: native SDK bergan id_token → bizning JWT
app.post('/api/auth/oauth/:provider/token', authLimiter, oauthTokenLogin(mintToken));

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// ==================== INTEGRATSIYALAR (Google Fit / Calendar) ====================
app.get('/api/integrations', requireAuth, integrationList);
app.get('/api/integrations/:provider/connect', requireAuth, integrationStart);
app.get('/api/integrations/google/callback', integrationCallback);
app.delete('/api/integrations/:provider', requireAuth, integrationDisconnect);

// ==================== TELEFON ORQALI KIRISH (SMS OTP) ====================
// Har chaqiruv PUL sarflaydi, shuning uchun IP bo'yicha ham qattiq cheklov.
// Raqam bo'yicha cheklov otp.ts ichida.
const otpLimiter = rl(
  60 * 60 * 1000, 10,
  "Juda ko'p urinish. Bir soatdan keyin qayta urinib ko'ring."
);

app.post('/api/auth/phone/request', otpLimiter, async (req, res) => {
  // smsConfigured() tekshiruvi requestCode ICHIDA — demo raqam SMS'siz
  // ishlashi kerak, aks holda Play tekshiruvchisi kira olmaydi.
  const { phone } = req.body || {};
  const r = await requestCode(String(phone || ''));
  if (!r.ok) {
    // retryAfter bo'lsa — chegara (429). Aks holda sozlama/format xatosi:
    // mijoz "biroz kuting" deb noto'g'ri xabar ko'rsatmasligi uchun ajratamiz.
    const code = r.retryAfter ? 429 : r.error?.includes('sozlanmagan') ? 503 : 400;
    return res.status(code).json({ error: r.error, retryAfter: r.retryAfter });
  }
  res.json({ ok: true });
});

app.post('/api/auth/phone/verify', otpLimiter, async (req, res) => {
  const { phone, code, name } = req.body || {};
  const r = await verifyCode(String(phone || ''), String(code || ''), name);
  if (!r.ok || !r.userId) {
    return res.status(401).json({ error: r.error || "Kod noto'g'ri" });
  }
  const user = Users.byId(r.userId);
  res.json({
    token: mintToken(r.userId),
    user: { id: r.userId, email: user?.email || '', name: user?.name || '' },
    isNew: r.isNew === true,
  });
});

// ==================== TELEGRAM ULANISH ====================
// Ilova kod so'raydi, foydalanuvchi uni botga yuboradi. Parol hech qachon
// Telegram yozishmalariga tushmaydi.
app.post('/api/telegram/code', requireAuth, (req: AuthedRequest, res) => {
  const code = Telegram.createCode(req.userId!);
  res.json({
    code,
    botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
    deepLink: process.env.TELEGRAM_BOT_USERNAME
      ? `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${code}`
      : '',
    expiresInSeconds: 600,
  });
});

app.get('/api/telegram/status', requireAuth, (req: AuthedRequest, res) => {
  res.json({ linked: Telegram.telegramIdFor(req.userId!) != null });
});

app.delete('/api/telegram/link', requireAuth, (req: AuthedRequest, res) => {
  const tgId = Telegram.telegramIdFor(req.userId!);
  if (tgId) Telegram.unlink(tgId);
  res.json({ ok: true });
});

// ==================== OBUNA / TO'LOV (Click) ====================
app.get('/api/billing/status', requireAuth, (req: AuthedRequest, res) => {
  res.json(billingStatus(req.userId!));
});

// Buyurtma ochish — pul bilan bog'liq, shuning uchun alohida cheklov.
const checkoutLimiter = rl(
  60 * 60 * 1000, 20,
  "Juda ko'p to'lov urinishi. Bir soatdan keyin qayta urinib ko'ring."
);

app.post('/api/billing/checkout', requireAuth, checkoutLimiter, (req: AuthedRequest, res) => {
  const { plan, returnUrl } = req.body || {};
  createCheckout(req.userId!, plan, returnUrl, res);
});

app.get('/api/billing/order/:id', requireAuth, (req: AuthedRequest, res) => {
  orderStatus(req.userId!, Number(req.params.id), res);
});

// --- Click callback'lari ---
// Bu ikki manzil Click kabinetiga yoziladi:
//   Prepare  → {APP_PUBLIC_URL}/api/click/prepare
//   Complete → {APP_PUBLIC_URL}/api/click/complete
//
// Autentifikatsiya YO'Q va bo'lishi ham mumkin emas — Click bizning
// tokenimizni bilmaydi. Himoya butunlay `sign_string` (MD5 + secret key)
// tekshiruviga tayanadi, shuning uchun CLICK_SECRET_KEY sizib chiqmasin.
//
// Click ma'lumotni forma sifatida yuboradi; ba'zi sozlamalarda JSON keladi,
// shuning uchun ikkala parser ham turadi.
const clickBody = [
  express.urlencoded({ extended: false, limit: '16kb' }),
  express.json({ limit: '16kb' }),
];

app.post('/api/click/prepare', ...clickBody, clickPrepare);
app.post('/api/click/complete', ...clickBody, clickComplete);

// ==================== DATA ROUTES (per-user, DB-backed) ====================
// Profile (singleton per user)
app.get('/api/profile', requireAuth, (req: AuthedRequest, res) => {
  const data = Profiles.get(req.userId!);
  if (!data) return res.status(404).json({ error: 'Profil topilmadi' });

  // `premium` HISOBLANIB qaytariladi, bazadagi xom qiymat emas.
  //
  // Bazada u muddat tugaganda ham `true` bo'lib qolaveradi (uni o'chiradigan
  // fon jarayoni yo'q, va bo'lishi ham shart emas — haqiqat manbai
  // `premiumUntil`). Flutter ilova aynan shu javobdagi `premium` ni o'qiydi,
  // shuning uchun xom qiymat qaytarilsa obuna tugagach ham "Faol" ko'rinardi.
  res.json({ ...data, premium: isPremiumActive(req.userId!) });
});

app.put('/api/profile', requireAuth, (req: AuthedRequest, res) => {
  const incoming = req.body || {};
  const existing = Profiles.get(req.userId!) || {};

  // The client PUTs the whole profile, so anything it must not control has to
  // be re-applied from the stored copy. Otherwise a patched app could simply
  // send {"premium": true} and unlock everything.
  //
  // `premiumUntil` ham shu ro'yxatda: usiz obunasi tugagan foydalanuvchi
  // o'ziga uzoq muddat yozib yuborib, premiumni cheksiz qilib olardi.
  const data = {
    ...incoming,
    premium: existing.premium === true,
    premiumUntil: existing.premiumUntil ?? null,
  };

  Profiles.set(req.userId!, data);
  res.json(data);
});

// ==================== MAQSADLAR (Goals) ====================
// Umumiy /api/data CRUD dan ATAYLAB alohida — bepul rejadagi maqsad
// chegarasi shu yerda tekshiriladi (qarang: goals.ts sarlavhasidagi izoh).
app.get('/api/goals', requireAuth, (req: AuthedRequest, res) => {
  listGoals(req.userId!, res);
});

app.post('/api/goals', requireAuth, (req: AuthedRequest, res) => {
  createGoal(req.userId!, req.body, res);
});

app.put('/api/goals/:id', requireAuth, (req: AuthedRequest, res) => {
  updateGoal(req.userId!, req.params.id, req.body, res);
});

app.delete('/api/goals/:id', requireAuth, (req: AuthedRequest, res) => {
  deleteGoal(req.userId!, req.params.id, res);
});

// ==================== KUNLIK REJA (Tasks) ====================
app.get('/api/tasks', requireAuth, (req: AuthedRequest, res) => {
  listTasks(req.userId!, req.query.date, res);
});

app.post('/api/tasks', requireAuth, (req: AuthedRequest, res) => {
  createTask(req.userId!, req.body, res);
});

app.put('/api/tasks/:id', requireAuth, (req: AuthedRequest, res) => {
  updateTask(req.userId!, req.params.id, req.body, res);
});

// Checkbox uchun — butun vazifani qayta yubormaslik kerak.
app.post('/api/tasks/:id/toggle', requireAuth, (req: AuthedRequest, res) => {
  toggleTask(req.userId!, req.params.id, res);
});

// Kechikkan vazifani boshqa kunga ko'chirish.
app.post('/api/tasks/:id/move', requireAuth, (req: AuthedRequest, res) => {
  moveTask(req.userId!, req.params.id, (req.body || {}).date, res);
});

app.delete('/api/tasks/:id', requireAuth, (req: AuthedRequest, res) => {
  deleteTask(req.userId!, req.params.id, res);
});

// ==================== ODATLAR (Habits) ====================
app.get('/api/habits', requireAuth, (req: AuthedRequest, res) => {
  listHabits(req.userId!, res);
});

app.post('/api/habits', requireAuth, (req: AuthedRequest, res) => {
  createHabit(req.userId!, req.body, res);
});

app.put('/api/habits/:id', requireAuth, (req: AuthedRequest, res) => {
  updateHabit(req.userId!, req.params.id, req.body, res);
});

// Kunni belgilash. `log` PUT orqali o'zgarmaydi — faqat shu yerdan,
// aks holda mijoz soxta ketma-ketlik yozib yuborishi mumkin edi.
app.post('/api/habits/:id/check', requireAuth, (req: AuthedRequest, res) => {
  checkHabit(req.userId!, req.params.id, (req.body || {}).date, res);
});

app.delete('/api/habits/:id', requireAuth, (req: AuthedRequest, res) => {
  deleteHabit(req.userId!, req.params.id, res);
});

// ==================== FOKUS (Pomodoro) ====================
// Taymer mijozda ishlaydi; server faqat TUGAGAN seansni yozadi.
app.get('/api/focus', requireAuth, (req: AuthedRequest, res) => {
  listFocus(req.userId!, req.query.date, res);
});

app.post('/api/focus', requireAuth, (req: AuthedRequest, res) => {
  createFocus(req.userId!, req.body, res);
});

app.delete('/api/focus/:id', requireAuth, (req: AuthedRequest, res) => {
  deleteFocus(req.userId!, req.params.id, res);
});

// ==================== HISOBOT VA PROGNOZ ====================
// Ikkalasi ham foydalanuvchi jadvalida PREMIUM.
const requirePremium = (req: AuthedRequest, res: any): boolean => {
  if (isPremiumActive(req.userId!)) return true;
  res.json({ locked: true, upgrade: true });
  return false;
};

app.get('/api/review', requireAuth, (req: AuthedRequest, res) => {
  if (!requirePremium(req, res)) return;
  // Faqat haftalik va oylik — oraliq qiymatlar hisobotni tushunarsiz
  // qiladi va har biri kunlarni qaytadan hisoblab serverni band qiladi.
  const days = req.query.period === 'month' ? 30 : 7;
  res.json({ locked: false, ...buildReview(req.userId!, days) });
});

app.get('/api/predictions', requireAuth, (req: AuthedRequest, res) => {
  if (!requirePremium(req, res)) return;
  res.json({ locked: false, predictions: predictAll(req.userId!) });
});

// --- AI qatlami ---
// AI FAQAT yuqoridagi hisoblangan raqamlarni SO'ZGA aylantiradi; raqamni
// o'zi o'ylab topmaydi (sabab: coach.ts sarlavhasidagi izoh).

app.post('/api/review/narrative', requireAuth, aiLimiter, async (req: AuthedRequest, res) => {
  if (!requirePremium(req, res)) return;
  try {
    const period = req.body?.period === 'month' ? 'month' : 'week';
    const review = buildReview(req.userId!, period === 'month' ? 30 : 7);

    // Ma'lumot bo'lmasa AI ga pul sarflamaymiz — aytadigan gapi yo'q.
    if (review.lifeScore.daysWithData === 0 && review.tasks.total === 0) {
      return res.json({
        locked: false, review,
        narrative: {
          summary: "Bu davrda yozuv yo'q, shuning uchun tahlil qilishga narsa yo'q.",
          win: '', problem: '',
          nextWeek: ['Bugundan boshlab kuniga uchta vazifa yozib boring.'],
        },
      });
    }

    const { system, user } = reviewPrompt(review, period);
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    res.json({
      locked: false,
      review,
      narrative: sanitizeReview(extractCoachJson(completion.choices[0]?.message?.content || '{}')),
    });
  } catch (err: any) {
    console.error('review/narrative:', err?.message || err);
    res.status(502).json({ error: aiErrorMessage(err) });
  }
});

app.post('/api/goals/breakdown', requireAuth, aiLimiter, async (req: AuthedRequest, res) => {
  if (!requirePremium(req, res)) return;
  try {
    const title = String(req.body?.title || '').trim().slice(0, 200);
    if (!title) return res.status(400).json({ error: 'Maqsad nomi kerak' });

    const deadline = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.deadline || ''))
      ? String(req.body.deadline)
      : null;

    const today = todayKey();
    const { system, user } = breakdownPrompt(
      title, deadline, String(req.body?.note || '').trim().slice(0, 500), today
    );

    const completion = await getClient().chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const parsed = extractCoachJson(completion.choices[0]?.message?.content || '{}');
    const milestones = sanitizeMilestones(parsed, today, deadline);

    // Bo'sh javob — foydalanuvchiga "muvaffaqiyatli" deb ko'rsatilmasin.
    if (milestones.length === 0) {
      return res.status(502).json({ error: 'AI bosqichlarni ajrata olmadi. Qayta urinib ko\'ring.' });
    }

    res.json({
      milestones,
      note: typeof parsed?.note === 'string' ? parsed.note.trim().slice(0, 500) : '',
    });
  } catch (err: any) {
    console.error('goals/breakdown:', err?.message || err);
    res.status(502).json({ error: aiErrorMessage(err) });
  }
});

app.post('/api/coach/ask', requireAuth, aiLimiter, async (req: AuthedRequest, res) => {
  if (!requirePremium(req, res)) return;
  try {
    const question = String(req.body?.question || '').trim().slice(0, 1000);
    if (!question) return res.status(400).json({ error: 'Savol kerak' });

    const { system, context } = coachPrompt(
      buildReview(req.userId!, 7), predictAll(req.userId!)
    );

    const completion = await getClient().chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Mening ma'lumotlarim:\n${context}\n\nSavolim: ${question}` },
      ],
    });

    res.json({ answer: (completion.choices[0]?.message?.content || '').trim() });
  } catch (err: any) {
    console.error('coach/ask:', err?.message || err);
    res.status(502).json({ error: aiErrorMessage(err) });
  }
});

// ==================== LIFE SCORE ====================
// Foydalanuvchi jadvalida Life Score PREMIUM funksiya. Bepul rejada
// raqam ham, tarkib ham berilmaydi — faqat qulf holati qaytadi, mijoz
// shunga qarab paywall ko'rsatadi.
app.get('/api/lifescore', requireAuth, (req: AuthedRequest, res) => {
  if (!isPremiumActive(req.userId!)) {
    return res.json({ locked: true, upgrade: true });
  }
  const day = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
    ? req.query.date
    : todayKey();
  res.json({ locked: false, ...computeLifeScore(req.userId!, day) });
});

app.get('/api/lifescore/trend', requireAuth, (req: AuthedRequest, res) => {
  if (!isPremiumActive(req.userId!)) {
    return res.json({ locked: true, upgrade: true });
  }
  // 90 kundan uzun so'rov har kunni qaytadan hisoblab serverni behuda
  // band qiladi (lifescore.ts dagi izohga qarang).
  const n = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
  res.json({ locked: false, days: lifeScoreTrend(req.userId!, n) });
});

// Generic collection CRUD: /api/data/:collection
app.get('/api/data/:collection', requireAuth, (req: AuthedRequest, res) => {
  const { collection } = req.params;
  if (!isCollection(collection)) return res.status(404).json({ error: 'Noma\'lum kolleksiya' });
  res.json(Items.list(req.userId!, collection));
});

// A single account should never need more rows than this in one collection;
// the cap stops a runaway client (or a script) from filling the disk.
const MAX_ITEMS_PER_COLLECTION = 20000;

/**
 * Yozuvni tekshiradi. Xato bo'lsa javob YUBORILADI va `null` qaytadi.
 *
 * Bu qatlam bo'lmaganda "108 000 000 qadam" yoki "85 000 000 000 kkal"
 * bemalol bazaga tushib, ball, hisobot va Life Score'ni ma'nosiz qilardi.
 */
/**
 * Kunlik YIG'INDI chegarasi.
 *
 * `sanitize.ts` bitta yozuvni cheklaydi, lekin foydalanuvchi 120 000 ni
 * ikki marta kiritsa kunlik jami 240 000 bo'lib ketardi — aynan shunday
 * bo'ldi. Shu sabab yozuv saqlashdan oldin o'sha kundagi mavjud yig'indi
 * hisoblanadi va yangi qiymat qolgan joyga sig'diriladi.
 */
const DAILY_CAPS: Record<string, Record<string, number>> = {
  activities: { steps: 120_000, activeMinutes: 1_440 },
  water: { amountMl: 10_000 },
  meals: { calories: 15_000 },
  focus: { minutes: 960 },
};

function capDailyTotal(
  userId: number, collection: string, data: Record<string, unknown>, skipId?: string
): string[] {
  const caps = DAILY_CAPS[collection];
  if (!caps) return [];

  const day = dayKeyOf((data as any).timestamp ?? (data as any).date ?? new Date().toISOString());
  const same = (Items.list(userId, collection) as any[]).filter(
    (x) => x.id !== skipId && dayKeyOf(x.timestamp ?? x.date) === day
  );

  const capped: string[] = [];
  for (const [field, max] of Object.entries(caps)) {
    const incoming = Number(data[field]);
    if (!Number.isFinite(incoming) || incoming <= 0) continue;

    const already = same.reduce((sum, x) => sum + (Number(x[field]) || 0), 0);
    const room = Math.max(0, max - already);
    if (incoming > room) {
      data[field] = room;
      capped.push(field);
    }
  }
  return capped;
}

function checkedBody(collection: string, body: unknown, res: any): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ error: "Noto'g'ri ma'lumot formati" });
    return null;
  }

  if (collection === 'sleep') {
    const r = sanitizeSleep(body);
    if ('error' in r) {
      res.status(400).json({ error: r.error });
      return null;
    }
    return r.data;
  }

  const { data, clamped } = sanitizeItem(collection, body);
  if (clamped.length) {
    console.log(`[sanitize] ${collection}: cheklandi → ${clamped.join(', ')}`);
  }
  return data;
}

app.post('/api/data/:collection', requireAuth, (req: AuthedRequest, res) => {
  const { collection } = req.params;
  if (!isCollection(collection)) return res.status(404).json({ error: 'Noma\'lum kolleksiya' });

  if (Items.count(req.userId!, collection) >= MAX_ITEMS_PER_COLLECTION) {
    return res.status(429).json({ error: 'Bu bo\'limda yozuvlar chegarasiga yetdingiz' });
  }

  const data = checkedBody(collection, req.body, res);
  if (!data) return;

  const capped = capDailyTotal(req.userId!, collection, data);
  if (capped.length) {
    console.log(`[sanitize] ${collection}: kunlik yig'indi cheklandi → ${capped.join(', ')}`);
  }
  res.json(Items.create(req.userId!, collection, data));
});

app.put('/api/data/:collection/:id', requireAuth, (req: AuthedRequest, res) => {
  const { collection, id } = req.params;
  if (!isCollection(collection)) return res.status(404).json({ error: 'Noma\'lum kolleksiya' });

  const data = checkedBody(collection, req.body, res);
  if (!data) return;

  // Yangilashda o'z yozuvini yig'indidan chiqaramiz, aks holda u
  // ikki marta sanalib, chegara noto'g'ri hisoblanardi.
  capDailyTotal(req.userId!, collection, data, id);
  res.json(Items.update(req.userId!, collection, id, data));
});

app.delete('/api/data/:collection/:id', requireAuth, (req: AuthedRequest, res) => {
  const { collection, id } = req.params;
  if (!isCollection(collection)) return res.status(404).json({ error: 'Noma\'lum kolleksiya' });
  Items.remove(req.userId!, collection, id);
  res.json({ ok: true });
});

/**
 * Bugungi yig'ma holat: ball, komponentlar, kunlik ko'rsatkichlar.
 * Telegram bot shu endpointdan foydalanadi — shunda ilova va bot bir xil
 * raqamni ko'rsatadi.
 */
app.get('/api/summary/today', requireAuth, (req: AuthedRequest, res) => {
  const uid = req.userId!;
  const profile = Profiles.get(uid) || {};
  // Kun foydalanuvchi mintaqasida hisoblanadi, UTC da emas — aks holda
  // yarim kechadan keyingi 5 soat ichida bot kechagi kunni ko'rsatardi
  // (qarang: day.ts).
  const meals = Items.list(uid, 'meals').filter((m: any) => isToday(m.timestamp));
  const water = Items.list(uid, 'water')
    .filter((w: any) => isToday(w.timestamp))
    .reduce((s: number, w: any) => s + (Number(w.amountMl) || 0), 0);
  const acts = Items.list(uid, 'activities').filter((a: any) => isToday(a.timestamp));

  const sum = (f: (m: any) => number) =>
    meals.reduce((s: number, m: any) => s + (Number(f(m)) || 0), 0);

  const score = computeScore({
    calories: sum((m) => m.calories),
    targetCalories: Number(profile.targetCalories) || 2200,
    protein: sum((m) => m.protein),
    targetProtein: Number(profile.targetProtein) || 126,
    vegServings: sum((m) => m.vegServings),
    sugar: sum((m) => m.sugar),
    upfCalories: meals
      .filter((m: any) => Number(m.nova) >= 4)
      .reduce((s: number, m: any) => s + (Number(m.calories) || 0), 0),
    waterMl: water,
    targetWaterMl: Number(profile.targetWaterMl) || 2500,
    steps: acts.reduce((s: number, a: any) => s + (Number(a.steps) || 0), 0),
    activeMinutes: acts.reduce(
      (s: number, a: any) => s + (Number(a.durationMinutes) || 0), 0),
  });

  res.json({
    date: todayKey(),
    score,
    profile: {
      name: profile.name || '',
      streak: profile.streak || 0,
      level: profile.level || 1,
      xp: profile.xp || 0,
      targetCalories: profile.targetCalories || 2200,
      targetProtein: profile.targetProtein || 126,
      targetWaterMl: profile.targetWaterMl || 2500,
      onboarded: profile.onboarded === true,
    },
    totals: {
      calories: Math.round(sum((m) => m.calories)),
      protein: Math.round(sum((m) => m.protein)),
      carbs: Math.round(sum((m) => m.carbs)),
      fat: Math.round(sum((m) => m.fat)),
      sugar: Math.round(sum((m) => m.sugar)),
      sodium: Math.round(sum((m) => m.sodium)),
      vegServings: Number(sum((m) => m.vegServings).toFixed(1)),
      cost: Math.round(sum((m) => m.cost)),
      water: Math.round(water),
      meals: meals.length,
      // Qadam va faol daqiqa ham kerak: web ilova shu javobdan
      // ko'rsatkichlarni quradi, aks holda ular soxta qolardi.
      steps: acts.reduce((s: number, a: any) => s + (Number(a.steps) || 0), 0),
      activeMinutes: acts.reduce((s: number, a: any) => s + (Number(a.activeMinutes) || 0), 0),
    },
  });
});

// Initialize OpenAI client
const apiKey = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

let openai: OpenAI | null = null;

if (apiKey) {
  openai = new OpenAI({ apiKey });
} else {
  console.warn('⚠️ OPENAI_API_KEY is missing from environment. AI features will fallback to simulation.');
}

const getClient = (): OpenAI => {
  if (!openai) {
    throw new Error('OpenAI API is not configured. Please add OPENAI_API_KEY to your environment.');
  }
  return openai;
};

// Helper: turn an OpenAI error into a clear Uzbek message for the app
function aiErrorMessage(err: any): string {
  const status = err?.status || err?.response?.status;
  const raw = String(err?.message || err || 'Noma\'lum xato');
  if (status === 429 || /quota|billing|insufficient/i.test(raw)) {
    return "OpenAI hisobingizda kredit tugagan yoki billing sozlanmagan (429). Real AI ishlashi uchun platform.openai.com/billing sahifasida to'lov usuli/kredit qo'shing.";
  }
  if (status === 401 || /api key|unauthorized|invalid/i.test(raw)) {
    return "OpenAI API kaliti noto'g'ri yoki muddati tugagan (401). .env dagi OPENAI_API_KEY ni tekshiring.";
  }
  return `AI xatosi: ${raw}`;
}

const num = (v: any, fallback = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/**
 * Sanity-check the model's nutrition JSON before it reaches the app.
 *
 * The model is reliable on macros but slippery on units: asked for a price in
 * so'm it will sometimes answer "22" meaning 22 000. No real meal in Uzbekistan
 * costs under 1000 so'm, so a small positive number is a thousands figure and
 * gets scaled. Everything else is coerced to a number and clamped to a
 * plausible range so a bad response cannot poison the Score.
 */
function normalizeNutrition(raw: any): any {
  const out = { ...raw };

  out.calories = num(raw.calories);
  out.protein = num(raw.protein);
  out.carbs = num(raw.carbs);
  out.fat = num(raw.fat);
  out.sugar = num(raw.sugar);
  out.fiber = num(raw.fiber);
  out.sodium = num(raw.sodium);
  out.vegServings = Math.min(10, num(raw.vegServings));

  const nova = Math.round(num(raw.novaScore ?? raw.nova, 1));
  out.novaScore = Math.min(4, Math.max(1, nova));
  out.nova = out.novaScore;

  let cost = num(raw.cost);
  if (cost > 0 && cost < 1000) cost = cost * 1000;
  // Bir kishilik taom 500 ming so'mdan oshmaydi — bu ham birlik xatosi.
  if (cost > 500000) cost = Math.round(cost / 1000) * 1000;
  out.cost = Math.round(cost);

  // Ichilgan suyuqlik. Model ba'zan litrda beradi ("1.5") — ml ga o'giramiz.
  // 6 litrdan ortig'i bir o'tirishda ishonchsiz, kesamiz: aks holda bitta
  // xato tahlil kunlik suv me'yorini soxta "bajarilgan" qilib qo'yadi.
  let water = num(raw.waterMl);
  if (water > 0 && water <= 6) water = water * 1000;
  out.waterMl = Math.min(6000, Math.round(water));

  return out;
}

// Helper: extract JSON object from a model response (handles accidental code fences)
function extractJson(text: string): any {
  if (!text) return {};
  let clean = text.trim();
  // Strip markdown code fences if present
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    // Try to grab the first {...} block
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return {};
  }
}

// ==================== API ENDPOINTS ====================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(apiKey), model: MODEL });
});

// 1. Natural Language Meal/Inventory Logger
app.post('/api/gemini/parse-meal', requireAuth, aiLimiter, async (req, res) => {
  try {
    const { text, type = 'lunch' } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Taom matni kiritilishi kerak' });
    }
    if (text.length > 1000) {
      return res.status(400).json({ error: 'Matn juda uzun (maksimum 1000 belgi)' });
    }

    console.log(`[AI] Parsing meal: "${text}"`);

    if (!apiKey) {
      console.log('[AI] Simulating meal parsing (API key missing)');
      return res.json(simulateMealParsing(text, type));
    }

    const systemPrompt = `Siz O'zbekiston oshxonasini yaxshi biladigan professional oziqlanish mutaxassisisiz.
Foydalanuvchi tabiiy tilda (asosan o'zbek tilida) yozgan taom tavsifini tahlil qiling.

Mavjud o'lchov birliklari: 'kg', 'grams', 'pieces'.
Umumiy hajmlarni standart birliklarga o'giring: "bir kosa osh" ~250 g, "bitta somsa" ~150 g,
"bitta patir non" ~200 g, "bitta piyola choy" ~200 ml, "bitta tovuq ko'kragi" ~150 g, "4 tuxum" — 4 dona.

MUHIM — quyidagi qiymatlarni ham albatta bering:
- sugar: umumiy shakar (g). Gazli ichimlik, shirinlik, murabbo, paket sharbatda yuqori.
- fiber: kletchatka (g). Sabzavot, meva, dukkakli, to'liq donli mahsulotlarda bo'ladi.
- sodium: natriy (mg). Tayyor taom, kolbasa, tuzlangan mahsulot va fast food uchun yuqori (400-1500).
- vegServings: taomdagi sabzavot/meva portsiyalari (1 portsiya = 80 g). Osh ~0.5,
  cho'pon salat ~1.5, somsa ~0.2, sof go'sht 0.
- novaScore: 1-4 qayta ishlanganlik darajasi. 1 = tabiiy, 2 = yog'/shakar/tuz,
  3 = non, pishloq, tayyor milliy taom, 4 = ULTRA-qayta ishlangan (gazli ichimlik, chipsi,
  kolbasa, instant lag'mon, fast food, sanoat shirinliklari).
- cost: taom narxi O'ZBEK SO'MIDA, TO'LIQ SON sifatida. Masalan yigirma ikki ming
  so'm bo'lsa 22000 deb yozing — 22 emas, "22 ming" emas. Toshkent narx tayanchi:
  ${PRICE_ANCHORS}
- waterMl: ICHILGAN SUYUQLIK hajmi millilitrda. Faqat ichimlik bo'lsa to'ldiring,
  aks holda 0. Standart hajmlar: piyola choy 200, stakan 250, chelak/butilka
  0.5 l = 500, 1 l = 1000, 1.5 l = 1500, energetik banka 250-500.
  Sof suv, mineral suv, choy, qahva — kaloriyasi 0 (yoki juda kam) va
  novaScore = 1. Shishadagi yoki baklashkadagi suv ham NOVA 1 — idishi
  plastik bo'lgani suvni qayta ishlangan qilmaydi.
  Gazli ichimlik va energetik: waterMl ni ham bering, LEKIN shakar va
  novaScore=4 ni ham to'g'ri ko'rsating — bu suv o'rnini bosmaydi.

analysis: maksimum 2 gap, aniq va foydali maslahat.
Barcha matnli qiymatlarni (name, analysis, tarkib nomlari) O'ZBEK tilida qaytaring.

Javobni QAT'IY quyidagi JSON sxemasi bo'yicha qaytaring, markdown ishlatmang:
{
  "name": string,
  "components": [{ "name": string, "amount": number, "unit": "kg"|"grams"|"pieces" }],
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "sugar": number,
  "fiber": number,
  "sodium": number,
  "vegServings": number,
  "novaScore": number,
  "cost": number,
  "waterMl": number,
  "analysis": string
}`;

    const completion = await getClient().chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Ushbu taom matnini tahlil qiling: "${text}". Taom turi: ${type}.` }
      ],
    });

    res.json(normalizeNutrition(extractJson(completion.choices[0]?.message?.content || '{}')));

  } catch (err: any) {
    console.error('Error in parse-meal:', err?.message || err);
    res.status(502).json({ error: aiErrorMessage(err) });
  }
});

// 2. Personalized AI Meal Planner based on goals & current inventory
app.post('/api/gemini/generate-meal-plan', requireAuth, aiLimiter, async (req, res) => {
  try {
    const { profile, inventory } = req.body;

    if (!profile) {
      return res.status(400).json({ error: 'User Profile is required' });
    }

    console.log('[AI] Generating personalized meal plan...');

    if (!apiKey) {
      console.log('[AI] Simulating meal planning (API key missing)');
      return res.json(simulateMealPlanning(profile, inventory));
    }

    const inventoryList = (inventory || [])
      .map((item: any) => `- ${item.name}: ${item.currentQuantity} ${item.unit} qoldi`)
      .join('\n');

    const systemPrompt = `Siz professional oziqlanish mutaxassisi va oshpazsiz. Foydalanuvchi maqsadlari va joriy oshxona zaxirasiga mos kunlik ovqatlanish rejasini tuzasiz.
Barcha matnli qiymatlarni O'ZBEK tilida qaytaring.

Javobni QAT'IY quyidagi JSON sxemasi bo'yicha qaytaring (markdownsiz). Har bir taom (breakfast, lunch, dinner, snack) quyidagi ko'rinishda:
{ "name": string, "description": string, "calories": number, "protein": number, "carbs": number, "fat": number, "ingredients": [{ "name": string, "amount": number, "unit": "kg"|"grams"|"pieces" }] }

To'liq javob:
{
  "meals": { "breakfast": Meal, "lunch": Meal, "dinner": Meal, "snack": Meal },
  "totalNutrients": { "calories": number, "protein": number, "carbs": number, "fat": number },
  "estimatedCost": number
}`;

    const userPrompt = `Quyidagi profil uchun shaxsiy kunlik ovqatlanish rejasini tuzing:
- Maqsad kaloriya: ${profile.targetCalories} kkal
- Maqsad oqsil: ${profile.targetProtein}g
- Maqsad uglevod: ${profile.targetCarbs}g
- Maqsad yog': ${profile.targetFat}g
- Parhez turi: ${profile.preferredDiet}

Foydalanuvchining hozirgi oshxona zaxirasi:
${inventoryList || 'Bo\'sh (hech narsa yo\'q)'}

Ko'rsatmalar:
1. Aynan to'rtta taom bering: breakfast, lunch, dinner, snack.
2. Isrofni kamaytirish uchun zaxiradagi mahsulotlarga tayaning (Tovuq go'shti, Tuxum, Guruch, Tvorog, Brokkoli, Bodring, Pomidor, Grechka).
3. Miqdorlarni standart birliklarda ('kg', 'grams', 'pieces') bering.
4. Umumiy oziqlanish qiymatini maqsad profilga imkon qadar yaqin saqlang.
5. Kunlik oziq-ovqat uchun realistik dollar narxini bering.`;

    const completion = await getClient().chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
    });

    res.json(extractJson(completion.choices[0]?.message?.content || '{}'));

  } catch (err: any) {
    console.error('Error in generate-meal-plan:', err?.message || err);
    res.status(502).json({ error: aiErrorMessage(err) });
  }
});

// 3. AI Coach chat dialogue
app.post('/api/gemini/coach-chat', requireAuth, aiLimiter, async (req, res) => {
  try {
    const { messages: allMessages, profile, inventory, logsToday } = req.body;

    if (!allMessages || !Array.isArray(allMessages)) {
      return res.status(400).json({ error: 'Messages list is required' });
    }

    // Only the tail of the conversation is worth sending: it keeps token cost
    // bounded no matter how long the chat history grows on the device.
    const messages = allMessages
      .slice(-12)
      .map((m: any) => ({ ...m, text: String(m?.text ?? '').slice(0, 2000) }));

    console.log('[AI] Generating coach reply...');

    if (!apiKey) {
      console.log('[AI] Simulating coach chat (API key missing)');
      return res.json({ text: simulateCoachReply(messages, inventory, logsToday) });
    }

    const inventoryList = (inventory || [])
      .map((item: any) => `- ${item.name}: ${item.currentQuantity} ${item.unit} qoldi (boshlang'ich ${item.initialQuantity})`)
      .join('\n');

    const logsSummary = logsToday
      ? [
          `UNUM Score: ${logsToday.unumScore ?? 'hali hisoblanmagan'}${logsToday.unumScore != null ? '/100' : ''}`,
          logsToday.scoreWeakest ? `Eng ko'p ball yo'qotilgan bo'lim: ${logsToday.scoreWeakest}` : '',
          `Kaloriya: ${logsToday.calories}/${profile?.targetCalories} kkal, Oqsil: ${logsToday.protein}/${profile?.targetProtein} g`,
          `Shakar: ${logsToday.sugar} g (me'yor 25 g), Kletchatka: ${logsToday.fiber} g, Natriy: ${logsToday.sodium} mg`,
          `Sabzavot/meva: ${logsToday.vegServings} / 5 portsiya`,
          `Suv: ${logsToday.water} ml, Qadam: ${logsToday.steps ?? 0}`,
        ].filter(Boolean).join('\n')
      : 'Bugun hali hech narsa kiritilmagan.';

    const systemInstruction = `Siz "UNUM AI Kouch" — foydalanuvchining shaxsiy profilaktik sog'liq maslahatchisisiz.

UNUM'ning markazida "UNUM Score" turadi — kunlik 0..100 ball. U 6 qismdan iborat:
oqsil (20), sabzavot va meva (20), shakar (15), tabiiy ovqat ya'ni ultra-qayta
ishlangan ovqatning kamligi (15), suv (10), harakat (20).
Sizning asosiy vazifangiz — foydalanuvchiga BALLNI QANDAY KO'TARISHNI aniq aytish.

Har doim O'ZBEK tilida javob bering.

Kontekst:
- Profil: Kaloriya maqsadi ${profile?.targetCalories} kkal, Oqsil maqsadi ${profile?.targetProtein} g, Parhez: ${profile?.preferredDiet}, Oylik oziq-ovqat byudjeti: ${profile?.budgetMonthly} so'm.
- Bugungi ko'rsatkichlar:
${logsSummary}
- Muzlatgich zaxirasi:
${inventoryList || 'Kiritilmagan'}

Javob berish qoidalari:
1. Do'stona, ammo aniq murabbiy ohangi. 4-5 gapdan oshmasin.
2. HAR DOIM aniq, bajariladigan qadam bering — "sog'lom ovqatlaning" emas, balki
   "kechqurun cho'pon salat va 2 ta tuxum qo'shsangiz, ball 79 ga chiqadi".
3. O'zbek taomlari bilan ishlang: osh, somsa, lag'mon, non, tvorog, qatiq, mosh.
4. Narxlarni SO'MDA ayting.
5. Rag'batlantiring, ammo yolg'on maqtov qilmang.
6. Siz shifokor EMASSIZ. Hech qachon tashxis qo'ymang, dori tavsiya qilmang va
   "sizda diabet bor" kabi gaplarni aytmang. Zarur bo'lsa shifokorga murojaat
   qilishni maslahat bering.
Markdown formatidan chiroyli foydalaning.`;

    const chatMessages = [
      { role: 'system' as const, content: systemInstruction },
      ...messages.map((m: any) => ({
        role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: String(m.text || '')
      }))
    ];

    const completion = await getClient().chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages: chatMessages,
    });

    res.json({ text: completion.choices[0]?.message?.content || 'Kechirasiz, fikrimni shakllantirishda muammo bo\'ldi. Keyingi savolingiz nima?' });

  } catch (err: any) {
    console.error('Error in coach-chat:', err?.message || err);
    res.status(502).json({ error: aiErrorMessage(err) });
  }
});

// 4. AI Food Photo Analyzer (Vision)
app.post('/api/gemini/analyze-photo', requireAuth, aiLimiter, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Rasm yuborilmadi' });
    }
    // ~4 MB of raw image once base64 overhead is removed.
    if (imageBase64.length > 5_600_000) {
      return res.status(413).json({ error: 'Rasm juda katta (maksimum 4 MB)' });
    }

    console.log('[AI] Analyzing uploaded food photo...');

    if (!apiKey) {
      setTimeout(() => {
        res.json({
          name: 'Guruch va brokkoli bilan grilda pishirilgan tovuq ko\'kragi',
          estimatedWeightGrams: 350,
          calories: 410,
          protein: 48,
          carbs: 32,
          fat: 8,
          confidenceScore: 0.94,
          detectedComponents: [
            { name: 'Tovuq go\'shti (ko\'krak)', amount: 150, unit: 'grams' },
            { name: 'Oq guruch', amount: 120, unit: 'grams' },
            { name: 'Brokkoli', amount: 80, unit: 'grams' }
          ],
          feedback: 'Ajoyib toza tarelka aniqlandi! Makronutrientlarning mukammal nisbati va brokkolidan boy kletchatka.'
        });
      }, 1500);
      return;
    }

    // Ensure a proper data URL for the vision API
    const dataUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64.replace(/^data:image\/\w+;base64,/, '')}`;

    const systemPrompt = `Siz oziq-ovqat rasmlarini tahlil qiluvchi mutaxassissiz va O'zbekiston
milliy taomlarini (osh, somsa, lag'mon, manti, norin, shashlik, mastava, dimlama, cho'pon salat)
yaxshi taniysiz. Barcha matnni O'ZBEK tilida qaytaring.

sugar (g), fiber (g), sodium (mg), vegServings (1 portsiya = 80 g sabzavot/meva) va
novaScore (1 = tabiiy ... 4 = ultra-qayta ishlangan) qiymatlarini ham albatta bering.
cost — taomning O'ZBEK SO'MIDAGI taxminiy narxi. Narx tayanchi: ${PRICE_ANCHORS}

RASMDA ICHIMLIK BO'LSA (suv shishasi, baklashka, piyola choy, energetik banka,
gazli ichimlik, sharbat) — uni ham xuddi taom kabi tahlil qiling:
- waterMl: idishdagi suyuqlik hajmi ml da. Yorliqdagi hajmni o'qing (0,5 L → 500,
  1,5 L → 1500, 1 L → 1000). Ko'rinmasa idish o'lchamidan taxmin qiling:
  piyola 200, stakan 250, energetik banka 250-500, baklashka 1000-2000.
- Sof suv: calories 0, protein 0, carbs 0, fat 0, sugar 0, novaScore 1.
- Energetik va gazli ichimlik: shakarni ANIQ bering (odatda 100 ml da 10-11 g,
  ya'ni 500 ml bankada ~50 g), novaScore 4, waterMl ni ham bering.
- name maydonida idish emas, ichimlik nomini yozing: "Suv (0,5 L)",
  "Energetik ichimlik (0,5 L)".
Ichimlik bo'lmasa waterMl = 0.

Javobni QAT'IY quyidagi JSON sxemasi bo'yicha qaytaring (markdownsiz):
{
  "name": string,
  "estimatedWeightGrams": number,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "sugar": number,
  "fiber": number,
  "sodium": number,
  "vegServings": number,
  "novaScore": number,
  "cost": number,
  "waterMl": number,
  "confidenceScore": number,
  "detectedComponents": [{ "name": string, "amount": number, "unit": "kg"|"grams"|"pieces" }],
  "feedback": string
}`;

    const completion = await getClient().chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Ushbu rasmni tahlil qiling — bu taom YOKI ichimlik bo'lishi mumkin. Baholang:
1. Rasmda qanday taom yoki ichimlik tasvirlangan.
2. Tarelkaning umumiy taxminiy og'irligi (grammda); ichimlik bo'lsa hajmi (waterMl).
3. Makrolar (Kaloriya, Oqsil, Uglevod, Yog').
4. Taomni alohida tarkibiy qismlarga ajrating: Tovuq go'shti (ko'krak), Oq guruch, Grechka, Tuxum, Tvorog, Brokkoli, Bodring, Pomidor.`
            },
            { type: 'image_url', image_url: { url: dataUrl } }
          ] as any
        }
      ],
    });

    res.json(normalizeNutrition(extractJson(completion.choices[0]?.message?.content || '{}')));

  } catch (err: any) {
    console.error('Error in analyze-photo:', err?.message || err);
    res.status(502).json({ error: aiErrorMessage(err) });
  }
});

// 5. Ovozli xabarni matnga aylantirish (Telegram bot uchun)
app.post('/api/gemini/transcribe', requireAuth, aiLimiter, async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Audio yuborilmadi' });
    }
    if (audioBase64.length > 8_000_000) {
      return res.status(413).json({ error: 'Ovozli xabar juda uzun' });
    }
    if (!apiKey) return res.status(503).json({ error: 'AI sozlanmagan' });

    const buf = Buffer.from(audioBase64, 'base64');
    // Telegram ovozli xabarlari OGG/Opus formatida keladi.
    const ext = (mimeType || '').includes('mpeg') ? 'mp3' : 'ogg';
    const file = new File([new Uint8Array(buf)], `voice.${ext}`, {
      type: mimeType || 'audio/ogg',
    });

    // DIQQAT: `language: 'uz'` YUBORMANG.
    //
    // OpenAI whisper-1 o'zbek NUTQINI tushunadi, lekin `language` parametri
    // 'uz' ni qabul qilmaydi va butun so'rovni 400 bilan rad etadi:
    //   whisper-1          → "Language 'uz' is not supported."
    //   gpt-4o-transcribe  → "Language code 'uz' is not recognized.
    //                         Try adding the language name to your prompt."
    // Ya'ni bot ovozli xabarlari umuman ishlamay qolgan edi.
    //
    // OpenAI tavsiya qilgan yechim — tilni PROMPT orqali bildirish. Prompt
    // ayni paytda ikki vazifani bajaradi: tilni belgilaydi va tez-tez
    // uchraydigan atamalarni (taom nomlari, "ming so'm") to'g'ri yozdiradi.
    //
    // Model ham almashtirildi: whisper-1 o'zbekchani turkcha yoki kirillga
    // burib yuboradi ("Ben bugün tuşlukta otuz beş mingsomla..."), gpt-4o-
    // transcribe esa aynan to'g'ri yozadi. Narxi bir xil ($0.006/daq).
    // Mini variant arzonroq, lekin xato qiladi ("ayran", "otdiz").
    const out = await getClient().audio.transcriptions.create({
      file: file as any,
      model: process.env.OPENAI_STT_MODEL || 'gpt-4o-transcribe',
      prompt:
        "Bu yozuv o'zbek tilida (Uzbek language). Ovqat va xarajat haqida: " +
        "osh, somsa, lag'mon, manti, norin, non, choy, so'm, ming, porsiya, " +
        "kosa, dona, nonushta, tushlik, kechki ovqat.",
    });

    res.json({ text: (out as any).text || '' });
  } catch (err: any) {
    console.error('Error in transcribe:', err?.message || err);
    res.status(502).json({ error: aiErrorMessage(err) });
  }
});

// ==================== SIMULATION UTILS ====================

function simulateMealParsing(text: string, _type: string) {
  const clean = text.toLowerCase();

  let name = 'Qo\'lda kiritilgan taom';
  let calories = 350;
  let protein = 25;
  let carbs = 30;
  let fat = 12;
  let cost = 3.50;
  const components: any[] = [];

  if ((clean.includes('tovuq') || clean.includes('chicken')) && (clean.includes('guruch') || clean.includes('rice'))) {
    name = 'Tovuq ko\'kragi va oq guruch';
    calories = 525; protein = 66; carbs = 42; fat = 7.6; cost = 2.85;
    components.push(
      { name: 'Tovuq go\'shti (ko\'krak)', amount: 200, unit: 'grams' },
      { name: 'Oq guruch', amount: 150, unit: 'grams' }
    );
  } else if (clean.includes('tovuq') || clean.includes('chicken')) {
    name = 'Qovurilgan tovuq ko\'kragi';
    calories = 330; protein = 62; carbs = 0; fat = 7.2; cost = 2.40;
    components.push({ name: 'Tovuq go\'shti (ko\'krak)', amount: 200, unit: 'grams' });
  } else if (clean.includes('guruch') || clean.includes('rice')) {
    name = 'Bug\'da pishirilgan guruch';
    calories = 195; protein = 4; carbs = 42; fat = 0.5; cost = 0.45;
    components.push({ name: 'Oq guruch', amount: 150, unit: 'grams' });
  } else if (clean.includes('tuxum') || clean.includes('egg')) {
    let pieces = 4;
    const match = clean.match(/(\d+)\s*(tuxum|egg)/);
    if (match) pieces = parseInt(match[1], 10);
    name = `${pieces} dona qaynatilgan tuxum`;
    calories = pieces * 70; protein = pieces * 6.5; carbs = pieces * 0.4; fat = pieces * 5; cost = pieces * 0.25;
    components.push({ name: 'Tuxum', amount: pieces, unit: 'pieces' });
  } else if (clean.includes('grechka')) {
    name = 'Qaynatilgan grechka';
    calories = 343; protein = 13; carbs = 71; fat = 3.4; cost = 0.80;
    components.push({ name: 'Grechka', amount: 100, unit: 'grams' });
  } else if (clean.includes('tvorog')) {
    name = 'Yangi tvorog';
    calories = 196; protein = 22; carbs = 6.8; fat = 8.6; cost = 1.20;
    components.push({ name: 'Tvorog', amount: 200, unit: 'grams' });
  } else if (clean.includes('brokkoli')) {
    name = 'Bug\'da pishirilgan brokkoli';
    calories = 34; protein = 2.8; carbs = 7; fat = 0.4; cost = 0.75;
    components.push({ name: 'Brokkoli', amount: 150, unit: 'grams' });
  } else if (clean.includes('bodring') || clean.includes('pomidor')) {
    name = 'Bodring va pomidor salatasi';
    calories = 45; protein = 1.5; carbs = 9; fat = 0.3; cost = 1.10;
    if (clean.includes('bodring')) components.push({ name: 'Bodring', amount: 150, unit: 'grams' });
    if (clean.includes('pomidor')) components.push({ name: 'Pomidor', amount: 150, unit: 'grams' });
  } else {
    const matchGrams = clean.match(/(\d+)\s*g/);
    const amount = matchGrams ? parseInt(matchGrams[1], 10) : 100;
    name = 'Muvozanatli taom';
    components.push({ name: 'Tvorog', amount, unit: 'grams' });
  }

  return {
    name, components, calories, protein, carbs, fat, cost,
    analysis: 'Bu taom juda foydali ko\'rinadi! Makronutrientlar muvozanati ajoyib. Mashg\'ulot davomida yetarlicha suv ichishni unutmang.'
  };
}

function simulateMealPlanning(_profile: any, _inventory: any[]) {
  return {
    meals: {
      breakfast: {
        name: 'Yuqori oqsilli tvorog salatasi',
        description: 'Kazein oqsiliga boy va bodringdan namlik beruvchi yengil nonushta.',
        calories: 226, protein: 23, carbs: 11, fat: 9,
        ingredients: [
          { name: 'Tvorog', amount: 200, unit: 'grams' },
          { name: 'Bodring', amount: 100, unit: 'grams' }
        ]
      },
      lunch: {
        name: 'Klassik tovuq va grechka',
        description: 'Sekin yonuvchi murakkab uglevodlar va sifatli oqsil.',
        calories: 648, protein: 75, carbs: 71, fat: 11,
        ingredients: [
          { name: 'Tovuq go\'shti (ko\'krak)', amount: 200, unit: 'grams' },
          { name: 'Grechka', amount: 100, unit: 'grams' },
          { name: 'Brokkoli', amount: 50, unit: 'grams' }
        ]
      },
      dinner: {
        name: 'Pomidorli tuxum',
        description: 'Oson hazm bo\'ladigan tuxum oqsili va sersuv pomidor.',
        calories: 337, protein: 27, carbs: 12, fat: 22,
        ingredients: [
          { name: 'Tuxum', amount: 4, unit: 'pieces' },
          { name: 'Pomidor', amount: 150, unit: 'grams' }
        ]
      },
      snack: {
        name: 'Bodring va tvorog',
        description: 'Kam kaloriyali, shakarsiz ajoyib gazak.',
        calories: 113, protein: 11, carbs: 7, fat: 4.5,
        ingredients: [
          { name: 'Tvorog', amount: 100, unit: 'grams' },
          { name: 'Bodring', amount: 100, unit: 'grams' }
        ]
      }
    },
    totalNutrients: { calories: 1324, protein: 136, carbs: 101, fat: 46.5 },
    estimatedCost: 8.40
  };
}

function simulateCoachReply(messages: any[], inventory: any[], logsToday: any) {
  const lastUserText = messages[messages.length - 1]?.text?.toLowerCase() || '';

  let shortageWarning = '';
  const lowStockItem = (inventory || []).find((i: any) => i.currentQuantity <= i.initialQuantity * 0.3);
  if (lowStockItem) {
    shortageWarning = ` **${lowStockItem.name}** kamayib ketyapti (${lowStockItem.currentQuantity} ${lowStockItem.unit} qoldi). Xarid ro'yxatiga qo'shing!`;
  }

  if (lastUserText.includes('byudjet') || lastUserText.includes('pul') || lastUserText.includes('narx')) {
    return `Xarajatlarni boshqarish diyeta izchilligining kalitidir! Hozir siz oylik byudjet doirasidasiz. **Maslahat**: nonushtadagi tovuqni tuxumga almashtirsangiz, oqsilni saqlab qolib kunlik xarajatni 25% gacha kamaytirasiz!${shortageWarning}`;
  }

  if (lastUserText.includes('suv') || lastUserText.includes('ich')) {
    const totalMl = logsToday?.water || 0;
    if (totalMl < 2000) {
      return `Gidratsiya muskul sintezi va hazm uchun muhim. Bugun **${totalMl}ml** kiritdingiz. Yana **1,000ml** qo'shishga harakat qiling! 💧`;
    }
    return `Ajoyib gidratsiya! Bugun **${totalMl}ml** ichdingiz. Shu ruhda davom eting! 💧`;
  }

  return `Salom! Bugungi ko'rsatkichlaringiz ajoyib. ${logsToday?.protein ? `Allaqachon **${logsToday.protein}g** oqsil oldingiz.` : 'Keyingi taomingizni kiriting, makrolarni sozlaymiz.'}${shortageWarning} Sizga qanday yordam bera olaman — byudjet, makro tahlili yoki retseptlar?`;
}

// ==================== STATIC SITE ====================
// public/ holds the marketing landing page plus the two pages Google Play
// requires to be reachable at a public URL: the privacy policy and the
// account-deletion request page.

function startServer() {
  const publicPath = path.join(process.cwd(), 'public');

  // ---- UNUM web ilovasi (React) — /app yo'lida ----
  // Tailscale faqat 3 ta funnel portiga ruxsat beradi va uchalasi ham band
  // (443 → TDIU, 8443 → shu backend, 10000 → LiveKit TURN). Shuning uchun web
  // ilova alohida port emas, shu serverning /app yo'lida beriladi. Yon foydasi:
  // /api same-origin bo'ladi, CORS ham, proksi ham kerak emas.
  const webDist = path.join(process.cwd(), 'unum', 'dist');
  const webIndex = path.join(webDist, 'index.html');

  app.use('/app', (_req, res, next) => {
    // Sog'liq ilovasi uchun qattiq sarlavhalar. Landing sahifaga tegmaydi.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()'
    );
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  app.use('/app', express.static(webDist, { index: false, maxAge: '1h' }));
  // SPA fallback: /app/* ichidagi har qanday yo'l index.html ga tushadi
  app.get(/^\/app(\/.*)?$/, (_req, res) => {
    if (!fs.existsSync(webIndex)) {
      return res.status(503).send('UNUM web hali build qilinmagan (unum/dist topilmadi).');
    }
    res.sendFile(webIndex);
  });

  app.use(express.static(publicPath, { extensions: ['html'] }));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint topilmadi' }));
  app.get('*', (_req, res) => res.sendFile(path.join(publicPath, 'index.html')));

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌍 UNUM backend (OpenAI ${MODEL}) listening on http://0.0.0.0:${PORT}`);
    startBot();
  });
}

/**
 * Telegram bot HTTP server ko'tarilgandan keyin ishga tushadi — u backendning
 * o'z API'siga murojaat qiladi, shuning uchun port tinglanayotgan bo'lishi shart.
 * Token yo'q bo'lsa bot ishga tushmaydi va bu xato hisoblanmaydi.
 */
function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('ℹ️  TELEGRAM_BOT_TOKEN yo\'q — bot ishga tushirilmadi');
    return;
  }
  const admin = Number(process.env.TELEGRAM_ADMIN_ID || 0);
  const bot = new UnumBot(token, `http://127.0.0.1:${PORT}`, admin);
  bot.start().catch((e) => {
    console.error('Bot ishga tushmadi:', e?.message || e);
  });
}

startServer();
