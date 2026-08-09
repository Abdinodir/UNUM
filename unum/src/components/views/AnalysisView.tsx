import React from 'react';
import { CalendarDays, ChevronRight, Info, TrendingUp } from 'lucide-react';
import { useUnum } from '../../context/UnumContext';
import { METRICS, RADAR_ORDER, type MetricKey } from '../../theme';
import { PERIOD_LABELS, type Period } from '../../types';
import { TopBar, TopBarAction } from '../shell/TopBar';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ReviewView } from './ReviewView';
import { RadarPentagon } from '../ui/RadarPentagon';
import { ScoreRing } from '../ui/ScoreRing';
import { Sparkline } from '../ui/Sparkline';
import { HeatmapGrid } from '../ui/HeatmapGrid';
import { Card, SectionHeader } from '../ui/Card';
import { CoachAvatar } from '../ui/CoachAvatar';
import { Sheet } from '../ui/Sheet';
import { Disclaimer } from '../ui/Disclaimer';

const PERIOD_OPTIONS = (Object.keys(PERIOD_LABELS) as Period[]).map((value) => ({
  value,
  label: PERIOD_LABELS[value],
}));

const WEEK_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const INFO_TEXTS: Record<string, { title: string; body: string }> = {
  balance: {
    title: 'Hayot balansi',
    body: "Beshta yo'nalish bo'yicha bajarilish darajasi. Har bir cho'qqi 0 dan 100 gacha foizni ko'rsatadi — maydon qanchalik keng bo'lsa, kun shunchalik muvozanatli o'tgan.",
  },
  score: {
    title: 'Unum Score',
    body: "Ovqatlanish, harakat, uyqu, ekran vaqti va maqsadlar asosida hisoblanadigan umumiy ball. Hisob-kitob qurilmangizda bajariladi va bir xil ma'lumot uchun har doim bir xil natija beradi. Bu tibbiy baho emas.",
  },
};

export const AnalysisView: React.FC = () => {
  const {
    metrics,
    period,
    setPeriod,
    score,
    previousScore,
    insights,
    trends,
    heatmap,
    mostActiveDay,
    mostActiveHour,
    setActiveTab,
  } = useUnum();

  const [infoKey, setInfoKey] = React.useState<string | null>(null);
  const [insightIndex, setInsightIndex] = React.useState(0);

  const radarValues = React.useMemo(
    () =>
      RADAR_ORDER.reduce(
        (acc, key) => ({ ...acc, [key]: metrics[key].percent }),
        {} as Record<MetricKey, number>
      ),
    [metrics]
  );

  const delta = score - previousScore;
  // Ro'yxat qisqarsa (masalan 5 ta kamchilikdan 1 taga) eski indeks
  // chegaradan chiqib, `insight.text` da ilova qulardi.
  const insight = insights[insightIndex] ?? insights[0];

  return (
    <>
      <TopBar
        title="AI Tahlil"
        right={
          <TopBarAction label="Sana tanlash">
            <CalendarDays size={21} strokeWidth={1.9} className="text-[#22C55E]" />
          </TopBarAction>
        }
      />

      <div className="px-4 pb-[120px] space-y-5">
        {/* Haftalik/oylik hisobot — tahlilning eng qimmatli qismi, shuning
            uchun eng tepada. Ostidagi eski grafiklar o'z joyida qoladi. */}
        <ReviewView onUpgrade={() => setActiveTab('profile')} />

        <SegmentedControl value={period} options={PERIOD_OPTIONS} onChange={setPeriod} />

        {/* Hayot balansi + Unum Score */}
        <Card flush className="p-3">
          <div className="grid grid-cols-[1.15fr_1fr] gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[13px] font-semibold text-white">Hayot balansi</span>
                <button onClick={() => setInfoKey('balance')} aria-label="Hayot balansi haqida">
                  <Info size={13} className="text-[#616B67]" />
                </button>
              </div>
              <RadarPentagon values={radarValues} size={190} showScale />
            </div>

            <div className="min-w-0 rounded-[16px] bg-[#0F1313] border border-white/[0.05] p-3 flex flex-col items-center">
              <div className="flex items-center gap-1.5 mb-2 self-start">
                <span className="text-[13px] font-semibold text-white">Unum Score</span>
                <button onClick={() => setInfoKey('score')} aria-label="Unum Score haqida">
                  <Info size={13} className="text-[#616B67]" />
                </button>
              </div>

              <ScoreRing value={score} size={116} thickness={9} />

              <p className="text-[11.5px] text-[#98A29E] mt-2.5">
                O'tgan hafta: <span className="tabular">{previousScore}</span>
              </p>

              <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-start gap-2 w-full">
                <TrendingUp size={14} className="text-[#34D77F] shrink-0 mt-0.5" />
                <p className="text-[11px] leading-[1.4] text-[#C7CFCC]">
                  {delta >= 0
                    ? `Siz o'tgan haftaga nisbatan ${delta} ballga yaxshilandingiz!`
                    : `O'tgan haftaga nisbatan ${Math.abs(delta)} ball pastroq.`}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* AI tahlil karuseli */}
        <Card
          onClick={() => setInsightIndex((i) => (i + 1) % Math.max(1, insights.length))}
          className="flex items-center gap-3"
        >
          <CoachAvatar size={54} />
          <div className="flex-1 min-w-0">
            <span className="block text-[14px] font-semibold text-[#34D77F] mb-1">AI tahlil</span>
            <p className="text-[12.5px] leading-[1.45] text-[#C7CFCC]">{insight.text}</p>
            <div className="flex items-center gap-1.5 mt-2.5">
              {insights.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === insightIndex ? 'w-3.5 bg-[#22C55E]' : 'w-1.5 bg-white/15'
                  }`}
                />
              ))}
            </div>
          </div>
          <span className="w-8 h-8 shrink-0 rounded-full bg-[#1B2020] flex items-center justify-center">
            <ChevronRight size={17} className="text-[#98A29E]" />
          </span>
        </Card>

        {/* Trend */}
        <div>
          <SectionHeader title="Trend" />
          <div className="snap-row">
            {trends.map((t) => {
              const color = METRICS[t.key].color;
              const positive = t.deltaPercent >= 0;
              const isPercentDelta = Math.abs(t.deltaPercent) >= 1;
              return (
                <div
                  key={t.key}
                  className="w-[124px] rounded-[16px] bg-[#131717] border border-white/[0.07] p-3"
                >
                  <span className="block text-[11px] text-[#98A29E] truncate">{t.label}</span>
                  <span className="block text-[19px] font-bold text-white tabular mt-0.5">
                    {t.value}
                  </span>
                  <div className="flex items-baseline gap-1.5 mb-1.5">
                    <span className="text-[10px] text-[#616B67]">o'rtacha</span>
                    <span
                      className="text-[11px] font-semibold tabular"
                      style={{ color: positive ? '#34D77F' : '#F97316' }}
                    >
                      {positive ? '+' : ''}
                      {t.deltaPercent}
                      {isPercentDelta ? '%' : ''}
                    </span>
                  </div>

                  <Sparkline points={t.points} color={color} width={100} height={40} />

                  <div className="flex justify-between mt-1">
                    {WEEK_LETTERS.map((d, i) => (
                      <span key={i} className="text-[8.5px] text-[#4B5450]">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Faollik haritasi */}
        <div>
          <SectionHeader title="Faollik haritasi" />
          <div className="grid grid-cols-[1.35fr_1fr] gap-3">
            <Card className="min-w-0">
              <HeatmapGrid data={heatmap} />
            </Card>

            <Card className="min-w-0 flex flex-col justify-center gap-4">
              <div>
                <span className="block text-[12px] text-[#98A29E]">Eng faol kun</span>
                <span className="block text-[15px] font-semibold text-white mt-0.5">
                  {mostActiveDay}
                </span>
              </div>

              <div className="pt-3 border-t border-white/[0.06]">
                <span className="block text-[12px] text-[#98A29E]">Eng faol soat</span>
                <span className="block text-[15px] font-semibold text-[#34D77F] mt-0.5 tabular">
                  {mostActiveHour}
                </span>
                <div
                  className="h-1.5 rounded-full mt-2.5"
                  style={{ background: 'linear-gradient(90deg, rgba(34,197,94,0.15), #22C55E)' }}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[9.5px] text-[#4B5450]">Kam</span>
                  <span className="text-[9.5px] text-[#4B5450]">Ko'p</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <Disclaimer />
      </div>

      <Sheet
        open={infoKey !== null}
        onClose={() => setInfoKey(null)}
        title={infoKey ? INFO_TEXTS[infoKey].title : ''}
      >
        <div className="px-5 pb-8 pt-2">
          <p className="text-[13.5px] leading-[1.6] text-[#C7CFCC]">
            {infoKey ? INFO_TEXTS[infoKey].body : ''}
          </p>
        </div>
      </Sheet>
    </>
  );
};
