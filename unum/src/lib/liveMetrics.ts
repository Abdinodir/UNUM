/**
 * Bosh ekran ko'rsatkichlarini HAQIQIY ma'lumotdan quradi.
 *
 * NIMA UCHUN YOZILDI. Web ilova `data/mock.ts` dagi qattiq kodlangan
 * qiymatlarni ko'rsatardi: har bir foydalanuvchi — hatto hech narsa
 * kiritmagani ham — "78 ball", "6 500 qadam", "eng faol kun: Payshanba"
 * ko'rardi. Bu shunchaki bo'sh emas, YOLG'ON edi: ilova o'zi o'ylab
 * topgan raqamni foydalanuvchining natijasi sifatida ko'rsatardi.
 *
 * Endi hamma raqam `/api/summary/today` dan keladi. Ma'lumot bo'lmasa —
 * nol va "hali ma'lumot yo'q", o'ylab topilgan qiymat emas.
 */
import type { MetricKey, MetricMap, MetricState } from '../types';

export interface Summary {
  date: string;
  score: { total: number; hasData: boolean; grade: string };
  profile: {
    targetCalories: number;
    targetProtein: number;
    targetWaterMl: number;
    streak: number;
    level: number;
    xp: number;
  };
  totals: {
    calories: number;
    protein: number;
    water: number;
    meals: number;
    steps: number;
    activeMinutes: number;
    vegServings: number;
    sugar: number;
    cost: number;
  };
}

const nf = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
const pct = (cur: number, target: number) =>
  target <= 0 ? 0 : Math.min(100, Math.round((cur / target) * 100));

const hm = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h} soat${m ? ` ${m} daq` : ''}` : `${m} daqiqa`;
};

/** Kunlik qadam maqsadi — `score.ts` shu qiymatdan hisoblaydi. */
export const STEP_GOAL = 8000;
export const SLEEP_GOAL_MIN = 480;

function metric(
  key: MetricKey,
  current: number,
  target: number,
  unit: string,
  valueText: string,
  remainderText: string,
  hasData: boolean
): MetricState {
  return {
    key,
    current,
    target,
    unit,
    valueText,
    remainderText,
    percent: hasData ? pct(current, target) : 0,
    // Tarix hali yig'ilmagan — bo'sh massiv, soxta grafik emas.
    history7: [],
  };
}

/**
 * `sleepMinutes` va `screenMinutes` alohida beriladi: birinchisi `sleep`
 * kolleksiyasidan, ikkinchisi hali UMUMAN ulanmagan (`null`).
 */
export function buildMetrics(
  s: Summary,
  sleepMinutes: number | null,
  screenMinutes: number | null
): MetricMap {
  const t = s.totals;
  const p = s.profile;

  const calLeft = Math.max(0, p.targetCalories - t.calories);
  const stepLeft = Math.max(0, STEP_GOAL - t.steps);

  return {
    nutrition: metric(
      'nutrition', t.calories, p.targetCalories, 'kkal',
      `${nf(t.calories)} / ${nf(p.targetCalories)} kkal`,
      t.meals === 0 ? "Bugun hali ovqat kiritilmagan"
        : calLeft > 0 ? `${nf(calLeft)} kkal qoldi` : 'Maqsad bajarildi',
      t.meals > 0
    ),
    steps: metric(
      'steps', t.steps, STEP_GOAL, 'qadam',
      `${nf(t.steps)} / ${nf(STEP_GOAL)} qadam`,
      t.steps === 0 ? "Hali qadam yozilmagan"
        : stepLeft > 0 ? `${nf(stepLeft)} qadam qoldi` : 'Maqsad bajarildi',
      t.steps > 0
    ),
    sleep: metric(
      'sleep', sleepMinutes ?? 0, SLEEP_GOAL_MIN, 'daqiqa',
      sleepMinutes == null
        ? "Yozuv yo'q"
        : `${hm(sleepMinutes)} / 8 soat`,
      sleepMinutes == null
        ? 'Uyquni kiriting'
        : sleepMinutes >= SLEEP_GOAL_MIN
          ? 'Maqsad bajarildi'
          : `${hm(SLEEP_GOAL_MIN - sleepMinutes)} qoldi`,
      sleepMinutes != null
    ),
    // ⚠️ Screen time HALI ULANMAGAN. Soxta foiz ko'rsatmaymiz va
    // "sozlamalardan yoqing" ham demaymiz — yoqadigan sozlama yo'q.
    screen: metric(
      'screen', screenMinutes ?? 0, 240, 'daqiqa',
      screenMinutes == null ? 'Hali ulanmagan' : hm(screenMinutes),
      screenMinutes == null ? 'Keyingi versiyada' : '',
      screenMinutes != null
    ),
    goals: metric(
      'goals', t.protein, p.targetProtein, 'g',
      `${nf(t.protein)} / ${nf(p.targetProtein)} g oqsil`,
      t.protein >= p.targetProtein
        ? 'Maqsad bajarildi'
        : `${nf(p.targetProtein - t.protein)} g qoldi`,
      t.meals > 0
    ),
  };
}
