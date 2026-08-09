import React from 'react';
import { Moon, PersonStanding, Smartphone, Target, Utensils } from 'lucide-react';
import { METRICS, type MetricKey } from '../../theme';

const ICONS: Record<MetricKey, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  nutrition: Utensils,
  steps: PersonStanding,
  screen: Smartphone,
  goals: Target,
  sleep: Moon,
};

export const MetricGlyph: React.FC<{ metric: MetricKey; size?: number }> = ({
  metric,
  size = 18,
}) => {
  const Icon = ICONS[metric];
  return <Icon size={size} strokeWidth={2} />;
};

/**
 * Metrikaning doira ichidagi rangli ikonkasi.
 * Radar cho'qqilarida ham, ro'yxat qatorlarida ham shu komponent ishlatiladi.
 */
export const MetricBadge: React.FC<{
  metric: MetricKey;
  size?: number;
  /** To'q fon o'rniga to'liq rangli doira (radar cho'qqilari uchun) */
  solid?: boolean;
  className?: string;
}> = ({ metric, size = 40, solid = false, className = '' }) => {
  const { color } = METRICS[metric];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: solid ? color : `${color}22`,
        border: `1px solid ${solid ? color : `${color}55`}`,
        color: solid ? '#0A0C0B' : color,
      }}
    >
      <MetricGlyph metric={metric} size={Math.round(size * 0.46)} />
    </span>
  );
};
