/**
 * Odatlar (Habits) va ketma-ketlik (streak).
 *
 * Bajarilgan kunlar odat hujjatining ICHIDA, `log` obyektida saqlanadi
 * ({"2026-08-08": true}). Har kun uchun alohida qator ochilmaydi: bir
 * foydalanuvchida yiliga ~365 kalit — bu bitta JSON uchun arzimas hajm,
 * lekin o'qishda birorta ham qo'shimcha so'rov kerak emas va streak
 * hisoblash butunlay xotirada bo'ladi.
 *
 * `habits` ham `COLLECTIONS` ga qo'shilmagan — bepul rejadagi 5 ta odat
 * chegarasi faqat shu moduldan o'tishi kerak.
 */
import type { Response } from 'express';
import { Items, isPremiumActive } from './db';
import { FREE_LIMITS } from './billing';
import { todayKey, shiftDay } from './day';

export const HABITS = 'habits';

/**
 * Odat qaysi kunlarda talab qilinadi.
 *  daily    — har kuni
 *  weekdays — dushanbadan jumagacha
 *  custom   — `days` da tanlangan kunlar (0=yakshanba … 6=shanba)
 */
export const SCHEDULES = ['daily', 'weekdays', 'custom'] as const;
export type Schedule = (typeof SCHEDULES)[number];

export interface Habit {
  id: string;
  title: string;
  /** Qisqa belgi — ro'yxatda ikonka o'rnida. */
  emoji: string;
  schedule: Schedule;
  /** `custom` uchun hafta kunlari. */
  days: number[];
  color: string;
  status: 'active' | 'archived';
  /** {"2026-08-08": true} — faqat bajarilgan kunlar yoziladi. */
  log: Record<string, boolean>;
  createdAt: string;
}

// ==================== YORDAMCHILAR ====================
const asText = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

/** "YYYY-MM-DD" dan hafta kuni (0=yakshanba). */
function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Shu kun odat talab qiladigan kunmi. */
export function isDueOn(habit: Habit, key: string): boolean {
  if (habit.schedule === 'daily') return true;
  const wd = weekdayOf(key);
  if (habit.schedule === 'weekdays') return wd >= 1 && wd <= 5;
  return habit.days.includes(wd);
}

/**
 * Joriy ketma-ketlik.
 *
 * MUHIM nozik joy: bugun hali belgilanmagan bo'lsa ketma-ketlik UZILMAYDI —
 * kun tugamagan, odam hali bajarishi mumkin. Shuning uchun sanashni
 * bugundan boshlaymiz, lekin bugun bo'sh bo'lsa uni "o'tkazib" kechadan
 * davom etamiz. Aks holda har kuni ertalab foydalanuvchi streak nolga
 * tushganini ko'rib, ilovaga bo'lgan ishonchini yo'qotardi.
 *
 * Talab qilinmagan kunlar (masalan `weekdays` dagi yakshanba) ketma-ketlikni
 * uzmaydi va uni oshirmaydi ham — shunchaki o'tkazib yuboriladi.
 */
export function currentStreak(habit: Habit, today = todayKey()): number {
  let streak = 0;
  let key = today;

  // Bugun belgilanmagan bo'lsa — hali kech emas, kechadan boshlaymiz.
  if (isDueOn(habit, key) && !habit.log[key]) key = shiftDay(key, -1);

  // 5 yildan uzun ketma-ketlik amalda bo'lmaydi; bu cheklov buzuq
  // ma'lumotda cheksiz aylanishning oldini oladi.
  for (let i = 0; i < 1830; i++) {
    if (!isDueOn(habit, key)) {
      key = shiftDay(key, -1);
      continue;
    }
    if (!habit.log[key]) break;
    streak++;
    key = shiftDay(key, -1);
  }
  return streak;
}

/**
 * Eng uzun ketma-ketlik — barcha yozuvlar bo'yicha.
 *
 * Ikki belgilangan kun orasida TALAB QILINGAN kun o'tkazib yuborilgan
 * bo'lsa ketma-ketlik uziladi. `weekdays` odatida juma va dushanba
 * ketma-ket hisoblanadi, chunki oradagi dam olish kunlari talab
 * qilinmaydi.
 */
export function bestStreak(habit: Habit): number {
  const days = Object.keys(habit.log).filter((k) => habit.log[k]).sort();
  if (days.length === 0) return 0;

  const missedBetween = (from: string, to: string): boolean => {
    for (let c = shiftDay(from, 1); c < to; c = shiftDay(c, 1)) {
      if (isDueOn(habit, c)) return true;
    }
    return false;
  };

  let best = 0;
  let run = 0;
  let prev = '';

  for (const day of days) {
    run = !prev || missedBetween(prev, day) ? 1 : run + 1;
    if (run > best) best = run;
    prev = day;
  }
  return best;
}

/** Oxirgi `n` kunning holati — ro'yxatdagi nuqtalar uchun. */
function recentDays(habit: Habit, n: number, today: string) {
  const out: { date: string; done: boolean; due: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = shiftDay(today, -i);
    out.push({ date, done: habit.log[date] === true, due: isDueOn(habit, date) });
  }
  return out;
}

export function decorate(habit: Habit, today = todayKey()) {
  const { log, ...rest } = habit;
  return {
    ...rest,
    doneToday: log[today] === true,
    dueToday: isDueOn(habit, today),
    streak: currentStreak(habit, today),
    best: bestStreak(habit),
    // Butun `log` ni yubormaymiz — u yillar davomida o'sadi va mijozga
    // faqat oxirgi ikki hafta kerak.
    recent: recentDays(habit, 14, today),
    totalDone: Object.values(log).filter(Boolean).length,
  };
}

// ==================== NORMALIZATSIYA ====================
function normalizeDays(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const set = new Set(
    v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  );
  return [...set].sort();
}

function buildHabit(body: Record<string, unknown>, existing?: Habit): Habit | { error: string } {
  const title = asText(body.title, 200);
  if (!title) return { error: 'Odat nomi kerak' };

  const schedule = (SCHEDULES as readonly string[]).includes(String(body.schedule))
    ? (body.schedule as Schedule)
    : existing?.schedule ?? 'daily';

  const days = 'days' in body ? normalizeDays(body.days) : existing?.days ?? [];

  return {
    id: existing?.id ?? '',
    title,
    emoji: asText(body.emoji, 8) || existing?.emoji || '🎯',
    schedule,
    // `custom` tanlanib, birorta kun belgilanmasa odat hech qachon
    // talab qilinmasdi — bunday holatda kunlik rejimga tushiramiz.
    days: schedule === 'custom' && days.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : days,
    color: asText(body.color, 9) || existing?.color || '#22C55E',
    status: body.status === 'archived' ? 'archived' : existing?.status ?? 'active',
    // `log` mijozdan QABUL QILINMAYDI — u faqat belgilash endpointi orqali
    // o'zgaradi, aks holda ilovani patch qilib soxta streak yasash mumkin edi.
    log: existing?.log ?? {},
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
}

// ==================== ENDPOINTLAR ====================
const load = (userId: number): Habit[] => Items.list(userId, HABITS) as Habit[];

export function listHabits(userId: number, res: Response) {
  const today = todayKey();
  const habits = load(userId);
  const active = habits.filter((h) => h.status === 'active');

  res.json({
    habits: habits.map((h) => decorate(h, today)),
    limit: isPremiumActive(userId) ? null : FREE_LIMITS.habits,
    activeCount: active.length,
    // Bugun bajarilishi kerak bo'lganlardan nechtasi bajarildi — Life Score
    // shu nisbatdan foydalanadi.
    todayDue: active.filter((h) => isDueOn(h, today)).length,
    todayDone: active.filter((h) => isDueOn(h, today) && h.log[today]).length,
  });
}

export function createHabit(userId: number, body: unknown, res: Response) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: "Noto'g'ri ma'lumot formati" });
  }

  if (!isPremiumActive(userId)) {
    const active = load(userId).filter((h) => h.status === 'active').length;
    if (active >= FREE_LIMITS.habits) {
      return res.status(403).json({
        error: `Bepul rejada ${FREE_LIMITS.habits} ta odat. Cheksiz odat uchun Premium.`,
        limit: FREE_LIMITS.habits,
        upgrade: true,
      });
    }
  }

  const built = buildHabit(body as Record<string, unknown>);
  if ('error' in built) return res.status(400).json({ error: built.error });

  res.json(decorate(Items.create(userId, HABITS, built) as Habit));
}

export function updateHabit(userId: number, id: string, body: unknown, res: Response) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: "Noto'g'ri ma'lumot formati" });
  }

  const existing = load(userId).find((h) => h.id === id);
  if (!existing) return res.status(404).json({ error: 'Odat topilmadi' });

  // Arxivdan tiklash ham chegaraga bo'ysunadi (goals.ts dagi kabi).
  const wantsActive = (body as any).status === 'active' && existing.status !== 'active';
  if (wantsActive && !isPremiumActive(userId)) {
    const active = load(userId).filter((h) => h.status === 'active').length;
    if (active >= FREE_LIMITS.habits) {
      return res.status(403).json({
        error: `Bepul rejada ${FREE_LIMITS.habits} ta odat.`,
        limit: FREE_LIMITS.habits,
        upgrade: true,
      });
    }
  }

  const built = buildHabit(body as Record<string, unknown>, existing);
  if ('error' in built) return res.status(400).json({ error: built.error });

  res.json(decorate(Items.update(userId, HABITS, id, built) as Habit));
}

/**
 * Kunni belgilash / belgini olib tashlash.
 *
 * KELAJAKDAGI kunni belgilashga ruxsat berilmaydi — aks holda oldindan
 * belgilab, ketma-ketlikni sun'iy uzaytirish mumkin bo'lardi.
 */
export function checkHabit(userId: number, id: string, dateParam: unknown, res: Response) {
  const existing = load(userId).find((h) => h.id === id);
  if (!existing) return res.status(404).json({ error: 'Odat topilmadi' });

  const today = todayKey();
  const raw = typeof dateParam === 'string' ? dateParam.slice(0, 10) : today;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;

  if (date > today) {
    return res.status(400).json({ error: 'Kelajakdagi kunni belgilab bo\'lmaydi' });
  }

  const log = { ...existing.log };
  if (log[date]) delete log[date];
  else log[date] = true;

  res.json(decorate(Items.update(userId, HABITS, id, { ...existing, log }) as Habit));
}

export function deleteHabit(userId: number, id: string, res: Response) {
  Items.remove(userId, HABITS, id);
  res.json({ ok: true });
}
