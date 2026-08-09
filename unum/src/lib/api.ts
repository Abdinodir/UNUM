/**
 * Backend bilan aloqa.
 *
 * Sessiya httpOnly cookie'da bo'lgani uchun har bir so'rovda
 * `credentials: 'include'` kerak — aks holda brauzer cookie'ni yubormaydi.
 * Token JS'da umuman saqlanmaydi.
 */

export interface ApiError extends Error {
  status: number;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = String(body.error);
    } catch {
      /* javob JSON emas — status kodi bilan qolamiz */
    }
    const err = new Error(message) as ApiError;
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface Me {
  id: number;
  email?: string;
  name?: string;
}

export const api = {
  /** Qaysi kirish usullari sozlangan — sozlanmagan tugma ko'rsatilmaydi */
  providers: () => request<{ google: boolean; apple: boolean }>('/api/auth/providers'),

  /** Sessiya bormi. 401 bo'lsa — kirilmagan. */
  me: () => request<Me>('/api/me'),

  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),

  getProfile: () => request<Record<string, unknown>>('/api/profile'),
  putProfile: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  integrations: () =>
    request<{ connected: { provider: string; scope: string; connected_at: string }[] }>(
      '/api/integrations'
    ),

  /** Ulash manzilini oladi — foydalanuvchi shu manzilga o'tadi */
  integrationConnectUrl: (provider: string) =>
    request<{ url: string }>(`/api/integrations/${provider}/connect`),

  integrationDisconnect: (provider: string) =>
    request<{ ok: true }>(`/api/integrations/${provider}`, { method: 'DELETE' }),

  /** Bugungi haqiqiy yig'ma holat — ball, kaloriya, qadam, suv. */
  summaryToday: () => request<import('./liveMetrics').Summary>('/api/summary/today'),

  /** Uyqu yozuvlari (kunlik daqiqa hisoblash uchun). */
  sleepLogs: () =>
    request<{ id: string; date: string; bedTime: string; wakeTime: string }[]>(
      '/api/data/sleep'
    ),

  // ---------- maqsadlar ----------
  goals: () => request<GoalsResponse>('/api/goals'),
  createGoal: (g: GoalInput) =>
    request<Goal>('/api/goals', { method: 'POST', body: JSON.stringify(g) }),
  updateGoal: (id: string, g: GoalInput) =>
    request<Goal>(`/api/goals/${id}`, { method: 'PUT', body: JSON.stringify(g) }),
  deleteGoal: (id: string) =>
    request<{ ok: true }>(`/api/goals/${id}`, { method: 'DELETE' }),

  // ---------- kunlik reja ----------
  tasks: (date?: string) =>
    request<TasksResponse>(`/api/tasks${date ? `?date=${date}` : ''}`),
  createTask: (t: TaskInput) =>
    request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(t) }),
  updateTask: (id: string, t: TaskInput) =>
    request<Task>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(t) }),
  toggleTask: (id: string) =>
    request<Task>(`/api/tasks/${id}/toggle`, { method: 'POST' }),
  moveTask: (id: string, date: string) =>
    request<Task>(`/api/tasks/${id}/move`, { method: 'POST', body: JSON.stringify({ date }) }),
  deleteTask: (id: string) =>
    request<{ ok: true }>(`/api/tasks/${id}`, { method: 'DELETE' }),

  // ---------- odatlar ----------
  habits: () => request<HabitsResponse>('/api/habits'),
  createHabit: (h: HabitInput) =>
    request<Habit>('/api/habits', { method: 'POST', body: JSON.stringify(h) }),
  updateHabit: (id: string, h: HabitInput) =>
    request<Habit>(`/api/habits/${id}`, { method: 'PUT', body: JSON.stringify(h) }),
  /** Kunni belgilash/olib tashlash. `log` PUT orqali o'zgarmaydi. */
  checkHabit: (id: string, date?: string) =>
    request<Habit>(`/api/habits/${id}/check`, {
      method: 'POST',
      body: JSON.stringify({ date }),
    }),
  deleteHabit: (id: string) =>
    request<{ ok: true }>(`/api/habits/${id}`, { method: 'DELETE' }),

  // ---------- fokus ----------
  focus: (date?: string) =>
    request<FocusResponse>(`/api/focus${date ? `?date=${date}` : ''}`),
  /** Faqat TUGAGAN seans yoziladi; vaqtni server qo'yadi. */
  logFocus: (f: { kind: FocusKind; minutes: number; note?: string; goalId?: string | null }) =>
    request<FocusSession>('/api/focus', { method: 'POST', body: JSON.stringify(f) }),
  deleteFocus: (id: string) =>
    request<{ ok: true }>(`/api/focus/${id}`, { method: 'DELETE' }),

  // ---------- Life Score ----------
  lifeScore: (date?: string) =>
    request<LifeScoreResponse>(`/api/lifescore${date ? `?date=${date}` : ''}`),
  lifeScoreTrend: (days = 30) =>
    request<{ locked: boolean; days?: { date: string; total: number; hasData: boolean }[] }>(
      `/api/lifescore/trend?days=${days}`
    ),

  // ---------- hisobot, prognoz, AI kouch ----------
  review: (period: 'week' | 'month' = 'week') =>
    request<ReviewResponse>(`/api/review?period=${period}`),
  /** AI xulosa — raqamlar baribir serverda hisoblanadi. */
  reviewNarrative: (period: 'week' | 'month' = 'week') =>
    request<NarrativeResponse>('/api/review/narrative', {
      method: 'POST', body: JSON.stringify({ period }),
    }),
  predictions: () => request<PredictionsResponse>('/api/predictions'),
  breakdown: (title: string, deadline: string | null, note = '') =>
    request<{ milestones: { title: string; dueDate: string | null }[]; note: string }>(
      '/api/goals/breakdown',
      { method: 'POST', body: JSON.stringify({ title, deadline, note }) }
    ),
  askCoach: (question: string) =>
    request<{ answer: string }>('/api/coach/ask', {
      method: 'POST', body: JSON.stringify({ question }),
    }),

  // ---------- obuna ----------
  billingStatus: () => request<BillingStatus>('/api/billing/status'),

  /** Buyurtma ochadi va Click sahifasining manzilini qaytaradi. */
  checkout: (plan: string) =>
    request<{ orderId: number; plan: string; amount: number; payUrl: string }>(
      '/api/billing/checkout',
      { method: 'POST', body: JSON.stringify({ plan, returnUrl: window.location.href }) }
    ),

  /** To'lovdan qaytgach holatni tekshirish. */
  order: (id: number) =>
    request<{ orderId: number; state: OrderState; plan: string; amount: number; premium: boolean }>(
      `/api/billing/order/${id}`
    ),
};

// ---------- maqsad turlari (server `goals.ts` bilan mos) ----------
export const GOAL_CATEGORIES = [
  { id: 'learning', label: "O'qish" },
  { id: 'fitness', label: 'Sport' },
  { id: 'health', label: "Sog'liq" },
  { id: 'career', label: 'Karyera' },
  { id: 'finance', label: 'Moliya' },
  { id: 'personal', label: 'Shaxsiy' },
] as const;

export type GoalCategory = (typeof GOAL_CATEGORIES)[number]['id'];

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
}

export interface GoalMetric {
  unit: string;
  start: number;
  target: number;
  current: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  metric: GoalMetric | null;
  milestones: Milestone[];
  startDate: string;
  deadline: string | null;
  status: 'active' | 'done' | 'archived';
  /** Server hisoblab beradi — mijozda qayta hisoblanmaydi. */
  progress: number;
  progressPercent: number;
  daysLeft: number | null;
  milestonesDone: number;
  milestonesTotal: number;
}

/**
 * Serverga yuboriladigan ko'rinish.
 *
 * `milestones` ni ham Omit qilamiz: aks holda `Partial<Goal>` dagi qat'iy
 * `Milestone[]` bilan kesishib, `dueDate` va `id` majburiy bo'lib qolardi —
 * yangi bosqichda esa ularning ikkalasi ham hali yo'q.
 */
export type GoalInput = Partial<
  Omit<
    Goal,
    | 'id' | 'progress' | 'progressPercent' | 'daysLeft'
    | 'milestonesDone' | 'milestonesTotal' | 'milestones'
  >
> & {
  title: string;
  milestones?: { id?: string; title: string; done?: boolean; dueDate?: string | null }[];
};

export interface GoalsResponse {
  goals: Goal[];
  /** null = cheksiz (premium) */
  limit: number | null;
  activeCount: number;
}

// ---------- vazifa turlari (server `tasks.ts` bilan mos) ----------
export const PRIORITIES = [
  { id: 'high', label: 'Muhim', color: '#F87171' },
  { id: 'normal', label: "O'rtacha", color: '#98A29E' },
  { id: 'low', label: 'Past', color: '#5A6360' },
] as const;

export type Priority = (typeof PRIORITIES)[number]['id'];

export interface Task {
  id: string;
  title: string;
  notes: string;
  date: string;
  done: boolean;
  completedAt: string | null;
  priority: Priority;
  goalId: string | null;
  estimateMin: number | null;
  order: number;
  createdAt: string;
}

export type TaskInput = {
  title: string;
  notes?: string;
  date?: string;
  done?: boolean;
  priority?: Priority;
  goalId?: string | null;
  estimateMin?: number | null;
};

export interface TasksResponse {
  date: string;
  tasks: Task[];
  /** O'tgan kunlardagi bajarilmaganlar — faqat bugungi kunni ko'rganda. */
  overdue: Task[];
  /** `percent` null = o'sha kunda umuman vazifa yo'q. */
  stats: { total: number; done: number; percent: number | null };
}

// ---------- odat turlari (server `habits.ts` bilan mos) ----------
export const WEEKDAY_SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

export type HabitSchedule = 'daily' | 'weekdays' | 'custom';

export interface Habit {
  id: string;
  title: string;
  emoji: string;
  schedule: HabitSchedule;
  days: number[];
  color: string;
  status: 'active' | 'archived';
  createdAt: string;
  /** Server hisoblaydi — `log` mijozga umuman yuborilmaydi. */
  doneToday: boolean;
  dueToday: boolean;
  streak: number;
  best: number;
  recent: { date: string; done: boolean; due: boolean }[];
  totalDone: number;
}

export type HabitInput = {
  title: string;
  emoji?: string;
  schedule?: HabitSchedule;
  days?: number[];
  status?: 'active' | 'archived';
};

export interface HabitsResponse {
  habits: Habit[];
  limit: number | null;
  activeCount: number;
  todayDue: number;
  todayDone: number;
}

export interface LifeComponent {
  id: string;
  label: string;
  ratio: number;
  weight: number;
  available: boolean;
  detail: string;
}

/**
 * Bepul rejada server `{ locked: true }` dan boshqa hech narsa yubormaydi —
 * raqamlar umuman kelmaydi, shuning uchun mijoz ularni "taxmin qilib"
 * ko'rsatolmaydi.
 */
export type LifeScoreResponse =
  | { locked: true; upgrade: true }
  | {
      locked: false;
      date: string;
      total: number;
      hasData: boolean;
      grade: string;
      components: LifeComponent[];
      weakest: LifeComponent | null;
    };

// ---------- fokus turlari (server `focus.ts` bilan mos) ----------
export const FOCUS_KINDS = [
  { id: 'study', label: "O'qish" },
  { id: 'work', label: 'Ish' },
  { id: 'skill', label: 'Mahorat' },
  { id: 'hobby', label: 'Hobbi' },
] as const;

export type FocusKind = (typeof FOCUS_KINDS)[number]['id'];

export interface FocusSession {
  id: string;
  timestamp: string;
  kind: FocusKind;
  minutes: number;
  note: string;
  goalId: string | null;
}

export interface FocusResponse {
  date: string;
  sessions: FocusSession[];
  minutes: number;
  target: number;
  percent: number;
  byKind: { kind: FocusKind; label: string; minutes: number }[];
  week: { date: string; minutes: number }[];
}

// ---------- hisobot turlari (server `review.ts` bilan mos) ----------
export interface Prediction {
  goalId: string;
  title: string;
  current: number;
  perDay: number;
  requiredPerDay: number | null;
  projectedDate: string | null;
  daysLate: number | null;
  onTrack: boolean | null;
  confidence: 'low' | 'medium' | 'high';
  message: string;
}

export interface Review {
  from: string;
  to: string;
  days: number;
  tasks: { done: number; total: number; percent: number | null };
  habits: { done: number; due: number; percent: number | null };
  focus: { minutes: number; perDay: number };
  lifeScore: {
    average: number | null;
    best: { date: string; total: number } | null;
    worst: { date: string; total: number } | null;
    daysWithData: number;
  };
  previousAverage: number | null;
  trend: 'up' | 'down' | 'flat' | null;
  weakest: { id: string; label: string } | null;
  topStreak: { title: string; streak: number } | null;
  highlights: string[];
}

export type ReviewResponse = { locked: true; upgrade: true } | ({ locked: false } & Review);

export interface Narrative {
  summary: string;
  win: string;
  problem: string;
  nextWeek: string[];
}

export type NarrativeResponse =
  | { locked: true; upgrade: true }
  | { locked: false; review: Review; narrative: Narrative };

export type PredictionsResponse =
  | { locked: true; upgrade: true }
  | { locked: false; predictions: Prediction[] };

export type OrderState = 'created' | 'prepared' | 'paid' | 'cancelled';

export interface Plan {
  id: string;
  title: string;
  days: number;
  /** So'mda, butun son. Konvertatsiya QILINMAYDI. */
  amount: number;
  perMonth: number;
  badge?: string;
}

export interface BillingStatus {
  premium: boolean;
  premiumUntil: string | null;
  plans: Plan[];
  limits: { goals: number | null; habits: number | null; aiPerDay: number };
  /** Click sozlanmagan bo'lsa sotib olish tugmasi ko'rsatilmaydi. */
  available: boolean;
}

/** Google kirish sahifasiga o'tish (server yo'naltiradi) */
export function startGoogleLogin() {
  window.location.href = '/api/auth/oauth/google';
}
