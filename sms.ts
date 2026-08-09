/**
 * eskiz.uz orqali SMS yuborish.
 *
 * Bu modul PUL sarflaydi — har bir yuborilgan SMS hisobdan yechiladi.
 * Shuning uchun bu yerda ikkita narsa muhim:
 *   1. Token keshlanadi (har SMS uchun qayta login qilinmaydi)
 *   2. Yuborishdan oldin raqam formati qat'iy tekshiriladi — noto'g'ri
 *      raqamga urinish ham hisobdan pul yechishi mumkin
 *
 * Cheklovlar (rate-limit) bu yerda emas, chaqiruvchi tomonda — chunki ular
 * foydalanuvchi/IP darajasida bo'lishi kerak.
 */

const BASE = 'https://notify.eskiz.uz/api';

interface TokenCache {
  token: string;
  /** Qachon eskiradi (ms). Eskiz tokeni ~30 kun, biz 25 kun deb olamiz. */
  expiresAt: number;
}

let cache: TokenCache | null = null;

function creds() {
  const email = process.env.ESKIZ_EMAIL;
  const password = process.env.ESKIZ_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export const smsConfigured = () => creds() !== null;

async function login(): Promise<string> {
  const c = creds();
  if (!c) throw new Error('eskiz sozlanmagan (ESKIZ_EMAIL / ESKIZ_PASSWORD)');

  const form = new URLSearchParams();
  form.set('email', c.email);
  form.set('password', c.password);

  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(20000),
  });
  const json: any = await res.json().catch(() => ({}));
  const token = json?.data?.token;
  if (!res.ok || !token) {
    throw new Error(`eskiz login: ${json?.message || res.status}`);
  }
  cache = { token, expiresAt: Date.now() + 25 * 24 * 60 * 60 * 1000 };
  return token;
}

async function token(): Promise<string> {
  if (cache && cache.expiresAt > Date.now()) return cache.token;
  return login();
}

/**
 * Raqamni eskiz kutgan ko'rinishga keltiradi: 998XXXXXXXXX.
 * Noto'g'ri bo'lsa `null` — bu holda SMS umuman yuborilmaydi.
 */
export function normalizePhone(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  // 901234567 → 998901234567
  const full = digits.length === 9 ? `998${digits}` : digits;
  // O'zbekiston: 998 + 2 raqamli operator kodi + 7 raqam
  if (!/^998\d{9}$/.test(full)) return null;
  return full;
}

/** Ko'rsatish uchun: 998901234567 → +998 90 123 45 67 */
export function formatPhone(p: string): string {
  const m = /^998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(p);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${p}`;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * SMS yuboradi.
 *
 * ⚠️ eskiz faqat OLDINDAN TASDIQLANGAN matn shablonlarini yuboradi.
 * Tasdiqlanmagan matn "message is not allowed" bilan qaytadi. Shablonni
 * eskiz kabinetida tasdiqlatib, `SMS_TEMPLATE` ni shunga moslang.
 */
export async function sendSms(phone: string, message: string): Promise<SendResult> {
  const normalized = normalizePhone(phone);
  if (!normalized) return { ok: false, error: "Raqam formati noto'g'ri" };

  try {
    const doSend = async (bearer: string) => {
      const form = new URLSearchParams();
      form.set('mobile_phone', normalized);
      form.set('message', message);
      form.set('from', process.env.ESKIZ_SENDER || '4546');

      return fetch(`${BASE}/message/sms/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearer}` },
        body: form,
        signal: AbortSignal.timeout(25000),
      });
    };

    let res = await doSend(await token());
    // Token eskirgan bo'lsa bir marta qayta login qilib ko'ramiz.
    if (res.status === 401) {
      cache = null;
      res = await doSend(await token());
    }

    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json?.message || `eskiz ${res.status}` };
    }
    return { ok: true, id: String(json?.id ?? '') };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/** Hisobdagi qolgan mablag' — admin uchun. */
export async function balance(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/user/get-limit`, {
      headers: { Authorization: `Bearer ${await token()}` },
      signal: AbortSignal.timeout(15000),
    });
    const json: any = await res.json().catch(() => ({}));
    return json?.data?.balance != null ? String(json.data.balance) : null;
  } catch {
    return null;
  }
}
