import React, { ReactNode } from 'react';
import { motion } from 'motion/react';
import { triggerHaptic } from '../../utils/haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSolid';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  full?: boolean;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[#22C55E] text-[#07130C] font-semibold active:bg-[#1FAF54]',
  secondary: 'bg-[#1B2020] text-white font-medium border border-white/[0.07]',
  ghost: 'bg-transparent text-[#98A29E] font-medium',
  danger: 'bg-[#EF4444]/12 text-[#F87171] font-semibold border border-[#EF4444]/25',
  dangerSolid: 'bg-[#B91C1C] text-white font-semibold',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  full,
  disabled,
  className = '',
  type = 'button',
}) => (
  <motion.button
    type={type}
    disabled={disabled}
    whileTap={disabled ? undefined : { scale: 0.97 }}
    onClick={() => {
      if (disabled) return;
      triggerHaptic('light', true);
      onClick?.();
    }}
    className={`inline-flex items-center justify-center gap-2 rounded-[16px] px-5 h-[52px] text-[15px] tracking-tight transition-colors ${
      VARIANTS[variant]
    } ${full ? 'w-full' : ''} ${disabled ? 'opacity-40' : ''} ${className}`}
  >
    {children}
  </motion.button>
);
