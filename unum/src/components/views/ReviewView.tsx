import React, { useEffect, useState } from 'react';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Crown, Loader2, Sparkles,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Disclaimer } from '../ui/Disclaimer';
import { api, type Narrative, type Review } from '../../lib/api';

type Period = 'week' | 'month';

const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)}-${MONTHS[Number(m) - 1]}`;
};

const Stat: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="flex-1">
    <p className="text-[11.5px] text-[#7B8481]">{label}</p>
    <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-white">{value}</p>
    {sub && <p className="text-[11px] text-[#5A6360]">{sub}</p>}
  </div>
);

const TrendBadge: React.FC<{ review: Review }> = ({ review }) => {
  if (!review.trend || review.previousAverage == null) return null;
  const map = {
    up: { Icon: ArrowUpRight, color: '#34D77F', text: "o'sdi" },
    down: { Icon: ArrowDownRight, color: '#F87171', text: 'tushdi' },
    flat: { Icon: ArrowRight, color: '#98A29E', text: "o'zgarmadi" },
  }[review.trend];

  return (
    <span
      className="inline-flex items-center gap-1 text-[12px] font-medium"
      style={{ color: map.color }}
    >
      <map.Icon size={14} />
      {review.previousAverage} → {review.lifeScore.average} {map.text}
    </span>
  );
};

export const ReviewView: React.FC<{ onUpgrade?: () => void }> = ({ onUpgrade }) => {
  const [period, setPeriod] = useState<Period>('week');
  const [review, setReview] = useState<Review | null>(null);
  const [locked, setLocked] = useState<boolean | null>(null);
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Davr almashganda eski AI xulosasi ko'rinib turmasin — u boshqa
    // davrga tegishli edi.
    setNarrative(null);
    setReview(null);
    api.review(period).then((r) => {
      if ('locked' in r && r.locked) return setLocked(true);
      setLocked(false);
      setReview(r as Review);
    }).catch((e) => setError((e as Error).message));
  }, [period]);

  const askAi = async () => {
    setAsking(true);
    setError(null);
    try {
      const r = await api.reviewNarrative(period);
      // `r.locked` orqali toraytirib bo'lmaydi — loyihada strictNullChecks
      // o'chiq (qarang: LifeScoreCard dagi bir xil izoh).
      if (!('narrative' in r)) setLocked(true);
      else {
        setNarrative(r.narrative);
        setReview(r.review);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAsking(false);
    }
  };

  if (locked) {
    return (
      <Card className="border-[#22C55E]/25 bg-[#22C55E]/[0.06]" onClick={onUpgrade}>
        <div className="flex items-start gap-3">
          <Crown size={20} className="mt-0.5 shrink-0 text-[#22C55E]" />
          <div>
            <p className="text-[15px] font-semibold text-white">Haftalik hisobot</p>
            <p className="mt-0.5 text-[12px] leading-snug text-[#98A29E]">
              Har hafta: nima bajarildi, qayerda cho&rsquo;kdingiz va keyingi hafta
              nimadan boshlash kerak. Premium bilan ochiladi.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <SegmentedControl<Period>
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'week', label: 'Hafta' },
          { value: 'month', label: 'Oy' },
        ]}
        className="mb-4"
      />

      {error && (
        <Card className="mb-3"><p className="text-[13px] text-[#F87171]">{error}</p></Card>
      )}

      {!review && locked === null && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" />
        </div>
      )}

      {review && (
        <>
          <Card className="mb-3">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-[12.5px] text-[#7B8481]">
                {shortDate(review.from)} – {shortDate(review.to)}
              </span>
              <TrendBadge review={review} />
            </div>

            <div className="flex gap-2">
              <Stat
                label="Life Score"
                value={review.lifeScore.average != null ? String(review.lifeScore.average) : '—'}
                sub={review.lifeScore.daysWithData ? `${review.lifeScore.daysWithData} kun` : undefined}
              />
              <Stat
                label="Reja"
                value={review.tasks.percent != null ? `${review.tasks.percent}%` : '—'}
                sub={`${review.tasks.done}/${review.tasks.total}`}
              />
              <Stat
                label="Odat"
                value={review.habits.percent != null ? `${review.habits.percent}%` : '—'}
                sub={`${review.habits.done}/${review.habits.due}`}
              />
              <Stat
                label="Fokus"
                value={`${Math.round(review.focus.minutes / 60 * 10) / 10}s`}
                sub={`kuniga ${review.focus.perDay} daq`}
              />
            </div>
          </Card>

          {review.highlights.length > 0 && (
            <Card className="mb-3">
              <ul className="space-y-1.5">
                {review.highlights.map((h) => (
                  <li key={h} className="flex gap-2 text-[13px] leading-snug text-[#C7CFCC]">
                    <span className="text-[#22C55E]">·</span>
                    {h}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(review.lifeScore.best || review.topStreak) && (
            <Card className="mb-3 space-y-2">
              {review.lifeScore.best && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#98A29E]">Eng yaxshi kun</span>
                  <span className="text-white">
                    {shortDate(review.lifeScore.best.date)} · {review.lifeScore.best.total} ball
                  </span>
                </div>
              )}
              {review.lifeScore.worst && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#98A29E]">Eng past kun</span>
                  <span className="text-white">
                    {shortDate(review.lifeScore.worst.date)} · {review.lifeScore.worst.total} ball
                  </span>
                </div>
              )}
              {review.topStreak && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#98A29E]">Eng uzun ketma-ketlik</span>
                  <span className="text-white">
                    {review.topStreak.title} · {review.topStreak.streak} kun
                  </span>
                </div>
              )}
            </Card>
          )}

          {/* AI xulosa — raqamlar yuqorida allaqachon hisoblangan, AI faqat
              ularni izohlaydi. Shuning uchun tugma bosilgandagina chaqiriladi:
              har ochilishda AI chaqirish pul sarflaydi. */}
          {narrative ? (
            <Card className="mb-3">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles size={15} className="text-[#22C55E]" />
                <span className="text-[13px] font-semibold text-white">AI xulosa</span>
              </div>
              <p className="text-[13.5px] leading-relaxed text-[#C7CFCC]">{narrative.summary}</p>

              {narrative.win && (
                <p className="mt-2.5 text-[13px] leading-snug text-[#34D77F]">
                  ✓ {narrative.win}
                </p>
              )}
              {narrative.problem && (
                <p className="mt-1.5 text-[13px] leading-snug text-[#F0A868]">
                  ! {narrative.problem}
                </p>
              )}

              {narrative.nextWeek.length > 0 && (
                <>
                  <p className="mt-3 text-[12px] font-medium text-[#7B8481]">
                    Keyingi {period === 'week' ? 'hafta' : 'oy'}:
                  </p>
                  <ul className="mt-1 space-y-1">
                    {narrative.nextWeek.map((s) => (
                      <li key={s} className="flex gap-2 text-[13px] leading-snug text-white">
                        <span className="text-[#22C55E]">→</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <Disclaimer className="mt-3" />
            </Card>
          ) : (
            <Button variant="secondary" full onClick={askAi} disabled={asking}>
              {asking ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <>
                  <Sparkles size={16} /> AI xulosasini olish
                </>
              )}
            </Button>
          )}
        </>
      )}
    </>
  );
};
