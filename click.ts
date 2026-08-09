/**
 * To'lov provayderi bilan bog'lanish qatlami — PUBLIC REPODA QISQARTIRILGAN.
 *
 * ⚠️ Bu faylning haqiqiy implementatsiyasi ochiq repozitoriyga kiritilmagan.
 *
 * Sabab: fayl ichida to'lov provayderining imzo (signature) sxemasi,
 * callback'larni tekshirish tartibi va buyurtma holatini o'zgartirish
 * mantig'i bor. Ular loyihaning tijoriy integratsiyasi bo'lgani uchun
 * yopiq saqlanadi.
 *
 * Bu yerda faqat INTERFEYS qoldirilgan — shunda repozitoriyning qolgan
 * qismi (server.ts, billing.ts) o'zgarishsiz kompilyatsiya bo'ladi va
 * arxitekturani o'qib tushunish mumkin.
 *
 * Haqiqiy versiyada bu modul quyidagilarni bajaradi:
 *   1. `prepare`  — provayder buyurtmani tasdiqlashdan oldin so'raydi:
 *                   buyurtma bormi, summa mosmi, allaqachon to'langanmi.
 *   2. `complete` — to'lov yakunlangach chaqiriladi: obuna faollashadi.
 *   3. Har ikkalasida ham so'rovning haqiqiyligi maxfiy kalit asosidagi
 *      imzo bilan tekshiriladi (autentifikatsiya tokeni yo'q, chunki
 *      provayder uni bilmaydi — butun himoya shu imzoga tayanadi).
 *   4. Xatolar HTTP status bilan emas, javob tanasidagi `error` kodi
 *      bilan qaytariladi — provayder shunday kutadi.
 */

import type { Request, Response } from 'express';

/** To'lov provayderi sozlanganmi (env to'ldirilganmi). */
export const clickConfigured = (): boolean => false;

/** Provayder kutadigan xato kodlari. */
export const ClickError = {
  Success: 0,
  SignCheckFailed: -1,
  IncorrectAmount: -2,
  ActionNotFound: -3,
  AlreadyPaid: -4,
  TransactionNotFound: -6,
  TransactionCancelled: -9,
} as const;

/** Buyurtmani to'lashdan oldingi tekshiruv (provayder chaqiradi). */
export function clickPrepare(_req: Request, res: Response) {
  res.json({ error: ClickError.ActionNotFound, error_note: 'Not available in public build' });
}

/** To'lov yakunlangach obunani faollashtirish (provayder chaqiradi). */
export function clickComplete(_req: Request, res: Response) {
  res.json({ error: ClickError.ActionNotFound, error_note: 'Not available in public build' });
}

/** Foydalanuvchini to'lov sahifasiga olib boradigan havola. */
export function buildPayUrl(_orderId: number, _amount: number, _returnUrl?: string): string {
  throw new Error('To\'lov provayderi bu qurilmada sozlanmagan');
}
