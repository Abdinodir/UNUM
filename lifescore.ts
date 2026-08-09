/**
 * UNUM Life Score — kunning yagona ko'rsatkichi (0–100).
 *
 * NIMA UCHUN SERVERDA. `score.ts`/`score.dart` juftligidan farqli o'laroq bu
 * yerda Dart nusxasi YO'Q va bo'lishi ham shart emas: Health Score bitta
 * kunning ovqat yozuvlaridan hisoblanadi va ilova uni oflayn ko'rsatishi
 * kerak, Life Score esa BARCHA modullarni (vazifa, odat, fokus, uyqu,
 * sog'liq) birlashtiradi — ular baribir serverda. Bitta joyda hisoblansa,
 * "ilovada bir, botda boshqa raqam" muammosi umuman paydo bo'lmaydi.
 *
 * ASOSIY QOIDA — YO'Q MA'LUMOT JAZOLAMAYDI.
 * Foydalanuvchi uyquni yozmasa, uyqu komponenti ballga UMUMAN kirmaydi va
 * og'irliklar qolganlari orasida qayta taqsimlanadi. Aks holda faqat vazifa
 * yozadigan odam hech qachon 40 balldan osholmasdi va ilovani tashlab
 * ketardi. Nol ball faqat HAQIQATAN yomon kun uchun.
 */
import { Items, Profiles } from './db';
import { todayKey, dayKeyOf, shiftDay } from './day';
import { computeScore } from './score';
import { isDueOn, type Habit } from './habits';
import type { Task } from './tasks';
import type { Goal } from './goals';

export interface LifeComponent {
  id: string;
  label: string;
  /** 0..1 — bajarilish nisbati. */
  ratio: number;
  /** Umumiy ballda necha foiz og'irlikka ega. */
  weight: number;
  /** Ma'lumot bormi. `false` bo'lsa ballga KIRMAYDI. */
  available: boolean;
  detail: string;
}

export interface LifeScore {
  date: string;
  total: number;
  hasData: boolean;
  grade: string;
  components: LifeComponent[];
  /** Eng ko'p ball yo'qotilgan mavjud komponent — kunlik maslahat shundan. */
  weakest: LifeComponent | null;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Og'irliklar. Yig'indisi 100 bo'lishi SHART emas — hisob baribir
 * mavjud komponentlar bo'yicha normallashtiriladi.
 */
const WEIGHTS = {
  tasks: 20,
  habits: 20,
  health: 25,
  focus: 15,
  sleep: 10,
  goals: 10,
} as const;

function grade(total: number, hasData: boolean): string {
  if (!hasData) return "Ma'lumot yo'q";
  if (total >= 90) return 'Ajoyib';
  if (total >= 75) return 'Yaxshi';
  if (total >= 60) return "O'rtacha";
  if (total >= 40) return 'Past';
  return 'Juda past';
}

export function computeLifeScore(userId: number, day = todayKey()): LifeScore {
  const profile = Profiles.get(userId) || {};
  const components: LifeComponent[] = [];

  // ---------- 1. Kunlik reja ----------
  const tasks = (Items.list(userId, 'tasks') as Task[]).filter((t) => t.date === day);
  const tasksDone = tasks.filter((t) => t.done).length;
  components.push({
    id: 'tasks',
    label: 'Reja',
    ratio: tasks.length ? tasksDone / tasks.length : 0,
    weight: WEIGHTS.tasks,
    available: tasks.length > 0,
    detail: `${tasksDone} / ${tasks.length} vazifa`,
  });

  // ---------- 2. Odatlar ----------
  const habits = (Items.list(userId, 'habits') as Habit[]).filter((h) => h.status === 'active');
  const due = habits.filter((h) => isDueOn(h, day));
  const habitsDone = due.filter((h) => h.log?.[day]).length;
  components.push({
    id: 'habits',
    label: 'Odatlar',
    ratio: due.length ? habitsDone / due.length : 0,
    weight: WEIGHTS.habits,
    available: due.length > 0,
    detail: `${habitsDone} / ${due.length} odat`,
  });

  // ---------- 3. Sog'liq (mavjud Health Score) ----------
  const meals = (Items.list(userId, 'meals') as any[]).filter((m) => dayKeyOf(m.timestamp) === day);
  const waterMl = (Items.list(userId, 'water') as any[])
    .filter((w) => dayKeyOf(w.timestamp) === day)
    .reduce((s, w) => s + (Number(w.amountMl) || 0), 0);
  const acts = (Items.list(userId, 'activities') as any[]).filter(
    (a) => dayKeyOf(a.timestamp) === day
  );
  const sum = (f: (m: any) => number) =>
    meals.reduce((s, m) => s + (Number(f(m)) || 0), 0);

  const health = computeScore({
    calories: sum((m) => m.calories),
    targetCalories: Number(profile.targetCalories) || 2200,
    protein: sum((m) => m.protein),
    targetProtein: Number(profile.targetProtein) || 120,
    vegServings: sum((m) => m.vegServings),
    sugar: sum((m) => m.sugar),
    upfCalories: sum((m) => (Number(m.novaScore) >= 4 ? Number(m.calories) || 0 : 0)),
    waterMl,
    targetWaterMl: Number(profile.targetWaterMl) || 2500,
    steps: acts.reduce((s: number, a: any) => s + (Number(a.steps) || 0), 0),
    activeMinutes: acts.reduce((s: number, a: any) => s + (Number(a.activeMinutes) || 0), 0),
  });

  components.push({
    id: 'health',
    label: "Sog'liq",
    ratio: health.total / 100,
    weight: WEIGHTS.health,
    available: health.hasData,
    detail: `${health.total} ball`,
  });

  // ---------- 4. Fokus ----------
  const focusTarget = Number(profile.focusTargetMinutes) || 120;
  const focusMin = (Items.list(userId, 'focus') as any[])
    .filter((f) => dayKeyOf(f.timestamp) === day)
    .reduce((s, f) => s + (Number(f.minutes) || 0), 0);
  components.push({
    id: 'focus',
    label: 'Fokus',
    ratio: clamp01(focusMin / focusTarget),
    weight: WEIGHTS.focus,
    available: focusMin > 0,
    detail: `${focusMin} / ${focusTarget} daqiqa`,
  });

  // ---------- 5. Uyqu ----------
  // `date` — UYG'ONGAN kun, shuning uchun to'g'ridan-to'g'ri solishtiriladi.
  const sleep = (Items.list(userId, 'sleep') as any[]).find((s) => s.date === day);
  const sleepHours = sleep ? hoursBetween(sleep.bedTime, sleep.wakeTime) : 0;
  components.push({
    id: 'sleep',
    label: 'Uyqu',
    // 7–9 soat ideal. 7 dan kam bo'lsa chiziqli tushadi, 9 dan ko'p bo'lsa
    // ham biroz tushadi — ortiqcha uyqu ham ko'rsatkich emas.
    ratio: sleepHours <= 0 ? 0 : sleepHours < 7 ? clamp01(sleepHours / 7)
      : sleepHours <= 9 ? 1 : clamp01(1 - (sleepHours - 9) / 6),
    weight: WEIGHTS.sleep,
    available: sleepHours > 0,
    detail: sleepHours > 0 ? `${sleepHours.toFixed(1)} soat` : 'Yozuv yo\'q',
  });

  // ---------- 6. Maqsad ----------
  // "Bugun maqsad tomon qadam tashladingmi": maqsadga bog'langan vazifa
  // bajarilgan yoki maqsad progressi shu kuni o'sgan bo'lsa — hisoblanadi.
  const goals = (Items.list(userId, 'goals') as Goal[]).filter((g) => g.status === 'active');
  const movedGoals = new Set<string>();
  for (const t of tasks) if (t.done && t.goalId) movedGoals.add(t.goalId);
  for (const g of goals) {
    const log = g.progressLog || [];
    const todayPoint = log.find((p) => p.date === day);
    const prev = log.filter((p) => p.date < day).pop();
    if (todayPoint && (!prev || todayPoint.value > prev.value)) movedGoals.add(g.id);
  }
  components.push({
    id: 'goals',
    label: 'Maqsad',
    // Bitta maqsad tomon qadam tashlash allaqachon yaxshi kun; ikkitasi —
    // to'liq ball. Har bir maqsadni har kuni surish real emas.
    ratio: goals.length ? clamp01(movedGoals.size / Math.min(2, goals.length)) : 0,
    weight: WEIGHTS.goals,
    available: goals.length > 0,
    detail: goals.length
      ? `${movedGoals.size} / ${goals.length} maqsadda harakat`
      : 'Maqsad yo\'q',
  });

  // ---------- Yig'ish ----------
  const usable = components.filter((c) => c.available);
  const totalWeight = usable.reduce((s, c) => s + c.weight, 0);
  const total = totalWeight
    ? Math.round(usable.reduce((s, c) => s + c.ratio * c.weight, 0) / totalWeight * 100)
    : 0;

  const weakest = usable
    .filter((c) => c.ratio < 0.999)
    .sort((a, b) => (1 - b.ratio) * b.weight - (1 - a.ratio) * a.weight)[0] ?? null;

  return {
    date: day,
    total,
    hasData: usable.length > 0,
    grade: grade(total, usable.length > 0),
    components,
    weakest,
  };
}

/** Yotish va turish vaqti orasidagi soat. Yaroqsiz yozuvda 0. */
function hoursBetween(bed: unknown, wake: unknown): number {
  const b = Date.parse(String(bed || ''));
  const w = Date.parse(String(wake || ''));
  if (!Number.isFinite(b) || !Number.isFinite(w) || w <= b) return 0;
  const hours = (w - b) / 3_600_000;
  // 16 soatdan uzun uyqu — deyarli har doim sana xatosi (pillars.dart
  // dagi bir xil chegara). Qirqib ko'rsatgandan ko'ra yaroqsiz deymiz.
  return hours > 16 ? 0 : hours;
}

/**
 * Oxirgi `n` kunning balli — trend grafigi uchun.
 *
 * Har kun uchun to'liq qayta hisoblanadi, ya'ni kolleksiyalar `n` marta
 * o'qiladi. Shaxsiy ilova hajmida (bir foydalanuvchining bir necha ming
 * yozuvi) bu sezilmaydi, shuning uchun keshsiz qoldirildi. `n` katta
 * bo'lsa (masalan yillik ko'rinish) avval kolleksiyalarni bir marta
 * o'qib, kun bo'yicha guruhlash kerak bo'ladi.
 */
export function lifeScoreTrend(userId: number, n: number, today = todayKey()) {
  const out: { date: string; total: number; hasData: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = shiftDay(today, -i);
    const s = computeLifeScore(userId, date);
    out.push({ date, total: s.total, hasData: s.hasData });
  }
  return out;
}
