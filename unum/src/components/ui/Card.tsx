import React, { ReactNode } from 'react';
import { motion } from 'motion/react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  /** Ichki paddingni o'chirish — ro'yxat va grafiklar o'z chetini boshqarganda */
  flush?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, flush }) => {
  const clickable = Boolean(onClick);
  return (
    <motion.div
      whileTap={clickable ? { scale: 0.99 } : undefined}
      onClick={onClick}
      className={`rounded-[20px] bg-[#131717] border border-white/[0.07] ${
        flush ? '' : 'p-4'
      } ${clickable ? 'cursor-pointer select-none' : ''} ${className}`}
    >
      {children}
    </motion.div>
  );
};

/** Karta ichidagi sarlavha qatori — o'ngda ixtiyoriy "Barchasini ko'rish" havolasi */
export const SectionHeader: React.FC<{
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}> = ({ title, actionLabel, onAction, className = '' }) => (
  <div className={`flex items-baseline justify-between mb-3 ${className}`}>
    <h2 className="text-[17px] font-semibold tracking-tight text-white">{title}</h2>
    {actionLabel && (
      <button
        onClick={onAction}
        className="text-[13px] font-medium text-[#22C55E] inline-flex items-center gap-0.5"
      >
        {actionLabel}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="m9 6 6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    )}
  </div>
);
