/**
 * Odatlar va ketma-ketlik sinovi.  Ishga tushirish:  npm run test:habits
 */
import { Users, Profiles, grantPremium } from '../db';
import {
  listHabits, createHabit, updateHabit, checkHabit, deleteHabit,
  currentStreak, bestStreak, isDueOn, type Habit,
} from '../habits';
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
  const r = fakeRes();
  fn(...args, r);
  return r.out;
};

/** Sinov uchun sof obyekt — bazaga tegmaydi. */
const mk = (log: Record<string, boolean>, over: Partial<Habit> = {}): Habit => ({
  id: 'h', title: 't', emoji: '🎯', schedule: 'daily', days: [],
  color: '#22C55E', status: 'active', log, createdAt: '', ...over,
});

const T = '2026-08-08';           // shanba
const d = (n: number) => shiftDay(T, n);

// ==================== STREAK MANTIG'I ====================
console.log('--- ketma-ketlik ---');
{
  check('bo\'sh odat → 0', currentStreak(mk({}), T) === 0);

  check('faqat bugun → 1', currentStreak(mk({ [T]: true }), T) === 1);

  check('3 kun ketma-ket → 3',
    currentStreak(mk({ [T]: true, [d(-1)]: true, [d(-2)]: true }), T) === 3);

  // ENG MUHIM QOIDA: bugun hali belgilanmagan bo'lsa ketma-ketlik uzilmaydi.
  check('bugun belgilanmagan, kecha bor → 1 (0 EMAS)',
    currentStreak(mk({ [d(-1)]: true }), T) === 1,
    String(currentStreak(mk({ [d(-1)]: true }), T)));

  check('bugun ham kecha ham yo\'q → 0',
    currentStreak(mk({ [d(-2)]: true }), T) === 0);

  check('oradagi bo\'shliq uzadi',
    currentStreak(mk({ [T]: true, [d(-1)]: true, [d(-3)]: true }), T) === 2);
}

// ==================== JADVAL ====================
console.log('\n--- jadval ---');
{
  const wd = mk({}, { schedule: 'weekdays' });
  check('shanba ish kuni emas', !isDueOn(wd, '2026-08-08'));
  check('dushanba ish kuni', isDueOn(wd, '2026-08-10'));
  check('juma ish kuni', isDueOn(wd, '2026-08-07'));
  check('yakshanba ish kuni emas', !isDueOn(wd, '2026-08-09'));

  // Juma belgilangan, shanba-yakshanba talab qilinmaydi → shanbada
  // ketma-ketlik hali 1 bo'lib turishi kerak.
  const streak = currentStreak(mk({ '2026-08-07': true }, { schedule: 'weekdays' }), '2026-08-08');
  check('dam olish kuni ketma-ketlikni UZMAYDI', streak === 1, String(streak));

  // Dushanba–juma to'liq → 5.
  const week = mk(
    { '2026-08-03': true, '2026-08-04': true, '2026-08-05': true, '2026-08-06': true, '2026-08-07': true },
    { schedule: 'weekdays' }
  );
  check('to\'liq ish haftasi → 5', currentStreak(week, '2026-08-08') === 5,
    String(currentStreak(week, '2026-08-08')));

  const custom = mk({}, { schedule: 'custom', days: [1, 3, 5] });
  check('custom: dushanba ha', isDueOn(custom, '2026-08-10'));
  check('custom: seshanba yo\'q', !isDueOn(custom, '2026-08-11'));
}

// ==================== ENG UZUN KETMA-KETLIK ====================
console.log('\n--- eng uzun ---');
{
  check('bo\'sh → 0', bestStreak(mk({})) === 0);
  check('bitta kun → 1', bestStreak(mk({ [T]: true })) === 1);

  const h = mk({
    '2026-07-01': true, '2026-07-02': true, '2026-07-03': true, '2026-07-04': true,
    // uzilish
    '2026-07-10': true, '2026-07-11': true,
  });
  check('eng uzun = 4', bestStreak(h) === 4, String(bestStreak(h)));

  const wd = mk(
    { '2026-08-06': true, '2026-08-07': true, '2026-08-10': true },
    { schedule: 'weekdays' }
  );
  check('ish kunlari: payshanba-juma-dushanba = 3', bestStreak(wd) === 3, String(bestStreak(wd)));
}

// ==================== ENDPOINTLAR ====================
console.log('\n--- endpointlar ---');
const uid = Users.create('habit@unum.local', 'h', 'Sinov');
Profiles.set(uid, {});
const TODAY = todayKey();

{
  check('nomsiz odat rad etiladi', call(createHabit, uid, { title: ' ' }).code === 400);

  const h = call(createHabit, uid, { title: 'Ertalab yugurish', emoji: '🏃' });
  check('odat yaratildi', h.code === 200 && !!h.body?.id);
  check('streak 0', h.body?.streak === 0);
  check('bugun bajarilmagan', h.body?.doneToday === false);
  check('log mijozga YUBORILMAYDI', !('log' in h.body), JSON.stringify(Object.keys(h.body)));

  // log ni PUT orqali yozib bo'lmaydi — soxta streak himoyasi.
  const hacked = call(updateHabit, uid, h.body.id, {
    title: 'Ertalab yugurish',
    log: { '2020-01-01': true, '2020-01-02': true, '2020-01-03': true },
  });
  check('PUT orqali soxta log O\'TMAYDI', hacked.body?.totalDone === 0,
    String(hacked.body?.totalDone));

  const checked = call(checkHabit, uid, h.body.id, TODAY);
  check('bugun belgilandi', checked.body?.doneToday === true);
  check('streak 1 ga chiqdi', checked.body?.streak === 1);

  const unchecked = call(checkHabit, uid, h.body.id, TODAY);
  check('qayta bosilganda belgi olindi', unchecked.body?.doneToday === false);

  const future = call(checkHabit, uid, h.body.id, shiftDay(TODAY, 1));
  check('kelajakdagi kun rad etiladi', future.code === 400, JSON.stringify(future.body));

  const past = call(checkHabit, uid, h.body.id, shiftDay(TODAY, -1));
  check('kechagi kunni belgilash mumkin', past.body?.streak === 1, String(past.body?.streak));
}

// ---------- Chegara: 5 ta odat ----------
{
  for (let i = 2; i <= 5; i++) call(createHabit, uid, { title: `Odat ${i}` });
  const l = call(listHabits, uid).body;
  check('5 ta faol odat', l.activeCount === 5, String(l.activeCount));

  const sixth = call(createHabit, uid, { title: '6-chi' });
  check('6-chi rad etildi', sixth.code === 403, JSON.stringify(sixth.body));
  check('chegara raqami', sixth.body?.limit === 5);

  grantPremium(uid, 30);
  check('premium bilan 6-chi o\'tdi', call(createHabit, uid, { title: '6-chi' }).code === 200);
}

// ---------- custom bo'sh kunlar bilan ----------
{
  const h = call(createHabit, uid, { title: 'Custom', schedule: 'custom', days: [] });
  check('bo\'sh custom → har kuni', h.body?.dueToday === true);
}

// ---------- bugungi hisob ----------
{
  const l = call(listHabits, uid).body;
  check('todayDue hisoblandi', typeof l.todayDue === 'number' && l.todayDue > 0, String(l.todayDue));
  check('todayDone <= todayDue', l.todayDone <= l.todayDue);
}

// ---------- oxirgi 14 kun ----------
{
  const h = call(listHabits, uid).body.habits[0];
  check('recent 14 kun', h.recent.length === 14, String(h.recent.length));
  check('recent oxirgisi bugun', h.recent[13].date === TODAY, h.recent[13].date);
}

console.log(`\n${failures === 0 ? "✅ HAMMASI O'TDI" : `❌ ${failures} ta SINOV YIQILDI`}\n`);
process.exit(failures === 0 ? 0 : 1);
