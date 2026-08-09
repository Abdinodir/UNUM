import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play, RotateCcw, X } from 'lucide-react';
import { TopBar } from '../shell/TopBar';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { api, FOCUS_KINDS, type FocusKind, type FocusResponse } from '../../lib/api';

const PRESETS = [15, 25, 45, 60];
const WEEKDAY = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

const mmss = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

/**
 * Pomodoro taymeri.
 *
 * Taymer BRAUZERDA ishlaydi, server faqat tugagan seansni oladi. Qolgan
 * vaqt `endsAt` (aniq tugash vaqti) dan hisoblanadi, `setInterval` ni
 * sanab emas — fon tabida brauzer intervalni sekinlashtiradi va sanoq
 * orqada qolib ketardi.
 */
export const FocusView: React.FC<{ header?: React.ReactNode }> = ({ header }) => {
  const [data, setData] = useState<FocusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [planned, setPlanned] = useState(25);
  const [kind, setKind] = useState<FocusKind>('study');
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const doneRef = useRef(false);

  const load = () =>
    api.focus().then((d) => { setData(d); setError(null); })
      .catch((e) => setError((e as Error).message));

  useEffect(() => { load(); }, []);

  // Sanoq
  useEffect(() => {
    if (!running || endsAt == null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0 && !doneRef.current) {
        doneRef.current = true;
        finish(planned);
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [running, endsAt, planned]);

  const start = () => {
    doneRef.current = false;
    setEndsAt(Date.now() + left * 1000);
    setRunning(true);
  };

  const pause = () => {
    setRunning(false);
    setEndsAt(null);
  };

  const reset = () => {
    setRunning(false);
    setEndsAt(null);
    setLeft(planned * 60);
    doneRef.current = false;
  };

  const finish = async (minutes: number) => {
    setRunning(false);
    setEndsAt(null);
    setLeft(planned * 60);
    if (minutes < 1) return;
    try {
      await api.logFocus({ kind, minutes });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  /** Muddatidan oldin tugatish — o'tgan vaqt yoziladi, rejalashtirilgani emas. */
  const stopEarly = () => {
    const spent = Math.round((planned * 60 - left) / 60);
    doneRef.current = true;
    if (spent >= 1) finish(spent);
    else reset();
  };

  const choosePreset = (m: number) => {
    if (running) return;
    setPlanned(m);
    setLeft(m * 60);
  };

  const ratio = planned > 0 ? 1 - left / (planned * 60) : 0;
  const maxWeek = Math.max(1, ...(data?.week.map((w) => w.minutes) ?? [1]));

  return (
    <>
      <TopBar title="Fokus" />
      <div className="px-4 pb-[120px]">
        {header}
        {/* Taymer */}
        <Card className="mb-4 text-center">
          <div className="relative mx-auto h-[190px] w-[190px]">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#1B2020" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke="#22C55E" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - ratio)}`}
                style={{ transition: 'stroke-dashoffset 0.5s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[38px] font-bold tabular-nums tracking-tight text-white">
                {mmss(left)}
              </span>
              <span className="mt-0.5 text-[12px] text-[#7B8481]">
                {FOCUS_KINDS.find((k) => k.id === kind)?.label}
              </span>
            </div>
          </div>

          {/* Davomiylik */}
          <div className="mt-4 flex justify-center gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => choosePreset(m)}
                disabled={running}
                aria-pressed={planned === m}
                className={`rounded-[12px] px-3.5 py-2 text-[13px] font-medium transition-colors ${
                  planned === m
                    ? 'bg-[#22C55E] text-[#07130C]'
                    : 'bg-[#1B2020] text-[#98A29E] border border-white/[0.07]'
                } ${running ? 'opacity-40' : ''}`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Tur */}
          <div className="mt-2.5 flex justify-center gap-2">
            {FOCUS_KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => !running && setKind(k.id)}
                disabled={running}
                aria-pressed={kind === k.id}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                  kind === k.id ? 'bg-[#22C55E]/18 text-[#34D77F]' : 'text-[#7B8481]'
                } ${running ? 'opacity-40' : ''}`}
              >
                {k.label}
              </button>
            ))}
          </div>

          {/* Boshqaruv */}
          <div className="mt-5 flex items-center justify-center gap-3">
            {!running ? (
              <button
                onClick={start}
                className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#22C55E] text-[#07130C]"
                aria-label="Boshlash"
              >
                <Play size={24} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={pause}
                className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#1B2020] text-white"
                aria-label="Pauza"
              >
                <Pause size={22} fill="currentColor" />
              </button>
            )}

            {left < planned * 60 && (
              <>
                <button
                  onClick={reset}
                  className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#1B2020] text-[#98A29E]"
                  aria-label="Boshidan"
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  onClick={stopEarly}
                  className="rounded-full bg-[#1B2020] px-4 py-2.5 text-[13px] font-medium text-[#34D77F]"
                >
                  Tugatish
                </button>
              </>
            )}
          </div>
        </Card>

        {error && (
          <Card className="mb-3"><p className="text-[13px] text-[#F87171]">{error}</p></Card>
        )}

        {!data && !error && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" />
          </div>
        )}

        {data && (
          <>
            {/* Bugungi yakun */}
            <Card className="mb-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-[#98A29E]">Bugun</span>
                <span className="text-[17px] font-semibold tabular-nums text-white">
                  {data.minutes}
                  <span className="ml-1 text-[13px] font-normal text-[#7B8481]">
                    / {data.target} daq
                  </span>
                </span>
              </div>
              <ProgressBar percent={data.percent} color="#22C55E" className="mt-2.5" />

              {data.byKind.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                  {data.byKind.map((k) => (
                    <span key={k.kind} className="text-[11.5px] text-[#7B8481]">
                      {k.label} <span className="text-[#C7CFCC]">{k.minutes} daq</span>
                    </span>
                  ))}
                </div>
              )}
            </Card>

            {/* Hafta */}
            <Card className="mb-3">
              <p className="mb-3 text-[13px] text-[#98A29E]">Oxirgi 7 kun</p>
              <div className="flex h-[64px] items-end gap-1.5">
                {data.week.map((w) => {
                  const [, , dd] = w.date.split('-');
                  const wd = new Date(`${w.date}T00:00:00Z`).getUTCDay();
                  return (
                    <div key={w.date} className="flex flex-1 flex-col items-center gap-1.5">
                      <div
                        className="w-full rounded-[3px] bg-[#22C55E]"
                        style={{
                          height: `${Math.max(2, (w.minutes / maxWeek) * 44)}px`,
                          opacity: w.minutes ? 1 : 0.15,
                        }}
                        title={`${w.date}: ${w.minutes} daq`}
                      />
                      <span className="text-[10px] text-[#5A6360]">{WEEKDAY[wd]}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Seanslar */}
            {data.sessions.length > 0 && (
              <Card flush>
                {data.sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-3 last:border-0"
                  >
                    <span className="text-[14px] font-semibold tabular-nums text-white">
                      {s.minutes}
                      <span className="ml-0.5 text-[11px] font-normal text-[#7B8481]">daq</span>
                    </span>
                    <span className="flex-1 truncate text-[13px] text-[#98A29E]">
                      {FOCUS_KINDS.find((k) => k.id === s.kind)?.label}
                      {s.note && ` · ${s.note}`}
                    </span>
                    <span className="text-[11.5px] tabular-nums text-[#5A6360]">
                      {new Date(s.timestamp).toLocaleTimeString('uz-UZ', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    <button
                      onClick={() => api.deleteFocus(s.id).then(load)}
                      aria-label="Seansni o'chirish"
                      className="p-1 text-[#4B5450]"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
};
