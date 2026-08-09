import { useEffect, useState } from 'react';
import { api, type BillingStatus } from './api';

/**
 * Obuna holatini serverdan o'qiydi.
 *
 * Premium HOLATI FAQAT SHU YERDAN keladi — mock ma'lumot yoki lokal bayroq
 * ishlatilmaydi. Server `premiumUntil` bo'yicha hal qiladi, klient esa
 * ko'rsatadi, xolos.
 */
export function useBilling() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () =>
    api
      .billingStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));

  useEffect(() => {
    refresh();
  }, []);

  return { status, loading, refresh, premium: status?.premium === true };
}

/** "2027-yil 14-mart" ko'rinishida. */
export const formatUntil = (iso: string | null): string | null =>
  iso
    ? new Date(iso).toLocaleDateString('uz-UZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;
