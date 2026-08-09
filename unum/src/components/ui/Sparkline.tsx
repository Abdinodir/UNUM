import React from 'react';

interface Props {
  points: number[];
  color: string;
  width?: number;
  height?: number;
  /** Chiziq ostini rangli gradient bilan to'ldirish */
  filled?: boolean;
  /** Har bir nuqtada kichik doira */
  dots?: boolean;
  className?: string;
}

export const Sparkline: React.FC<Props> = ({
  points,
  color,
  width = 120,
  height = 44,
  filled = true,
  dots = true,
  className = '',
}) => {
  const gradientId = React.useId();

  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const padY = 5;

  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * width,
    y: height - padY - ((p - min) / span) * (height - padY * 2),
  }));

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} className={className} aria-hidden>
      {filled && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
        </>
      )}
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      {dots &&
        coords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={2} fill={color} />)}
    </svg>
  );
};
