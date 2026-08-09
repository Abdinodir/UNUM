import React from 'react';
import { motion } from 'motion/react';
import { colors, scoreColor } from '../../theme';

interface Props {
  /** 0–100 */
  value: number;
  size?: number;
  thickness?: number;
  /** Ring ostidagi "/100" yozuvi */
  showDenominator?: boolean;
  label?: string;
  className?: string;
}

export const ScoreRing: React.FC<Props> = ({
  value,
  size = 150,
  thickness = 10,
  showDenominator = true,
  label,
  className = '',
}) => {
  const clamped = Math.min(100, Math.max(0, value));
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const stroke = scoreColor(clamped);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Unum Score ${clamped} / 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={thickness}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped / 100) }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-bold tracking-tight leading-none"
          style={{ fontSize: size * 0.31, color: colors.text }}
        >
          {clamped}
        </span>
        {showDenominator && (
          <span
            className="font-medium mt-0.5"
            style={{ fontSize: size * 0.1, color: colors.textDim }}
          >
            /100
          </span>
        )}
        {label && (
          <span
            className="font-medium mt-0.5"
            style={{ fontSize: size * 0.1, color: stroke }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
};
