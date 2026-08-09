/**
 * UNUM Health Score — server tomonidagi nusxa.
 *
 * ⚠️ Bu `mobile/lib/score.dart` bilan AYNAN bir xil bo'lishi shart. Ikkalasi
 * ham kerak: ilova uni offline hisoblaydi, bot esa serverda. Formulani
 * o'zgartirsangiz, ikkala faylni ham va `mobile/test/score_test.dart` ni
 * yangilang — aks holda foydalanuvchi ilovada bir, botda boshqa ball ko'radi.
 */

export interface ScoreInput {
  calories: number;
  targetCalories: number;
  protein: number;
  targetProtein: number;
  vegServings: number;
  sugar: number;
  upfCalories: number;
  waterMl: number;
  targetWaterMl: number;
  steps: number;
  activeMinutes: number;
}

export interface ScoreComponent {
  id: string;
  label: string;
  earned: number;
  max: number;
  detail: string;
}

export interface ScoreResult {
  total: number;
  hasData: boolean;
  grade: string;
  components: ScoreComponent[];
  weakest: ScoreComponent | null;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** `good` da to'liq, `bad` da nol — orasida chiziqli. */
function decline(value: number, good: number, bad: number): number {
  if (value <= good) return 1;
  if (value >= bad) return 0;
  return (bad - value) / (bad - good);
}

export function computeScore(i: ScoreInput): ScoreResult {
  const hasData =
    i.calories > 0 || i.waterMl > 0 || i.steps > 0 || i.activeMinutes > 0;

  const proteinRatio =
    i.targetProtein <= 0 ? 0 : clamp01(i.protein / i.targetProtein);
  const vegRatio = clamp01(i.vegServings / 5);

  // "Ovqat yemasam ball yuqori" holatining oldini oladi: toza ovqatlanish
  // komponentlari kaloriya maqsadining yarmi kiritilgandagina to'liq beriladi.
  const adequacy =
    i.targetCalories <= 0 ? 1 : clamp01(i.calories / (i.targetCalories * 0.5));

  const upfShare = i.calories <= 0 ? 0 : clamp01(i.upfCalories / i.calories);
  const waterRatio =
    i.targetWaterMl <= 0 ? 0 : clamp01(i.waterMl / i.targetWaterMl);
  const stepRatio = clamp01(i.steps / 8000);
  const activeRatio = clamp01(i.activeMinutes / 30);

  const components: ScoreComponent[] = [
    {
      id: 'protein',
      label: 'Oqsil',
      earned: proteinRatio * 20,
      max: 20,
      detail: `${Math.round(i.protein)} / ${Math.round(i.targetProtein)} g`,
    },
    {
      id: 'veg',
      label: 'Sabzavot va meva',
      earned: vegRatio * 20,
      max: 20,
      detail: `${i.vegServings.toFixed(1)} / 5 portsiya`,
    },
    {
      id: 'sugar',
      label: 'Shakar',
      earned: decline(i.sugar, 25, 75) * 15 * adequacy,
      max: 15,
      detail: `${Math.round(i.sugar)} g (me'yor 25 g)`,
    },
    {
      id: 'upf',
      label: 'Tabiiy ovqat',
      earned: decline(upfShare, 0.2, 0.5) * 15 * adequacy,
      max: 15,
      detail: `qayta ishlangan ${Math.round(upfShare * 100)}%`,
    },
    {
      id: 'water',
      label: 'Suv',
      earned: waterRatio * 10,
      max: 10,
      detail: `${Math.round(i.waterMl)} / ${Math.round(i.targetWaterMl)} ml`,
    },
    {
      id: 'move',
      label: 'Harakat',
      earned: stepRatio * 12 + activeRatio * 8,
      max: 20,
      detail: `${i.steps} qadam · ${i.activeMinutes} daq`,
    },
  ];

  const raw = components.reduce((s, c) => s + c.earned, 0);
  const total = hasData ? Math.min(100, Math.max(0, Math.round(raw))) : 0;

  const incomplete = components
    .filter((c) => c.earned < c.max - 0.5)
    .sort((a, b) => b.max - b.earned - (a.max - a.earned));

  return {
    total,
    hasData,
    grade: !hasData
      ? "Ma'lumot yo'q"
      : total >= 90
      ? 'Ajoyib'
      : total >= 75
      ? 'Yaxshi'
      : total >= 60
      ? "O'rtacha"
      : total >= 40
      ? 'Past'
      : 'Juda past',
    components,
    weakest: incomplete.length ? incomplete[0] : null,
  };
}
