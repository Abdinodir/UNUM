import React, { useEffect, useState } from 'react';
import { Check, Crown, Loader2 } from 'lucide-react';
import { SubScreen } from '../ui/SubScreen';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api, type BillingStatus, type Plan } from '../../lib/api';

/** 399000 → "399 000". Konvertatsiya YO'Q — qiymat allaqachon so'mda. */
const som = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ');

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * To'lovdan qaytgan foydalanuvchini qanday aniqlaymiz.
 *
 * Click `return_url` ga qaytaradi, lekin to'lov TASDIQLANGANINI faqat server
 * biladi (Complete callback). Shuning uchun qaytgach buyurtmani so'raymiz —
 * URL'dagi hech qanday parametrga ISHONMAYMIZ.
 */
const PENDING_KEY = 'unum:pendingOrder';

const BENEFITS = [
  'Cheksiz AI tahlil — kunlik chegara yo’q',
  'Haftalik va oylik hisobot',
  'Chuqur statistika va tendensiyalar',
  'Barcha mavzular va vidjetlar',
  'Bulutli zaxira va bir nechta qurilma',
];

export const PremiumView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [selected, setSelected] = useState<string>('year');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.billingStatus().then(setStatus).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  // To'lovdan qaytish. Buyurtma hali 'prepared' bo'lishi mumkin — Click
  // callback'i bir necha soniya kechikadi, shuning uchun bir necha marta
  // so'raymiz va keyin to'xtaymiz (cheksiz so'rov yubormaymiz).
  useEffect(() => {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const orderId = Number(raw);
    if (!Number.isInteger(orderId)) return sessionStorage.removeItem(PENDING_KEY);

    let tries = 0;
    let timer: number;

    const poll = async () => {
      tries += 1;
      try {
        const order = await api.order(orderId);
        if (order.state === 'paid') {
          sessionStorage.removeItem(PENDING_KEY);
          setError(null);
          return load();
        }
        if (order.state === 'cancelled') {
          sessionStorage.removeItem(PENDING_KEY);
          return setError("To'lov bekor qilindi");
        }
      } catch {
        /* tarmoq uzildi — keyingi urinishda qayta so'raymiz */
      }
      if (tries < 10) timer = window.setTimeout(poll, 3000);
      else sessionStorage.removeItem(PENDING_KEY);
    };

    setBusy(true);
    poll().finally(() => setBusy(false));
    return () => window.clearTimeout(timer);
  }, []);

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      const { orderId, payUrl } = await api.checkout(selected);
      // Qaytganimizda qaysi buyurtmani tekshirishni bilishimiz uchun.
      sessionStorage.setItem(PENDING_KEY, String(orderId));
      window.location.href = payUrl;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <SubScreen title="Premium" onBack={onBack}>
      {status?.premium ? (
        <Card className="mb-4 text-center">
          <Crown size={30} className="mx-auto mb-2 text-[#22C55E]" />
          <p className="text-[17px] font-semibold text-white">Premium faol</p>
          {status.premiumUntil && (
            <p className="mt-1 text-[13px] text-[#98A29E]">
              {fmtDate(status.premiumUntil)} gacha
            </p>
          )}
        </Card>
      ) : (
        <>
          <div className="mb-5 text-center">
            <Crown size={34} className="mx-auto mb-3 text-[#22C55E]" />
            <h2 className="text-[22px] font-semibold tracking-tight text-white">
              Maqsadingizga tezroq yeting
            </h2>
            <p className="mt-1.5 text-[14px] leading-snug text-[#98A29E]">
              Premium sizga ko&rsquo;proq tugma emas, ko&rsquo;proq natija beradi.
            </p>
          </div>

          <Card className="mb-5">
            <ul className="space-y-2.5">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <Check size={17} className="mt-0.5 shrink-0 text-[#22C55E]" />
                  <span className="text-[14px] leading-snug text-white">{b}</span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="space-y-2.5">
            {status?.plans.map((plan: Plan) => {
              const active = selected === plan.id;
              return (
                <button
                  key={plan.id}
                  onClick={() => setSelected(plan.id)}
                  aria-pressed={active}
                  className={`flex w-full items-center justify-between rounded-[20px] border p-4 text-left transition-colors ${
                    active
                      ? 'border-[#22C55E] bg-[#22C55E]/[0.08]'
                      : 'border-white/[0.07] bg-[#131717]'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[16px] font-semibold text-white">{plan.title}</span>
                      {plan.badge && (
                        <span className="rounded-full bg-[#22C55E]/15 px-2 py-0.5 text-[11px] font-medium text-[#22C55E]">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] text-[#98A29E]">
                      oyiga {som(plan.perMonth)} so&rsquo;m
                    </p>
                  </div>
                  <span className="shrink-0 text-[16px] font-semibold text-white">
                    {som(plan.amount)}
                  </span>
                </button>
              );
            })}
          </div>

          {error && <p className="mt-4 text-center text-[13px] text-[#F87171]">{error}</p>}

          <Button
            full
            className="mt-5"
            disabled={busy || !status || !status.available}
            onClick={buy}
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : 'Click orqali to’lash'}
          </Button>

          {status && !status.available && (
            <p className="mt-2.5 text-center text-[12px] text-[#98A29E]">
              To&rsquo;lov tizimi hozircha ulanmoqda
            </p>
          )}

          <p className="mt-3 text-center text-[12px] leading-snug text-[#6B7671]">
            To&rsquo;lov Click orqali amalga oshiriladi. Obuna avtomatik uzaytirilmaydi.
          </p>
        </>
      )}
    </SubScreen>
  );
};
