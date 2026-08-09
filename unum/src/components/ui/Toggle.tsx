import React from 'react';
import { motion } from 'motion/react';
import { triggerHaptic } from '../../utils/haptics';

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export const Toggle: React.FC<Props> = ({ checked, onChange, disabled, label }) => (
  <button
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => {
      if (disabled) return;
      triggerHaptic('light', true);
      onChange(!checked);
    }}
    className={`relative w-[46px] h-[28px] rounded-full transition-colors shrink-0 ${
      checked ? 'bg-[#22C55E]' : 'bg-white/[0.14]'
    } ${disabled ? 'opacity-40' : ''}`}
  >
    <motion.span
      layout
      transition={{ type: 'spring', stiffness: 520, damping: 34 }}
      className="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-sm"
      style={{ left: checked ? 21 : 3 }}
    />
  </button>
);
