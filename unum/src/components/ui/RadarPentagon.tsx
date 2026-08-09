import React from 'react';
import { motion } from 'motion/react';
import { METRICS, RADAR_ORDER, colors, type MetricKey } from '../../theme';
import { MetricBadge } from './MetricIcon';

interface Props {
  /** Har bir metrika uchun 0–100 oralig'idagi qiymat */
  values: Record<MetricKey, number>;
  size?: number;
  /** O'lchov raqamlari (0/25/50/75/100) ko'rsatilsinmi */
  showScale?: boolean;
  onSelect?: (metric: MetricKey) => void;
}

const RINGS = [0.25, 0.5, 0.75, 1];

/** Cho'qqi burchagi: soat 12 dan boshlab soat yo'nalishi bo'yicha 72° qadam */
function angleAt(index: number): number {
  return (-90 + index * 72) * (Math.PI / 180);
}

function pointAt(cx: number, cy: number, r: number, index: number) {
  const a = angleAt(index);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function polygonPoints(cx: number, cy: number, radii: number[]): string {
  return radii
    .map((r, i) => {
      const p = pointAt(cx, cy, r, i);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(' ');
}

export const RadarPentagon: React.FC<Props> = ({
  values,
  size = 300,
  showScale = true,
  onSelect,
}) => {
  const cx = size / 2;
  const cy = size / 2 + 6;
  const R = size * 0.3;
  const badgeSize = Math.max(28, Math.round(size * 0.11));

  const dataRadii = RADAR_ORDER.map((key) => (Math.min(100, Math.max(0, values[key])) / 100) * R);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0" aria-hidden>
        {/* Panjara — konsentrik beshburchaklar */}
        {RINGS.map((k) => (
          <polygon
            key={k}
            points={polygonPoints(cx, cy, [0, 1, 2, 3, 4].map(() => R * k))}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}

        {/* Markazdan cho'qqilarga radial chiziqlar */}
        {[0, 1, 2, 3, 4].map((i) => {
          const p = pointAt(cx, cy, R, i);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />
          );
        })}

        {/* Ma'lumot ko'pburchagi */}
        <motion.polygon
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          points={polygonPoints(cx, cy, dataRadii)}
          fill={`${colors.green}38`}
          stroke={colors.greenBright}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        {/* Cho'qqi nuqtalari */}
        {dataRadii.map((r, i) => {
          const p = pointAt(cx, cy, r, i);
          return <circle key={i} cx={p.x} cy={p.y} r={3.2} fill={colors.greenBright} />;
        })}

        {/* O'lchov raqamlari — yuqori o'q bo'ylab */}
        {showScale &&
          [0, 25, 50, 75, 100].map((v) => (
            <text
              key={v}
              x={cx + 8}
              y={cy - (v / 100) * R + 4}
              fill="rgba(255,255,255,0.28)"
              fontSize={Math.max(8, size * 0.033)}
              fontWeight={500}
            >
              {v}
            </text>
          ))}
      </svg>

      {/* Cho'qqi ikonkalari va yozuvlari — HTML qatlamda, uslublash osonroq */}
      {RADAR_ORDER.map((key, i) => {
        const p = pointAt(cx, cy, R, i);
        const metric = METRICS[key];
        const percent = Math.round(values[key]);

        // Yozuv joylashuvi cho'qqiga qarab o'zgaradi
        let labelStyle: React.CSSProperties;
        let align = 'text-center';
        if (i === 0) {
          labelStyle = { left: p.x, top: p.y - badgeSize / 2 - 8, transform: 'translate(-50%,-100%)' };
        } else if (i === 1) {
          labelStyle = { left: p.x + badgeSize / 2 + 8, top: p.y, transform: 'translate(0,-50%)' };
          align = 'text-left';
        } else if (i === 4) {
          labelStyle = { left: p.x - badgeSize / 2 - 8, top: p.y, transform: 'translate(-100%,-50%)' };
          align = 'text-right';
        } else {
          labelStyle = { left: p.x, top: p.y + badgeSize / 2 + 8, transform: 'translate(-50%,0)' };
        }

        return (
          <React.Fragment key={key}>
            <button
              onClick={onSelect ? () => onSelect(key) : undefined}
              className="absolute"
              style={{
                left: p.x,
                top: p.y,
                transform: 'translate(-50%,-50%)',
                cursor: onSelect ? 'pointer' : 'default',
              }}
              aria-label={`${metric.label} ${percent}%`}
            >
              <MetricBadge metric={key} size={badgeSize} solid />
            </button>

            <div
              className={`absolute whitespace-nowrap leading-tight pointer-events-none ${align}`}
              style={labelStyle}
            >
              <div
                className="font-medium text-white"
                style={{ fontSize: Math.max(9, size * 0.038) }}
              >
                {metric.label}
              </div>
              <div
                className="font-semibold"
                style={{ color: metric.color, fontSize: Math.max(10, size * 0.042) }}
              >
                {percent}%
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
