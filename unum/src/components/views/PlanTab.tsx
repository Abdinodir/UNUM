import React, { useState } from 'react';
import { TopBar } from '../shell/TopBar';
import { SegmentedControl } from '../ui/SegmentedControl';
import { PlannerView } from './PlannerView';
import { HabitsView } from './HabitsView';
import { FocusView } from './FocusView';
import { GoalsView } from './GoalsView';

type Section = 'today' | 'habits' | 'focus' | 'goals';

// Yorliqlar QISQA: to'rttasi 360px kenglikdagi ekranga ham sig'ishi kerak.
const OPTIONS: { value: Section; label: string }[] = [
  { value: 'today', label: 'Bugun' },
  { value: 'habits', label: 'Odat' },
  { value: 'focus', label: 'Fokus' },
  { value: 'goals', label: 'Maqsad' },
];

/**
 * "Reja" tabi — kunlik reja, odatlar va maqsadlar bir joyda.
 *
 * Nega birga: vazifa odatga, odat maqsadga xizmat qiladi va ular orasida
 * o'tish tez-tez kerak. Uchtasi alohida tab bo'lsa pastdagi panel yettitaga
 * chiqib, markazdagi "+" uchun joy qolmasdi.
 */
export const PlanTab: React.FC = () => {
  const [section, setSection] = useState<Section>('today');

  const segments = (
    <SegmentedControl<Section>
      value={section}
      onChange={setSection}
      options={OPTIONS}
      className="mb-4"
    />
  );

  // GoalsView va FocusView o'z TopBar'ini o'zi chiqaradi (biri "+" tugmasi,
  // ikkinchisi boshqa sarlavha bilan), shuning uchun ularga segmentni prop
  // sifatida beramiz; qolgan ikkitasi umumiy qobiqda ko'rsatiladi.
  if (section === 'goals') return <GoalsView header={segments} />;
  if (section === 'focus') return <FocusView header={segments} />;

  return (
    <>
      <TopBar title="Reja" />
      <div className="px-4 pb-[120px]">
        {segments}
        {section === 'today' ? <PlannerView /> : <HabitsView />}
      </div>
    </>
  );
};
