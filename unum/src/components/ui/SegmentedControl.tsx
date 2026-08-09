import React from 'react';
import { motion } from 'motion/react';
import { triggerHaptic } from '../../utils/haptics';

interface Props<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Bugun / Hafta / Oy / Yil ko'rinishidagi segment.
 * Tanlangan element ostidagi yashil "pill" layoutId bilan siljiydi.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: Props<T>) {
  const groupId = React.useId();

  return (
    <div
      role="tablist"
      className={`flex items-center gap-1 p-1 rounded-[14px] bg-[#131717] border border-white/[0.06] ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (active) return;
              triggerHaptic('light', true);
              onChange(opt.value);
            }}
            className="relative flex-1 h-9 rounded-[11px] text-[13px] font-medium tracking-tight"
          >
            {active && (
              <motion.span
                layoutId={`seg-${groupId}`}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-[11px] bg-[#22C55E]/15 border border-[#22C55E]/30"
              />
            )}
            <span
              className={`relative z-10 ${active ? 'text-[#34D77F]' : 'text-[#98A29E]'}`}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
