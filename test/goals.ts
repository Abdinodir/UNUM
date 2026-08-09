/**
 * Maqsadlar modulining sinovi.  Ishga tushirish:  npm run test:goals
 *
 * Sozlamalar npm skriptida beriladi — sabab `test/click.ts` dagi izohda.
 */
import { Users, Profiles, grantPremium } from '../db';
import { listGoals, createGoal, updateGoal, computeProgress, decorate, type Goal } from '../goals';

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

const create = (uid: number, body: any) => {
  const r = fakeRes();
  createGoal(uid, body, r);
  return r.out;
};
const update = (uid: number, id: string, body: any) => {
  const r = fakeRes();
  updateGoal(uid, id, body, r);
  return r.out;
};
const list = (uid: number) => {
  const r = fakeRes();
  listGoals(uid, r);
  return r.out.body;
};

const userId = Users.create('goal@unum.local', 'hash', 'Sinov');
Profiles.set(userId, { name: 'Sinov' });

// ---------- 1. Yaratish va validatsiya ----------
{
  const bad = create(userId, { title: '   ' });
  check('nomsiz maqsad rad etiladi', bad.code === 400, JSON.stringify(bad.body));

  const g = create(userId, {
    title: 'IELTS 7.0 olish',
    category: 'learning',
    deadline: '2027-02-01',
    milestones: [
      { title: 'Listening 7.0' },
      { title: 'Reading 7.0' },
      { title: 'Writing 6.5' },
      { title: 'Speaking 7.0' },
    ],
  });
  check('maqsad yaratildi', g.code === 200 && !!g.body?.id, JSON.stringify(g.body));
  check('kategoriya saqlandi', g.body?.category === 'learning');
  check('bosqichlarga id berildi', g.body?.milestones.every((m: any) => !!m.id));
  check('progress 0%', g.body?.progressPercent === 0, String(g.body?.progressPercent));
  check('bosqichlar sanaldi', g.body?.milestonesTotal === 4);
}

// ---------- 2. Noto'g'ri kategoriya xavfsiz qiymatga tushadi ----------
{
  const g = create(userId, { title: 'Test', category: '<script>alert(1)</script>' });
  check("noma'lum kategoriya → personal", g.body?.category === 'personal', g.body?.category);
}

// ---------- 3. Bepul chegara: 3 ta faol maqsad ----------
{
  // Yuqorida 2 ta yaratildi (IELTS, Test) — uchinchisi hali o'tishi kerak.
  const third = create(userId, { title: '3-chi maqsad' });
  check('3-chi maqsad o\'tdi', third.code === 200, JSON.stringify(third.body));
  check('endi 3 ta faol', list(userId).activeCount === 3, String(list(userId).activeCount));

  const g = create(userId, { title: '4-chi maqsad' });
  check('4-chi maqsad rad etildi (403)', g.code === 403, JSON.stringify(g.body));
  check('upgrade bayrog\'i berildi', g.body?.upgrade === true);
  check('chegara raqami aytildi', g.body?.limit === 3);
}

// ---------- 4. Arxivlash joy bo'shatadi ----------
let firstId = '';
{
  const goals = list(userId).goals;
  firstId = goals[0].id;
  const arch = update(userId, firstId, { ...goals[0], status: 'archived' });
  check('arxivlandi', arch.body?.status === 'archived');

  const g = create(userId, { title: 'Endi joy bor' });
  check('arxivlagach yangi maqsad yaratildi', g.code === 200, JSON.stringify(g.body));
}

// ---------- 5. Arxivdan tiklab chegarani AYLANIB O'TIB bo'lmaydi ----------
{
  const before = list(userId);
  check('hozir 3 ta faol', before.activeCount === 3, String(before.activeCount));

  const archived = before.goals.find((g: any) => g.status === 'archived');
  const r = update(userId, archived.id, { ...archived, status: 'active' });
  check('arxivdan tiklash 403 bilan rad etildi', r.code === 403, JSON.stringify(r.body));
  check('hali ham 3 ta faol', list(userId).activeCount === 3);
}

// ---------- 6. Raqamli o'lchov: kamayish tomon ----------
{
  const g = create(userId, {
    title: '10 kg ozish',
    metric: { unit: 'kg', start: 80, target: 70, current: 80 },
    status: 'active',
  });
  // 3 ta faol bor edi — bu rad etiladi, shuning uchun premium beramiz.
  check('chegara hali kuchda', g.code === 403);

  grantPremium(userId, 30);
  const g2 = create(userId, {
    title: '10 kg ozish',
    metric: { unit: 'kg', start: 80, target: 70, current: 80 },
  });
  check('premium bilan 4-chi maqsad yaratildi', g2.code === 200, JSON.stringify(g2.body));
  check('boshida progress 0%', g2.body?.progressPercent === 0);

  const half = update(userId, g2.body.id, {
    ...g2.body,
    metric: { unit: 'kg', start: 80, target: 70, current: 75 },
  });
  check('75 kg → 50%', half.body?.progressPercent === 50, String(half.body?.progressPercent));

  const done = update(userId, g2.body.id, {
    ...g2.body,
    metric: { unit: 'kg', start: 80, target: 70, current: 70 },
  });
  check('70 kg → 100%', done.body?.progressPercent === 100, String(done.body?.progressPercent));

  const over = update(userId, g2.body.id, {
    ...g2.body,
    metric: { unit: 'kg', start: 80, target: 70, current: 65 },
  });
  check('maqsaddan oshib ketsa ham 100% (200% emas)', over.body?.progressPercent === 100,
    String(over.body?.progressPercent));
}

// ---------- 7. Bosqichlar bo'yicha progress ----------
{
  const g = create(userId, {
    title: 'Kitob yozish',
    milestones: [{ title: 'Reja' }, { title: 'Qoralama' }, { title: 'Tahrir' }, { title: 'Nashr' }],
  });
  const ms = g.body.milestones;
  ms[0].done = true;
  const r = update(userId, g.body.id, { ...g.body, milestones: ms });
  check('1/4 bosqich → 25%', r.body?.progressPercent === 25, String(r.body?.progressPercent));
  check('bosqich id o\'zgarmadi', r.body?.milestones[0].id === ms[0].id);
}

// ---------- 8. Progress tarixi (prognoz uchun) ----------
{
  const goals = list(userId).goals;
  const withMetric = goals.find((g: any) => g.metric);
  const log = withMetric?.progressLog ?? [];

  check('progress tarixi yozilyapti', log.length >= 1, JSON.stringify(log));
  check('oxirgi qiymat 100', log[log.length - 1]?.value === 100, JSON.stringify(log));

  // Bir kunda bir nechta yangilanish BITTA nuqtaga yig'iladi — aks holda
  // prognoz uchun kunlar emas, saqlashlar soni sanalib qolardi.
  const days = new Set(log.map((p: any) => p.date));
  check('kuniga bitta nuqta', days.size === log.length,
    `${log.length} yozuv, ${days.size} kun`);
}

// ---------- 9. daysLeft ----------
{
  const g: Goal = {
    id: 'x', title: 't', description: '', category: 'personal', metric: null,
    milestones: [], startDate: '2026-01-01', deadline: null, status: 'active',
    createdAt: '', completedAt: null, progressLog: [],
  };
  check('deadline yo\'q → null', decorate(g).daysLeft === null);

  const past = decorate({ ...g, deadline: '2020-01-01' });
  check('o\'tib ketgan deadline manfiy', (past.daysLeft ?? 0) < 0, String(past.daysLeft));
}

// ---------- 10. 'done' status progressni 100% qiladi ----------
{
  const g: Goal = {
    id: 'x', title: 't', description: '', category: 'personal', metric: null,
    milestones: [{ id: 'a', title: 'a', done: false, dueDate: null }],
    startDate: '2026-01-01', deadline: null, status: 'done',
    createdAt: '', completedAt: null, progressLog: [],
  };
  check('status=done → progress 1', computeProgress(g) === 1);
}

console.log(`\n${failures === 0 ? "✅ HAMMASI O'TDI" : `❌ ${failures} ta SINOV YIQILDI`}\n`);
process.exit(failures === 0 ? 0 : 1);
