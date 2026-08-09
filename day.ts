/**
 * Kun kaliti ("2026-08-08") — foydalanuvchi vaqt mintaqasida.
 *
 * NIMA UCHUN KERAK. Server `new Date().toISOString()` ishlatganda kun UTC
 * bo'yicha hisoblanadi. O'zbekiston UTC+5 — demak har kecha soat 00:00 dan
 * 05:00 gacha server hali KECHAGI kunda turadi. Flutter ilova esa
 * `DateTime.now()` bilan LOKAL kunni oladi. Natijada shu 5 soat ichida
 * kiritilgan yozuv ilovada bugungi, botda esa kechagi kunga tushib,
 * ikkalasi har xil ball ko'rsatardi.
 *
 * Streak (odat ketma-ketligi) uchun bu yanada muhim: yarim kechada
 * belgilangan odat "kechagi" deb hisoblansa, ketma-ketlik noto'g'ri uziladi.
 */

/** O'zbekistonda yozgi vaqt yo'q — smena qat'iy UTC+5. */
const TZ = process.env.APP_TIMEZONE || 'Asia/Tashkent';

// en-CA lokali sanani aynan YYYY-MM-DD ko'rinishida beradi.
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Hozirgi kun kaliti. */
export const todayKey = (now: Date = new Date()): string => fmt.format(now);

/**
 * Yozuvning timestamp'i qaysi kunga tegishli.
 *
 * ⚠️ Bazada IKKI XIL format bor va bu ataylab hisobga olinadi:
 *   • "2026-08-08T01:09:00.000Z"     — server/bot yozgan, UTC belgisi bor
 *   • "2026-08-08T01:09:00.000"      — Flutter yozgan, mintaqasiz (LOKAL)
 *
 * Mintaqa belgisi bo'lsa — o'giramiz. Bo'lmasa — u allaqachon foydalanuvchi
 * vaqtida, shuning uchun sanani shundoq olamiz. Mintaqasiz qiymatni UTC deb
 * o'girish eski yozuvlarni bir kun orqaga surib yuborardi.
 */
export function dayKeyOf(timestamp: unknown): string {
  const s = String(timestamp || '');
  if (!s) return '';

  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s);
  if (!hasZone) return s.split('T')[0];

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s.split('T')[0] : fmt.format(d);
}

/** Yozuv bugungimi. */
export const isToday = (timestamp: unknown, now?: Date): boolean =>
  dayKeyOf(timestamp) === todayKey(now);

/** `key` dan `days` kun oldingi kalit (manfiy bo'lsa — keyingi). */
export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  // UTC da yuritamiz: kalit allaqachon "kalendar sana", mintaqa siljishi
  // bu yerda qayta qo'llanilsa kun chegarasida xato beradi.
  const base = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(base).toISOString().split('T')[0];
}

/** Bugundan boshlab orqaga `n` ta kun kaliti (bugun birinchi). */
export function lastDays(n: number, now?: Date): string[] {
  const t = todayKey(now);
  return Array.from({ length: n }, (_, i) => shiftDay(t, -i));
}
