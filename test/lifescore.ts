/**
 * Life Score sinovi.  Ishga tushirish:  npm run test:lifescore
 *
 * Asosiy e'tibor: YO'Q MA'LUMOT JAZOLAMASLIGI kerak.
 */
import { Users, Profiles, Items } from '../db';
import { computeLifeScore } from '../lifescore';
import { todayKey } from '../day';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail && !cond ? ` → ${detail}` : ''}`);
  if (!cond) failures++;
}

const T = todayKey();
const nu = (email: string) => {
  const id = Users.create(email, 'h', 'S');
  Profiles.set(id, {});
  return id;
};

// ---------- 1. Hech narsa yo'q ----------
{
  const u = nu('empty@unum.local');
  const s = computeLifeScore(u, T);
  check('bo\'sh kun → hasData false', s.hasData === false);
  check('bo\'sh kun → total 0', s.total === 0);
  check('bo\'sh kun → "Ma\'lumot yo\'q"', s.grade === "Ma'lumot yo'q", s.grade);
  check('barcha komponentlar available=false', s.components.every((c) => !c.available));
}

// ---------- 2. ENG MUHIM: faqat bitta modul ishlatilsa ham 100 olish mumkin ----------
{
  const u = nu('tasksonly@unum.local');
  Items.create(u, 'tasks', { title: 'a', date: T, done: true, priority: 'normal' });
  Items.create(u, 'tasks', { title: 'b', date: T, done: true, priority: 'normal' });

  const s = computeLifeScore(u, T);
  check('faqat vazifa yozgan odam 100 ball olishi MUMKIN', s.total === 100,
    `${s.total} — ${JSON.stringify(s.components.filter(c => c.available).map(c => [c.id, c.ratio]))}`);
  check('faqat "tasks" komponenti hisobga olindi',
    s.components.filter((c) => c.available).map((c) => c.id).join() === 'tasks');
  check('grade "Ajoyib"', s.grade === 'Ajoyib', s.grade);
}

// ---------- 3. Yarim bajarilgan reja ----------
{
  const u = nu('half@unum.local');
  Items.create(u, 'tasks', { title: 'a', date: T, done: true, priority: 'normal' });
  Items.create(u, 'tasks', { title: 'b', date: T, done: false, priority: 'normal' });

  const s = computeLifeScore(u, T);
  check('1/2 vazifa → 50', s.total === 50, String(s.total));
  check('weakest = tasks', s.weakest?.id === 'tasks', s.weakest?.id);
}

// ---------- 4. Og'irliklar qayta taqsimlanadi ----------
{
  const u = nu('twomod@unum.local');
  // Reja 100% (og'irlik 20), odatlar 0% (og'irlik 20) → 50 bo'lishi kerak,
  // qolgan modullar yo'qligi ta'sir qilmasin.
  Items.create(u, 'tasks', { title: 'a', date: T, done: true, priority: 'normal' });
  Items.create(u, 'habits', {
    title: 'h', emoji: '🎯', schedule: 'daily', days: [], color: '#22C55E',
    status: 'active', log: {}, createdAt: '',
  });

  const s = computeLifeScore(u, T);
  check('reja 100% + odat 0% → 50', s.total === 50, String(s.total));
  check('ikkita komponent hisobda',
    s.components.filter((c) => c.available).length === 2);
}

// ---------- 5. Odat bajarilsa ----------
{
  const u = nu('habit@unum.local');
  Items.create(u, 'habits', {
    title: 'h', emoji: '🎯', schedule: 'daily', days: [], color: '#22C55E',
    status: 'active', log: { [T]: true }, createdAt: '',
  });
  check('odat bajarildi → 100', computeLifeScore(u, T).total === 100);
}

// ---------- 6. Arxivlangan odat ballga kirmaydi ----------
{
  const u = nu('archived@unum.local');
  Items.create(u, 'habits', {
    title: 'h', emoji: '🎯', schedule: 'daily', days: [], color: '#22C55E',
    status: 'archived', log: {}, createdAt: '',
  });
  const s = computeLifeScore(u, T);
  check('arxivlangan odat hisobga olinmaydi', s.hasData === false, JSON.stringify(s.components.filter(c=>c.available)));
}

// ---------- 7. Talab qilinmagan kundagi odat ----------
{
  const u = nu('weekend@unum.local');
  // Faqat dushanba talab qiladigan odat; bugun dushanba bo'lmasa
  // komponent umuman mavjud emas.
  const monday = new Date(`${T}T00:00:00Z`).getUTCDay() === 1;
  Items.create(u, 'habits', {
    title: 'h', emoji: '🎯', schedule: 'custom', days: [1], color: '#22C55E',
    status: 'active', log: {}, createdAt: '',
  });
  const s = computeLifeScore(u, T);
  const habitsComp = s.components.find((c) => c.id === 'habits')!;
  check('talab qilinmagan kunda odat komponenti yo\'q',
    habitsComp.available === monday, `bugun dushanbami: ${monday}`);
}

// ---------- 8. Uyqu ----------
{
  const u = nu('sleep@unum.local');
  Items.create(u, 'sleep', {
    date: T, bedTime: `${T}T23:00:00.000Z`, wakeTime: `${T}T07:00:00.000Z`, quality: 4,
  });
  // wake < bed → yaroqsiz, 0 bo'lishi kerak.
  check('teskari vaqt yaroqsiz', computeLifeScore(u, T).hasData === false);

  const u2 = nu('sleep2@unum.local');
  const prev = new Date(Date.parse(`${T}T07:00:00.000Z`) - 8 * 3600_000).toISOString();
  Items.create(u2, 'sleep', { date: T, bedTime: prev, wakeTime: `${T}T07:00:00.000Z` });
  const s = computeLifeScore(u2, T);
  check('8 soat uyqu → 100', s.total === 100, `${s.total} (${s.components.find(c=>c.id==='sleep')?.detail})`);

  const u3 = nu('sleep3@unum.local');
  const short = new Date(Date.parse(`${T}T07:00:00.000Z`) - 3.5 * 3600_000).toISOString();
  Items.create(u3, 'sleep', { date: T, bedTime: short, wakeTime: `${T}T07:00:00.000Z` });
  check('3.5 soat → 50', computeLifeScore(u3, T).total === 50,
    String(computeLifeScore(u3, T).total));

  const u4 = nu('sleep4@unum.local');
  const huge = new Date(Date.parse(`${T}T07:00:00.000Z`) - 20 * 3600_000).toISOString();
  Items.create(u4, 'sleep', { date: T, bedTime: huge, wakeTime: `${T}T07:00:00.000Z` });
  check('20 soat — sana xatosi, yaroqsiz', computeLifeScore(u4, T).hasData === false);
}

// ---------- 9. Fokus ----------
{
  const u = nu('focus@unum.local');
  Profiles.set(u, { focusTargetMinutes: 100 });
  Items.create(u, 'focus', { timestamp: `${T}T10:00:00.000`, kind: 'study', minutes: 50 });
  check('50/100 daqiqa → 50', computeLifeScore(u, T).total === 50,
    String(computeLifeScore(u, T).total));

  Items.create(u, 'focus', { timestamp: `${T}T14:00:00.000`, kind: 'work', minutes: 90 });
  check('maqsaddan oshsa ham 100 (140% emas)', computeLifeScore(u, T).total === 100);
}

// ---------- 10. Maqsad ----------
{
  const u = nu('goal@unum.local');
  Items.create(u, 'goals', {
    title: 'G', status: 'active', milestones: [], metric: null,
    progressLog: [{ date: T, value: 20 }], category: 'personal',
    description: '', startDate: T, deadline: null, createdAt: '', completedAt: null,
  });
  const s = computeLifeScore(u, T);
  check('bugun progress o\'sgan maqsad → harakat bor', s.total === 100, String(s.total));

  const u2 = nu('goal2@unum.local');
  Items.create(u2, 'goals', {
    title: 'G', status: 'active', milestones: [], metric: null,
    progressLog: [{ date: '2020-01-01', value: 20 }], category: 'personal',
    description: '', startDate: T, deadline: null, createdAt: '', completedAt: null,
  });
  check('eski progress bugungi harakat emas', computeLifeScore(u2, T).total === 0,
    String(computeLifeScore(u2, T).total));

  // Maqsadga bog'langan vazifa bajarilsa ham harakat hisoblanadi.
  const u3 = nu('goal3@unum.local');
  const g = Items.create(u3, 'goals', {
    title: 'G', status: 'active', milestones: [], metric: null, progressLog: [],
    category: 'personal', description: '', startDate: T, deadline: null,
    createdAt: '', completedAt: null,
  });
  Items.create(u3, 'tasks', { title: 't', date: T, done: true, priority: 'normal', goalId: g.id });
  const s3 = computeLifeScore(u3, T);
  check('maqsadga bog\'langan vazifa harakat beradi',
    s3.components.find((c) => c.id === 'goals')?.ratio === 1,
    String(s3.components.find((c) => c.id === 'goals')?.ratio));
}

console.log(`\n${failures === 0 ? "✅ HAMMASI O'TDI" : `❌ ${failures} ta SINOV YIQILDI`}\n`);
process.exit(failures === 0 ? 0 : 1);
