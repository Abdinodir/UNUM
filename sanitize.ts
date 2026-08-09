/**
 * Qo'lda kiritilgan yozuvlarni tekshirish.
 *
 * NIMA UCHUN KERAK BO'LDI. AI orqali kelgan ovqat `normalizeNutrition` da
 * cheklanardi, lekin umumiy `/api/data/:collection` CRUD hech narsani
 * tekshirmasdi. Natijada "108 000 000 qadam" yoki "85 000 000 000 kkal"
 * bemalol bazaga tushib, ballni ham, haftalik hisobotni ham, Life Score'ni
 * ham ma'nosiz qilib qo'yardi. Bir marta shunday yozuv kiritilsa, keyingi
 * barcha o'rtachalar buziladi.
 *
 * Chegaralar QASDDAN keng olingan — maqsad foydalanuvchiga xalaqit berish
 * emas, faqat FIZIK MUMKIN BO'LMAGAN qiymatlarni to'sish. Marafonchi ham,
 * og'ir vazn ko'taruvchi ham bemalol sig'adi.
 */

/** Insonning bir kunda yurishi mumkin bo'lgan eng katta qadam (rekord ~90k). */
const MAX_STEPS = 120_000;

export interface FieldRule {
  min?: number;
  max: number;
  /** Butun songa yaxlitlansinmi. */
  int?: boolean;
}

/**
 * Kolleksiya → maydon chegaralari.
 * Ro'yxatda yo'q maydonlarga tegilmaydi (masalan `name`, `timestamp`).
 */
const RULES: Record<string, Record<string, FieldRule>> = {
  meals: {
    // Bitta ovqat. Kunlik emas — to'yga borgan odam ham 8000 dan oshmaydi.
    calories: { max: 8_000 },
    protein: { max: 1_000 },
    carbs: { max: 1_500 },
    fat: { max: 1_000 },
    sugar: { max: 1_000 },
    fiber: { max: 300 },
    sodium: { max: 50_000 },
    vegServings: { max: 15 },
    novaScore: { min: 1, max: 4, int: true },
    nova: { min: 1, max: 4, int: true },
    // So'mda. 10 mln — restoran hisobi uchun ham ortig'i bilan yetadi.
    cost: { max: 10_000_000 },
    waterMl: { max: 6_000 },
  },
  water: {
    // Bitta yozuv. Kuniga bir nechta yozuv bo'lishi mumkin.
    amountMl: { min: 1, max: 5_000, int: true },
  },
  activities: {
    steps: { max: MAX_STEPS, int: true },
    activeMinutes: { max: 1_440, int: true },
    distanceKm: { max: 300 },
    calories: { max: 10_000 },
  },
  body: {
    weight: { min: 20, max: 400 },
    heightCm: { min: 50, max: 260 },
    bodyFat: { max: 80 },
  },
  focus: {
    minutes: { min: 1, max: 480, int: true },
  },
  journal: {
    // Kayfiyat 1..5. Matn uzunligi alohida cheklanadi (quyida).
    mood: { min: 1, max: 5, int: true },
  },
};

/** Kundalik matni uchun chegara — bitta yozuvda 5000 belgi yetarli. */
const JOURNAL_MAX_TEXT = 5000;

function clampField(value: unknown, rule: FieldRule): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const lo = rule.min ?? 0;
  const clamped = Math.min(rule.max, Math.max(lo, n));
  return rule.int ? Math.round(clamped) : clamped;
}

export interface SanitizeResult {
  data: Record<string, unknown>;
  /** Qaysi maydonlar cheklandi — mijozga ogohlantirish uchun. */
  clamped: string[];
}

/**
 * Yozuvni kolleksiya qoidalari bo'yicha tozalaydi.
 *
 * Qiymat chegaradan chiqsa RAD ETILMAYDI, balki CHEKLANADI: foydalanuvchi
 * nol qo'ygan bo'lsa ham yozuvi yo'qolmaydi, lekin statistikani buzmaydi.
 * Cheklangan maydonlar ro'yxati qaytariladi — mijoz shuni aytishi mumkin.
 */
export function sanitizeItem(collection: string, body: unknown): SanitizeResult {
  const data = { ...(body as Record<string, unknown>) };
  const rules = RULES[collection];
  if (!rules) return { data, clamped: [] };

  // Kundalik matnini kesib qo'yamiz: cheksiz matn bazani shishiradi va
  // AI hisobotiga yuborilganda tokenni behuda sarflaydi.
  if (collection === 'journal' && typeof data.text === 'string') {
    data.text = data.text.slice(0, JOURNAL_MAX_TEXT);
  }

  const clamped: string[] = [];
  for (const [field, rule] of Object.entries(rules)) {
    if (!(field in data) || data[field] == null) continue;
    const before = Number(data[field]);
    const after = clampField(data[field], rule);
    if (after == null) {
      // Son bo'lmagan qiymat (masalan "ko'p") — maydonni umuman olib
      // tashlaymiz, NaN bazaga tushmasin.
      delete data[field];
      clamped.push(field);
      continue;
    }
    data[field] = after;
    if (Number.isFinite(before) && Math.abs(before - after) > 0.001) {
      clamped.push(field);
    }
  }

  return { data, clamped };
}

/**
 * Uyqu yozuvi — alohida, chunki u ikkita vaqtdan hisoblanadi.
 * Yaroqsiz bo'lsa `null` qaytadi va yozuv RAD ETILADI: chala uyqu yozuvi
 * saqlangandan ko'ra umuman bo'lmagani yaxshi, aks holda Life Score
 * "0 soat uxlagan" deb ball tushirardi.
 */
export function sanitizeSleep(body: unknown): { data: Record<string, unknown> } | { error: string } {
  const data = { ...(body as Record<string, unknown>) };

  const bed = Date.parse(String(data.bedTime ?? ''));
  const wake = Date.parse(String(data.wakeTime ?? ''));
  if (!Number.isFinite(bed) || !Number.isFinite(wake)) {
    return { error: "Yotish va turish vaqtini to'g'ri kiriting" };
  }
  if (wake <= bed) {
    return { error: 'Turish vaqti yotish vaqtidan keyin bo\'lishi kerak' };
  }

  const hours = (wake - bed) / 3_600_000;
  // 16 soatdan uzun uyqu — deyarli har doim sana xatosi (`pillars.dart`
  // va `lifescore.ts` da ham xuddi shu chegara).
  if (hours > 16) {
    return { error: "Uyqu 16 soatdan uzun bo'lishi mumkin emas — sanani tekshiring" };
  }

  const quality = Number(data.quality);
  if (Number.isFinite(quality)) {
    data.quality = Math.min(5, Math.max(1, Math.round(quality)));
  }

  return { data };
}
