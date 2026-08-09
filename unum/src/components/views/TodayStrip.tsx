import React, { useEffect, useState } from 'react';
import { CheckSquare, Repeat, Timer } from 'lucide-react';
import { Card } from '../ui/Card';
import { api } from '../../lib/api';

/**
 * Bosh ekrandagi "Bugun" chizig'i — reja, odat va fokusning qisqa yakuni.
 *
 * NIMA UCHUN LIFE SCORE'DAN ALOHIDA. Life Score premium funksiya, ya'ni
 * bepul foydalanuvchi bosh ekranda kunlik holatini UMUMAN ko'rmasdi va
 * ilovaga qaytish sababi qolmasdi. Bu chiziq — hammaga ochiq, ballsiz
 * xom raqamlar; Life Score esa ularning ustidagi tahlil qatlami.
 */
interface Summary {
  tasks: { done: number; total: number };
  habits: { done: number; due: number };
  focus: { minutes: number; target: number };
}

export const TodayStrip: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    // Uchala so'rov parallel; bittasi yiqilsa qolganlari baribir ko'rsatiladi.
    Promise.allSettled([api.tasks(), api.habits(), api.focus()]).then(
      ([t, h, f]) => {
        setS({
          tasks: t.status === 'fulfilled'
            ? { done: t.value.stats.done, total: t.value.stats.total }
            : { done: 0, total: 0 },
          habits: h.status === 'fulfilled'
            ? { done: h.value.todayDone, due: h.value.todayDue }
            : { done: 0, due: 0 },
          focus: f.status === 'fulfilled'
            ? { minutes: f.value.minutes, target: f.value.target }
            : { minutes: 0, target: 0 },
        });
      }
    );
  }, []);

  if (!s) return null;

  const nothing =
    s.tasks.total === 0 && s.habits.due === 0 && s.focus.minutes === 0;

  const cells = [
    {
      Icon: CheckSquare,
      label: 'Reja',
      value: s.tasks.total ? `${s.tasks.done}/${s.tasks.total}` : '—',
      done: s.tasks.total > 0 && s.tasks.done === s.tasks.total,
    },
    {
      Icon: Repeat,
      label: 'Odat',
      value: s.habits.due ? `${s.habits.done}/${s.habits.due}` : '—',
      done: s.habits.due > 0 && s.habits.done === s.habits.due,
    },
    {
      Icon: Timer,
      label: 'Fokus',
      value: s.focus.minutes ? `${s.focus.minutes} daq` : '—',
      done: s.focus.target > 0 && s.focus.minutes >= s.focus.target,
    },
  ];

  return (
    <Card onClick={onOpen}>
      {nothing ? (
        <p className="text-[13px] leading-snug text-[#98A29E]">
          Bugun hali hech narsa belgilanmagan. Rejaga bitta vazifa
          qo&rsquo;shishdan boshlang.
        </p>
      ) : (
        <div className="flex items-center">
          {cells.map(({ Icon, label, value, done }, i) => (
            <div
              key={label}
              className={`flex flex-1 flex-col items-center gap-1 ${
                i > 0 ? 'border-l border-white/[0.06]' : ''
              }`}
            >
              <Icon size={16} className={done ? 'text-[#22C55E]' : 'text-[#7B8481]'} />
              <span
                className={`text-[15px] font-semibold tabular-nums ${
                  done ? 'text-[#22C55E]' : 'text-white'
                }`}
              >
                {value}
              </span>
              <span className="text-[10.5px] text-[#7B8481]">{label}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
