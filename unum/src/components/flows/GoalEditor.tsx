import React, { useState } from 'react';
import { Check, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { SubScreen } from '../ui/SubScreen';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  api,
  GOAL_CATEGORIES,
  type Goal,
  type GoalCategory,
  type GoalInput,
} from '../../lib/api';

interface Props {
  /** null = yangi maqsad */
  goal: Goal | null;
  saving: boolean;
  onSave: (input: GoalInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/** Tahrir paytidagi bosqich — `id` faqat mavjudlarida bo'ladi. */
interface DraftMilestone {
  id?: string;
  title: string;
  done: boolean;
  /** React ro'yxati uchun barqaror kalit; serverga YUBORILMAYDI. */
  key: string;
}

let keySeq = 0;
const nextKey = () => `m${++keySeq}`;

const inputClass =
  'w-full rounded-[14px] bg-[#0E1211] border border-white/[0.08] px-3.5 py-3 ' +
  'text-[15px] text-white placeholder:text-[#5A6360] outline-none ' +
  'focus:border-[#22C55E]/60 transition-colors';

const labelClass = 'mb-1.5 block text-[12.5px] font-medium text-[#98A29E]';

export const GoalEditor: React.FC<Props> = ({ goal, saving, onSave, onDelete, onClose }) => {
  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [category, setCategory] = useState<GoalCategory>(goal?.category ?? 'personal');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [status, setStatus] = useState(goal?.status ?? 'active');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);

  const [milestones, setMilestones] = useState<DraftMilestone[]>(
    (goal?.milestones ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      done: m.done,
      key: nextKey(),
    }))
  );

  // Raqamli o'lchov ixtiyoriy — "IELTS 7" da kerak emas, "10 kg ozish" da kerak.
  const [useMetric, setUseMetric] = useState(Boolean(goal?.metric));
  const [unit, setUnit] = useState(goal?.metric?.unit ?? '');
  const [start, setStart] = useState(String(goal?.metric?.start ?? ''));
  const [target, setTarget] = useState(String(goal?.metric?.target ?? ''));
  const [current, setCurrent] = useState(String(goal?.metric?.current ?? ''));

  const addMilestone = () =>
    setMilestones((list) => [...list, { title: '', done: false, key: nextKey() }]);

  const patchMilestone = (key: string, patch: Partial<DraftMilestone>) =>
    setMilestones((list) => list.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  const removeMilestone = (key: string) =>
    setMilestones((list) => list.filter((m) => m.key !== key));

  const canSave = title.trim().length > 0 && !saving;

  /**
   * AI bilan bosqichlarga bo'lish.
   *
   * Natija darhol SAQLANMAYDI — muharrirga qo'yiladi, foydalanuvchi ko'rib,
   * tahrirlab, keyin o'zi saqlaydi. AI taklifini so'ramasdan yozib qo'yish
   * foydalanuvchining maqsadini uning ruxsatisiz o'zgartirish bo'lardi.
   */
  const breakdown = async () => {
    if (!title.trim()) return;
    setBreaking(true);
    setAiError(null);
    try {
      const r = await api.breakdown(title.trim(), deadline || null, description.trim());
      setMilestones((list) => [
        ...list.filter((m) => m.title.trim()),
        ...r.milestones.map((m) => ({ title: m.title, done: false, key: nextKey() })),
      ]);
      setAiNote(r.note);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setBreaking(false);
    }
  };

  const submit = () => {
    if (!canSave) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      category,
      deadline: deadline || null,
      status,
      // Bo'sh nomli bosqichlarni yubormaymiz — server ularni baribir
      // tashlab yuboradi, lekin bu yerda tozalash foydalanuvchiga
      // kutilgan natijani beradi.
      milestones: milestones
        .filter((m) => m.title.trim())
        .map((m) => ({ id: m.id, title: m.title.trim(), done: m.done })),
      metric: useMetric
        ? {
            unit: unit.trim() || 'birlik',
            start: Number(start) || 0,
            target: Number(target) || 0,
            current: Number(current) || Number(start) || 0,
          }
        : null,
    });
  };

  return (
    <SubScreen
      title={goal ? 'Maqsadni tahrirlash' : 'Yangi maqsad'}
      onBack={onClose}
      action={
        <button
          onClick={submit}
          disabled={!canSave}
          className={`text-[15px] font-semibold ${
            canSave ? 'text-[#22C55E]' : 'text-[#4B5450]'
          }`}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : 'Saqlash'}
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="goal-title">Maqsad</label>
          <input
            id="goal-title"
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Masalan: IELTS 7.0 olish"
            maxLength={200}
            autoFocus={!goal}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="goal-desc">Izoh (ixtiyoriy)</label>
          <textarea
            id="goal-desc"
            className={`${inputClass} min-h-[76px] resize-none`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Nima uchun bu maqsad muhim?"
            maxLength={2000}
          />
        </div>

        <div>
          <span className={labelClass}>Soha</span>
          <div className="flex flex-wrap gap-2">
            {GOAL_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
                className={`rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
                  category === c.id
                    ? 'bg-[#22C55E] text-[#07130C]'
                    : 'bg-[#1B2020] text-[#98A29E] border border-white/[0.07]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="goal-deadline">Muddat (ixtiyoriy)</label>
          <input
            id="goal-deadline"
            type="date"
            className={inputClass}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        {/* ---------- Bosqichlar ---------- */}
        <div>
          <span className={labelClass}>Bosqichlar</span>
          <Card flush className="overflow-hidden">
            {milestones.length === 0 && (
              <p className="px-4 py-3.5 text-[13px] text-[#7B8481]">
                Bosqichlarga bo&rsquo;lsangiz progress avtomatik hisoblanadi.
              </p>
            )}

            {milestones.map((m, i) => (
              <div
                key={m.key}
                className={`flex items-center gap-2.5 px-3 py-2.5 ${
                  i > 0 ? 'border-t border-white/[0.05]' : ''
                }`}
              >
                <button
                  onClick={() => patchMilestone(m.key, { done: !m.done })}
                  aria-pressed={m.done}
                  aria-label={m.done ? 'Bajarilmagan deb belgilash' : 'Bajarildi deb belgilash'}
                  className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                    m.done
                      ? 'border-[#22C55E] bg-[#22C55E]'
                      : 'border-white/20 bg-transparent'
                  }`}
                >
                  {m.done && <Check size={13} strokeWidth={3.2} className="text-[#07130C]" />}
                </button>

                <input
                  className={`flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#5A6360] ${
                    m.done ? 'text-[#7B8481] line-through' : 'text-white'
                  }`}
                  value={m.title}
                  onChange={(e) => patchMilestone(m.key, { title: e.target.value })}
                  placeholder="Bosqich nomi"
                  maxLength={200}
                />

                <button
                  onClick={() => removeMilestone(m.key)}
                  aria-label="Bosqichni o'chirish"
                  className="shrink-0 p-1 text-[#5A6360]"
                >
                  <X size={16} />
                </button>
              </div>
            ))}

            <button
              onClick={addMilestone}
              className="flex w-full items-center gap-2 border-t border-white/[0.05] px-4 py-3 text-[13.5px] font-medium text-[#22C55E]"
            >
              <Plus size={16} /> Bosqich qo&rsquo;shish
            </button>
          </Card>

          <button
            onClick={breakdown}
            disabled={!title.trim() || breaking}
            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-[14px] border border-[#22C55E]/25 bg-[#22C55E]/[0.08] py-3 text-[13.5px] font-medium ${
              title.trim() && !breaking ? 'text-[#34D77F]' : 'text-[#4B5450]'
            }`}
          >
            {breaking ? (
              <>
                <Loader2 size={15} className="animate-spin" /> AI o&rsquo;ylayapti…
              </>
            ) : (
              <>
                <Sparkles size={15} /> AI bilan bosqichlarga bo&rsquo;lish
              </>
            )}
          </button>

          {aiError && (
            <p className="mt-2 text-[12px] text-[#F87171]">{aiError}</p>
          )}
          {aiNote && (
            <p className="mt-2 text-[12px] leading-snug text-[#98A29E]">
              {aiNote} — bosqichlarni tahrirlab, keyin saqlang.
            </p>
          )}
        </div>

        {/* ---------- Raqamli o'lchov ---------- */}
        <div>
          <button
            onClick={() => setUseMetric((v) => !v)}
            aria-pressed={useMetric}
            className="mb-2 flex items-center gap-2 text-[13px] font-medium text-[#22C55E]"
          >
            {useMetric ? <X size={15} /> : <Plus size={15} />}
            Raqamli o&rsquo;lchov {useMetric ? 'kerak emas' : "qo'shish"}
          </button>

          {useMetric && (
            <Card>
              <p className="mb-3 text-[12px] leading-snug text-[#7B8481]">
                Masalan: 80 kg dan 70 kg gacha. O&rsquo;lchov bo&rsquo;lsa progress
                bosqichlar emas, shu raqamlar bo&rsquo;yicha hisoblanadi.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={labelClass} htmlFor="m-unit">Birlik</label>
                  <input id="m-unit" className={inputClass} value={unit}
                    onChange={(e) => setUnit(e.target.value)} placeholder="kg" maxLength={20} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="m-current">Hozir</label>
                  <input id="m-current" type="number" inputMode="decimal" className={inputClass}
                    value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="80" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="m-start">Boshlang&rsquo;ich</label>
                  <input id="m-start" type="number" inputMode="decimal" className={inputClass}
                    value={start} onChange={(e) => setStart(e.target.value)} placeholder="80" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="m-target">Maqsad</label>
                  <input id="m-target" type="number" inputMode="decimal" className={inputClass}
                    value={target} onChange={(e) => setTarget(e.target.value)} placeholder="70" />
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* ---------- Holat ---------- */}
        {goal && (
          <div>
            <span className={labelClass}>Holat</span>
            <div className="flex gap-2">
              {([
                ['active', 'Faol'],
                ['done', 'Bajarildi'],
                ['archived', 'Arxiv'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setStatus(value)}
                  aria-pressed={status === value}
                  className={`flex-1 rounded-[14px] py-2.5 text-[13px] font-medium transition-colors ${
                    status === value
                      ? 'bg-[#22C55E] text-[#07130C]'
                      : 'bg-[#1B2020] text-[#98A29E] border border-white/[0.07]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {onDelete && (
          <div className="pt-2">
            {confirmDelete ? (
              <div className="space-y-2">
                <p className="text-center text-[13px] text-[#98A29E]">
                  Maqsad butunlay o&rsquo;chiriladi. Davom etamizmi?
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" full onClick={() => setConfirmDelete(false)}>
                    Bekor qilish
                  </Button>
                  <Button variant="dangerSolid" full onClick={onDelete}>
                    O&rsquo;chirish
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" full onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} /> Maqsadni o&rsquo;chirish
              </Button>
            )}
          </div>
        )}
      </div>
    </SubScreen>
  );
};
