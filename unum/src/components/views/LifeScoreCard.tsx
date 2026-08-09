import React, { useEffect, useState } from 'react';
import { Crown, Loader2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { ScoreRing } from '../ui/ScoreRing';
import { ProgressBar } from '../ui/ProgressBar';
import { api, type LifeScoreResponse } from '../../lib/api';

/**
 * Life Score kartasi — bosh ekranning eng tepasida.
 *
 * Bepul rejada server raqamni UMUMAN yubormaydi (`locked: true`), shuning
 * uchun bu yerda soxta/namunaviy qiymat ko'rsatilmaydi — qulf holati
 * ochiq aytiladi.
 */
export const LifeScoreCard: React.FC<{ onUpgrade?: () => void }> = ({ onUpgrade }) => {
  const [data, setData] = useState<LifeScoreResponse | null>(null);

  useEffect(() => {
    api.lifeScore().then(setData).catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <Card className="mb-4 flex h-[128px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" />
      </Card>
    );
  }

  // `in` orqali tekshiramiz, `data.locked` orqali emas: loyihada
  // `strictNullChecks` o'chiq va bunday holatda TypeScript union'ni
  // boolean diskriminant bo'yicha toraytirmaydi.
  if (!('components' in data)) {
    return (
      <Card
        className="mb-4 border-[#22C55E]/25 bg-[#22C55E]/[0.06]"
        onClick={onUpgrade}
      >
        <div className="flex items-center gap-3">
          <Crown size={22} className="shrink-0 text-[#22C55E]" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-white">Life Score</p>
            <p className="mt-0.5 text-[12px] leading-snug text-[#98A29E]">
              Kuningizning yagona ko&rsquo;rsatkichi — reja, odat, fokus, uyqu va
              sog&rsquo;liq bir ballda. Premium bilan ochiladi.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const usable = data.components.filter((c) => c.available);

  return (
    <Card className="mb-4">
      <div className="flex items-center gap-4">
        <ScoreRing value={data.total} size={96} thickness={8} showDenominator={false} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-[#98A29E]">Life Score</p>
          <p className="text-[26px] font-bold leading-tight tracking-tight text-white">
            {data.hasData ? data.total : '—'}
            <span className="ml-1 text-[14px] font-medium text-[#7B8481]">/100</span>
          </p>
          <p className="mt-0.5 text-[12.5px] text-[#34D77F]">{data.grade}</p>
        </div>
      </div>

      {usable.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {usable.map((c) => (
            <div key={c.id}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[12.5px] text-[#C7CFCC]">{c.label}</span>
                <span className="text-[11.5px] tabular-nums text-[#7B8481]">{c.detail}</span>
              </div>
              <ProgressBar percent={c.ratio * 100} color="#22C55E" height={3} />
            </div>
          ))}
        </div>
      )}

      {!data.hasData && (
        <p className="mt-3 text-[12.5px] leading-snug text-[#7B8481]">
          Bugun hali ma&rsquo;lumot yo&rsquo;q. Vazifa qo&rsquo;shing yoki odatni
          belgilang — ball shu zahoti paydo bo&rsquo;ladi.
        </p>
      )}

      {data.weakest && (
        <p className="mt-3 border-t border-white/[0.05] pt-3 text-[12.5px] leading-snug text-[#98A29E]">
          Eng ko&rsquo;p ball <span className="text-white">{data.weakest.label}</span> dan
          yo&rsquo;qolyapti — {data.weakest.detail}.
        </p>
      )}
    </Card>
  );
};
