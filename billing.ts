/**
 * Obuna rejalari va to'lov boshlash.
 *
 * To'lov provayderi bilan gaplashish `click.ts` da; bu yerda faqat "nima
 * sotilyapti" va "kim so'radi" mantiqi.
 */
import type { Response } from 'express';
import { Payments, Profiles, isPremiumActive } from './db';
import { buildPayUrl, clickConfigured } from './click';

export interface Plan {
  id: string;
  title: string;
  /** Necha kunga premium beradi. */
  days: number;
  /** BUTUN so'mda. Valyuta konvertatsiyasi YO'Q — narx allaqachon so'mda. */
  amount: number;
  /** Oyiga tushadigan narx — solishtirish uchun, sotuvda emas. */
  perMonth: number;
  badge?: string;
}

const num = (key: string, fallback: number) => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

// Narxlar `.env` dan o'zgartiriladi — kodni qayta yig'ish shart emas.
// Boshlang'ich qiymatlar O'zbekiston bozori uchun kelishilgan jadval.
const MONTH = num('PRICE_MONTH', 49_000);
const HALF = num('PRICE_HALF_YEAR', 249_000);
const YEAR = num('PRICE_YEAR', 399_000);

/** Uzoq rejaning oylikka nisbatan tejami, foizda. */
const saving = (amount: number, months: number) =>
  Math.round((1 - amount / (MONTH * months)) * 100);

export const PLANS: Plan[] = [
  {
    id: 'month',
    title: '1 oy',
    days: 30,
    amount: MONTH,
    perMonth: MONTH,
  },
  {
    id: 'half',
    title: '6 oy',
    days: 180,
    amount: HALF,
    perMonth: Math.round(HALF / 6),
    badge: `${saving(HALF, 6)}% tejaysiz`,
  },
  {
    id: 'year',
    title: '1 yil',
    days: 365,
    amount: YEAR,
    perMonth: Math.round(YEAR / 12),
    badge: `${saving(YEAR, 12)}% tejaysiz`,
  },
];

/**
 * Bepul rejadagi chegaralar — paywall jadvali VA server tekshiruvi uchun
 * YAGONA manba. Chegarani ikki joyda yozsak, ular albatta bir-biridan
 * uzilib qoladi va foydalanuvchi ilovada ko'rgan raqam serverdagidan
 * boshqacha bo'ladi.
 *
 * `null` = cheksiz.
 */
export const FREE_LIMITS = {
  goals: 3,
  habits: 5,
  aiPerDay: Number(process.env.AI_DAILY_LIMIT_FREE || 12),
} as const;

export const PREMIUM_LIMITS = {
  goals: null,
  habits: null,
  aiPerDay: Number(process.env.AI_DAILY_LIMIT || 120),
} as const;

export const limitsFor = (premium: boolean) =>
  premium ? PREMIUM_LIMITS : FREE_LIMITS;

export const planById = (id: string): Plan | undefined =>
  PLANS.find((p) => p.id === id);

/** Foydalanuvchining obuna holati — ilova va bot shu javobga qaraydi. */
export function billingStatus(userId: number) {
  const profile = Profiles.get(userId) || {};
  const active = isPremiumActive(userId);
  return {
    premium: active,
    premiumUntil: active ? profile.premiumUntil ?? null : null,
    plans: PLANS,
    limits: limitsFor(active),
    // Sozlanmagan bo'lsa mijoz "Sotib olish" tugmasini ko'rsatmasligi kerak —
    // bosgandan keyin xato berish yomon tajriba.
    available: clickConfigured(),
  };
}

/**
 * Qaytish manzilini tekshiradi.
 *
 * Faqat o'z domenimizga yoki Telegram'ga qaytishga ruxsat: aks holda bu ochiq
 * redirect bo'lardi — kimdir to'lov havolasini yasab, foydalanuvchini
 * to'lovdan keyin o'z saytiga tashlab yuborishi mumkin edi.
 */
function safeReturnUrl(raw: unknown): string | undefined {
  const self = (process.env.APP_PUBLIC_URL || '').replace(/\/+$/, '');
  const fallback = self ? `${self}/app/` : undefined;
  if (typeof raw !== 'string' || !raw) return fallback;

  try {
    const url = new URL(raw);
    const okHost =
      (self && raw.startsWith(`${self}/`)) ||
      url.hostname === 't.me' ||
      url.hostname === 'telegram.me';
    return okHost ? raw : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Buyurtma ochadi va to'lov havolasini qaytaradi.
 *
 * Summa HAR DOIM serverdagi rejadan olinadi — klient yuborgan narx umuman
 * o'qilmaydi, aks holda 1 so'mga yillik obuna sotib olish mumkin bo'lardi.
 */
export interface Checkout {
  orderId: number;
  plan: string;
  amount: number;
  payUrl: string;
}

/**
 * Buyurtma ochadi. HTTP'ga bog'liq emas — bot ham shu funksiyani chaqiradi.
 * Sozlanmagan yoki reja noto'g'ri bo'lsa `null` qaytaradi.
 */
export function startCheckout(
  userId: number, planId: string, returnUrl?: string
): Checkout | null {
  if (!clickConfigured()) return null;

  const plan = planById(planId);
  if (!plan) return null;

  const order = Payments.create(userId, plan.id, plan.days, plan.amount);
  return {
    orderId: order.id,
    plan: plan.id,
    amount: plan.amount,
    payUrl: buildPayUrl(order.id, plan.amount, safeReturnUrl(returnUrl)),
  };
}

export function createCheckout(userId: number, planId: unknown, returnUrl: unknown, res: Response) {
  if (!clickConfigured()) {
    return res.status(503).json({ error: "To'lov tizimi hozircha sozlanmagan" });
  }

  const checkout = startCheckout(
    userId,
    String(planId || ''),
    typeof returnUrl === 'string' ? returnUrl : undefined
  );
  if (!checkout) return res.status(400).json({ error: 'Reja topilmadi' });

  res.json(checkout);
}

/** Buyurtma holati — ilova to'lovdan qaytgach shuni so'raydi. */
export function orderStatus(userId: number, orderId: number, res: Response) {
  const row = Payments.byId(orderId);
  // Boshqa odamning buyurtmasi "topilmadi" bo'lib ko'rinadi — kimning
  // buyurtmasi borligini raqam terib bilib bo'lmasin.
  if (!row || row.user_id !== userId) {
    return res.status(404).json({ error: 'Buyurtma topilmadi' });
  }
  res.json({
    orderId: row.id,
    state: row.state,
    plan: row.plan,
    amount: row.amount,
    paidAt: row.paid_at,
    premium: isPremiumActive(userId),
  });
}
