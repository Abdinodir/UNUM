/**
 * Fokus seanslari (Pomodoro).
 *
 * Server FAQAT TUGAGAN seansni yozadi — taymer telefonda/brauzerda ishlaydi.
 * Sabab: ishlab turgan taymerni serverda saqlash uzilgan ulanish, yopilgan
 * ilova va ikkita qurilma holatlarida sinxronlash muammosini keltiradi,
 * foydasi esa yo'q. Seans tugagach bitta yozuv yuboriladi.
 *
 * `focus` kolleksiyasi Flutter ilovada allaqachon ishlatiladi
 * (`mobile/lib/pillars.dart` → `FocusSession`), shuning uchun maydon nomlari
 * O'ZGARTIRILMAYDI: timestamp / kind / minutes / note.
 */
import type { Response } from 'express';
import { Items, Profiles } from './db';
import { todayKey, dayKeyOf, shiftDay } from './day';

export const FOCUS = 'focus';

export const KINDS = ['study', 'work', 'hobby', 'skill'] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABELS: Record<Kind, string> = {
  study: "O'qish",
  work: 'Ish',
  hobby: 'Hobbi',
  skill: 'Mahorat',
};

export interface FocusSession {
  id: string;
  /** ISO. Seans TUGAGAN vaqt. */
  timestamp: string;
  kind: Kind;
  minutes: number;
  note: string;
  /** Qaysi maqsad uchun ishlandi (ixtiyoriy). */
  goalId: string | null;
}

/** Kunlik fokus maqsadi, daqiqada. */
export const DEFAULT_TARGET = 120;

const asKind = (v: unknown): Kind =>
  (KINDS as readonly string[]).includes(String(v)) ? (v as Kind) : 'study';

/**
 * Seans uzunligi. 1 daqiqadan kam — tasodifiy bosish; 8 soatdan uzun bitta
 * "fokus seansi" bo'lishi mumkin emas (deyarli har doim taymer unutilgan).
 */
function asMinutes(v: unknown): number | null {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 480 ? n : null;
}

const load = (userId: number): FocusSession[] =>
  Items.list(userId, FOCUS) as FocusSession[];

const target = (userId: number): number => {
  const v = Number(Profiles.get(userId)?.focusTargetMinutes);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_TARGET;
};

const totalOf = (list: FocusSession[]) =>
  list.reduce((s, f) => s + (Number(f.minutes) || 0), 0);

// ==================== ENDPOINTLAR ====================
export function listFocus(userId: number, dateParam: unknown, res: Response) {
  const day = typeof dateParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : todayKey();

  const all = load(userId);
  const today = all.filter((f) => dayKeyOf(f.timestamp) === day);
  const goal = target(userId);
  const minutes = totalOf(today);

  // Oxirgi 7 kun — kunlik ustunlar uchun.
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDay(day, -(6 - i));
    return { date, minutes: totalOf(all.filter((f) => dayKeyOf(f.timestamp) === date)) };
  });

  const byKind = KINDS.map((kind) => ({
    kind,
    label: KIND_LABELS[kind],
    minutes: totalOf(today.filter((f) => asKind(f.kind) === kind)),
  })).filter((k) => k.minutes > 0);

  res.json({
    date: day,
    sessions: today.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))),
    minutes,
    target: goal,
    percent: Math.min(100, Math.round((minutes / goal) * 100)),
    byKind,
    week,
  });
}

export function createFocus(userId: number, body: unknown, res: Response) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: "Noto'g'ri ma'lumot formati" });
  }
  const src = body as Record<string, unknown>;

  const minutes = asMinutes(src.minutes);
  if (minutes == null) {
    return res.status(400).json({ error: 'Seans uzunligi 1–480 daqiqa oralig\'ida bo\'lishi kerak' });
  }

  const session: Omit<FocusSession, 'id'> = {
    // Vaqtni SERVER qo'yadi — mijoz yuborgan sanaga ishonsak, o'tmishga
    // yoki kelajakka soxta seans yozib, fokus ballini ko'tarish mumkin edi.
    timestamp: new Date().toISOString(),
    kind: asKind(src.kind),
    minutes,
    note: typeof src.note === 'string' ? src.note.trim().slice(0, 500) : '',
    goalId: typeof src.goalId === 'string' && src.goalId ? src.goalId : null,
  };

  res.json(Items.create(userId, FOCUS, session));
}

export function deleteFocus(userId: number, id: string, res: Response) {
  Items.remove(userId, FOCUS, id);
  res.json({ ok: true });
}
