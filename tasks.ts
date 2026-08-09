/**
 * Kunlik reja (Daily Planner) va vazifalar.
 *
 * QAROR — takrorlanish bu yerda YO'Q. Har kuni takrorlanadigan narsa
 * "odat" (habit) va u alohida modulda, streak bilan yuritiladi. Aks holda
 * takrorlanish mantig'i ikki joyda yarim-yarim yozilib, ikkalasi ham
 * ishonchsiz bo'lardi. Vazifa = aniq kunga qo'yilgan bir martalik ish.
 *
 * `tasks` ham `COLLECTIONS` ga qo'shilmagan — sabab `goals.ts` dagi kabi:
 * validatsiya faqat shu moduldan o'tsin.
 */
import type { Response } from 'express';
import { Items } from './db';
import { todayKey } from './day';

export const TASKS = 'tasks';

export const PRIORITIES = ['low', 'normal', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface Task {
  id: string;
  title: string;
  notes: string;
  /** Kun kaliti "YYYY-MM-DD" — planner shu bo'yicha guruhlaydi. */
  date: string;
  done: boolean;
  completedAt: string | null;
  priority: Priority;
  /** Qaysi maqsadga xizmat qiladi (ixtiyoriy). */
  goalId: string | null;
  /** Taxminiy vaqt, daqiqada. */
  estimateMin: number | null;
  /** Kun ichidagi tartib — foydalanuvchi surib o'zgartiradi. */
  order: number;
  createdAt: string;
}

// ==================== NORMALIZATSIYA ====================
const asText = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

function asDay(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  // Faqat "YYYY-MM-DD" qabul qilamiz. To'liq timestamp kelsa kun qismini
  // olamiz, lekin mintaqa bo'yicha O'GIRMAYMIZ — bu maydon kalendar kuni,
  // vaqt nuqtasi emas.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : todayKey();
}

function asPriority(v: unknown): Priority {
  const s = String(v || '');
  return (PRIORITIES as readonly string[]).includes(s) ? (s as Priority) : 'normal';
}

function asEstimate(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  // 24 soatdan uzun vazifa — bu vazifa emas, loyiha. Cheklab qo'yamiz.
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 1440) : null;
}

function buildTask(
  body: Record<string, unknown>, existing?: Task, order = 0
): Task | { error: string } {
  const title = asText(body.title, 300);
  if (!title) return { error: 'Vazifa nomi kerak' };

  const done = 'done' in body ? body.done === true : existing?.done === true;

  return {
    id: existing?.id ?? '',
    title,
    notes: asText(body.notes, 2000),
    date: 'date' in body ? asDay(body.date) : existing?.date ?? todayKey(),
    done,
    // Bajarilgan vaqt faqat holat O'ZGARGANDA yoziladi — har tahrirda
    // yangilansa, "qachon bajardim" ma'lumoti yo'qolardi.
    completedAt: done
      ? existing?.done && existing.completedAt
        ? existing.completedAt
        : new Date().toISOString()
      : null,
    priority: asPriority('priority' in body ? body.priority : existing?.priority),
    goalId: typeof body.goalId === 'string' && body.goalId
      ? body.goalId
      : 'goalId' in body ? null : existing?.goalId ?? null,
    estimateMin: 'estimateMin' in body ? asEstimate(body.estimateMin) : existing?.estimateMin ?? null,
    order: typeof body.order === 'number' ? body.order : existing?.order ?? order,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
}

// ==================== TARTIBLASH ====================
const PRIORITY_RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

/** Bajarilmaganlar tepada, keyin ustuvorlik, keyin qo'lda qo'yilgan tartib. */
function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) =>
    Number(a.done) - Number(b.done) ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.order - b.order ||
    a.createdAt.localeCompare(b.createdAt)
  );
}

// ==================== ENDPOINTLAR ====================
const load = (userId: number): Task[] => Items.list(userId, TASKS) as Task[];

/**
 * Bir kunning rejasi.
 *
 * `overdue` — o'tgan kunlardagi bajarilmagan vazifalar. Planner'ning eng
 * foydali qismi shu: unutilgan ish ko'rinmay qolsa, reja ma'nosini yo'qotadi.
 * Faqat BUGUNGI kunni ko'rganda qo'shiladi — o'tmishga qarab turib
 * "kechikkan" ro'yxatini ko'rsatish chalkash bo'lardi.
 */
export function listTasks(userId: number, dateParam: unknown, res: Response) {
  const all = load(userId);
  const date = typeof dateParam === 'string' && dateParam ? asDay(dateParam) : todayKey();
  const isToday = date === todayKey();

  const tasks = sortTasks(all.filter((t) => t.date === date));
  const overdue = isToday
    ? sortTasks(all.filter((t) => !t.done && t.date < date))
    : [];

  const done = tasks.filter((t) => t.done).length;

  res.json({
    date,
    tasks,
    overdue,
    stats: {
      total: tasks.length,
      done,
      // Bo'sh kunda 0% ko'rsatish "yomon kun" degan taassurot beradi —
      // vazifa yo'q bo'lsa foiz ham yo'q.
      percent: tasks.length ? Math.round((done / tasks.length) * 100) : null,
    },
  });
}

export function createTask(userId: number, body: unknown, res: Response) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: "Noto'g'ri ma'lumot formati" });
  }

  const day = asDay((body as any).date);
  const sameDay = load(userId).filter((t) => t.date === day);
  const built = buildTask(body as Record<string, unknown>, undefined, sameDay.length);
  if ('error' in built) return res.status(400).json({ error: built.error });

  res.json(Items.create(userId, TASKS, built) as Task);
}

export function updateTask(userId: number, id: string, body: unknown, res: Response) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: "Noto'g'ri ma'lumot formati" });
  }

  const existing = load(userId).find((t) => t.id === id);
  if (!existing) return res.status(404).json({ error: 'Vazifa topilmadi' });

  const built = buildTask(body as Record<string, unknown>, existing);
  if ('error' in built) return res.status(400).json({ error: built.error });

  res.json(Items.update(userId, TASKS, id, built) as Task);
}

/** Checkbox uchun qisqa yo'l — butun vazifani qayta yubormaslik kerak. */
export function toggleTask(userId: number, id: string, res: Response) {
  const existing = load(userId).find((t) => t.id === id);
  if (!existing) return res.status(404).json({ error: 'Vazifa topilmadi' });

  const built = buildTask({ ...existing, done: !existing.done }, existing);
  if ('error' in built) return res.status(400).json({ error: built.error });

  res.json(Items.update(userId, TASKS, id, built) as Task);
}

/** Kechikkan vazifani bugunga ko'chirish. */
export function moveTask(userId: number, id: string, dateParam: unknown, res: Response) {
  const existing = load(userId).find((t) => t.id === id);
  if (!existing) return res.status(404).json({ error: 'Vazifa topilmadi' });

  const built = buildTask({ ...existing, date: asDay(dateParam) }, existing);
  if ('error' in built) return res.status(400).json({ error: built.error });

  res.json(Items.update(userId, TASKS, id, built) as Task);
}

export function deleteTask(userId: number, id: string, res: Response) {
  Items.remove(userId, TASKS, id);
  res.json({ ok: true });
}
