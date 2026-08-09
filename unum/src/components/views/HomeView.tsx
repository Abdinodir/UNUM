import React from 'react';
import { Bell, ChevronRight, Droplet, PenLine, Sparkles, Target, Utensils } from 'lucide-react';
import { motion } from 'motion/react';
import { useUnum } from '../../context/UnumContext';
import { METRICS, RADAR_ORDER, type MetricKey } from '../../theme';
import { PERIOD_LABELS, type Period } from '../../types';
import { TopBar, TopBarAction } from '../shell/TopBar';
import { SegmentedControl } from '../ui/SegmentedControl';
import { RadarPentagon } from '../ui/RadarPentagon';
import { Card, SectionHeader } from '../ui/Card';
import { MetricBadge } from '../ui/MetricIcon';
import { ProgressBar } from '../ui/ProgressBar';
import { CoachAvatar } from '../ui/CoachAvatar';
import { LifeScoreCard } from './LifeScoreCard';
import { TodayStrip } from './TodayStrip';

const PERIOD_OPTIONS = (Object.keys(PERIOD_LABELS) as Period[]).map((value) => ({
  value,
  label: PERIOD_LABELS[value],
}));

const QUICK_ACTIONS: { key: string; label: string; Icon: typeof Utensils; metric: MetricKey }[] = [
  { key: 'meal', label: 'Ovqat', Icon: Utensils, metric: 'nutrition' },
  { key: 'water', label: 'Suv ichish', Icon: Droplet, metric: 'nutrition' },
  { key: 'goal', label: 'Maqsad', Icon: Target, metric: 'goals' },
  { key: 'reminder', label: 'Eslatma', Icon: Bell, metric: 'goals' },
  { key: 'note', label: "Qo'lda yozish", Icon: PenLine, metric: 'nutrition' },
];

export const HomeView: React.FC = () => {
  const {
    profile,
    metrics,
    period,
    setPeriod,
    insights,
    setActiveTab,
    setAddFlowMetric,
  } = useUnum();

  const radarValues = React.useMemo(
    () =>
      RADAR_ORDER.reduce(
        (acc, key) => ({ ...acc, [key]: metrics[key].percent }),
        {} as Record<MetricKey, number>
      ),
    [metrics]
  );

  const firstName = profile.name.split(' ')[0];
  const coachInsight = insights[0];

  return (
    <>
      <TopBar
        title="Unum"
        chevron
        subtitle={`Assalomu alaykum, ${firstName}! 👋`}
        right={
          <TopBarAction label="Bildirishnomalar" dot>
            <Bell size={21} strokeWidth={1.9} />
          </TopBarAction>
        }
      />

      <div className="px-4 pb-[120px] space-y-5">
        {/* Kunning yagona ko'rsatkichi — eng tepada, chunki ilovaga
            kirgan odam birinchi navbatda "bugun qanday ketyapman" ni
            bilishni xohlaydi. */}
        <LifeScoreCard onUpgrade={() => setActiveTab('profile')} />

        {/* Bepul foydalanuvchi ham kunlik holatini ko'rsin — Life Score
            qulflangan bo'lsa ham bu chiziq ochiq. */}
        <TodayStrip onOpen={() => setActiveTab('goals')} />

        <SegmentedControl value={period} options={PERIOD_OPTIONS} onChange={setPeriod} />

        {/* Hayot balansi radari */}
        <div className="pt-2 pb-1">
          <RadarPentagon
            values={radarValues}
            size={300}
            onSelect={(m) => setAddFlowMetric(m)}
          />
        </div>

        {/* AI Coach kartasi */}
        <Card onClick={() => setActiveTab('coach')} className="flex items-center gap-3">
          <CoachAvatar size={54} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[14px] font-semibold text-[#34D77F]">AI Coach</span>
              <Sparkles size={13} className="text-[#34D77F]" />
            </div>
            <p className="text-[12.5px] leading-[1.45] text-[#C7CFCC]">{coachInsight.text}</p>
          </div>
          <span className="w-8 h-8 shrink-0 rounded-full bg-[#1B2020] flex items-center justify-center">
            <ChevronRight size={17} className="text-[#98A29E]" />
          </span>
        </Card>

        {/* Bugungi vazifalar */}
        <div>
          <SectionHeader
            title="Bugungi vazifalar"
            actionLabel="Barchasini ko'rish"
            onAction={() => setActiveTab('analysis')}
          />

          <Card flush className="divide-y divide-white/[0.05]">
            {RADAR_ORDER.map((key, i) => {
              const m = metrics[key];
              const meta = METRICS[key];
              return (
                <motion.button
                  key={key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => setAddFlowMetric(key)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-white/[0.03]"
                >
                  <MetricBadge metric={key} size={38} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[14.5px] font-medium text-white truncate">
                        {meta.label}
                      </span>
                      <span
                        className="text-[14px] font-semibold tabular shrink-0"
                        style={{ color: meta.color }}
                      >
                        {m.percent}%
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-2 mt-0.5 mb-2">
                      <span className="text-[11.5px] text-[#7B8481] truncate">{m.valueText}</span>
                      <span className="text-[11.5px] text-[#7B8481] shrink-0">
                        {m.remainderText}
                      </span>
                    </div>

                    <ProgressBar percent={m.percent} color={meta.color} />
                  </div>

                  <ChevronRight size={17} className="text-[#4B5450] shrink-0" />
                </motion.button>
              );
            })}
          </Card>
        </div>

        {/* Tezkor qo'shish */}
        <div>
          <SectionHeader title="Tezkor qo'shish" />
          <div className="snap-row">
            {QUICK_ACTIONS.map(({ key, label, Icon, metric }) => (
              <button
                key={key}
                onClick={() => setAddFlowMetric(metric)}
                className="w-[88px] h-[74px] rounded-[16px] bg-[#131717] border border-white/[0.07] flex flex-col items-center justify-center gap-1.5 active:bg-white/[0.04]"
              >
                <Icon size={19} className="text-[#C7CFCC]" strokeWidth={1.9} />
                <span className="text-[11px] text-[#98A29E] text-center leading-tight px-1">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
