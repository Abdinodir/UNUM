/**
 * Web ilova profili ↔ serverdagi kanonik profil o'rtasidagi moslashtiruvchi.
 *
 * NEGA KERAK: `profiles` jadvalidagi bitta yozuvni Play Market'dagi Flutter
 * ilovasi ham ishlatadi va uning maydon nomlari boshqacha (`height`, `weight`,
 * `goalWeight`, `activityLevel`, `gender: "Erkak"`). Web ilova o'z nomlari
 * bilan yozsa, telefon ilovasidagi profil buziladi.
 *
 * Shuning uchun:
 *   - o'qishda kanonik sxemadan web sxemasiga o'giriladi
 *   - yozishda mavjud yozuv ustiga faqat bizga tegishli maydonlar qo'yiladi,
 *     tanimagan maydonlar (targetCalories, xp, streak…) TEGILMAYDI
 */
import type { ActivityLevel, Gender, UserProfile } from '../types';

/** Serverda jins o'zbekcha matn sifatida saqlanadi */
const GENDER_TO_SERVER: Record<Gender, string> = { male: 'Erkak', female: 'Ayol' };
const ACTIVITY_TO_SERVER: Record<ActivityLevel, string> = {
  low: 'Past',
  medium: "O'rtacha",
  high: 'Yuqori',
};

function genderFromServer(value: unknown): Gender | undefined {
  const s = String(value ?? '').toLowerCase();
  if (s.startsWith('erkak') || s === 'male') return 'male';
  if (s.startsWith('ayol') || s === 'female') return 'female';
  return undefined;
}

function activityFromServer(value: unknown): ActivityLevel | undefined {
  const s = String(value ?? '').toLowerCase();
  if (s.startsWith('past') || s === 'low') return 'low';
  if (s.startsWith('yuqori') || s === 'high') return 'high';
  if (s.startsWith("o'rtacha") || s.startsWith('o‘rtacha') || s === 'medium') return 'medium';
  return undefined;
}

function num(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Serverdagi yozuvdan web profiliga — faqat aniqlangan qiymatlar qaytadi */
export function profileFromServer(raw: Record<string, unknown>): Partial<UserProfile> {
  const out: Partial<UserProfile> = {};

  if (typeof raw.name === 'string' && raw.name.trim()) out.name = raw.name.trim();
  if (typeof raw.email === 'string' && raw.email.trim()) out.email = raw.email.trim();

  const age = num(raw.age);
  if (age) out.age = age;

  const gender = genderFromServer(raw.gender);
  if (gender) out.gender = gender;

  const height = num(raw.heightCm ?? raw.height);
  if (height) out.heightCm = height;

  const weight = num(raw.weightKg ?? raw.weight);
  if (weight) out.weightKg = weight;

  const target = num(raw.targetWeightKg ?? raw.goalWeight);
  if (target) out.targetWeightKg = target;

  const activity = activityFromServer(raw.activity ?? raw.activityLevel);
  if (activity) out.activity = activity;

  if (typeof raw.sleepWindow === 'string' && raw.sleepWindow) out.sleepWindow = raw.sleepWindow;
  if (typeof raw.premium === 'boolean') out.premium = raw.premium;
  out.onboarded = raw.onboarded === true;

  return out;
}

/**
 * Web profilini serverdagi yozuv ustiga qo'yadi.
 *
 * `existing` — serverdan o'qilgan xom yozuv. Uni asos qilib olamiz va faqat
 * o'z maydonlarimizni yangilaymiz, shunda Flutter ilovasining maydonlari
 * (targetCalories, xp, streak, budgetMonthly…) o'z joyida qoladi.
 */
export function profileToServer(
  existing: Record<string, unknown>,
  profile: UserProfile
): Record<string, unknown> {
  return {
    ...existing,

    name: profile.name,
    age: profile.age,

    // Ikkala nom ham yoziladi: eski ilova `height`/`weight` ni o'qiydi,
    // yangi ilova esa `heightCm`/`weightKg` ni.
    gender: GENDER_TO_SERVER[profile.gender],
    height: profile.heightCm,
    heightCm: profile.heightCm,
    weight: profile.weightKg,
    weightKg: profile.weightKg,
    goalWeight: profile.targetWeightKg,
    targetWeightKg: profile.targetWeightKg,
    activityLevel: ACTIVITY_TO_SERVER[profile.activity],
    activity: profile.activity,

    sleepWindow: profile.sleepWindow,
    onboarded: true,

    // `premium` ni HECH QACHON yubormaymiz — serverning o'zi qo'yadi.
    premium: undefined,
  };
}
