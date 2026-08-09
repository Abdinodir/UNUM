/**
 * UNUM dizayn tokenlari.
 * Yagona manba — ranglar, radiuslar va metrika identiteti shu yerdan olinadi.
 * Skrinshotlardagi qiymatlar bilan moslashtirilgan (dark, yashil aksent).
 */

export const colors = {
  /** Sahifa foni — deyarli qora, yengil yashil ohangda */
  bg: '#0A0C0B',
  /** Kartalar foni */
  surface: '#131717',
  /** Karta ichidagi ikkilamchi yuza (progress track, segment fon) */
  surfaceAlt: '#1B2020',
  /** Chegaralar */
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.12)',

  text: '#F2F5F4',
  textMuted: '#98A29E',
  textDim: '#616B67',

  /** Asosiy brend yashili */
  green: '#22C55E',
  greenBright: '#34D77F',
  greenDim: '#16833F',

  danger: '#EF4444',
  dangerSoft: 'rgba(239,68,68,0.12)',
  warn: '#F59E0B',
} as const;

export type MetricKey = 'nutrition' | 'steps' | 'sleep' | 'screen' | 'goals';

/** Har bir metrikaning rangi, nomi va ikonkasi — radar, ro'yxat va kartalar bir xil ishlatadi */
export const METRICS: Record<
  MetricKey,
  { key: MetricKey; label: string; short: string; color: string; icon: string }
> = {
  nutrition: {
    key: 'nutrition',
    label: "Sog'lom ovqatlanish",
    short: 'Ovqat',
    color: '#22C55E',
    icon: 'utensils',
  },
  steps: {
    key: 'steps',
    label: 'Qadam',
    short: 'Qadam',
    color: '#84CC16',
    icon: 'walk',
  },
  screen: {
    key: 'screen',
    label: 'Skrn time',
    short: 'Screen',
    color: '#F97316',
    icon: 'phone',
  },
  goals: {
    key: 'goals',
    label: 'Maqsadlar',
    short: 'Maqsad',
    color: '#8B5CF6',
    icon: 'target',
  },
  sleep: {
    key: 'sleep',
    label: 'Uyqu',
    short: 'Uyqu',
    color: '#6366F1',
    icon: 'moon',
  },
};

/**
 * Radar burchaklari soat 12 dan boshlanadi va soat yo'nalishi bo'yicha ketadi.
 * Skrinshotdagi tartib: ovqatlanish (tepa) → qadam → screen → maqsadlar → uyqu.
 */
export const RADAR_ORDER: MetricKey[] = ['nutrition', 'steps', 'screen', 'goals', 'sleep'];

export const radius = {
  card: 20,
  row: 16,
  chip: 999,
  sheet: 28,
} as const;

/** Ball qiymatiga qarab rang: past → qizil-sariq, yuqori → yashil */
export function scoreColor(percent: number): string {
  if (percent >= 75) return colors.green;
  if (percent >= 50) return '#EAB308';
  return colors.danger;
}

/** Ball qiymatining o'zbekcha talqini (hech qachon tibbiy baho emas) */
export function scoreLabel(percent: number): string {
  if (percent >= 85) return 'A’lo';
  if (percent >= 70) return 'Yaxshi';
  if (percent >= 50) return "O'rtacha";
  return 'Past';
}
