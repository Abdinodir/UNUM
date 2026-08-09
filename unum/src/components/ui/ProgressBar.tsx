import React from 'react';
import { motion } from 'motion/react';

interface Props {
  /** 0–100 */
  percent: number;
  color: string;
  height?: number;
  className?: string;
}

export const ProgressBar: React.FC<Props> = ({ percent, color, height = 4, className = '' }) => (
  <div
    className={`w-full rounded-full bg-white/[0.07] overflow-hidden ${className}`}
    style={{ height }}
    role="progressbar"
    aria-valuenow={Math.round(percent)}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    <motion.div
      className="h-full rounded-full"
      style={{ background: color }}
      initial={{ width: 0 }}
      animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    />
  </div>
);
