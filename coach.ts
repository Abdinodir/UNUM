/**
 * AI Goal Coach va Goal Breakdown.
 *
 * QAT'IY CHEGARA: AI HECH QANDAY RAQAM O'YLAB TOPMAYDI.
 * Barcha ko'rsatkichlar `review.ts` da deterministik hisoblanadi va AI ga
 * TAYYOR holda beriladi; uning vazifasi — shu raqamlarni o'zbek tilida
 * tushuntirish va aniq keyingi qadam taklif qilish. Shu sabab bir xil
 * haftada bir xil raqam ko'rsatiladi, garchi matn har safar biroz boshqacha
 * bo'lsa ham.
 *
 * Prompt'lar shu faylda to'plangan — ular mahsulot ovozi, kod emas.
 */
import type OpenAI from 'openai';
import type { Review, Prediction } from './review';

/** Har joyda takrorlanadigan asos. */
const VOICE = `Siz UNUM ilovasining maqsad kouchisiz. O'zbek tilida, lotin
alifbosida yozasiz. Uslub: qisqa, aniq, hurmatli "siz". Hech qachon
tashxis qo'ymaysiz va tibbiy maslahat bermaysiz. Maqtov ham, tanbeh ham
o'lchovli — foydalanuvchi bola emas.`;

// ==================== HAFTALIK / OYLIK XULOSA ====================
export function reviewPrompt(review: Review, period: 'week' | 'month') {
  const label = period === 'week' ? 'hafta' : 'oy';

  // AI ga FAQAT hisoblangan raqamlar beriladi.
  const facts = {
    davr: `${review.from} … ${review.to}`,
    vazifalar: `${review.tasks.done}/${review.tasks.total}` +
      (review.tasks.percent != null ? ` (${review.tasks.percent}%)` : ''),
    odatlar: `${review.habits.done}/${review.habits.due}` +
      (review.habits.percent != null ? ` (${review.habits.percent}%)` : ''),
    fokus_daqiqa: review.focus.minutes,
    fokus_kuniga: review.focus.perDay,
    life_score_ortacha: review.lifeScore.average,
    oldingi_davr_ortacha: review.previousAverage,
    tendensiya: review.trend,
    eng_yaxshi_kun: review.lifeScore.best,
    eng_yomon_kun: review.lifeScore.worst,
    eng_zaif_soha: review.weakest?.label ?? null,
    eng_uzun_ketma_ketlik: review.topStreak,
  };

  const system = `${VOICE}

Sizga o'tgan ${label} bo'yicha ANIQ HISOBLANGAN raqamlar beriladi.
Vazifangiz — ularni izohlash. Raqamlarni O'ZGARTIRMANG, yangi raqam
QO'SHMANG va "taxminan", "ehtimol 80%" kabi asossiz baholar bermang.
Ma'lumot yo'q bo'lsa (null), u haqda umuman gapirmang.

Javobni QAT'IY quyidagi JSON sxemasi bo'yicha qaytaring, markdown ishlatmang:
{
  "summary": string,      // 2-3 gap: ${label} qanday o'tdi
  "win": string,          // eng yaxshi natija, 1 gap
  "problem": string,      // eng katta muammo, 1 gap (yo'q bo'lsa bo'sh satr)
  "nextWeek": [string]    // keyingi ${label} uchun 2-3 ta ANIQ, bajariladigan qadam
}`;

  return {
    system,
    user: `Ma'lumotlar:\n${JSON.stringify(facts, null, 2)}`,
  };
}

// ==================== MAQSADNI BOSQICHLARGA BO'LISH ====================
export function breakdownPrompt(
  title: string, deadline: string | null, note: string, today: string
) {
  const system = `${VOICE}

Foydalanuvchi maqsadini bajarish mumkin bo'lgan BOSQICHLARGA bo'lasiz.

BUGUNGI SANA: ${today}. Modelning o'z "hozirgi vaqti" noto'g'ri —
sanalarni FAQAT shu qiymatdan hisoblang.

Qoidalar:
- Hech bir bosqich sanasi ${today} dan OLDIN bo'lmasin.
- 4 tadan 8 tagacha bosqich. Kamroq — foydasiz, ko'proq — qo'rqitadi.
- Har bir bosqich TEKSHIRILADIGAN bo'lsin: "Ingliz tilini o'rganish" emas,
  "Cambridge 15 dan 4 ta to'liq test ishlash".
- Bosqichlar mantiqiy ketma-ketlikda, oson va aniqdan boshlanadi.
- Muddat berilgan bo'lsa, bosqichlarni shu muddat ichida taqsimlang.
- O'zbekiston sharoitini hisobga oling (mavjud resurslar, narxlar, imkoniyat).
- Tibbiy yoki moliyaviy maslahat bermang.

Javobni QAT'IY quyidagi JSON sxemasi bo'yicha qaytaring, markdown ishlatmang:
{
  "milestones": [{ "title": string, "dueDate": string|null }],
  "note": string   // 1-2 gap: nimadan boshlash kerak
}
dueDate — "YYYY-MM-DD" yoki null.`;

  const parts = [`Maqsad: "${title}"`];
  if (deadline) parts.push(`Muddat: ${deadline}`);
  if (note) parts.push(`Qo'shimcha: ${note}`);

  return { system, user: parts.join('\n') };
}

// ==================== KOUCH SUHBATI ====================
export function coachPrompt(review: Review, predictions: Prediction[]) {
  const system = `${VOICE}

Sizga foydalanuvchining HISOBLANGAN ko'rsatkichlari va maqsad prognozlari
beriladi. Savolga shu ma'lumotga tayanib javob bering. Ma'lumotda yo'q
narsani o'ylab topmang — bilmasangiz, "bu haqda ma'lumot yo'q" deng.
Javob 4 gapdan oshmasin. JSON emas, oddiy matn.`;

  const context = {
    hafta: {
      vazifalar: `${review.tasks.done}/${review.tasks.total}`,
      odatlar: `${review.habits.done}/${review.habits.due}`,
      fokus_daqiqa: review.focus.minutes,
      life_score: review.lifeScore.average,
      tendensiya: review.trend,
      eng_zaif: review.weakest?.label ?? null,
    },
    maqsadlar: predictions.map((p) => ({
      nom: p.title,
      bajarildi_foiz: p.current,
      kuniga_foiz: p.perDay,
      kerak_kuniga: p.requiredPerDay,
      kech_kun: p.daysLate,
      izoh: p.message,
    })),
  };

  return { system, context: JSON.stringify(context, null, 2) };
}

/** JSON javobni xavfsiz ajratib olish (model ba'zan ```json bilan o'raydi). */
export function extractJson(raw: string): any {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* pastda */ }
    }
    return {};
  }
}

/**
 * AI qaytargan bosqichlarni tozalaydi.
 *
 * Model ba'zan 20 ta bosqich yoki bo'sh nom qaytaradi — bunday javobni
 * to'g'ridan-to'g'ri maqsadga yozib yuborsak, foydalanuvchi keyin ularni
 * qo'lda o'chirib chiqishga majbur bo'lardi.
 */
export function sanitizeMilestones(
  raw: any, today: string, deadline: string | null = null
): { title: string; dueDate: string | null }[] {
  const list = Array.isArray(raw?.milestones) ? raw.milestones : [];
  return list
    .map((m: any) => {
      const d = typeof m?.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.dueDate)
        ? m.dueDate
        : null;
      return {
        title: typeof m?.title === 'string' ? m.title.trim().slice(0, 200) : '',
        // Model bugungi sanani bilmaydi va promptga qaramay o'tmishdagi yoki
        // deadline'dan keyingi sana berishi mumkin. Bunday sanani saqlagandan
        // ko'ra tashlab yuborgan ma'qul: foydalanuvchi allaqachon kechikkan
        // bosqichni ko'rib, ilovaga ishonchini yo'qotardi.
        dueDate: d && d >= today && (!deadline || d <= deadline) ? d : null,
      };
    })
    .filter((m: { title: string }) => m.title.length > 0)
    .slice(0, 8);
}

/** Hisobot javobini tozalaydi. */
export function sanitizeReview(raw: any) {
  const str = (v: unknown, max = 600) =>
    typeof v === 'string' ? v.trim().slice(0, max) : '';
  const steps = Array.isArray(raw?.nextWeek) ? raw.nextWeek : [];
  return {
    summary: str(raw?.summary),
    win: str(raw?.win, 300),
    problem: str(raw?.problem, 300),
    nextWeek: steps.map((s: unknown) => str(s, 200)).filter(Boolean).slice(0, 3),
  };
}

export type ChatClient = OpenAI;
