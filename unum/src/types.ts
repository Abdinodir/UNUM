import type { MetricKey } from './theme';

export type { MetricKey };

export type TabType = 'home' | 'goals' | 'analysis' | 'coach' | 'profile';

export type Period = 'day' | 'week' | 'month' | 'year';

export const PERIOD_LABELS: Record<Period, string> = {
  day: 'Bugun',
  week: 'Hafta',
  month: 'Oy',
  year: 'Yil',
};

/**
 * Bitta metrikaning kunlik holati.
 * `current`/`target` xom qiymat (kkal, qadam, daqiqa), `percent` esa 0–100.
 * Screen time uchun kamroq = yaxshiroq, shuning uchun `inverted` bayrog'i bor.
 */
export interface MetricState {
  key: MetricKey;
  current: number;
  target: number;
  unit: string;
  /** Ro'yxatdagi "1 650 / 2 100 kkal" ko'rinishidagi matn */
  valueText: string;
  /** "450 kkal qoldi" ko'rinishidagi qoldiq matni */
  remainderText: string;
  percent: number;
  inverted?: boolean;
  history7: number[];
}

export type MetricMap = Record<MetricKey, MetricState>;

export interface TrendCard {
  key: MetricKey;
  label: string;
  value: string;
  unit?: string;
  deltaPercent: number;
  points: number[];
}

/** Faollik haritasi: 7 qator (hafta kunlari) × N ustun (kunlar), qiymat 0–1 */
export type ActivityHeatmap = number[][];

export interface AiInsight {
  id: string;
  text: string;
  /** Qaysi metrikaga tegishli — kartani ranglash uchun */
  metric?: MetricKey;
}

export interface Recommendation {
  id: string;
  metric: MetricKey;
  title: string;
  /** "Kam yuryapsiz" kabi qisqa yorliq */
  tag: string;
  summary: string;
  percent: number;
  /** "Nima uchun tavsiya qilinmoqda?" bo'limidagi dalillar */
  reasons: string[];
  /** Yakuniy tavsiya matni */
  advice: string;
}

export interface PlanItem {
  id: string;
  metric: MetricKey;
  title: string;
  body: string;
  planned: boolean;
}

export interface PartnerOffer {
  id: string;
  name: string;
  description: string;
  offer: string;
  /** Ikonka o'rniga ishlatiladigan emoji/harf — logotip yuklanmaydi */
  badge: string;
  color: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  /** AI javobi umumiy tavsiya ekanini ko'rsatuvchi banner */
  showDisclaimer?: boolean;
}

export type IntegrationKey =
  | 'apple_health'
  | 'health_connect'
  | 'smartwatch'
  | 'screen_time'
  | 'google_fit'
  | 'google_calendar';

export interface Integration {
  key: IntegrationKey;
  name: string;
  connected: boolean;
  /** Web'da mumkin emas, faqat native qatlamda ishlaydi */
  nativeOnly: boolean;
  description: string;
  color: string;
}

export interface Subscription {
  active: boolean;
  priceText: string;
  nextPaymentDate: string;
  cardLast4?: string;
  cardBrand?: string;
}

export type Gender = 'male' | 'female';
export type ActivityLevel = 'low' | 'medium' | 'high';

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  low: 'Past',
  medium: "O'rtacha",
  high: 'Yuqori',
};

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl?: string;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  activity: ActivityLevel;
  sleepWindow: string;
  healthLimits: string;
  allergies: string;
  premium: boolean;
  /** Onboarding tugallanganmi — tugallanmagan bo'lsa auth oqimi ko'rsatiladi */
  onboarded: boolean;
  hapticsEnabled: boolean;
}

export interface Settings {
  notifications: boolean;
  reminders: boolean;
  nightMode: boolean;
  language: 'uz' | 'ru' | 'en';
  units: 'metric' | 'imperial';
  weekStart: 'mon' | 'sun';
}

export type AuthProvider = 'google' | 'apple';

export interface AuthState {
  status: 'anonymous' | 'authenticated';
  provider?: AuthProvider;
  /** Faqat displey uchun; token hech qachon localStorage'ga yozilmaydi */
  email?: string;
}
