/**
 * Kouch tavsiyalari va kunlik rejani HAQIQIY ball komponentlaridan quradi.
 *
 * NIMA UCHUN YOZILDI. `data/mock.ts` da yozib qo'yilgan tavsiyalar bor edi,
 * masalan: "Oxirgi 7 kunda maqsadingizning 45% ini bajardingiz". Bu 45%
 * hech qachon hisoblanmagan — shunchaki matn edi. Foydalanuvchi uni o'z
 * statistikasi deb o'qiydi.
 *
 * Endi har bir raqam `computeScore` dan keladi. Hisoblanmagan narsa
 * umuman AYTILMAYDI.
 */
import type { MetricKey, PlanItem, Recommendation } from '../types';

interface ScoreComponent {
  id: string;
  label: string;
  earned: number;
  max: number;
  detail: string;
}

const METRIC_OF: Record<string, MetricKey> = {
  protein: 'goals',
  veg: 'nutrition',
  sugar: 'nutrition',
  upf: 'nutrition',
  water: 'nutrition',
  move: 'steps',
};

/** Komponent uchun sabab va tavsiya — o'ylab topilgan raqamsiz. */
const COPY: Record<string, { tag: string; reasons: string[]; advice: string }> = {
  protein: {
    tag: 'Oqsil yetishmayapti',
    reasons: [
      'Oqsil to’qima tiklanishi va to’qlik hissi uchun asosiy modda.',
      'Yetarli oqsil ovqatlanishdan keyingi ochlikni kamaytiradi.',
    ],
    advice: 'Har ovqatga bitta oqsil manbasi qo’shing: tuxum, tovuq, baliq yoki tvorog.',
  },
  veg: {
    tag: 'Sabzavot kam',
    reasons: [
      'Sabzavot kletchatka va mikroelement beradi.',
      'Kletchatka qon shakarining keskin ko’tarilishini yumshatadi.',
    ],
    advice: 'Har ovqatga bir hovuch sabzavot qo’shsangiz kunlik me’yor to’ladi.',
  },
  sugar: {
    tag: 'Shakar ko’p',
    reasons: [
      'Ortiqcha shakar kunlik kaloriyani bildirmay oshiradi.',
      'Shirin ichimlik to’qlik hissi bermaydi.',
    ],
    advice: 'Shirin ichimlikni suvga almashtirish eng tez ta’sir qiladigan qadam.',
  },
  upf: {
    tag: 'Qayta ishlangan ovqat ko’p',
    reasons: [
      'Qadoqlangan mahsulotda natriy va qo’shimchalar yuqori bo’ladi.',
      'Uyda tayyorlangan taom tarkibini o’zingiz nazorat qilasiz.',
    ],
    advice: 'Kuniga bitta qadoqlangan mahsulotni uy taomiga almashtiring.',
  },
  water: {
    tag: 'Suv kam',
    reasons: [
      'Suvsizlik charchoq va diqqat susayishiga olib keladi.',
      'Ochlik hissi ko’pincha suvsizlik bilan chalkashtiriladi.',
    ],
    advice: 'Har soatda bir stakan — kun oxirida me’yor o’zi to’ladi.',
  },
  move: {
    tag: 'Harakat kam',
    reasons: [
      'Muntazam yurish yurak-qon tomir tizimini qo’llab-quvvatlaydi.',
      'Ovqatdan keyingi qisqa yurish qon shakarini pasaytiradi.',
    ],
    advice: 'Yigirma daqiqalik piyoda yurish farqni sezilarli qiladi.',
  },
};

const gapsOf = (components: ScoreComponent[]) =>
  components
    .filter((c) => c.earned < c.max - 0.5)
    .sort((a, b) => b.max - b.earned - (a.max - a.earned));

export function buildRecommendations(
  score: { hasData: boolean; components?: ScoreComponent[] } | null
): Recommendation[] {
  if (!score?.hasData || !score.components?.length) return [];

  return gapsOf(score.components)
    .filter((c) => COPY[c.id])
    .slice(0, 4)
    .map((c) => ({
      id: c.id,
      metric: METRIC_OF[c.id] ?? 'nutrition',
      title: c.label,
      tag: COPY[c.id].tag,
      // Foiz — komponentning HAQIQIY bajarilishi, o'ylab topilgan emas.
      summary: `${c.detail}. Bu ko’rsatkich bo’yicha ${Math.round(
        (c.earned / c.max) * 100
      )}% bajarilgan.`,
      percent: Math.round((c.earned / c.max) * 100),
      reasons: COPY[c.id].reasons,
      advice: COPY[c.id].advice,
    }));
}

export function buildPlan(
  score: { hasData: boolean; components?: ScoreComponent[] } | null
): PlanItem[] {
  if (!score?.hasData || !score.components?.length) return [];

  return gapsOf(score.components)
    .filter((c) => COPY[c.id])
    .slice(0, 3)
    .map((c) => ({
      id: `plan-${c.id}`,
      metric: METRIC_OF[c.id] ?? 'nutrition',
      title: c.label,
      body: COPY[c.id].advice,
      planned: false,
    }));
}
