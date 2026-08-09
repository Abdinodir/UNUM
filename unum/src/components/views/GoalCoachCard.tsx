import React, { useState } from 'react';
import { Crown, Loader2, Send, Target } from 'lucide-react';
import { Card } from '../ui/Card';
import { Disclaimer } from '../ui/Disclaimer';
import { api } from '../../lib/api';

/** Bosishga tayyor savollar — bo'sh maydonga qarab turishdan ko'ra oson. */
const SUGGESTIONS = [
  'Maqsadimga ulgurish uchun bugun nima qilay?',
  'Qaysi maqsadim orqada qolyapti?',
  'Odatlarimni qanday tiklayman?',
];

/**
 * Maqsadga yo'naltirilgan AI kouch.
 *
 * Mavjud ovqatlanish chatidan ALOHIDA: bu yerdagi javob foydalanuvchining
 * HISOBLANGAN ko'rsatkichlariga (haftalik hisobot + maqsad prognozlari)
 * tayanadi, server ularni promptga o'zi qo'shadi. Shuning uchun savol
 * kontekstsiz yuborilsa ham javob shaxsiy chiqadi.
 */
export const GoalCoachCard: React.FC<{ onUpgrade?: () => void }> = ({ onUpgrade }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setAnswer('');
    try {
      const r = await api.askCoach(text);
      // Qulflangan bo'lsa server `{locked:true}` qaytaradi — `answer` bo'lmaydi.
      if (!('answer' in r) || !r.answer) setLocked(true);
      else setAnswer(r.answer);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (locked) {
    return (
      <Card className="border-[#22C55E]/25 bg-[#22C55E]/[0.06]" onClick={onUpgrade}>
        <div className="flex items-start gap-3">
          <Crown size={20} className="mt-0.5 shrink-0 text-[#22C55E]" />
          <div>
            <p className="text-[15px] font-semibold text-white">AI Goal Coach</p>
            <p className="mt-0.5 text-[12px] leading-snug text-[#98A29E]">
              Maqsadlaringiz va haqiqiy ko&rsquo;rsatkichlaringizga qarab javob
              beradi. Premium bilan ochiladi.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Target size={16} className="text-[#22C55E]" />
        <span className="text-[14px] font-semibold text-white">Maqsad kouchi</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-[14px] border border-white/[0.08] bg-[#0E1211] px-3.5 py-3 text-[14px] text-white outline-none placeholder:text-[#5A6360] focus:border-[#22C55E]/60"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask(question)}
          placeholder="Savolingizni yozing…"
          maxLength={1000}
        />
        <button
          onClick={() => ask(question)}
          disabled={!question.trim() || busy}
          aria-label="Yuborish"
          className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] ${
            question.trim() && !busy ? 'bg-[#22C55E] text-[#07130C]' : 'bg-[#1B2020] text-[#4B5450]'
          }`}
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>

      {!answer && !busy && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setQuestion(s); ask(s); }}
              className="rounded-full bg-[#1B2020] px-3 py-1.5 text-[11.5px] text-[#98A29E]"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2.5 text-[12.5px] text-[#F87171]">{error}</p>}

      {answer && (
        <>
          <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#C7CFCC]">
            {answer}
          </p>
          <Disclaimer className="mt-3" />
        </>
      )}
    </Card>
  );
};
