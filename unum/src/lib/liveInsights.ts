/**
 * Kunlik kuzatuvlarni HAQIQIY ball komponentlaridan quradi.
 *
 * NIMA UCHUN YOZILDI. Ilgari bu yerda `data/mock.ts` dagi o'ylab topilgan
 * matnlar turardi, masalan: "Instagramni kechki 23:00 dan keyin ishlatgan
 * kunlaringda o'rtacha 1 soat kamroq uxlagansan". Bunday bog'liqlik HECH
 * QACHON hisoblanmagan — bu shunchaki yozib qo'yilgan gap edi. Foydalanuvchi
 * uni o'zining tahlili deb qabul qiladi va ilovaga bo'lgan ishonchi
 * asossiz joyga quriladi.
 *
 * Endi har bir satr `computeScore` qaytargan komponentdan olinadi va
 * FAQAT o'lchangan narsani aytadi. Bog'liqlik ("X sababli Y") umuman
 * chiqarilmaydi — buning uchun bizda statistik asos yo'q.
 */
import type { AiInsight, MetricKey } from '../types';

interface ScoreComponent {
  id: string;
  label: string;
  earned: number;
  max: number;
  detail: string;
}

/** Ball komponenti → radar o'qi. Mos kelmasa `nutrition`. */
const METRIC_OF: Record<string, MetricKey> = {
  protein: 'goals',
  veg: 'nutrition',
  sugar: 'nutrition',
  upf: 'nutrition',
  water: 'nutrition',
  move: 'steps',
};

/** Komponent uchun aniq, o'lchangan maslahat. */
const ADVICE: Record<string, string> = {
  protein: 'Oqsilni oshirish uchun tuxum, tovuq yoki tvorog qo’shing.',
  veg: 'Har ovqatga bir hovuch sabzavot qo’shsangiz me’yor to’ladi.',
  sugar: 'Shirin ichimlikni suvga almashtirish eng tez ta’sir qiladi.',
  upf: 'Qadoqlangan mahsulot o’rniga uyda tayyorlangan taom tanlang.',
  water: 'Har soatda bir stakan — kun oxirida me’yor o’zi to’ladi.',
  move: 'Yigirma daqiqalik piyoda yurish farqni sezilarli qiladi.',
};

/**
 * `hasData` bo'lmasa bitta yo'naltiruvchi satr qaytariladi — ro'yxat
 * HECH QACHON bo'sh bo'lmaydi, chunki `AnalysisView` uni `% insights.length`
 * bilan aylantiradi va bo'sh massivda bu NaN beradi.
 */
export function buildInsights(
  score: { hasData: boolean; components?: ScoreComponent[] } | null
): AiInsight[] {
  if (!score || !score.hasData || !score.components?.length) {
    return [
      {
        id: 'empty',
        metric: 'nutrition',
        text:
          "Bugun hali yozuv yo’q. Bitta taom yoki bir stakan suv kiriting — " +
          'tahlil shundan boshlanadi.',
      },
    ];
  }

  // Eng ko'p ball yo'qotgan komponentdan boshlaymiz: foydalanuvchiga
  // avval eng foydali gap aytilsin.
  const gaps = score.components
    .filter((c) => c.earned < c.max - 0.5)
    .sort((a, b) => b.max - b.earned - (a.max - a.earned));

  if (gaps.length === 0) {
    return [
      {
        id: 'perfect',
        metric: 'nutrition',
        text: 'Bugun barcha ko’rsatkich me’yorda. Shu sur’atni saqlang.',
      },
    ];
  }

  return gaps.slice(0, 5).map((c) => ({
    id: c.id,
    metric: METRIC_OF[c.id] ?? 'nutrition',
    text: `${c.label}: ${c.detail}.${ADVICE[c.id] ? ` ${ADVICE[c.id]}` : ''}`,
  }));
}
