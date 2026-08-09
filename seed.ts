import { Profiles, Items } from './db';
import { FOODS } from './foods';

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

/**
 * Mifflin-St Jeor BMR × activity factor. This is the standard clinical
 * estimate, and it is what makes the calorie target personal instead of a
 * one-size-fits-all 2200.
 */
export function computeTargets(p: {
  age: number; gender: string; height: number; weight: number;
  activityLevel: string; weightGoalType: string;
}) {
  const isMale = /erkak|male|m/i.test(p.gender);
  const bmr =
    10 * p.weight + 6.25 * p.height - 5 * p.age + (isMale ? 5 : -161);

  const factors: Record<string, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
  };
  const tdee = bmr * (factors[p.activityLevel] ?? 1.55);

  // A 20% deficit / 12% surplus keeps the change sustainable rather than crash-like.
  const adjusted =
    p.weightGoalType === 'lose' ? tdee * 0.8
    : p.weightGoalType === 'gain' ? tdee * 1.12
    : tdee;

  const targetCalories = Math.round(adjusted / 10) * 10;
  // 1.8 g/kg supports muscle retention in a deficit; fat at 25% of energy.
  const targetProtein = Math.round(p.weight * 1.8);
  const targetFat = Math.round((targetCalories * 0.25) / 9);
  const targetCarbs = Math.max(
    0,
    Math.round((targetCalories - targetProtein * 4 - targetFat * 9) / 4)
  );
  // 30 ml per kg, clamped to a sane range.
  const targetWaterMl = Math.min(4000, Math.max(1500, Math.round((p.weight * 30) / 50) * 50));

  return { targetCalories, targetProtein, targetCarbs, targetFat, targetWaterMl };
}

// Fresh profile for a brand-new account: default targets the user can edit,
// but NO fake activity history — 0 XP, level 1, no streak.
export function defaultProfile(name: string) {
  const base = {
    age: 25, gender: 'Erkak', height: 175, weight: 70.0, goalWeight: 65.0,
    activityLevel: 'moderate', weightGoalType: 'lose' as const,
  };
  return {
    ...base,
    ...computeTargets(base),
    preferredDiet: 'everything',
    // so'mda: o'rtacha bir kishilik oylik oziq-ovqat byudjeti
    budgetMonthly: 1500000,
    name,
    dietPreference: 'balanced',
    level: 1, xp: 0, streak: 0, lastActiveDate: '',
  };
}

// Reference catalog seeded into every new account so logging has something to
// pick from on day one. See foods.ts — 130+ items with sugar, fibre, sodium,
// NOVA group and so'm prices.
const foodCatalog = () =>
  FOODS.map((x) => ({
    id: x.id,
    name: x.name,
    calories: x.calories,
    protein: x.protein,
    carbs: x.carbs,
    fat: x.fat,
    fiber: x.fiber,
    sugar: x.sugar,
    sodium: x.sodium,
    nova: x.nova,
    veg: x.veg,
    unit: x.unit,
    servingSize: x.servingSize,
    pricePerUnit: x.pricePerUnit,
    image: x.image,
    category: x.category,
  }));

// Achievements are goals — start fully LOCKED, unlocked by real user actions.
// Every one of these has matching unlock logic in the app; nothing here is
// decorative.
const achievements = () => [
  { id: 'ach_1', title: 'Oqsil Qiroli', description: "Ketma-ket 3 kun oqsil me'yorini bajardi", icon: '🍗', unlocked: false },
  { id: 'ach_2', title: 'Gidratsiya Qahramoni', description: "Bir kunda 3 litrdan ko'p suv ichdi", icon: '💧', unlocked: false },
  { id: 'ach_3', title: 'Toza Kun', description: "Bir kunda 90+ UNUM Score to'pladi", icon: '💎', unlocked: false },
  { id: 'ach_4', title: 'Oshpazlik Ustasi', description: 'Bazaga shaxsiy mahsulot kiritdi', icon: '🍳', unlocked: false },
  { id: 'ach_5', title: "Sog'lom Hafta", description: 'Ketma-ket 7 kun ilovaga kirdi', icon: '🔥', unlocked: false },
];

const coachWelcome = () => [
  {
    id: 'msg_1',
    sender: 'ai',
    text: 'Salom! Men sizning UNUM AI murabbiyingizman. Bugun nima yeganingizni yozing — masalan "1 kosa osh va 2 ta somsa" — men uni tahlil qilib, Score\'ingizni qanday ko\'tarishni aytaman.',
    timestamp: new Date().toISOString(),
  },
];

/**
 * Seed a brand-new account with a CLEAN slate:
 *  - profile (editable defaults, 0 XP)
 *  - food reference catalog (needed for manual logging)
 *  - achievements (all locked)
 *  - one coach welcome message
 * Inventory, meals, water, body, expenses and activities all start EMPTY —
 * the user fills them in and every entry is stored in the database.
 */
export function seedUser(userId: number, name: string) {
  Profiles.set(userId, defaultProfile(name));
  Items.bulkInsert(userId, 'food', foodCatalog());
  Items.bulkInsert(userId, 'achievements', achievements());
  Items.bulkInsert(userId, 'coach', coachWelcome());
  // inventory / meals / water / body / expenses / activities: intentionally empty
}

// kept for potential future "demo data" button; not used on register
export const _sampleDate = (n: number) => ymd(daysAgo(n));
