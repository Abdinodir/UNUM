/**
 * Prototip ma'lumotlari. Raqamlar dizayn skrinshotlaridan olingan —
 * backend ulanganda bu fayl butunlay API javoblari bilan almashtiriladi.
 */
import type {
  ActivityHeatmap,
  AiInsight,
  ChatMessage,
  Integration,
  MetricMap,
  PartnerOffer,
  PlanItem,
  Recommendation,
  Settings,
  Subscription,
  TrendCard,
  UserProfile,
} from '../types';

export const INITIAL_PROFILE: UserProfile = {
  name: 'Davrbek Norov',
  email: 'unum.user@mail.com',
  age: 23,
  gender: 'male',
  heightCm: 175,
  weightKg: 72,
  targetWeightKg: 68,
  activity: 'medium',
  sleepWindow: '23:30 – 07:00',
  healthLimits: "Yo'q",
  allergies: "Yo'q",
  premium: true,
  onboarded: false,
  hapticsEnabled: true,
};

export const INITIAL_SETTINGS: Settings = {
  notifications: true,
  reminders: true,
  nightMode: true,
  language: 'uz',
  units: 'metric',
  weekStart: 'mon',
};

export const INITIAL_METRICS: MetricMap = {
  nutrition: {
    key: 'nutrition',
    current: 1650,
    target: 2100,
    unit: 'kkal',
    valueText: '1 650 / 2 100 kkal',
    remainderText: '450 kkal qoldi',
    percent: 78,
    history7: [1900, 2050, 1720, 1980, 1840, 2100, 1650],
  },
  steps: {
    key: 'steps',
    current: 6500,
    target: 10000,
    unit: 'qadam',
    valueText: '6 500 / 10 000 qadam',
    remainderText: '3 500 qadam qoldi',
    percent: 65,
    history7: [8100, 9400, 7600, 10200, 8800, 9100, 6500],
  },
  sleep: {
    key: 'sleep',
    current: 405,
    target: 480,
    unit: 'daqiqa',
    valueText: '6 soat 45 daqiqa / 8 soat',
    remainderText: '1 soat 15 daqiqa qoldi',
    percent: 82,
    history7: [430, 465, 390, 450, 420, 480, 405],
  },
  screen: {
    key: 'screen',
    current: 130,
    target: 240,
    unit: 'daqiqa',
    valueText: '2 soat 10 daqiqa / 4 soat',
    remainderText: '1 soat 50 daqiqa qoldi',
    percent: 40,
    inverted: true,
    history7: [180, 210, 150, 195, 165, 140, 130],
  },
  goals: {
    key: 'goals',
    current: 2,
    target: 3,
    unit: 'ta',
    valueText: '2 / 3 ta bajarildi',
    remainderText: '1 ta vazifa qoldi',
    percent: 63,
    history7: [2, 3, 1, 3, 2, 3, 2],
  },
};

export const UNUM_SCORE = 78;
export const PREVIOUS_WEEK_SCORE = 72;

export const INITIAL_INSIGHTS: AiInsight[] = [
  {
    id: 'ins-1',
    metric: 'screen',
    text: "Instagramni kechki 23:00 dan keyin ishlatgan kunlaringda o'rtacha 1 soat kamroq uxlagansan.",
  },
  {
    id: 'ins-2',
    metric: 'steps',
    text: "Ma'lumotlaringizga qaraganda, tushlikdan keyingi qisqa sayr qadam sonini o'rtacha 1 400 taga oshirgan.",
  },
  {
    id: 'ins-3',
    metric: 'nutrition',
    text: "So'nggi haftadagi ma'lumotlar asosida, ertalabki oqsilli nonushta kunlik kaloriya me'yorini barqarorlashtirgan.",
  },
  {
    id: 'ins-4',
    metric: 'sleep',
    text: "Uyqu vaqti bir xil bo'lgan kunlarda ertalabki energiya bahosi yuqoriroq bo'lgan.",
  },
  {
    id: 'ins-5',
    metric: 'goals',
    text: "Kunlik vazifalarni tongda bajarganingizda, kechga qadar bajarilish darajasi 2 barobar yuqori bo'lgan.",
  },
];

export const INITIAL_TRENDS: TrendCard[] = [
  {
    key: 'steps',
    label: 'Qadam',
    value: '8 240',
    deltaPercent: 12,
    points: [7100, 8600, 7900, 9200, 8400, 9600, 8240],
  },
  {
    key: 'nutrition',
    label: 'Ovqat (kkal)',
    value: '1 850',
    deltaPercent: -5,
    points: [2050, 1900, 2000, 1780, 1950, 1820, 1850],
  },
  {
    key: 'sleep',
    label: 'Uyqu (soat)',
    value: '7.1',
    deltaPercent: 0.6,
    points: [6.5, 7.2, 6.9, 7.4, 7.0, 7.3, 7.1],
  },
  {
    key: 'screen',
    label: 'Skrn time (soat)',
    value: '2.8',
    deltaPercent: 0.7,
    points: [3.9, 3.5, 3.6, 3.1, 3.0, 2.6, 2.8],
  },
  {
    key: 'goals',
    label: 'Maqsadlar',
    value: '63%',
    deltaPercent: 8,
    points: [45, 52, 48, 60, 55, 68, 63],
  },
];

/** 7 qator (Yak–Shan) × 14 ustun (2 hafta). Qiymat 0–1. */
export const INITIAL_HEATMAP: ActivityHeatmap = [
  [0.2, 0.4, 0.1, 0.5, 0.3, 0.2, 0.6, 0.1, 0.3, 0.4, 0.2, 0.5, 0.3, 0.2],
  [0.5, 0.3, 0.6, 0.2, 0.4, 0.9, 0.3, 0.5, 0.2, 0.6, 0.4, 0.3, 0.5, 0.4],
  [0.3, 0.6, 0.4, 0.7, 0.2, 0.5, 0.8, 0.3, 0.6, 0.2, 0.4, 0.7, 0.3, 0.5],
  [0.7, 0.4, 0.5, 0.3, 0.9, 0.4, 0.6, 0.2, 0.5, 0.8, 0.3, 0.6, 0.4, 0.9],
  [0.4, 0.5, 0.3, 0.6, 0.4, 0.2, 0.5, 0.7, 0.3, 0.4, 0.6, 0.2, 0.5, 0.3],
  [0.6, 0.2, 0.7, 0.4, 0.5, 0.3, 0.4, 0.6, 0.2, 0.5, 0.3, 0.7, 0.4, 0.2],
  [0.3, 0.5, 0.9, 0.2, 0.6, 0.4, 0.3, 0.5, 0.7, 0.2, 0.4, 0.3, 0.6, 0.4],
];

export const MOST_ACTIVE_DAY = 'Payshanba';
export const MOST_ACTIVE_HOUR = '15:00 – 16:00';

export const INITIAL_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'rec-steps',
    metric: 'steps',
    title: 'Qadam',
    tag: 'Kam yuryapsiz',
    summary:
      "Oxirgi 7 kunda maqsadingizning 45% ini bajardingiz. 7 000 qadamdan boshlash maqsadingizga yordam beradi.",
    percent: 45,
    reasons: [
      "O'rtacha kunlik qadam: 4 500. Maqsad: 10 000",
      '7 kundan beri maqsad to‘liq bajarilmagan',
      'Ketma-ket kichik maqsadlar katta odatga aylanish ehtimolini oshiradi',
    ],
    advice:
      "Dastlab 7 000 qadamdan boshlab, odatga aylangach maqsadingizni oshiring.",
  },
  {
    id: 'rec-nutrition',
    metric: 'nutrition',
    title: 'Ovqatlanish',
    tag: 'Oqsil kam',
    summary:
      "Bu hafta oqsil iste'moli kam bo'ldi. Fast food ko'proq iste'mol qilingan.",
    percent: 62,
    reasons: [
      "O'rtacha kunlik oqsil: 54 g. Tavsiya: 90 g",
      "Haftada 3 kun tez tayyor ovqat qayd etilgan",
      'Oqsil to‘yimlilik hissini uzoqroq saqlaydi',
    ],
    advice:
      "Har ovqatda bir kaft hajmidagi oqsil manbasini qo'shishga harakat qiling.",
  },
  {
    id: 'rec-screen',
    metric: 'screen',
    title: 'Screen time',
    tag: "Ko'p ishlatyapsiz",
    summary:
      "Instagramdan foydalanish odatdagidan ko'p. Kechga kamaytirish tavsiya etiladi.",
    percent: 40,
    reasons: [
      "Kunlik o'rtacha: 3 soat 40 daqiqa",
      "Kechki 22:00 dan keyingi ulush: 41%",
      'Kech ekran yorug‘ligi uyquga o‘tishni sekinlashtiradi',
    ],
    advice:
      "Uyqudan 45 daqiqa oldin ijtimoiy tarmoqlarni yopishni sinab ko'ring.",
  },
  {
    id: 'rec-goals',
    metric: 'goals',
    title: "Kitob o'qish",
    tag: 'Ortda qolyapti',
    summary: "Bu hafta maqsad bajarilmadi. Har kuni 10 betdan boshlang.",
    percent: 30,
    reasons: [
      "Haftalik o'qilgan: 21 bet. Maqsad: 70 bet",
      'Eng ko‘p o‘qilgan vaqt: 22:00 – 23:00',
      'Kichik kunlik me’yor uzilishlarni kamaytiradi',
    ],
    advice: "Kuniga 10 betdan o'qish oy oxirigacha maqsadga yetkazadi.",
  },
];

export const INITIAL_PLAN: PlanItem[] = [
  {
    id: 'plan-steps',
    metric: 'steps',
    title: 'Qadam',
    body: "Maqsadingizni 10 000 dan 7 000 ga tushirishingiz mumkin.",
    planned: false,
  },
  {
    id: 'plan-nutrition',
    metric: 'nutrition',
    title: 'Ovqatlanish',
    body: "Bu hafta kam oqsil iste'modan. Har ovqatda protein qo'shishga harakat qiling.",
    planned: false,
  },
  {
    id: 'plan-screen',
    metric: 'screen',
    title: 'Screen time',
    body: "Instagramdan foydalanish ko'paygan. Kuniga 1 soatdan boshlab kamaytiring.",
    planned: false,
  },
  {
    id: 'plan-goals',
    metric: 'goals',
    title: "Kitob o'qish",
    body: "Har kuni 10 bet o'qish orqali oy oxirigacha maqsadingizga yetishingiz mumkin.",
    planned: false,
  },
];

export const INITIAL_PARTNERS: PartnerOffer[] = [
  {
    id: 'p-englify',
    name: 'Englify',
    description: "IELTS va ingliz tili darslari",
    offer: '7 kun bepul sinov',
    badge: 'E',
    color: '#3B82F6',
  },
  {
    id: 'p-asaxiy-sport',
    name: 'ASAXI SPORT',
    description: "Sifatli sport kiyimlari va poyabzallar",
    offer: '5% chegirma',
    badge: 'A',
    color: '#71717A',
  },
  {
    id: 'p-korzinka',
    name: 'Korzinka Healthy',
    description: "Sog'lom mahsulotlar va yetkazib berish",
    offer: '10% chegirma',
    badge: 'K',
    color: '#EF4444',
  },
];

export const INITIAL_CHAT: ChatMessage[] = [
  { id: 'c-1', sender: 'user', text: "Bugun nima yesam bo'ladi?" },
  {
    id: 'c-2',
    sender: 'ai',
    showDisclaimer: true,
    text: `Bugungi maqsadingizga mos ovqatlanish uchun quyidagilarni tavsiya qilaman:

- **Tushlik:** Tovuq filesi, grechka, sabzavot salati
- **Kechki ovqat:** Baliq, bulgur, bodring va pomidor salati
- **Oraliq:** Greek yogurt + yong'oq

Bu taxminan 1650 kkal bo'ladi.`,
  },
];

/**
 * ⚠️ `connected` MAYDONI HAQIQATNI AYTISHI SHART.
 *
 * Ilgari Apple Health, Health Connect, Smartwatch va Screen Time
 * `connected: true` deb turardi — hech biri ulanmagan bo'lsa ham. Ilova
 * ulanmagan narsani "Ulangan" deb ko'rsatardi va foydalanuvchi ma'lumot
 * o'z-o'zidan tortilyapti deb o'ylardi.
 *
 * Haqiqiy ulanish holati Google servislari uchun serverdan keladi
 * (`/api/integrations`); native (Health Connect, Apple Health) hali
 * umuman yozilmagan, shuning uchun `false`.
 */
export const INITIAL_INTEGRATIONS: Integration[] = [
  {
    key: 'apple_health',
    name: 'Apple Health',
    connected: false,
    nativeOnly: true,
    description: 'Qadam, uyqu va yurak urishi',
    color: '#EF4444',
  },
  {
    key: 'health_connect',
    name: 'Health Connect',
    connected: false,
    nativeOnly: true,
    description: "Qadam va uyqu — mobil ilovada ulanadi",
    color: '#3B82F6',
  },
  {
    key: 'smartwatch',
    name: 'Smartwatch',
    connected: false,
    nativeOnly: true,
    description: 'Soat orqali kunlik faollik',
    color: '#0EA5E9',
  },
  {
    key: 'screen_time',
    name: 'Screen Time',
    connected: false,
    nativeOnly: true,
    description: 'Telefon foydalanish vaqti — hali ulanmagan',
    color: '#8B5CF6',
  },
  {
    // Google Fit API 2026 oxirida o'chadi va yangi ro'yxatdan o'tish yopiq —
    // shuning uchun ulash tugmasi yo'q, qadam ma'lumoti Health Connect'dan keladi.
    key: 'google_fit',
    name: 'Google Fit',
    connected: false,
    nativeOnly: true,
    description: "Google to'xtatmoqda — Health Connect ishlatiladi",
    color: '#71717A',
  },
  {
    key: 'google_calendar',
    name: 'Google Calendar',
    connected: false,
    nativeOnly: false,
    description: 'Kun tartibi va bandlik',
    color: '#3B82F6',
  },
];

export const INITIAL_SUBSCRIPTION: Subscription = {
  active: true,
  priceText: "59 000 so'm / oy",
  nextPaymentDate: '12 sentyabr 2026',
  cardLast4: '4242',
  cardBrand: 'VISA',
};

export const PREMIUM_FEATURES = [
  'Cheksiz AI tahlil',
  'AI Coach bilan cheksiz chat',
  'Haftalik va oylik hisobotlar',
  'Rasm va ovoz orqali kiritish',
  'Kengaytirilgan statistika',
  'Reklamasiz tajriba',
];
