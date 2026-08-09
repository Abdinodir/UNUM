import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db, Users } from './db';
import { seedUser } from './seed';
import { sendSms, normalizePhone, formatPhone, smsConfigured } from './sms';

/**
 * Telefon raqami orqali kirish (SMS OTP).
 *
 * Bu ilovadagi YAGONA endpoint bo'lib, uni chaqirish HAQIQIY PUL sarflaydi.
 * Shuning uchun himoya birinchi o'rinda:
 *
 *   • bitta raqamga soatiga 3, kuniga 10 ta kod
 *   • ketma-ket so'rovlar orasida 60 soniya sovish vaqti
 *   • kod 5 daqiqada eskiradi
 *   • 5 marta noto'g'ri kiritilsa kod bekor bo'ladi (brute-force'ga qarshi:
 *     6 xonali kodni 5 urinishda topish ehtimoli 1:200 000)
 *   • kod bazada OCHIQ saqlanmaydi — faqat xeshi
 *
 * Bularsiz bitta skript bir kechada butun hisobni bo'shatib ketardi.
 */

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_PER_HOUR = 3;
const MAX_PER_DAY = 10;
const MAX_VERIFY_ATTEMPTS = 5;

const otpStmt = {
  get: db.prepare('SELECT * FROM phone_otps WHERE phone = ?'),
  upsert: db.prepare(`
    INSERT INTO phone_otps (phone, code_hash, expires_at, attempts, last_sent, sent_today, day)
    VALUES (@phone, @code_hash, @expires_at, 0, @last_sent, @sent_today, @day)
    ON CONFLICT(phone) DO UPDATE SET
      code_hash = excluded.code_hash,
      expires_at = excluded.expires_at,
      attempts = 0,
      last_sent = excluded.last_sent,
      sent_today = excluded.sent_today,
      day = excluded.day
  `),
  bumpAttempts: db.prepare(
    'UPDATE phone_otps SET attempts = attempts + 1 WHERE phone = ?'
  ),
  clear: db.prepare('DELETE FROM phone_otps WHERE phone = ?'),
  purge: db.prepare('DELETE FROM phone_otps WHERE expires_at < ?'),
};

const userStmt = {
  byPhone: db.prepare('SELECT * FROM users WHERE phone = ?'),
  setPhone: db.prepare('UPDATE users SET phone = ? WHERE id = ?'),
};

interface OtpRow {
  phone: string;
  code_hash: string;
  expires_at: number;
  attempts: number;
  last_sent: number;
  sent_today: number;
  day: string;
}

const today = () => new Date().toISOString().split('T')[0];

/**
 * SMS yuborilmasa adminga darhol xabar beradi.
 *
 * Buning sababi: telefon — kirishning YAGONA yo'li. eskiz shabloni rad etilsa
 * yoki balans tugasa, ilova jimgina o'ladi — hech kim ro'yxatdan o'tolmaydi,
 * lekin hech qanday xato ko'rinmaydi. Bu holatni foydalanuvchining shikoyatidan
 * emas, birinchi xatoning o'zidan bilishimiz kerak.
 *
 * Soatiga bittadan ko'p xabar yuborilmaydi — aks holda nosozlik paytida
 * yuzlab xabar kelardi.
 */
let lastAlert = 0;
function alertAdmin(text: string): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_ADMIN_ID;
  if (!token || !chat) return;
  if (Date.now() - lastAlert < 60 * 60 * 1000) return;
  lastAlert = Date.now();

  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {
    /* Ogohlantirish yuborilmasa ham asosiy oqim to'xtamasligi kerak. */
  });
}

/** Kodni xeshlaymiz — baza o'g'irlansa ham kodlar ochiq bo'lmasin. */
const hash = (code: string, phone: string) =>
  crypto.createHash('sha256').update(`${phone}:${code}`).digest('hex');

export interface RequestResult {
  ok: boolean;
  error?: string;
  /** Qayta yuborishgacha necha soniya qolgani. */
  retryAfter?: number;
}

/**
 * Kod yuboradi.
 *
 * Muvaffaqiyatli javob raqam ro'yxatdan o'tgan-o'tmaganini OSHKOR QILMAYDI —
 * aks holda bu raqamlar bazasini yig'ish vositasiga aylanardi.
 */
/**
 * Play/App Store tekshiruvchilari uchun demo raqam.
 *
 * eskiz faqat O'zbekiston raqamlariga SMS yuboradi, tekshiruvchilar esa
 * chet elda — ular hisob ocholmasa ilova RAD ETILADI. Shuning uchun bitta
 * oldindan belgilangan raqam SMS yubormasdan, doimiy kod bilan kiradi.
 * Bu raqam faqat Play Console'ning "App access" bo'limida ko'rsatiladi.
 */
function demoAccount(): { phone: string; code: string } | null {
  const phone = normalizePhone(process.env.DEMO_PHONE || '');
  const code = (process.env.DEMO_CODE || '').replace(/\D/g, '');
  if (!phone || code.length !== 6) return null;
  return { phone, code };
}

export async function requestCode(rawPhone: string): Promise<RequestResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return { ok: false, error: "Telefon raqami noto'g'ri. Masalan: 90 123 45 67" };
  }

  // Demo raqam: SMS yuborilmaydi, pul sarflanmaydi.
  const demo = demoAccount();
  if (demo && phone === demo.phone) {
    otpStmt.upsert.run({
      phone,
      code_hash: hash(demo.code, phone),
      expires_at: Date.now() + CODE_TTL_MS,
      last_sent: Date.now(),
      sent_today: 1,
      day: today(),
    });
    return { ok: true };
  }

  if (!smsConfigured()) {
    return { ok: false, error: 'SMS xizmati sozlanmagan' };
  }

  otpStmt.purge.run(Date.now() - 24 * 60 * 60 * 1000);
  const row = otpStmt.get.get(phone) as OtpRow | undefined;
  const now = Date.now();

  let sentToday = 1;
  if (row) {
    const sinceLast = now - row.last_sent;
    if (sinceLast < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        error: 'Juda tez-tez. Biroz kuting.',
        retryAfter: Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000),
      };
    }
    if (row.day === today()) {
      if (row.sent_today >= MAX_PER_DAY) {
        return {
          ok: false,
          error: "Bugun uchun kod chegarasi tugadi. Ertaga urinib ko'ring.",
        };
      }
      // Soatlik chegara: oxirgi soatdagi yuborishlarni taxminiy hisoblaymiz.
      if (sinceLast < 60 * 60 * 1000 && row.sent_today >= MAX_PER_HOUR) {
        const rowHourStart = row.last_sent - 60 * 60 * 1000;
        if (rowHourStart < now) {
          return {
            ok: false,
            error: "Bir soatda 3 tadan ko'p kod yuborilmaydi.",
            retryAfter: Math.ceil((60 * 60 * 1000 - sinceLast) / 1000),
          };
        }
      }
      sentToday = row.sent_today + 1;
    }
  }

  // 6 xonali kod. Math.random EMAS — kriptografik generator.
  const code = String(crypto.randomInt(100000, 1000000));

  const message =
    process.env.SMS_TEMPLATE?.replace('{code}', code) ||
    `UNUM tasdiqlash kodi: ${code}. Hech kimga bermang.`;

  const res = await sendSms(phone, message);
  if (!res.ok) {
    console.error('otp send failed:', phone, res.error);
    alertAdmin(
      `🚨 UNUM: SMS yuborilmadi — HECH KIM ro'yxatdan o'tolmaydi!\n\n` +
        `Raqam: ${formatPhone(phone)}\n` +
        `Sabab: ${res.error}\n\n` +
        `Tez-tez uchraydigan sabablar: eskiz shabloni tasdiqlanmagan, ` +
        `balans tugagan, yoki ESKIZ paroli o'zgargan.`
    );
    return { ok: false, error: 'SMS yuborilmadi. Keyinroq urinib ko\'ring.' };
  }

  otpStmt.upsert.run({
    phone,
    code_hash: hash(code, phone),
    expires_at: now + CODE_TTL_MS,
    last_sent: now,
    sent_today: sentToday,
    day: today(),
  });

  return { ok: true };
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
  userId?: number;
  isNew?: boolean;
}

/**
 * Kodni tekshiradi va hisobga kiritadi.
 * Raqam yangi bo'lsa — yangi hisob ochiladi.
 */
export async function verifyCode(
  rawPhone: string,
  code: string,
  name?: string
): Promise<VerifyResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: "Raqam noto'g'ri" };

  const row = otpStmt.get.get(phone) as OtpRow | undefined;
  if (!row) return { ok: false, error: 'Kod topilmadi. Yangi kod so\'rang.' };

  if (row.expires_at < Date.now()) {
    otpStmt.clear.run(phone);
    return { ok: false, error: 'Kod muddati tugadi. Yangi kod so\'rang.' };
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    otpStmt.clear.run(phone);
    return {
      ok: false,
      error: "Juda ko'p noto'g'ri urinish. Yangi kod so'rang.",
    };
  }

  const given = String(code || '').replace(/\D/g, '');
  // Vaqt bo'yicha hujumga qarshi doimiy vaqtli solishtirish.
  const expected = row.code_hash;
  const actual = hash(given, phone);
  const same =
    actual.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));

  if (!same) {
    otpStmt.bumpAttempts.run(phone);
    const left = MAX_VERIFY_ATTEMPTS - (row.attempts + 1);
    return {
      ok: false,
      error: left > 0
        ? `Kod noto'g'ri. Yana ${left} ta urinish qoldi.`
        : "Kod noto'g'ri. Yangi kod so'rang.",
    };
  }

  otpStmt.clear.run(phone);

  const existing = userStmt.byPhone.get(phone) as { id: number } | undefined;
  if (existing) return { ok: true, userId: existing.id, isNew: false };

  // Yangi hisob. Email majburiy ustun bo'lgani uchun raqamdan hosil qilamiz —
  // foydalanuvchi keyin haqiqiy emailini qo'sha oladi.
  const pseudoEmail = `${phone}@phone.unum.local`;
  const randomPassword = crypto.randomBytes(24).toString('hex');
  const displayName = (name || '').trim() || 'Chempion';

  const userId = Users.create(
    pseudoEmail,
    await bcrypt.hash(randomPassword, 10),
    displayName
  );
  userStmt.setPhone.run(phone, userId);
  // Email bilan ro'yxatdan o'tish bilan bir xil boshlang'ich ma'lumot:
  // ovqat katalogi, yutuqlar, kouch salomi.
  seedUser(userId, displayName);

  return { ok: true, userId, isNew: true };
}

export { formatPhone };
