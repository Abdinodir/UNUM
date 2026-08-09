import React, { useEffect, useState } from 'react';
import { Check, Crown, Flame, Loader2, Plus, Repeat } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  api,
  WEEKDAY_SHORT,
  type Habit,
  type HabitInput,
  type HabitSchedule,
  type HabitsResponse,
} from '../../lib/api';

const EMOJIS = ['🎯', '🏃', '📚', '💧', '🧘', '🛏️', '🚭', '💪', '🍎', '✍️', '🕌', '🧹'];

const scheduleLabel = (h: Habit) => {
  if (h.schedule === 'daily') return 'Har kuni';
  if (h.schedule === 'weekdays') return 'Ish kunlari';
  return h.days.map((d) => WEEKDAY_SHORT[d]).join(', ');
};

// ==================== BITTA ODAT ====================
const HabitCard: React.FC<{
  habit: Habit;
  onCheck: () => void;
  onOpen: () => void;
}> = ({ habit, onCheck, onOpen }) => (
  <Card className="mb-2.5">
    <div className="flex items-center gap-3">
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="text-[18px] leading-none">{habit.emoji}</span>
          <span className="truncate text-[15px] font-semibold text-white">{habit.title}</span>
        </div>
        <div className="mt-1 flex items-center gap-2.5">
          <span className="text-[11.5px] text-[#7B8481]">{scheduleLabel(habit)}</span>
          {habit.streak > 0 && (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#F59E0B]">
              <Flame size={12} /> {habit.streak} kun
            </span>
          )}
        </div>
      </button>

      {/* Bugun talab qilinmaydigan kun bo'lsa ham belgilash mumkin —
          odam rejadan tashqari bajarsa, uni to'sib qo'yish noto'g'ri. */}
      <button
        onClick={onCheck}
        aria-pressed={habit.doneToday}
        aria-label={habit.doneToday ? 'Belgini olib tashlash' : 'Bajarildi deb belgilash'}
        className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          habit.doneToday
            ? 'border-[#22C55E] bg-[#22C55E]'
            : habit.dueToday
            ? 'border-white/20'
            : 'border-white/10'
        }`}
      >
        {habit.doneToday && <Check size={19} strokeWidth={3} className="text-[#07130C]" />}
      </button>
    </div>

    {/* Oxirgi 14 kun */}
    <div className="mt-3 flex items-end gap-[3px]">
      {habit.recent.map((d) => (
        <span
          key={d.date}
          title={d.date}
          className={`h-[18px] flex-1 rounded-[3px] ${
            d.done ? 'bg-[#22C55E]' : d.due ? 'bg-white/[0.09]' : 'bg-white/[0.04]'
          }`}
        />
      ))}
    </div>
  </Card>
);

// ==================== TAHRIR ====================
const HabitSheet: React.FC<{
  habit: Habit | null;
  onSave: (h: HabitInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}> = ({ habit, onSave, onDelete, onClose }) => {
  const [title, setTitle] = useState(habit?.title ?? '');
  const [emoji, setEmoji] = useState(habit?.emoji ?? '🎯');
  const [schedule, setSchedule] = useState<HabitSchedule>(habit?.schedule ?? 'daily');
  const [days, setDays] = useState<number[]>(habit?.days ?? [1, 2, 3, 4, 5]);
  const [archived, setArchived] = useState(habit?.status === 'archived');

  const field =
    'w-full rounded-[14px] bg-[#0E1211] border border-white/[0.08] px-3.5 py-3 ' +
    'text-[15px] text-white placeholder:text-[#5A6360] outline-none focus:border-[#22C55E]/60';

  const toggleDay = (d: number) =>
    setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort()));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] border-t border-white/[0.08] bg-[#131717] p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/15" />

        <input
          className={field}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Masalan: Ertalab yugurish"
          maxLength={200}
          autoFocus
        />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              aria-pressed={emoji === e}
              className={`flex h-[38px] w-[38px] items-center justify-center rounded-[12px] text-[18px] ${
                emoji === e ? 'bg-[#22C55E]/20 ring-1 ring-[#22C55E]' : 'bg-[#1B2020]'
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          {([
            ['daily', 'Har kuni'],
            ['weekdays', 'Ish kunlari'],
            ['custom', 'Tanlangan'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSchedule(value)}
              aria-pressed={schedule === value}
              className={`flex-1 rounded-[12px] py-2.5 text-[12.5px] font-medium transition-colors ${
                schedule === value
                  ? 'bg-[#22C55E] text-[#07130C]'
                  : 'bg-[#1B2020] text-[#98A29E] border border-white/[0.07]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {schedule === 'custom' && (
          <div className="mt-3 flex gap-1.5">
            {WEEKDAY_SHORT.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                aria-pressed={days.includes(i)}
                className={`h-10 flex-1 rounded-[12px] text-[12.5px] font-medium ${
                  days.includes(i)
                    ? 'bg-[#22C55E] text-[#07130C]'
                    : 'bg-[#1B2020] text-[#98A29E] border border-white/[0.07]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {habit && (
          <button
            onClick={() => setArchived((v) => !v)}
            className="mt-4 flex w-full items-center justify-between rounded-[14px] bg-[#1B2020] px-3.5 py-3 text-[14px] text-white"
          >
            Arxivlangan
            <span className={`text-[13px] ${archived ? 'text-[#22C55E]' : 'text-[#7B8481]'}`}>
              {archived ? 'Ha' : "Yo'q"}
            </span>
          </button>
        )}

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
            onClick={() =>
              title.trim() &&
              onSave({
                title: title.trim(),
                emoji,
                schedule,
                days,
                status: archived ? 'archived' : 'active',
              })
            }
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

// ==================== ASOSIY ====================
export const HabitsView: React.FC = () => {
  const [data, setData] = useState<HabitsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Habit | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = () =>
    api.habits().then((d) => { setData(d); setError(null); })
      .catch((e) => setError((e as Error).message));

  useEffect(() => { load(); }, []);

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

  const active = data?.habits.filter((h) => h.status === 'active') ?? [];
  const archived = data?.habits.filter((h) => h.status === 'archived') ?? [];
  const atLimit = data?.limit != null && active.length >= data.limit;

  return (
    <>
      {data && data.todayDue > 0 && (
        <Card className="mb-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-[#98A29E]">Bugun</span>
            <span className="text-[17px] font-semibold tabular-nums text-[#22C55E]">
              {data.todayDone} / {data.todayDue}
            </span>
          </div>
        </Card>
      )}

      {error && (
        <Card className="mb-3">
          <p className="text-[13px] text-[#F87171]">{error}</p>
        </Card>
      )}

      {!data && !error && (
        <div className="flex justify-center py-14">
          <Loader2 className="h-6 w-6 animate-spin text-[#22C55E]" />
        </div>
      )}

      {data && active.length === 0 && (
        <div className="py-12 text-center">
          <Repeat size={36} className="mx-auto mb-3 text-[#2E3735]" strokeWidth={1.6} />
          <p className="text-[16px] font-semibold text-white">Hali odat yo&rsquo;q</p>
          <p className="mx-auto mt-1.5 max-w-[270px] text-[13px] leading-snug text-[#7B8481]">
            Kichik odatdan boshlang. Ketma-ketlik uzilmasa, natija o&rsquo;zi keladi.
          </p>
          <Button className="mt-5" onClick={() => setEditing('new')}>
            Odat qo&rsquo;shish
          </Button>
        </div>
      )}

      {active.map((h) => (
        <HabitCard
          key={h.id}
          habit={h}
          onCheck={() => act(() => api.checkHabit(h.id))}
          onOpen={() => setEditing(h)}
        />
      ))}

      {data && active.length > 0 && (
        atLimit ? (
          <Card className="mt-1 border-[#22C55E]/25 bg-[#22C55E]/[0.06]">
            <div className="flex items-start gap-2.5">
              <Crown size={18} className="mt-0.5 shrink-0 text-[#22C55E]" />
              <div>
                <p className="text-[13.5px] font-semibold text-white">
                  Bepul rejada {data.limit} ta odat
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-[#98A29E]">
                  Cheksiz odat uchun Premium. Yoki keraksizini arxivlang.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Button variant="secondary" full className="mt-1" onClick={() => setEditing('new')}>
            <Plus size={17} /> Yangi odat
          </Button>
        )
      )}

      {archived.length > 0 && (
        <>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="mb-2.5 mt-6 text-[13px] font-semibold tracking-tight text-[#7B8481]"
          >
            Arxiv ({archived.length}) {showArchived ? '▴' : '▾'}
          </button>
          {showArchived && archived.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              onCheck={() => act(() => api.checkHabit(h.id))}
              onOpen={() => setEditing(h)}
            />
          ))}
        </>
      )}

      {editing && (
        <HabitSheet
          habit={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDelete={editing === 'new' ? undefined : () => act(() => api.deleteHabit(editing.id))}
          onSave={(input) =>
            act(() =>
              editing === 'new' ? api.createHabit(input) : api.updateHabit(editing.id, input)
            )
          }
        />
      )}
    </>
  );
};
