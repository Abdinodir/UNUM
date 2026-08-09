import React from 'react';
import { BarChart3, Bot, Home, ListChecks, Plus, User, X } from 'lucide-react';
import { motion } from 'motion/react';
import { triggerHaptic } from '../../utils/haptics';
import type { TabType } from '../../types';

interface Props {
  active: TabType;
  onChange: (tab: TabType) => void;
  addOpen: boolean;
  onToggleAdd: () => void;
}

const TABS: { key: TabType; label: string; Icon: typeof Home }[] = [
  { key: 'home', label: 'Asosiy', Icon: Home },
  { key: 'goals', label: 'Reja', Icon: ListChecks },
  { key: 'analysis', label: 'Tahlil', Icon: BarChart3 },
  { key: 'coach', label: 'AI Coach', Icon: Bot },
  { key: 'profile', label: 'Profil', Icon: User },
];

/**
 * Suzuvchi shisha tab bar. Markazda ko'tarilgan yashil "+" tugmasi —
 * u tab emas, radial menyuni ochadi.
 */
export const TabBar: React.FC<Props> = ({ active, onChange, addOpen, onToggleAdd }) => {
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const renderTab = ({ key, label, Icon }: (typeof TABS)[number]) => {
    const isActive = active === key && !addOpen;
    return (
      <button
        key={key}
        onClick={() => {
          triggerHaptic('light', true);
          onChange(key);
        }}
        aria-current={isActive ? 'page' : undefined}
        className="flex-1 flex flex-col items-center gap-1 py-1"
      >
        <Icon
          size={21}
          strokeWidth={isActive ? 2.4 : 1.9}
          className={isActive ? 'text-[#22C55E]' : 'text-[#7B8481]'}
        />
        <span
          className={`text-[10.5px] tracking-tight ${
            isActive ? 'text-[#22C55E] font-semibold' : 'text-[#7B8481] font-medium'
          }`}
        >
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 pointer-events-none pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-[430px] px-3 pb-3">
        <nav className="relative pointer-events-auto rounded-[26px] bg-[#141818]/92 border border-white/[0.08] backdrop-blur-2xl px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <div className="flex items-center">
            {left.map(renderTab)}

            {/* Markazdagi + — tab emas, radial menyu ochgichi */}
            <div className="w-[64px] shrink-0" aria-hidden />

            {right.map(renderTab)}
          </div>

          <motion.button
            onClick={() => {
              triggerHaptic('medium', true);
              onToggleAdd();
            }}
            whileTap={{ scale: 0.92 }}
            animate={{ rotate: addOpen ? 90 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            aria-label={addOpen ? 'Yopish' : "Qo'shish"}
            aria-expanded={addOpen}
            className={`absolute left-1/2 -translate-x-1/2 -top-[22px] w-[56px] h-[56px] rounded-full flex items-center justify-center shadow-[0_6px_20px_rgba(34,197,94,0.35)] ${
              addOpen
                ? 'bg-transparent border-2 border-[#22C55E] text-[#22C55E]'
                : 'bg-[#22C55E] text-[#07130C]'
            }`}
          >
            {addOpen ? <X size={26} strokeWidth={2.6} /> : <Plus size={28} strokeWidth={2.6} />}
          </motion.button>
        </nav>
      </div>
    </div>
  );
};
