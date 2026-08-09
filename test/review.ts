/**
 * Prognoz va hisobot sinovi.  Ishga tushirish:  npm run test:review
 */
import { Users, Profiles, Items } from '../db';
import { predictGoal, buildReview } from '../review';
import { shiftDay } from '../day';
import type { Goal } from '../goals';
import { sanitizeMilestones } from '../coach';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail && !cond ? ` → ${detail}` : ''}`);
  if (!cond) failures++;
}

/** Sinov sanasi qat'iy — natijalar kalendarga bog'liq bo'lmasin. */
const T = '2026-08-08';
const d = (n: number) => shiftDay(T, n);

const mkGoal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1', title: 'Maqsad', description: '', category: 'personal',
  metric: null, milestones: [], startDate: d(-30), deadline: null,
  status: 'active', createdAt: '', completedAt: null, progressLog: [],
  ...over,
});

console.log('--- prognoz ---');

// ---------- 1. Ma'lumot yetarli emas ----------
{
  const p = predictGoal(mkGoal(), T);
  check('nuqta yo\'q → ishonch past', p.confidence === 'low');
  check('prognoz sanasi yo\'q', p.projectedDate === null);
  check('perDay 0', p.perDay === 0);
}

// ---------- 2. Bir tekis temp ----------
{
  // 20 kunda 0 → 40%, ya'ni kuniga 2%.
  const log = Array.from({ length: 21 }, (_, i) => ({ date: d(-20 + i), value: i * 2 }));
  const p = predictGoal(mkGoal({ progressLog: log, metric: { unit: '%', start: 0, target: 100, current: 40 } }), T);

  check('temp kuniga 2%', p.perDay === 2, String(p.perDay));
  check('ishonch yuqori', p.confidence === 'high', p.confidence);
  // 40% dan 100% gacha 60% qoldi, kuniga 2% → 30 kun.
  check('30 kunda tugaydi', p.projectedDate === d(30), p.projectedDate ?? 'null');
}

// ---------- 3. Deadline'ga ULGURADI ----------
{
  const log = Array.from({ length: 21 }, (_, i) => ({ date: d(-20 + i), value: i * 3 }));
  const p = predictGoal(mkGoal({
    progressLog: log, deadline: d(60),
    metric: { unit: '%', start: 0, target: 100, current: 60 },
  }), T);
  check('ulguradi → onTrack true', p.onTrack === true, JSON.stringify({ daysLate: p.daysLate }));
  check('daysLate manfiy', (p.daysLate ?? 0) < 0, String(p.daysLate));
  check('xabar "Ulgurasiz"', p.message.startsWith('Ulgurasiz'), p.message);
}

// ---------- 4. Deadline'ga KECHIKADI ----------
{
  // Kuniga 1%: 20 kunda 20%. Qolgan 80% → 80 kun. Deadline 30 kundan keyin.
  const log = Array.from({ length: 21 }, (_, i) => ({ date: d(-20 + i), value: i }));
  const p = predictGoal(mkGoal({
    progressLog: log, deadline: d(30),
    metric: { unit: '%', start: 0, target: 100, current: 20 },
  }), T);

  check('kechikadi → onTrack false', p.onTrack === false);
  check('50 kun kech', p.daysLate === 50, String(p.daysLate));
  check('kerakli temp hisoblandi', p.requiredPerDay === 2.7,
    String(p.requiredPerDay));
  check('xabarda ikkala temp ham bor',
    p.message.includes('2.7%') && p.message.includes('1.0%'), p.message);
  // TAXMINIY foiz BO'LMASLIGI kerak — asoslab bo'lmaydigan raqam.
  check('soxta ehtimol foizi yo\'q', !/ulgurish.*\d+%/i.test(p.message), p.message);
}

// ---------- 5. Siljish yo'q ----------
{
  const log = Array.from({ length: 10 }, (_, i) => ({ date: d(-9 + i), value: 30 }));
  const p = predictGoal(mkGoal({
    progressLog: log, deadline: d(20),
    metric: { unit: '%', start: 0, target: 100, current: 30 },
  }), T);
  check('siljish yo\'q → prognoz yo\'q', p.projectedDate === null);
  check('siljish yo\'q → onTrack false', p.onTrack === false);
  check('xabar aniq', p.message.includes("siljish yo'q"), p.message);
}

// ---------- 6. Bajarilgan maqsad ----------
{
  const p = predictGoal(mkGoal({ status: 'done' }), T);
  check('bajarilgan → 100%', p.current === 100);
  check('bajarilgan → onTrack true', p.onTrack === true);
}

// ---------- 7. Orqaga ketish ----------
{
  const log = [{ date: d(-10), value: 50 }, { date: d(-1), value: 30 }];
  const p = predictGoal(mkGoal({ progressLog: log, metric: { unit: '%', start: 0, target: 100, current: 30 } }), T);
  check('progress tushgan → prognoz yo\'q', p.projectedDate === null);
}

console.log('\n--- hisobot ---');

const uid = Users.create('review@unum.local', 'h', 'S');
Profiles.set(uid, {});

// ---------- 8. Bo'sh hisobot ----------
{
  const r = buildReview(uid, 7, T);
  check('7 kunlik oraliq', r.days === 7 && r.from === d(-6) && r.to === T,
    `${r.from}..${r.to}`);
  check('vazifa yo\'q → percent null', r.tasks.percent === null);
  check('Life Score o\'rtachasi null', r.lifeScore.average === null);
  check('trend null', r.trend === null);
  check('xulosa bo\'sh', r.highlights.length === 0, JSON.stringify(r.highlights));
}

// ---------- 9. To'ldirilgan hafta ----------
{
  const u = Users.create('review2@unum.local', 'h', 'S');
  Profiles.set(u, {});

  // Har kuni 2 ta vazifa, birinchi 4 kunda ikkalasi ham bajarilgan.
  for (let i = 0; i < 7; i++) {
    const date = d(-6 + i);
    Items.create(u, 'tasks', { title: 'a', date, done: i < 4, priority: 'normal' });
    Items.create(u, 'tasks', { title: 'b', date, done: i < 4, priority: 'normal' });
  }
  // Odat: 5 kun bajarilgan.
  const log: Record<string, boolean> = {};
  for (let i = 0; i < 5; i++) log[d(-6 + i)] = true;
  Items.create(u, 'habits', {
    title: 'Yugurish', emoji: '🏃', schedule: 'daily', days: [],
    color: '#22C55E', status: 'active', log, createdAt: '',
  });
  // Fokus: 2 kunda 60+30.
  Items.create(u, 'focus', { timestamp: `${d(-3)}T10:00:00.000`, kind: 'study', minutes: 60, note: '', goalId: null });
  Items.create(u, 'focus', { timestamp: `${d(-1)}T10:00:00.000`, kind: 'work', minutes: 30, note: '', goalId: null });

  const r = buildReview(u, 7, T);
  check('vazifa 8/14', r.tasks.done === 8 && r.tasks.total === 14,
    `${r.tasks.done}/${r.tasks.total}`);
  check('vazifa 57%', r.tasks.percent === 57, String(r.tasks.percent));
  check('odat 5/7', r.habits.done === 5 && r.habits.due === 7,
    `${r.habits.done}/${r.habits.due}`);
  check('fokus 90 daqiqa', r.focus.minutes === 90, String(r.focus.minutes));
  check('kuniga ~13 daqiqa', r.focus.perDay === 13, String(r.focus.perDay));
  check('Life Score o\'rtachasi bor', r.lifeScore.average !== null, String(r.lifeScore.average));
  check('eng yaxshi kun aniqlandi', r.lifeScore.best !== null);
  check('xulosalar yozildi', r.highlights.length >= 3, JSON.stringify(r.highlights));

  // Ketma-ketlik: oxirgi 2 kun belgilanmagan, shuning uchun davr oxirida 0.
  check('davr oxirida ketma-ketlik uzilgan', r.topStreak === null,
    JSON.stringify(r.topStreak));
}

// ---------- 10. Oylik ----------
{
  const r = buildReview(uid, 30, T);
  check('30 kunlik oraliq', r.days === 30 && r.from === d(-29));
}

console.log('\n--- AI javobini tozalash ---');

// AI bugungi sanani bilmaydi va o'tmishdagi sana berishi mumkin (prodda
// haqiqatan shunday bo'ldi: 2026-08-08 da "2026-08-01" qaytardi).
{
  const raw = {
    milestones: [
      { title: 'O\'tmishdagi bosqich', dueDate: '2026-08-01' },
      { title: 'To\'g\'ri bosqich', dueDate: '2026-09-01' },
      { title: 'Deadline\'dan keyin', dueDate: '2027-06-01' },
      { title: 'Sanasiz bosqich' },
      { title: '   ' },
    ],
  };
  const out = sanitizeMilestones(raw, T, '2027-02-01');

  check('bo\'sh nomli bosqich tashlandi', out.length === 4, String(out.length));
  check('o\'tmishdagi sana olib tashlandi', out[0].dueDate === null,
    String(out[0].dueDate));
  check('to\'g\'ri sana saqlandi', out[1].dueDate === '2026-09-01', String(out[1].dueDate));
  check('deadline\'dan keyingi sana olib tashlandi', out[2].dueDate === null,
    String(out[2].dueDate));
  check('nomlar saqlandi', out[0].title === 'O\'tmishdagi bosqich');

  const many = sanitizeMilestones(
    { milestones: Array.from({ length: 20 }, (_, i) => ({ title: `B${i}` })) }, T
  );
  check('8 tadan ko\'pi kesiladi', many.length === 8, String(many.length));
}

console.log(`\n${failures === 0 ? "✅ HAMMASI O'TDI" : `❌ ${failures} ta SINOV YIQILDI`}\n`);
process.exit(failures === 0 ? 0 : 1);
