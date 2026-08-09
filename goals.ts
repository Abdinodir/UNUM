/**
 * Maqsadlar (Goals) — "personal operating system" ning o'zagi.
 *
 * ⚠️ `goals` ATAYLAB `COLLECTIONS` ro'yxatiga QO'SHILMAGAN. Aks holda uni
 * umumiy `/api/data/:collection` CRUD orqali ham yaratish mumkin bo'lar edi
 * va bepul rejadagi 3 ta maqsad chegarasi chetlab o'tilardi. Maqsadlar
 * FAQAT shu moduldagi endpointlar orqali o'zgaradi.
 */
import type { Response } from 'express';
import { Items, isPremiumActive } from './db';
import { FREE_LIMITS } from './billing';
import { todayKey } from './day';

export const GOALS = 'goals';

/** Maqsad qaysi sohaga tegishli — statistika va shablonlar uchun. */
export const CATEGORIES = [
  'learning',   // IELTS, dasturlash, kitob
  'fitness',    // sport, vazn, kuch
  'health',     // uyqu, ovqat, suv
  'career',     // ish, loyiha, biznes
  'finance',    // jamg'arma, daromad
  'personal',   // odat, munosabat, hobbi
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
}

/**
 * Raqamli o'lchov. Har maqsadda ham bo'lavermaydi:
 * "10 kg ozish" da bor (start 80 → target 70), "IELTS 7 olish" da yo'q —
 * u bosqichlar (milestone) bilan o'lchanadi.
 */
export interface Metric {
  unit: string;
  start: number;
  target: number;
  current: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: Category;
  metric: Metric | null;
  milestones: Milestone[];
  startDate: string;
  deadline: string | null;
  status: 'active' | 'done' | 'archived';
  createdAt: string;
  completedAt: string | null;
  /**
   * Progress tarixi — Goal Prediction shundan hisoblanadi ("hozirgi
   * temping bilan 12 kun kech tugatasan"). Faqat qiymat O'ZGARGANDA
   * yoziladi, aks holda har saqlashda o'sib ketardi.
   */
  progressLog: { date: string; value: number }[];
}

// ==================== YORDAMCHILAR ====================
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Kun foydalanuvchi mintaqasida — UTC da EMAS (sabab: day.ts).
const today = todayKey;

/** ISO sana ("2026-08-08") yoki null. Vaqt qismi tashlab yuboriladi. */
function asDate(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function asText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

let seq = 0;
const genId = () => `ms_${Date.now().toString(36)}${(seq = (seq + 1) % 4096).toString(36)}`;

/**
 * Maqsad bajarilishi, 0..1.
 *
 * Raqamli o'lchov ustun turadi — u aniqroq. O'lchov bo'lmasa bosqichlar
 * sanaladi. Ikkalasi ham bo'lmasa progress 0 (bajarilgan deb belgilanmaguncha).
 */
export function computeProgress(goal: Goal): number {
  if (goal.status === 'done') return 1;

  if (goal.metric) {
    const { start, target, current } = goal.metric;
    // Maqsad kamayish tomon ham bo'lishi mumkin ("80 kg → 70 kg"),
    // shuning uchun yo'nalishni ayirma belgisidan olamiz.
    const span = target - start;
    if (span === 0) return current === target ? 1 : 0;
    return clamp01((current - start) / span);
  }

  if (goal.milestones.length > 0) {
    return goal.milestones.filter((m) => m.done).length / goal.milestones.length;
  }

  return 0;
}

/** Deadline'gacha necha kun qoldi. Deadline yo'q bo'lsa null; o'tib ketgan bo'lsa manfiy. */
export function daysLeft(goal: Goal): number | null {
  if (!goal.deadline) return null;
  const ms = new Date(`${goal.deadline}T23:59:59Z`).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** Mijozga yuboriladigan ko'rinish — hisoblangan maydonlar bilan. */
export function decorate(goal: Goal) {
  const progress = computeProgress(goal);
  return {
    ...goal,
    progress,
    progressPercent: Math.round(progress * 100),
    daysLeft: daysLeft(goal),
    milestonesDone: goal.milestones.filter((m) => m.done).length,
    milestonesTotal: goal.milestones.length,
  };
}

// ==================== NORMALIZATSIYA ====================
function normalizeMilestones(raw: unknown, existing: Milestone[] = []): Milestone[] {
  if (!Array.isArray(raw)) return existing;
  const byId = new Map(existing.map((m) => [m.id, m]));

  // 50 ta bosqich har qanday real maqsad uchun yetarli; cheklov bitta
  // hujjatning cheksiz o'sishining oldini oladi.
  return raw.slice(0, 50).flatMap((item): Milestone[] => {
    if (!item || typeof item !== 'object') return [];
    const src = item as Record<string, unknown>;
    const title = asText(src.title, 200);
    if (!title) return [];
    const id = typeof src.id === 'string' && byId.has(src.id) ? src.id : genId();
    return [{ id, title, done: src.done === true, dueDate: asDate(src.dueDate) }];
  });
}

function normalizeMetric(raw: unknown): Metric | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const unit = asText(src.unit, 20);
  if (!unit) return null;
  return {
    unit,
    start: asNumber(src.start),
    target: asNumber(src.target),
    current: asNumber(src.current ?? src.start),
  };
}

function normalizeCategory(raw: unknown): Category {
  const v = String(raw || '');
  return (CATEGORIES as readonly string[]).includes(v) ? (v as Category) : 'personal';
}

/**
 * Kiruvchi ma'lumotdan to'liq Goal yasaydi.
 * `existing` berilsa — yangilash, aks holda yangi maqsad.
 */
function buildGoal(body: Record<string, unknown>, existing?: Goal): Goal | { error: string } {
  const title = asText(body.title, 200);
  if (!title) return { error: 'Maqsad nomi kerak' };

  const milestones = normalizeMilestones(body.milestones, existing?.milestones);
  const metric = 'metric' in body ? normalizeMetric(body.metric) : existing?.metric ?? null;

  const status =
    body.status === 'done' || body.status === 'archived' || body.status === 'active'
      ? body.status
      : existing?.status ?? 'active';

  const goal: Goal = {
    id: existing?.id ?? '',
    title,
    description: asText(body.description, 2000),
    category: normalizeCategory(body.category ?? existing?.category),
    metric,
    milestones,
    startDate: asDate(body.startDate) ?? existing?.startDate ?? today(),
    deadline: 'deadline' in body ? asDate(body.deadline) : existing?.deadline ?? null,
    status,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    completedAt:
      status === 'done'
        ? existing?.completedAt ?? new Date().toISOString()
        : null,
    progressLog: existing?.progressLog ?? [],
  };

  // Progress o'zgargan bo'lsa tarixga yozamiz. Bir kunda bir nechta
  // o'zgarish bo'lsa — o'sha kunning oxirgi qiymati qoladi.
  const value = Math.round(computeProgress(goal) * 100);
  const last = goal.progressLog[goal.progressLog.length - 1];
  if (!last || last.value !== value) {
    const d = today();
    if (last && last.date === d) last.value = value;
    else goal.progressLog.push({ date: d, value });
    // Tarix cheksiz o'smasin — bir yillik nuqta prognoz uchun yetarli.
    if (goal.progressLog.length > 400) goal.progressLog.splice(0, goal.progressLog.length - 400);
  }

  return goal;
}

// ==================== ENDPOINTLAR ====================
const load = (userId: number): Goal[] => Items.list(userId, GOALS) as Goal[];

export function listGoals(userId: number, res: Response) {
  const goals = load(userId);
  const active = goals.filter((g) => g.status === 'active');

  res.json({
    goals: goals.map(decorate),
    // Mijoz "yana nechta yaratsam bo'ladi" ni shundan biladi va tugmani
    // oldindan o'chirib qo'yadi — chegaraga urilib xato ko'rsatmaydi.
    limit: isPremiumActive(userId) ? null : FREE_LIMITS.goals,
    activeCount: active.length,
  });
}

export function createGoal(userId: number, body: unknown, res: Response) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: "Noto'g'ri ma'lumot formati" });
  }

  // Chegara FAQAT faol maqsadlarga tegishli — arxivlangan eski maqsadlar
  // yangisini yaratishga to'sqinlik qilmasligi kerak.
  if (!isPremiumActive(userId)) {
    const active = load(userId).filter((g) => g.status === 'active').length;
    if (active >= FREE_LIMITS.goals) {
      return res.status(403).json({
        error: `Bepul rejada ${FREE_LIMITS.goals} ta faol maqsad. Cheksiz maqsad uchun Premium.`,
        limit: FREE_LIMITS.goals,
        upgrade: true,
      });
    }
  }

  const built = buildGoal(body as Record<string, unknown>);
  if ('error' in built) return res.status(400).json({ error: built.error });

  res.json(decorate(Items.create(userId, GOALS, built) as Goal));
}

export function updateGoal(userId: number, id: string, body: unknown, res: Response) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: "Noto'g'ri ma'lumot formati" });
  }

  const existing = load(userId).find((g) => g.id === id);
  if (!existing) return res.status(404).json({ error: 'Maqsad topilmadi' });

  // Arxivlangan maqsadni qayta faollashtirish ham chegaraga bo'ysunadi,
  // aks holda uni arxivlab-tiklab chegarani aylanib o'tish mumkin bo'lardi.
  const wantsActive = (body as any).status === 'active' && existing.status !== 'active';
  if (wantsActive && !isPremiumActive(userId)) {
    const active = load(userId).filter((g) => g.status === 'active').length;
    if (active >= FREE_LIMITS.goals) {
      return res.status(403).json({
        error: `Bepul rejada ${FREE_LIMITS.goals} ta faol maqsad.`,
        limit: FREE_LIMITS.goals,
        upgrade: true,
      });
    }
  }

  const built = buildGoal(body as Record<string, unknown>, existing);
  if ('error' in built) return res.status(400).json({ error: built.error });

  res.json(decorate(Items.update(userId, GOALS, id, built) as Goal));
}

export function deleteGoal(userId: number, id: string, res: Response) {
  Items.remove(userId, GOALS, id);
  res.json({ ok: true });
}
