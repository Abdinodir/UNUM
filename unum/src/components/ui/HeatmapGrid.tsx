import React from 'react';
import type { ActivityHeatmap } from '../../types';

interface Props {
  /** 7 qator (hafta kunlari) × N ustun, qiymat 0–1 */
  data: ActivityHeatmap;
  className?: string;
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Qiymatga qarab yashil to'yinganlik — 0 bo'lsa deyarli ko'rinmas */
function cellColor(v: number): string {
  const alpha = 0.06 + Math.min(1, Math.max(0, v)) * 0.74;
  return `rgba(34,197,94,${alpha.toFixed(3)})`;
}

export const HeatmapGrid: React.FC<Props> = ({ data, className = '' }) => {
  const cols = data[0]?.length ?? 0;
  const weeks = Math.max(1, Math.round(cols / 7));

  return (
    <div className={className}>
      <div className="flex gap-1.5">
        {/* Hafta kunlari harflari */}
        <div className="flex flex-col justify-between py-[1px]">
          {DAY_LETTERS.map((d, i) => (
            <span key={i} className="text-[9px] leading-none text-[#616B67] h-[14px] flex items-center">
              {d}
            </span>
          ))}
        </div>

        <div className="flex-1 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {data.map((row, r) =>
            row.map((v, c) => (
              <span
                key={`${r}-${c}`}
                className="rounded-[3px] aspect-square"
                style={{ background: cellColor(v) }}
                title={`${Math.round(v * 100)}%`}
              />
            ))
          )}
        </div>
      </div>

      {/* Hafta belgilari */}
      <div className="flex gap-1.5 mt-2 pl-[14px]">
        <div
          className="flex-1 grid text-[10px] text-[#616B67]"
          style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0,1fr))` }}
        >
          {Array.from({ length: weeks }, (_, i) => (
            <span key={i} className="text-center">
              {i + 1}-h
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
