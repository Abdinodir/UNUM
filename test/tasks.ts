/**
 * Kunlik reja modulining sinovi.  Ishga tushirish:  npm run test:tasks
 */
import { Users, Profiles } from '../db';
import {
  listTasks, createTask, updateTask, toggleTask, moveTask, deleteTask,
} from '../tasks';
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

const uid = Users.create('task@unum.local', 'h', 'Sinov');
Profiles.set(uid, {});

const TODAY = todayKey();
const YESTERDAY = shiftDay(TODAY, -1);
const TOMORROW = shiftDay(TODAY, 1);

// ---------- 1. Yaratish va validatsiya ----------
{
  const bad = call(createTask, uid, { title: '  ' });
  check('nomsiz vazifa rad etiladi', bad.code === 400, JSON.stringify(bad.body));

  const t = call(createTask, uid, { title: 'Reja tuzish' });
  check('vazifa yaratildi', t.code === 200 && !!t.body?.id);
  check('sana sukut bo\'yicha bugun', t.body?.date === TODAY, t.body?.date);
  check('ustuvorlik sukut bo\'yicha normal', t.body?.priority === 'normal');
  check('bajarilmagan', t.body?.done === false);
  check('completedAt yo\'q', t.body?.completedAt === null);
}

// ---------- 2. Noto'g'ri qiymatlar xavfsiz qiymatga tushadi ----------
{
  const t = call(createTask, uid, {
    title: 'Test', priority: 'SUPER_URGENT', estimateMin: 999999, date: 'buzuq-sana',
  });
  check('noma\'lum ustuvorlik → normal', t.body?.priority === 'normal', t.body?.priority);
  check('juda katta vaqt 1440 ga cheklandi', t.body?.estimateMin === 1440, String(t.body?.estimateMin));
  check('buzuq sana → bugun', t.body?.date === TODAY, t.body?.date);
}

// ---------- 3. Tartiblash: bajarilmagan tepada, keyin ustuvorlik ----------
{
  call(createTask, uid, { title: 'Muhim ish', priority: 'high' });
  call(createTask, uid, { title: 'Keyinroq', priority: 'low' });

  const l = call(listTasks, uid, TODAY).body;
  check('bugun 4 ta vazifa', l.tasks.length === 4, String(l.tasks.length));
  check('yuqori ustuvorlik birinchi', l.tasks[0].title === 'Muhim ish', l.tasks[0].title);
  check('past ustuvorlik oxirida',
    l.tasks[l.tasks.length - 1].title === 'Keyinroq', l.tasks[l.tasks.length - 1].title);
}

// ---------- 4. Toggle ----------
let doneId = '';
{
  const l = call(listTasks, uid, TODAY).body;
  doneId = l.tasks[0].id;

  const t = call(toggleTask, uid, doneId);
  check('toggle bajarildi', t.body?.done === true);
  check('completedAt yozildi', typeof t.body?.completedAt === 'string');

  const stamp = t.body.completedAt;
  const again = call(updateTask, uid, doneId, { ...t.body, title: 'Muhim ish (tahrir)' });
  check('qayta tahrirda completedAt O\'ZGARMAYDI', again.body?.completedAt === stamp,
    `${stamp} → ${again.body?.completedAt}`);

  const off = call(toggleTask, uid, doneId);
  check('qayta toggle → bajarilmagan', off.body?.done === false);
  check('completedAt tozalandi', off.body?.completedAt === null);
}

// ---------- 5. Bajarilganlar pastga tushadi ----------
{
  call(toggleTask, uid, doneId);
  const l = call(listTasks, uid, TODAY).body;
  check('bajarilgan vazifa pastga tushdi',
    l.tasks[l.tasks.length - 1].id === doneId, l.tasks[l.tasks.length - 1].title);
}

// ---------- 6. Statistika ----------
{
  const l = call(listTasks, uid, TODAY).body;
  check('stats.total', l.stats.total === 4, String(l.stats.total));
  check('stats.done', l.stats.done === 1, String(l.stats.done));
  check('stats.percent = 25', l.stats.percent === 25, String(l.stats.percent));

  const empty = call(listTasks, uid, TOMORROW).body;
  check('bo\'sh kunda percent null (0% emas)', empty.stats.percent === null,
    String(empty.stats.percent));
}

// ---------- 7. Kechikkanlar ----------
{
  const old = call(createTask, uid, { title: 'Kecha unutilgan', date: YESTERDAY });
  check('kechagi vazifa yaratildi', old.body?.date === YESTERDAY);

  const l = call(listTasks, uid, TODAY).body;
  check('kechikkan bugungi ro\'yxatda ko\'rinadi', l.overdue.length === 1, JSON.stringify(l.overdue.map((t: any) => t.title)));
  check('kechikkan asosiy ro\'yxatga ARALASHMAYDI',
    !l.tasks.some((t: any) => t.title === 'Kecha unutilgan'));

  // O'tmishga qarab turib "kechikkan" ko'rsatilmasligi kerak.
  const past = call(listTasks, uid, YESTERDAY).body;
  check('o\'tgan kunni ko\'rganda kechikkanlar yo\'q', past.overdue.length === 0);
  check('o\'tgan kunda o\'z vazifasi bor', past.tasks.length === 1);

  // Bajarilgan eski vazifa kechikkan hisoblanmaydi.
  call(toggleTask, uid, old.body.id);
  check('bajarilgan eski vazifa kechikkanlarda YO\'Q',
    call(listTasks, uid, TODAY).body.overdue.length === 0);
  call(toggleTask, uid, old.body.id);
}

// ---------- 8. Bugunga ko'chirish ----------
{
  const overdue = call(listTasks, uid, TODAY).body.overdue[0];
  const moved = call(moveTask, uid, overdue.id, TODAY);
  check('bugunga ko\'chirildi', moved.body?.date === TODAY, moved.body?.date);

  const l = call(listTasks, uid, TODAY).body;
  check('endi kechikkanlar bo\'sh', l.overdue.length === 0);
  check('bugungi ro\'yxatga qo\'shildi', l.tasks.some((t: any) => t.title === 'Kecha unutilgan'));
}

// ---------- 9. Maqsadga bog'lash ----------
{
  const t = call(createTask, uid, { title: 'IELTS mashq', goalId: 'goa_test123' });
  check('goalId saqlandi', t.body?.goalId === 'goa_test123');

  const unlinked = call(updateTask, uid, t.body.id, { ...t.body, goalId: null });
  check('bog\'lanish uzildi', unlinked.body?.goalId === null);
}

// ---------- 10. O'chirish va yo'q vazifa ----------
{
  const l = call(listTasks, uid, TODAY).body;
  const n = l.tasks.length;
  call(deleteTask, uid, l.tasks[0].id);
  check('o\'chirildi', call(listTasks, uid, TODAY).body.tasks.length === n - 1);

  check('yo\'q vazifani toggle → 404', call(toggleTask, uid, 'yoq').code === 404);
  check('yo\'q vazifani tahrir → 404',
    call(updateTask, uid, 'yoq', { title: 'x' }).code === 404);
}

console.log(`\n${failures === 0 ? "✅ HAMMASI O'TDI" : `❌ ${failures} ta SINOV YIQILDI`}\n`);
process.exit(failures === 0 ? 0 : 1);
