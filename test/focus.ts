/**
 * Fokus seanslari sinovi.  Ishga tushirish:  npm run test:focus
 */
import { Users, Profiles, Items } from '../db';
import { listFocus, createFocus, deleteFocus } from '../focus';
import { todayKey, shiftDay } from '../day';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail && !cond ? ` → ${detail}` : ''}`);
  if (!cond) failures++;
}

function fakeRes() {
  const out: any = { code: 200, body: null };
  return {
    status(c: number) { out.code = c; return this; },
    json(b: any) { out.body = b; return this; },
    out,
  } as any;
}
const call = (fn: (...a: any[]) => void, ...args: any[]) => {
  const r = fakeRes(); fn(...args, r); return r.out;
};

const uid = Users.create('focus@unum.local', 'h', 'S');
Profiles.set(uid, {});
const T = todayKey();

// ---------- 1. Validatsiya ----------
{
  check('0 daqiqa rad etiladi', call(createFocus, uid, { minutes: 0 }).code === 400);
  check('manfiy rad etiladi', call(createFocus, uid, { minutes: -25 }).code === 400);
  check('481 daqiqa rad etiladi (taymer unutilgan)',
    call(createFocus, uid, { minutes: 481 }).code === 400);
  check('matn rad etiladi', call(createFocus, uid, { minutes: 'yigirma' }).code === 400);
  check('480 daqiqa o\'tadi', call(createFocus, uid, { minutes: 480 }).code === 200);
}

// ---------- 2. Yaratish ----------
{
  const s = call(createFocus, uid, { kind: 'study', minutes: 25, note: 'IELTS' });
  check('seans yaratildi', s.code === 200 && !!s.body?.id);
  check('kind saqlandi', s.body?.kind === 'study');
  check('25 daqiqa', s.body?.minutes === 25);

  const bad = call(createFocus, uid, { kind: 'HACK', minutes: 10 });
  check('noma\'lum kind → study', bad.body?.kind === 'study', bad.body?.kind);

  const rounded = call(createFocus, uid, { minutes: 24.7 });
  check('kasr yaxlitlanadi', rounded.body?.minutes === 25, String(rounded.body?.minutes));
}

// ---------- 3. Vaqtni SERVER qo'yadi ----------
{
  const s = call(createFocus, uid, { minutes: 30, timestamp: '2020-01-01T00:00:00.000Z' });
  check('mijoz yuborgan timestamp E\'TIBORSIZ qoldiriladi',
    !String(s.body?.timestamp).startsWith('2020'), s.body?.timestamp);
  check('soxta o\'tmishdagi seans bugungi kunga yozildi',
    String(s.body?.timestamp).slice(0, 4) === String(new Date().getUTCFullYear()));
}

// ---------- 4. Kunlik yig'indi ----------
{
  const l = call(listFocus, uid, T).body;
  check('sana bugungi', l.date === T);
  check('maqsad sukut bo\'yicha 120', l.target === 120, String(l.target));
  // 480 + 25 + 10 + 25 + 30 = 570
  check('jami daqiqa hisoblandi', l.minutes === 570, String(l.minutes));
  check('foiz 100 da cheklandi', l.percent === 100, String(l.percent));
  check('seanslar ro\'yxati', l.sessions.length === 5, String(l.sessions.length));
}

// ---------- 5. Maqsad profildan ----------
{
  const u2 = Users.create('focus2@unum.local', 'h', 'S');
  Profiles.set(u2, { focusTargetMinutes: 60 });
  call(createFocus, u2, { minutes: 30 });
  const l = call(listFocus, u2, T).body;
  check('profildagi maqsad ishlatildi', l.target === 60, String(l.target));
  check('30/60 → 50%', l.percent === 50, String(l.percent));
}

// ---------- 6. Turlar bo'yicha ----------
{
  const u3 = Users.create('focus3@unum.local', 'h', 'S');
  Profiles.set(u3, {});
  call(createFocus, u3, { kind: 'study', minutes: 50 });
  call(createFocus, u3, { kind: 'work', minutes: 25 });
  call(createFocus, u3, { kind: 'study', minutes: 25 });

  const l = call(listFocus, u3, T).body;
  const study = l.byKind.find((k: any) => k.kind === 'study');
  check('study 75 daqiqa', study?.minutes === 75, JSON.stringify(l.byKind));
  check('bo\'sh turlar ro\'yxatda yo\'q', l.byKind.length === 2, String(l.byKind.length));
  check('turkcha yorliq', study?.label === "O'qish", study?.label);
}

// ---------- 7. Haftalik ----------
{
  const u4 = Users.create('focus4@unum.local', 'h', 'S');
  Profiles.set(u4, {});
  call(createFocus, u4, { minutes: 40 });
  // Uch kun oldingi seans — timestamp'ni to'g'ridan-to'g'ri yozamiz,
  // chunki endpoint har doim hozirgi vaqtni qo'yadi.
  Items.create(u4, 'focus', {
    timestamp: `${shiftDay(T, -3)}T10:00:00.000`, kind: 'work', minutes: 60, note: '', goalId: null,
  });

  const l = call(listFocus, u4, T).body;
  check('hafta 7 kundan iborat', l.week.length === 7);
  check('hafta oxiri bugun', l.week[6].date === T, l.week[6].date);
  check('bugun 40 daqiqa', l.week[6].minutes === 40, String(l.week[6].minutes));
  check('3 kun oldin 60 daqiqa', l.week[3].minutes === 60, JSON.stringify(l.week));
  check('bugungi ro\'yxatda eski seans YO\'Q', l.sessions.length === 1);
}

// ---------- 8. O'chirish ----------
{
  const u5 = Users.create('focus5@unum.local', 'h', 'S');
  Profiles.set(u5, {});
  const s = call(createFocus, u5, { minutes: 25 });
  call(deleteFocus, u5, s.body.id);
  check('o\'chirildi', call(listFocus, u5, T).body.sessions.length === 0);
}

console.log(`\n${failures === 0 ? "✅ HAMMASI O'TDI" : `❌ ${failures} ta SINOV YIQILDI`}\n`);
process.exit(failures === 0 ? 0 : 1);
