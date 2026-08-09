/**
 * Botning matni va vizual mantig'i.
 *
 * Alohida modulda, chunki bu yerda haqiqiy qaror bor: **ballni vaqtga qarab
 * boshqacha talqin qilish**. Soat 10:00 da faqat nonushta kiritgan odamga
 * "27/100 — Juda past" deyish noto'g'ri va ruhni tushiradi: kun boshida ball
 * tabiiy ravishda past bo'ladi. Kechqurun esa xuddi shu 27 haqiqatan past.
 */

export const som = (n: number) => {
  const s = Math.round(n).toString();
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return `${out} so'm`;
};

export const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Kunning qancha qismi o'tgani (0..1).
 * Faol kun 07:00 dan 22:00 gacha deb olinadi — odam tunda ovqat kiritmaydi.
 */
export function dayProgress(hour: number, minute = 0): number {
  const t = hour + minute / 60;
  if (t <= 7) return 0.05;
  if (t >= 22) return 1;
  return (t - 7) / 15;
}

export type Phase = 'morning' | 'midday' | 'evening' | 'night';

export function phaseOf(hour: number): Phase {
  if (hour < 11) return 'morning';
  if (hour < 17) return 'midday';
  if (hour < 23) return 'evening';
  return 'night';
}

/**
 * Vaqtni hisobga olgan baho.
 *
 * Kun oxirigacha shu sur'atda davom etsa qancha ball to'planishini hisoblab,
 * shuni baholaydi. Shu tufayli ertalabki past ball "yomon" deb atalmaydi.
 */
export function projectedScore(total: number, progress: number): number {
  if (progress <= 0.05) return total;
  return Math.min(100, Math.round(total / progress));
}

export function scoreHeadline(
  total: number,
  hour: number,
  hasData: boolean
): { emoji: string; title: string; note: string } {
  if (!hasData) {
    return {
      emoji: '⚪️',
      title: 'Kun hali boshlanmadi',
      note: 'Birinchi taomingizni kiriting — ball shundan keyin hisoblanadi.',
    };
  }

  const p = dayProgress(hour);
  const projected = projectedScore(total, p);
  const phase = phaseOf(hour);

  // Kechqurun — haqiqiy baho. Undan oldin — sur'at bo'yicha.
  if (phase === 'evening' || phase === 'night') {
    if (total >= 90) {
      return { emoji: '🟢', title: 'Ajoyib kun', note: 'Bugun hamma narsa joyida edi.' };
    }
    if (total >= 75) {
      return { emoji: '🟢', title: 'Yaxshi kun', note: 'Bir-ikki kichik nuqta qolgan.' };
    }
    if (total >= 60) {
      return { emoji: '🟡', title: "O'rtacha kun", note: 'Ertaga yaxshiroq qilamiz.' };
    }
    if (total >= 40) {
      return { emoji: '🟠', title: 'Oson kun bo\'lmadi', note: 'Ertaga yangidan boshlaymiz.' };
    }
    return {
      emoji: '🔴',
      title: 'Bugun qiyin kechdi',
      note: 'Buni ham hisobga oldik. Muhimi — ertaga davom etish.',
    };
  }

  // Ertalab va tushda: sur'atni ko'rsatamiz, hukm qilmaymiz.
  if (projected >= 80) {
    return {
      emoji: '🟢',
      title: 'Zo\'r sur\'at',
      note: `Shu ruhda davom etsangiz, kun oxirida ~${projected} ball.`,
    };
  }
  if (projected >= 60) {
    return {
      emoji: '🟡',
      title: 'Yaxshi ketyapti',
      note: `Hozirgi sur'atda kun oxirida ~${projected} ball chiqadi.`,
    };
  }
  return {
    emoji: '🟠',
    title: phase === 'morning' ? 'Kun endi boshlandi' : 'Kun o\'rtasi',
    note: 'Hali hamma narsani to\'g\'rilash mumkin — quyida nimadan boshlashni yozdim.',
  };
}

/** Ingichka progress chizig'i. */
export function bar(value: number, max: number, width = 10): string {
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const filled = Math.round(ratio * width);
  return '▰'.repeat(filled) + '▱'.repeat(width - filled);
}

/** Bitta ko'rsatkich qatori: nom, chiziq, qiymat. */
export function metricLine(
  emoji: string,
  label: string,
  value: number,
  target: number,
  unit: string
): string {
  const done = target > 0 && value >= target;
  return `${emoji} ${label.padEnd(0)} ${bar(value, target, 8)} ${Math.round(value)}/${Math.round(target)} ${unit}${done ? ' ✓' : ''}`;
}

export function greeting(hour: number, name: string): string {
  const n = name ? `, ${esc(name)}` : '';
  if (hour < 5) return `Tunggi salom${n}`;
  if (hour < 11) return `Xayrli tong${n}`;
  if (hour < 17) return `Xayrli kun${n}`;
  if (hour < 22) return `Xayrli kech${n}`;
  return `Xayrli tun${n}`;
}

/** Seriya haqida qisqa, rag'batlantiruvchi jumla. */
export function streakLine(streak: number): string {
  if (streak <= 0) return '';
  if (streak === 1) return '🔥 1-kun — boshlandi';
  if (streak < 7) return `🔥 ${streak} kun ketma-ket · 7 gacha ${7 - streak} kun`;
  if (streak < 30) return `🔥 ${streak} kun ketma-ket · 30 gacha ${30 - streak} kun`;
  return `🔥 ${streak} kun ketma-ket — bu allaqachon odat`;
}

/**
 * Eng zaif komponentga qarab bitta aniq keyingi qadam.
 * "Sog'lom ovqatlaning" emas — aynan nima qilish kerakligi.
 */
export function nextStep(weakestId: string | undefined, phase: Phase): string | null {
  switch (weakestId) {
    case 'protein':
      return phase === 'evening'
        ? 'Kechki ovqatga 200 g tvorog yoki 3 ta tuxum qo\'shing.'
        : 'Keyingi taomga tovuq, tuxum yoki tvorog qo\'shing.';
    case 'veg':
      return 'Bitta cho\'pon salat qo\'shing — bu darrov 1.5 portsiya.';
    case 'water':
      return '2 stakan suv iching va shu yerda "💧 Suv" tugmasini bosing.';
    case 'move':
      return phase === 'evening'
        ? '15 daqiqalik sayr ham 1500 qadam qo\'shadi.'
        : 'Kun davomida 20 daqiqa yurishga harakat qiling.';
    case 'sugar':
      return 'Bugun shirin ichimlikdan voz keching — suv yoki ko\'k choy.';
    case 'upf':
      return 'Keyingi taomni uyda pishirilganidan tanlang.';
    default:
      return null;
  }
}
