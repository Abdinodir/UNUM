import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { METRICS, type MetricKey } from '../../theme';
import { MetricGlyph } from '../ui/MetricIcon';
import { triggerHaptic } from '../../utils/haptics';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (metric: MetricKey) => void;
}

/**
 * "+" bosilganda yarim doira bo'ylab chiqadigan 5 ta odat tugmasi.
 * Chapdan o'ngga: Screen time → Uyqu → Ovqatlanish (tepa) → Qadam → Maqsadlar.
 */
const ARC: { metric: MetricKey; angle: number }[] = [
  { metric: 'screen', angle: 180 },
  { metric: 'sleep', angle: 135 },
  { metric: 'nutrition', angle: 90 },
  { metric: 'steps', angle: 45 },
  { metric: 'goals', angle: 0 },
];

const RADIUS = 116;
const ITEM = 58;

export const RadialAddMenu: React.FC<Props> = ({ open, onClose, onSelect }) => (
  <AnimatePresence>
    {open && (
      <div className="fixed inset-0 z-40">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#0A0C0B]/88 backdrop-blur-[6px]"
        />

        {/* Langar nuqta — tab bardagi "+" markazi bilan bir xil balandlikda */}
        <div className="absolute left-1/2 bottom-[calc(env(safe-area-inset-bottom)+90px)] w-0 h-0">
          {ARC.map(({ metric, angle }, i) => {
            const rad = (angle * Math.PI) / 180;
            const x = RADIUS * Math.cos(rad);
            const y = -RADIUS * Math.sin(rad);
            const { color, label } = METRICS[metric];

            return (
              <motion.button
                key={metric}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                animate={{ opacity: 1, x, y, scale: 1 }}
                exit={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                transition={{
                  type: 'spring',
                  stiffness: 340,
                  damping: 26,
                  delay: open ? i * 0.035 : 0,
                }}
                onClick={() => {
                  triggerHaptic('medium', true);
                  onSelect(metric);
                }}
                className="absolute flex flex-col items-center gap-1.5"
                style={{ left: -ITEM / 2, top: -ITEM / 2 }}
              >
                <span
                  className="flex items-center justify-center rounded-full shadow-lg"
                  style={{
                    width: ITEM,
                    height: ITEM,
                    background: color,
                    color: '#07130C',
                  }}
                >
                  <MetricGlyph metric={metric} size={24} />
                </span>
                <span className="text-[11px] font-medium text-white whitespace-nowrap">
                  {label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    )}
  </AnimatePresence>
);
