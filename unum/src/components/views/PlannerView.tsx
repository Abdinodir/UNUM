import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock, Loader2, Plus, Target, X } from 'lucide-react';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import {
  api,
  PRIORITIES,
  type Goal,
  type Priority,
  type Task,
  type TasksResponse,
} from '../../lib/api';

/** Lokal kun kaliti. Server ham Asia/Tashkent da hisoblaydi (day.ts). */
const dayKey = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const shift = (key: string, days: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + days));
};

const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

function dayLabel(key: string, today: string): string {
  if (key === today) return 'Bugun';
  if (key === shift(today, 1)) return 'Ertaga';
  if (key === shift(today, -1)) return 'Kecha';
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${d}-${MONTHS[m - 1]}, ${WEEKDAYS[date.getDay()]}`;
}

const priorityColor = (p: Priority) =>
  PRIORITIES.find((x) => x.id === p)?.color ?? '#98A29E';

// ==================== BITTA VAZIFA ====================
const TaskRow: React.FC<{
  task: Task;
  goalTitle?: string;
  onToggle: () => void;
  onOpen: () => void;
  onMoveToday?: () => void;
}> = ({ task, goalTitle, onToggle, onOpen, onMoveToday }) => (
  <div className="flex items-start gap-3 border-b border-white/[0.05] px-4 py-3 last:border-0">
    <button
      onClick={onToggle}
      aria-pressed={task.done}
      aria-label={task.done ? 'Bajarilmagan deb belgilash' : 'Bajarildi deb belgilash'}
      className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors ${
        task.done ? 'border-[#22C55E] bg-[#22C55E]' : 'border-white/20'
      }`}
      style={!task.done && task.priority === 'high' ? { borderColor: '#F87171' } : undefined}
    >
      {task.done && <Check size={13} strokeWidth={3.2} className="text-[#07130C]" />}
    </button>

    <button onClick={onOpen} className="min-w-0 flex-1 text-left">
      <p
        className={`text-[14.5px] leading-snug ${
          task.done ? 'text-[#5A6360] line-through' : 'text-white'
        }`}
      >
        {task.title}
      </p>

      {(task.estimateMin || goalTitle || task.priority === 'high') && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {task.priority === 'high' && !task.done && (
            <span
              className="text-[11px] font-medium"
              style={{ color: priorityColor('high') }}
            >
              Muhim
            </span>
          )}
          {task.estimateMin != null && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#7B8481]">
              <Clock size={11} /> {task.estimateMin} daq
            </span>
          )}
          {goalTitle && (
            <span className="inline-flex min-w-0 items-center gap-1 text-[11px] text-[#7B8481]">
              <Target size={11} className="shrink-0" />
              <span className="truncate">{goalTitle}</span>
            </span>
          )}
        </div>
      )}
    </button>

    {onMoveToday && (
      <button
        onClick={onMoveToday}
        className="shrink-0 rounded-full bg-[#22C55E]/12 px-2.5 py-1 text-[11px] font-medium text-[#22C55E]"
      >
        Bugunga
      </button>
    )}
  </div>
);

// ==================== TAHRIR OYNASI ====================
const TaskSheet: React.FC<{
  task: Task | null;
  date: string;
  goals: Goal[];
  onSave: (t: { title: string; priority: Priority; estimateMin: number | null; goalId: string | null; notes: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}> = ({ task, goals, onSave, onDelete, onClose }) => {
  const [title, setTitle] = useState(task?.title ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'normal');
  const [estimate, setEstimate] = useState(task?.estimateMin ? String(task.estimateMin) : '');
  const [goalId, setGoalId] = useState(task?.goalId ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      priority,
      estimateMin: estimate ? Number(estimate) : null,
      goalId: goalId || null,
      notes: notes.trim(),
    });
  };

  const field =
    'w-full rounded-[14px] bg-[#0E1211] border border-white/[0.08] px-3.5 py-3 ' +
    'text-[15px] text-white placeholder:text-[#5A6360] outline-none focus:border-[#22C55E]/60';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-[430px] rounded-t-[24px] border-t border-white/[0.08] bg-[#131717] p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/15" />

        <input
          ref={inputRef}
          className={field}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Nima qilish kerak?"
          maxLength={300}
        />

        <div className="mt-3 flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p.id}
              onClick={() => setPriority(p.id)}
              aria-pressed={priority === p.id}
              className={`flex-1 rounded-[12px] py-2 text-[12.5px] font-medium transition-colors ${
                priority === p.id
                  ? 'bg-[#22C55E] text-[#07130C]'
                  : 'bg-[#1B2020] text-[#98A29E] border border-white/[0.07]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <input
            className={field}
            type="number"
            inputMode="numeric"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            placeholder="Daqiqa"
          />
          <select
            className={`${field} appearance-none`}
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
          >
            <option value="">Maqsadsiz</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </div>

        <textarea
          className={`${field} mt-3 min-h-[64px] resize-none`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Izoh (ixtiyoriy)"
          maxLength={2000}
        />

        <div className="mt-4 flex gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              className="rounded-[16px] border border-[#EF4444]/25 bg-[#EF4444]/12 px-4 py-3 text-[14px] font-semibold text-[#F87171]"
            >
              O&rsquo;chirish
            </button>
          )}
          <button
            onClick={submit}
            disabled={!title.trim()}
            className={`flex-1 rounded-[16px] py-3 text-[15px] font-semibold ${
              title.trim() ? 'bg-[#22C55E] text-[#07130C]' : 'bg-[#1B2020] text-[#4B5450]'
            }`}
          >
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== ASOSIY KO'RINISH ====================
export const PlannerView: React.FC = () => {
  const today = dayKey(new Date());
  const [date, setDate] = useState(today);
  const [data, setData] = useState<TasksResponse | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | 'new' | null>(null);

  const load = (d = date) =>
    api.tasks(d).then(setData).catch((e) => setError((e as Error).message));

  useEffect(() => {
    load(date);
  }, [date]);

  useEffect(() => {
    // Vazifani maqsadga bog'lash uchun ro'yxat kerak. Xato bo'lsa jim
    // o'tamiz — maqsadsiz ham vazifa yaratish mumkin bo'lishi kerak.
    api.goals().then((r) => setGoals(r.goals.filter((g) => g.status === 'active'))).catch(() => {});
  }, []);

  const goalTitle = (id: string | null) =>
    id ? goals.find((g) => g.id === id)?.title : undefined;

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
      setEditing(null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stats = data?.stats;

  return (
    <>
      {/* Kun tanlagich */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setDate(shift(date, -1))}
          aria-label="Oldingi kun"
          className="flex h-9 w-9 items-center justify-center rounded-full active:bg-white/[0.06]"
        >
          <ChevronLeft size={20} className="text-[#98A29E]" />
        </button>

        <button
          onClick={() => setDate(today)}
          className="text-[15px] font-semibold text-white"
        >
          {dayLabel(date, today)}
        </button>

        <button
          onClick={() => setDate(shift(date, 1))}
          aria-label="Keyingi kun"
          className="flex h-9 w-9 items-center justify-center rounded-full active:bg-white/[0.06]"
        >
          <ChevronRight size={20} className="text-[#98A29E]" />
        </button>
      </div>

      {/* Kun yakuni */}
      {stats && stats.total > 0 && (
        <Card className="mb-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-[#98A29E]">
              {stats.done} / {stats.total} bajarildi
            </span>
            <span className="text-[17px] font-semibold tabular-nums text-[#22C55E]">
              {stats.percent}%
            </span>
          </div>
          <ProgressBar percent={stats.percent ?? 0} color="#22C55E" className="mt-2.5" />
        </Card>
      )}

      {error && (
        <Card className="mb-3">
          <p className="text-[13px] text-[#F87171]">{error}</p>
        </Card>
      )}

      {/* Kechikkanlar */}
      {data && data.overdue.length > 0 && (
        <>
          <h2 className="mb-2 mt-1 text-[12.5px] font-semibold tracking-tight text-[#F87171]">
            Kechikkan ({data.overdue.length})
          </h2>
          <Card flush className="mb-4 border-[#EF4444]/20">
            {data.overdue.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                goalTitle={goalTitle(t.goalId)}
                onToggle={() => act(() => api.toggleTask(t.id))}
                onOpen={() => setEditing(t)}
                onMoveToday={() => act(() => api.moveTask(t.id, today))}
              />
            ))}
          </Card>
        </>
      )}

      {/* Kun rejasi */}
      {!data && !error && (
        <div className="flex justify-center py-14">
          <Loader2 className="h-6 w-6 animate-spin text-[#22C55E]" />
        </div>
      )}

      {data && data.tasks.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[15px] font-semibold text-white">
            {date === today ? 'Bugunga reja yo’q' : 'Bu kunga reja yo’q'}
          </p>
          <p className="mx-auto mt-1.5 max-w-[260px] text-[13px] leading-snug text-[#7B8481]">
            Kunni 3 ta muhim ishdan boshlang — qolgani o&rsquo;z-o&rsquo;zidan quyiladi.
          </p>
        </div>
      ) : (
        data && (
          <Card flush className="mb-3">
            {data.tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                goalTitle={goalTitle(t.goalId)}
                onToggle={() => act(() => api.toggleTask(t.id))}
                onOpen={() => setEditing(t)}
              />
            ))}
          </Card>
        )
      )}

      <button
        onClick={() => setEditing('new')}
        className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-white/[0.07] bg-[#1B2020] py-3.5 text-[14.5px] font-medium text-white"
      >
        <Plus size={17} /> Vazifa qo&rsquo;shish
      </button>

      {editing && (
        <TaskSheet
          task={editing === 'new' ? null : editing}
          date={date}
          goals={goals}
          onClose={() => setEditing(null)}
          onDelete={
            editing === 'new' ? undefined : () => act(() => api.deleteTask(editing.id))
          }
          onSave={(input) =>
            act(() =>
              editing === 'new'
                ? api.createTask({ ...input, date })
                : api.updateTask(editing.id, { ...input, date: editing.date, done: editing.done })
            )
          }
        />
      )}
    </>
  );
};
