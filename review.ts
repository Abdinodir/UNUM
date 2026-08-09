/**
 * Hisobotlar va prognoz — DETERMINISTIK, AI EMAS.
 *
 * Nima uchun AI emas: haftalik hisobot har yakshanba har bir foydalanuvchi
 * uchun ishlaydi. AI bilan bu pul sarflaydi, sekin bo'ladi va eng yomoni —
 * bir xil ma'lumotdan har safar boshqacha xulosa chiqaradi. Raqamlar shu
 * yerda aniq hisoblanadi; AI keyinchalik faqat ularni SO'ZGA aylantirishi
 * mumkin (`coach.ts`), lekin raqamni o'zi o'ylab topmaydi.
 *
 * Prognozda TAXMINIY foiz ("ulgurishingiz 91%") ATAYLAB YO'Q — bunday
 * raqamni asoslab bo'lmaydi. O'rniga tushunarli va tekshiriladigan narsa
 * beriladi: "kuniga 2.1% kerak, siz 1.4% qilyapsiz".
 */
import { Items } from './db';
import { todayKey, shiftDay, dayKeyOf } from './day';
import { computeLifeScore } from './lifescore';
import { computeProgress, type Goal } from './goals';
import { isDueOn, type Habit } from './habits';
import type { Task } from './tasks';

// ==================== PROGNOZ ====================
export interface Prediction {
  goalId: string;
  title: string;
  /** Hozirgi bajarilish, %. */
  current: number;
  /** Kuniga o'rtacha necha % o'syapti (oxirgi oyna bo'yicha). */
  perDay: number;
  /** Deadline'ga ulgurish uchun kuniga necha % kerak. */
  requiredPerDay: number | null;
  /** Hozirgi temp bilan tugash sanasi. Temp 0 yoki manfiy bo'lsa null. */
  projectedDate: string | null;
  /** Deadline'dan necha kun kech (musbat) yoki erta (manfiy). */
  daysLate: number | null;
  onTrack: boolean | null;
  /** Prognozga qanchalik ishonish mumkin. */
  confidence: 'low' | 'medium' | 'high';
  message: string;
}

/** Ikki kun kaliti orasidagi kun soni. */
function daysBetween(from: string, to: string): number {
  const p = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(to) - p(from)) / 86_400_000);
}

/**
 * Maqsad prognozi.
 *
 * Temp oxirgi 21 kunlik oynadan olinadi: undan qisqa oyna tasodifiy bir
 * kunlik sakrashga o'ta sezgir, undan uzun oyna esa odam sur'atni
 * o'zgartirganini sezmaydi.
 */
export function predictGoal(goal: Goal, today = todayKey()): Prediction {
  const current = Math.round(computeProgress(goal) * 100);
  const log = (goal.progressLog || []).filter((p) => p.date <= today);

  const base = {
    goalId: goal.id,
    title: goal.title,
    current,
    requiredPerDay: null as number | null,
    projectedDate: null as string | null,
    daysLate: null as number | null,
    onTrack: null as boolean | null,
  };

  // Deadline'gacha qolgan kun — required tempni hisoblash uchun.
  const left = goal.deadline ? daysBetween(today, goal.deadline) : null;
  const required =
    left != null && left > 0 ? Math.max(0, (100 - current) / left) : null;

  if (current >= 100) {
    return { ...base, perDay: 0, requiredPerDay: required, confidence: 'high',
      onTrack: true, message: 'Maqsad bajarildi. 🎉' };
  }

  // Kamida ikkita nuqta va ular orasida kamida 1 kun bo'lishi kerak.
  const window = log.filter((p) => daysBetween(p.date, today) <= 21);
  const points = window.length >= 2 ? window : log.slice(-2);

  if (points.length < 2) {
    return {
      ...base, perDay: 0, requiredPerDay: required, confidence: 'low',
      message: left != null && left > 0
        ? `Prognoz uchun ma'lumot yetarli emas. Deadline'gacha ${left} kun — kuniga ${required!.toFixed(1)}% kerak.`
        : "Prognoz uchun ma'lumot yetarli emas.",
    };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const span = daysBetween(first.date, last.date);
  const perDay = span > 0 ? (last.value - first.value) / span : 0;

  // Ishonch: nuqta soni va oraliq uzunligiga qarab.
  const confidence: Prediction['confidence'] =
    points.length >= 7 && span >= 10 ? 'high'
    : points.length >= 3 && span >= 3 ? 'medium'
    : 'low';

  if (perDay <= 0) {
    return {
      ...base, perDay: 0, requiredPerDay: required, confidence,
      onTrack: left != null ? false : null,
      message: left != null && left > 0
        ? `Oxirgi ${span} kunda siljish yo'q. Deadline'gacha ${left} kun — kuniga ${required!.toFixed(1)}% kerak.`
        : `Oxirgi ${span} kunda siljish yo'q.`,
    };
  }

  const daysNeeded = Math.ceil((100 - current) / perDay);
  const projectedDate = shiftDay(today, daysNeeded);
  const daysLate = goal.deadline ? daysBetween(goal.deadline, projectedDate) : null;
  const onTrack = daysLate == null ? null : daysLate <= 0;

  let message: string;
  if (daysLate == null) {
    message = `Hozirgi temp bilan ${daysNeeded} kunda tugaydi (${projectedDate}).`;
  } else if (daysLate <= 0) {
    message = `Ulgurasiz — deadline'dan ${Math.abs(daysLate)} kun oldin tugaydi.`;
  } else {
    message =
      `Hozirgi temp bilan ${daysLate} kun kech tugaysiz. ` +
      `Kuniga ${required!.toFixed(1)}% kerak, siz ${perDay.toFixed(1)}% qilyapsiz.`;
  }

  return {
    ...base,
    perDay: Math.round(perDay * 10) / 10,
    requiredPerDay: required == null ? null : Math.round(required * 10) / 10,
    projectedDate,
    daysLate,
    onTrack,
    confidence,
    message,
  };
}

export function predictAll(userId: number, today = todayKey()): Prediction[] {
  return (Items.list(userId, 'goals') as Goal[])
    .filter((g) => g.status === 'active')
    .map((g) => predictGoal(g, today));
}

// ==================== HISOBOT ====================
export interface Review {
  from: string;
  to: string;
  days: number;
  tasks: { done: number; total: number; percent: number | null };
  habits: { done: number; due: number; percent: number | null };
  focus: { minutes: number; perDay: number };
  lifeScore: { average: number | null; best: { date: string; total: number } | null;
    worst: { date: string; total: number } | null; daysWithData: number };
  /** Oldingi shu uzunlikdagi davr bilan solishtirish (Life Score o'rtachasi). */
  previousAverage: number | null;
  trend: 'up' | 'down' | 'flat' | null;
  /** Eng ko'p ball yo'qotgan soha. */
  weakest: { id: string; label: string } | null;
  /** Ketma-ketligi eng uzun odat. */
  topStreak: { title: string; streak: number } | null;
  highlights: string[];
}

function rangeKeys(to: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDay(to, -(n - 1 - i)));
}

/** `n` kunlik hisobot (7 — haftalik, 30 — oylik). */
export function buildReview(userId: number, n: number, to = todayKey()): Review {
  const keys = rangeKeys(to, n);
  const from = keys[0];
  const inRange = (k: string) => k >= from && k <= to;

  // --- vazifalar ---
  const allTasks = Items.list(userId, 'tasks') as Task[];
  const tasks = allTasks.filter((t) => inRange(t.date));
  const tasksDone = tasks.filter((t) => t.done).length;

  // --- odatlar ---
  const habits = (Items.list(userId, 'habits') as Habit[]).filter(
    (h) => h.status === 'active'
  );
  let due = 0;
  let habitsDone = 0;
  for (const h of habits) {
    for (const k of keys) {
      if (!isDueOn(h, k)) continue;
      due++;
      if (h.log?.[k]) habitsDone++;
    }
  }

  // --- fokus ---
  const focusMin = (Items.list(userId, 'focus') as any[])
    .filter((f) => inRange(dayKeyOf(f.timestamp)))
    .reduce((s, f) => s + (Number(f.minutes) || 0), 0);

  // --- Life Score ---
  const scores = keys.map((k) => ({ date: k, ...computeLifeScore(userId, k) }));
  const withData = scores.filter((s) => s.hasData);
  const average = withData.length
    ? Math.round(withData.reduce((s, x) => s + x.total, 0) / withData.length)
    : null;

  const sorted = [...withData].sort((a, b) => b.total - a.total);
  const best = sorted[0] ? { date: sorted[0].date, total: sorted[0].total } : null;
  const worst = sorted.length > 1
    ? { date: sorted[sorted.length - 1].date, total: sorted[sorted.length - 1].total }
    : null;

  // --- oldingi davr ---
  const prevKeys = rangeKeys(shiftDay(from, -1), n);
  const prevWithData = prevKeys
    .map((k) => computeLifeScore(userId, k))
    .filter((s) => s.hasData);
  const previousAverage = prevWithData.length
    ? Math.round(prevWithData.reduce((s, x) => s + x.total, 0) / prevWithData.length)
    : null;

  const trend: Review['trend'] =
    average == null || previousAverage == null ? null
    : average - previousAverage >= 3 ? 'up'
    : previousAverage - average >= 3 ? 'down'
    : 'flat';

  // --- eng zaif soha (davr bo'yicha eng ko'p uchragan) ---
  const weakCount = new Map<string, { label: string; n: number }>();
  for (const s of withData) {
    if (!s.weakest) continue;
    const e = weakCount.get(s.weakest.id) ?? { label: s.weakest.label, n: 0 };
    e.n++;
    weakCount.set(s.weakest.id, e);
  }
  const weakestEntry = [...weakCount.entries()].sort((a, b) => b[1].n - a[1].n)[0];
  const weakest = weakestEntry
    ? { id: weakestEntry[0], label: weakestEntry[1].label }
    : null;

  // --- eng uzun ketma-ketlik ---
  let topStreak: Review['topStreak'] = null;
  for (const h of habits) {
    let run = 0;
    for (const k of keys) {
      if (!isDueOn(h, k)) continue;
      run = h.log?.[k] ? run + 1 : 0;
    }
    if (run > 0 && (!topStreak || run > topStreak.streak)) {
      topStreak = { title: h.title, streak: run };
    }
  }

  // --- qisqa xulosalar ---
  const highlights: string[] = [];
  const taskPercent = tasks.length ? Math.round((tasksDone / tasks.length) * 100) : null;
  const habitPercent = due ? Math.round((habitsDone / due) * 100) : null;

  if (taskPercent != null) highlights.push(`Rejaning ${taskPercent}% i bajarildi (${tasksDone}/${tasks.length}).`);
  if (habitPercent != null) highlights.push(`Odatlar ${habitPercent}% bajarildi.`);
  if (focusMin > 0) highlights.push(`Fokusda ${Math.round(focusMin / 60 * 10) / 10} soat.`);
  if (topStreak) highlights.push(`"${topStreak.title}" — ${topStreak.streak} kun ketma-ket.`);
  if (trend === 'up') highlights.push(`Life Score o'sdi: ${previousAverage} → ${average}.`);
  if (trend === 'down') highlights.push(`Life Score tushdi: ${previousAverage} → ${average}.`);
  if (weakest) highlights.push(`Eng ko'p ball "${weakest.label}" dan yo'qoldi.`);

  return {
    from, to, days: n,
    tasks: { done: tasksDone, total: tasks.length, percent: taskPercent },
    habits: { done: habitsDone, due, percent: habitPercent },
    focus: { minutes: focusMin, perDay: Math.round(focusMin / n) },
    lifeScore: { average, best, worst, daysWithData: withData.length },
    previousAverage,
    trend,
    weakest,
    topStreak,
    highlights,
  };
}
