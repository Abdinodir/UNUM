/**
 * Kun kaliti mantiqining sinovi.  Ishga tushirish:  npm run test:day
 *
 * Bu fayl bazaga tegmaydi — sof funksiyalar.
 */
import { todayKey, dayKeyOf, isToday, shiftDay, lastDays } from '../day';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail && !cond ? ` → ${detail}` : ''}`);
  if (!cond) failures++;
}

// ---------- Asosiy xato: yarim tundan keyingi 5 soat ----------
{
  // 2026-08-07 20:09 UTC = 2026-08-08 01:09 Toshkentda.
  const t = new Date('2026-08-07T20:09:00.000Z');
  check('yarim tundan keyin Toshkent kuni 08 (UTC 07 emas)',
    todayKey(t) === '2026-08-08', todayKey(t));

  // Aynan chegara: 19:00 UTC = 00:00 Toshkent.
  check('19:00 UTC → yangi kun boshlandi',
    todayKey(new Date('2026-08-07T19:00:00.000Z')) === '2026-08-08');
  check('18:59 UTC → hali eski kun',
    todayKey(new Date('2026-08-07T18:59:00.000Z')) === '2026-08-07');
}

// ---------- Ikki xil timestamp formati ----------
{
  // Server/bot yozgan — UTC belgisi bor, o'girish kerak.
  check('UTC belgili timestamp o\'giriladi',
    dayKeyOf('2026-08-07T20:09:00.000Z') === '2026-08-08',
    dayKeyOf('2026-08-07T20:09:00.000Z'));

  // Flutter yozgan — mintaqasiz, allaqachon lokal. O'girilmasligi SHART.
  check('mintaqasiz timestamp shundoq olinadi',
    dayKeyOf('2026-08-08T01:09:00.000') === '2026-08-08',
    dayKeyOf('2026-08-08T01:09:00.000'));

  // Eng muhim holat: agar mintaqasizni UTC deb o'girsak, 01:09 → 06:09
  // bo'lib kun o'zgarmasdi, LEKIN 2026-08-08T02:00 lokal 21:00 oldingi kunga
  // tushib ketardi. Shuni tekshiramiz.
  check('mintaqasiz yarim tun yozuvi kun orqaga SURILMAYDI',
    dayKeyOf('2026-08-08T00:30:00.000') === '2026-08-08',
    dayKeyOf('2026-08-08T00:30:00.000'));

  check('ofsetli timestamp ham o\'giriladi',
    dayKeyOf('2026-08-08T01:09:00.000+05:00') === '2026-08-08',
    dayKeyOf('2026-08-08T01:09:00.000+05:00'));

  check('bo\'sh qiymat bo\'sh kalit', dayKeyOf(null) === '' && dayKeyOf(undefined) === '');
}

// ---------- isToday ----------
{
  const now = new Date('2026-08-07T20:09:00.000Z'); // = 08-08 Toshkentda
  check('bugungi yozuv', isToday('2026-08-08T00:30:00.000', now));
  check('kechagi yozuv emas', !isToday('2026-08-07T10:00:00.000', now));
}

// ---------- shiftDay ----------
{
  check('bir kun orqaga', shiftDay('2026-08-08', -1) === '2026-08-07');
  check('oy chegarasi', shiftDay('2026-08-01', -1) === '2026-07-31');
  check('yil chegarasi', shiftDay('2026-01-01', -1) === '2025-12-31');
  check('kabisa yili', shiftDay('2028-03-01', -1) === '2028-02-29',
    shiftDay('2028-03-01', -1));
  check('oldinga', shiftDay('2026-08-08', 1) === '2026-08-09');
}

// ---------- lastDays (streak uchun) ----------
{
  const now = new Date('2026-08-07T20:09:00.000Z');
  const d = lastDays(3, now);
  check('bugundan boshlab orqaga',
    JSON.stringify(d) === JSON.stringify(['2026-08-08', '2026-08-07', '2026-08-06']),
    JSON.stringify(d));
}

console.log(`\n${failures === 0 ? "✅ HAMMASI O'TDI" : `❌ ${failures} ta SINOV YIQILDI`}\n`);
process.exit(failures === 0 ? 0 : 1);
