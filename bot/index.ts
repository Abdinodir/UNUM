import { Telegram, Promo, Profiles, isPremiumActive } from '../db';
import { PLANS, startCheckout } from '../billing';
import { BackendClient } from './client';
import {
  TelegramApi,
  TgMessage,
  TgCallback,
  Keyboard,
  ReplyKeyboard,
} from './api';
import {
  som,
  esc,
  bar,
  greeting,
  streakLine,
  nextStep,
  phaseOf,
  scoreHeadline,
  dayProgress,
  projectedScore,
} from './ui';

/**
 * UNUM Telegram boti.
 *
 * Ilovaning "tez kirish" nusxasi: ovoz yoki matn bilan taom kiritish, suv
 * qo'shish, bugungi holatni ko'rish. Backend bilan o'z HTTP API'si orqali
 * gaplashadi, shuning uchun ilova bilan bir xil qoidalar amal qiladi.
 */

const MEAL_TYPES: Record<string, string> = {
  breakfast: 'Nonushta',
  lunch: 'Tushlik',
  dinner: 'Kechki ovqat',
  snack: 'Gazak',
};

/** Doimiy tugmalar — asosiy amallar har doim bir bosishda. */
const MAIN_KEYBOARD: ReplyKeyboard = [
  ['🍽 Ovqat kiritish', '💧 Suv'],
  ['📊 Bugun', '🎯 Nima qilay?'],
  ['⭐️ Premium'],
];

const WATER_STEPS = [200, 300, 500];

function guessMealType(hour: number): string {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 22) return 'dinner';
  return 'snack';
}

interface Pending {
  parsed: any;
  type: string;
  raw: string;
}

export class UnumBot {
  private api: TelegramApi;
  private backend: BackendClient;
  private offset = 0;
  private running = false;

  private pending = new Map<number, Pending>();
  private awaitingFood = new Set<number>();

  /** Instagram foydalanuvchi nomini kutayotganlar. */
  private awaitingIg = new Set<number>();

  private readonly promoLimit: number;
  private readonly channel: string;
  private readonly instagram: string;

  constructor(token: string, backendUrl: string, private adminId: number) {
    this.api = new TelegramApi(token);
    this.backend = new BackendClient(backendUrl);
    this.promoLimit = Number(process.env.PROMO_LIMIT || 500);
    this.channel = (process.env.TELEGRAM_CHANNEL || '').trim();
    this.instagram = (process.env.INSTAGRAM_URL || '').trim();
  }

  async start() {
    const me = await this.api.getMe();
    console.log(`🤖 Telegram bot ishga tushdi: @${me.username}`);

    await this.api.setMyCommands([
      { command: 'kun', description: "Bugungi holat va ball" },
      { command: 'ovqat', description: 'Taom kiritish (ovoz yoki matn)' },
      { command: 'suv', description: "Suv qo'shish" },
      { command: 'premium', description: 'Bepul Premium olish' },
      { command: 'yordam', description: 'Qanday ishlataman?' },
    ]);

    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
  }

  private async loop() {
    while (this.running) {
      try {
        const updates = await this.api.getUpdates(this.offset);
        for (const u of updates) {
          this.offset = u.update_id + 1;
          this.handle(u).catch((e) =>
            console.error('bot handle error:', e?.message || e)
          );
        }
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (!/timeout|aborted|AbortError/i.test(msg)) {
          console.error('bot poll error:', msg);
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  private async handle(u: { message?: TgMessage; callback_query?: TgCallback }) {
    if (u.callback_query) return this.onCallback(u.callback_query);
    if (u.message) return this.onMessage(u.message);
  }

  // ─────────────────────────── xabarlar ───────────────────────────
  private async onMessage(msg: TgMessage) {
    const tgId = msg.from?.id;
    const chatId = msg.chat.id;
    if (!tgId || msg.chat.type !== 'private') return;

    const text = (msg.text || msg.caption || '').trim();

    if (text.startsWith('/start')) {
      const payload = text.split(/\s+/)[1];
      return this.cmdStart(tgId, chatId, msg.from?.first_name, payload);
    }

    const userId = Telegram.userIdFor(tgId);
    if (!userId) {
      if (/^[A-Za-z0-9]{6}$/.test(text)) return this.tryLink(tgId, chatId, text);
      return this.askToLink(chatId);
    }

    // Doimiy klaviatura tugmalari
    if (text === '🍽 Ovqat kiritish' || text === '/ovqat') {
      this.awaitingFood.add(tgId);
      return this.promptFood(chatId);
    }
    if (text === '💧 Suv' || text === '/suv') return this.promptWater(chatId);
    if (text === '📊 Bugun' || text === '/kun' || text === '/ball') {
      return this.cmdToday(userId, chatId);
    }
    if (text === '🎯 Nima qilay?') return this.cmdWhatNow(userId, chatId);
    if (text === '⭐️ Premium' || text === '/premium') {
      return this.cmdPremium(userId, tgId, chatId);
    }
    if (text.startsWith('/admin')) return this.cmdAdmin(tgId, chatId, text);
    if (this.awaitingIg.has(tgId) && !text.startsWith('/')) {
      return this.saveIg(userId, tgId, chatId, text);
    }
    if (text === '/yordam') return this.cmdHelp(chatId);
    if (text === '/uzish') return this.cmdUnlink(tgId, chatId);

    if (msg.voice || msg.audio) return this.onVoice(userId, chatId, msg);
    if (msg.photo?.length) return this.onPhoto(userId, chatId, msg);
    if (text && !text.startsWith('/')) return this.onFoodText(userId, chatId, text);

    if (text.startsWith('/')) {
      return void this.api.sendMessage(
        chatId,
        "Bunday buyruq yo'q. Pastdagi tugmalardan foydalaning yoki /yordam.",
        { replyKeyboard: MAIN_KEYBOARD }
      );
    }
  }

  // ─────────────────────────── ulanish ───────────────────────────
  private async cmdStart(
    tgId: number,
    chatId: number,
    name?: string,
    payload?: string
  ) {
    const existing = Telegram.userIdFor(tgId);

    // Ilovadan "obuna" tugmasi bosilib kelingan: /start=premium.
    // ⚠️ Bu tekshiruv "hisob ulangan" shartidan OLDIN turishi shart —
    // aks holda ulangan foydalanuvchi oddiy salomlashuvga tushib qolardi
    // va obuna oqimini o'zi qidirishga majbur bo'lardi.
    if (payload === 'premium') {
      if (existing) return this.cmdPremium(existing, tgId, chatId);
      await this.api.sendMessage(
        chatId,
        "Obuna uchun avval hisobingizni ulash kerak.\n\n" +
          "Ilovada: Profil → Integratsiyalar → Telegram, va u yerdagi " +
          "6 xonali kodni menga yuboring.",
        { replyKeyboard: MAIN_KEYBOARD }
      );
      return;
    }

    if (existing) {
      await this.api.sendMessage(
        chatId,
        `${greeting(new Date().getHours(), name || '')}! Hisobingiz ulangan ✅`,
        { replyKeyboard: MAIN_KEYBOARD }
      );
      return this.cmdToday(existing, chatId);
    }

    if (payload && /^[A-Za-z0-9]{6}$/.test(payload)) {
      return this.tryLink(tgId, chatId, payload);
    }

    await this.api.sendMessage(
      chatId,
      `<b>UNUM</b> — sog'liq yordamchingiz 🌱\n\n` +
        `${greeting(new Date().getHours(), name || '')}!\n\n` +
        `Bu bot ilovangiz bilan <b>bitta hisobda</b> ishlaydi. Bu yerda ovoz ` +
        `bilan tez kiritasiz, ilovada to'liq tahlilni ko'rasiz.\n\n` +
        `<b>Ulanish — 3 qadam:</b>\n` +
        `1️⃣ UNUM ilovasini oching\n` +
        `2️⃣ <b>Profil → Telegram botga ulash</b>\n` +
        `3️⃣ Chiqqan <b>6 xonali kodni</b> shu yerga yuboring\n\n` +
        `<i>Parolingiz hech qachon Telegramga yuborilmaydi.</i>`
    );
  }

  private async tryLink(tgId: number, chatId: number, code: string) {
    const userId = Telegram.consumeCode(code);
    if (!userId) {
      return void this.api.sendMessage(
        chatId,
        "❌ Kod noto'g'ri yoki muddati tugagan.\n\n" +
          '<b>Nima qilish kerak:</b> ilovada <b>Profil → Telegram botga ulash</b> ' +
          'bo\'limini qayta oching va yangi kod oling (kod 10 daqiqa amal qiladi).'
      );
    }
    Telegram.link(tgId, userId);

    await this.api.sendMessage(
      chatId,
      '✅ <b>Ulandi!</b>\n\n' +
        'Endi eng tez usulni sinab ko\'ring: mikrofonni bosib ayting —\n' +
        '<i>«Tushlikka 35 minga bir porsiya osh yedim»</i>\n\n' +
        'Men kaloriya, oqsil, shakar, tuz va narxni o\'zim hisoblayman.',
      { replyKeyboard: MAIN_KEYBOARD }
    );
    return this.cmdToday(userId, chatId);
  }

  private askToLink(chatId: number) {
    return this.api.sendMessage(
      chatId,
      'Avval hisobingizni ulang — /start bosing.'
    );
  }

  private async cmdUnlink(tgId: number, chatId: number) {
    Telegram.unlink(tgId);
    await this.api.sendMessage(
      chatId,
      "Hisob uzildi. Qayta ulanish uchun /start.\n\n" +
        "Ma'lumotlaringiz saqlanib qoldi — ilovada joyida turibdi."
    );
  }

  // ─────────────────────────── taom ───────────────────────────
  private promptFood(chatId: number) {
    return this.api.sendMessage(
      chatId,
      '🎙 <b>Ovozli xabar yuboring</b> — eng tez usul.\n\n' +
        'Yoki yozing. Masalan:\n' +
        '• <i>«Tushlikka 35 minga bir porsiya osh yedim»</i>\n' +
        '• <i>«2 ta somsa va bir piyola choy»</i>\n' +
        '• <i>«200 g tovuq, guruch va cho\'pon salat»</i>\n\n' +
        '<i>Narxni aytsangiz — xarajat ham avtomatik yoziladi.</i>'
    );
  }

  private async onVoice(userId: number, chatId: number, msg: TgMessage) {
    const file = msg.voice || msg.audio;
    if (!file) return;

    if (file.duration > 120) {
      return void this.api.sendMessage(
        chatId,
        "Ovozli xabar juda uzun (2 daqiqadan ko'p).\n" +
          'Qisqaroq ayting — faqat nima yeganingizni.'
      );
    }

    await this.api.sendChatAction(chatId, 'typing');
    const status = await this.api.sendMessage(chatId, '🎙 Tinglayapman…');

    try {
      const buf = await this.api.downloadFile(file.file_id);
      const { text } = await this.backend.post<{ text: string }>(
        userId,
        '/api/gemini/transcribe',
        { audioBase64: buf.toString('base64'), mimeType: file.mime_type }
      );

      if (!text || text.trim().length < 3) {
        return void this.api.editMessage(
          chatId,
          status.message_id,
          "🤔 Ovozni aniq tushunolmadim.\n\n" +
            '<b>Maslahat:</b> shovqinsiz joyda, sekinroq ayting. ' +
            'Yoki shunchaki matn bilan yozing.'
        );
      }

      await this.api.editMessage(
        chatId,
        status.message_id,
        `🎙 <i>«${esc(text)}»</i>\n\n⏳ Tahlil qilinmoqda…`
      );
      await this.analyzeAndAsk(userId, chatId, status.message_id, text);
    } catch (e: any) {
      await this.api.editMessage(
        chatId,
        status.message_id,
        this.errorCard(e)
      );
    }
  }

  /**
   * Rasm orqali kiritish: tarelka, suv shishasi, energetik banka.
   *
   * Telegram bir rasmni bir nechta o'lchamda yuboradi; oxirgisi eng kattasi.
   * Vision uchun eng katta variantni olamiz, lekin serverdagi 4 MB cheklovi
   * bor — undan oshsa bir pog'ona kichigiga tushamiz.
   */
  private async onPhoto(userId: number, chatId: number, msg: TgMessage) {
    const sizes = msg.photo || [];
    const MAX_BYTES = 4_000_000;
    const pick =
      [...sizes].reverse().find((p) => (p.file_size ?? 0) <= MAX_BYTES) ||
      sizes[0];
    if (!pick) return;

    await this.api.sendChatAction(chatId, 'typing');
    const status = await this.api.sendMessage(chatId, '📸 Rasmni ko\'ryapman…');

    try {
      const buf = await this.api.downloadFile(pick.file_id);
      const parsed = await this.backend.post<any>(
        userId,
        '/api/gemini/analyze-photo',
        { imageBase64: buf.toString('base64') }
      );

      const hasContent =
        Number(parsed?.calories) > 0 || Number(parsed?.waterMl) > 0;
      if (!parsed?.name || !hasContent) {
        return void this.api.editMessage(
          chatId,
          status.message_id,
          "🤔 Rasmdan aniqlab bo'lmadi.\n\n" +
            "<b>Maslahat:</b> yorug'roq joyda, tepadan suratga oling. " +
            'Yoki matn bilan yozing.'
        );
      }

      // Rasm izohi (caption) bo'lsa — foydalanuvchi qo'shimcha aytgan
      // ("yarim ichdim"), uni kartochkada ko'rsatamiz.
      const raw = msg.caption?.trim() || 'rasm';
      const type = guessMealType(new Date().getHours());
      this.pending.set(chatId, { parsed, type, raw });
      await this.api.editMessage(
        chatId,
        status.message_id,
        this.mealCard(parsed, type, raw),
        this.confirmKeyboard(type)
      );
    } catch (e: any) {
      await this.api.editMessage(chatId, status.message_id, this.errorCard(e));
    }
  }

  private async onFoodText(userId: number, chatId: number, text: string) {
    this.awaitingFood.delete(userId);
    await this.api.sendChatAction(chatId, 'typing');
    const status = await this.api.sendMessage(chatId, '⏳ Tahlil qilinmoqda…');
    try {
      await this.analyzeAndAsk(userId, chatId, status.message_id, text);
    } catch (e: any) {
      await this.api.editMessage(chatId, status.message_id, this.errorCard(e));
    }
  }

  private async analyzeAndAsk(
    userId: number,
    chatId: number,
    messageId: number,
    text: string
  ) {
    const type = guessMealType(new Date().getHours());
    const parsed = await this.backend.post<any>(userId, '/api/gemini/parse-meal', {
      text,
      type,
    });

    // Kaloriya 0 bo'lishi mumkin va bu XATO EMAS — sof suv, choy, qahva.
    // Shuning uchun tekshiruv "kaloriya YOKI suv bor" degan shartda.
    const hasContent = Number(parsed?.calories) > 0 || Number(parsed?.waterMl) > 0;
    if (!parsed?.name || !hasContent) {
      return void this.api.editMessage(
        chatId,
        messageId,
        "🤔 Aniqlab bo'lmadi.\n\n" +
          '<b>Aniqroq ayting:</b> nima yedingiz yoki ichdingiz va qancha.\n' +
          "<i>Masalan: «bir kosa osh», «yarim litr suv ichdim»</i>"
      );
    }

    this.pending.set(chatId, { parsed, type, raw: text });
    await this.api.editMessage(
      chatId,
      messageId,
      this.mealCard(parsed, type, text),
      this.confirmKeyboard(type)
    );
  }

  private mealCard(p: any, type: string, raw: string): string {
    const water = Number(p.waterMl) || 0;
    const drinkOnly = water > 0 && Number(p.calories) < 25;

    const L: string[] = [];
    L.push(
      drinkOnly
        ? `💧 <b>${esc(p.name)}</b>`
        : `🍽 <b>${esc(p.name)}</b>  ·  ${MEAL_TYPES[type]}`
    );
    L.push(`<i>«${esc(raw)}»</i>`);
    L.push('');
    if (drinkOnly) {
      // Suv uchun makro qatorining ma'nosi yo'q — hammasi nol.
      L.push(`<b>${water} ml</b> suyuqlik`);
    } else {
      L.push(`<b>${Math.round(p.calories)} kkal</b>`);
      L.push(
        `oqsil <b>${Math.round(p.protein)}</b>g · uglevod ${Math.round(p.carbs)}g · yog' ${Math.round(p.fat)}g`
      );
      if (water > 0) L.push(`💧 ${water} ml suyuqlik`);
    }

    const flags: string[] = [];
    if (Number(p.sugar) >= 25) flags.push(`🍬 shakar ${Math.round(p.sugar)}g — ko'p`);
    else if (Number(p.sugar) > 0) flags.push(`🍬 shakar ${Math.round(p.sugar)}g`);
    if (Number(p.sodium) >= 1000) flags.push(`🧂 tuz yuqori (${Math.round(p.sodium)}mg)`);
    if (Number(p.vegServings) > 0) {
      flags.push(`🥗 sabzavot ${Number(p.vegServings).toFixed(1)} porsiya`);
    }
    if (Number(p.novaScore) >= 4) flags.push('⚠️ ultra-qayta ishlangan');
    if (flags.length) {
      L.push('');
      L.push(flags.join('\n'));
    }

    if (Number(p.cost) > 0) {
      L.push('');
      L.push(`💰 <b>${som(p.cost)}</b>`);
    }
    if (p.analysis) {
      L.push('');
      L.push(`💡 <i>${esc(p.analysis)}</i>`);
    }
    L.push('');
    L.push('<i>To\'g\'rimi? Tasdiqlang — shundan keyin saqlanadi.</i>');
    return L.join('\n');
  }

  private confirmKeyboard(current: string): Keyboard {
    const others = Object.keys(MEAL_TYPES).filter((t) => t !== current);
    const rows: Keyboard = [[{ text: '✅ Saqlash', callback_data: 'save' }]];
    for (let i = 0; i < others.length; i += 2) {
      rows.push(
        others.slice(i, i + 2).map((t) => ({
          text: `→ ${MEAL_TYPES[t]}`,
          callback_data: `type:${t}`,
        }))
      );
    }
    rows.push([{ text: '❌ Bekor', callback_data: 'cancel' }]);
    return rows;
  }

  // ─────────────────────────── suv ───────────────────────────
  private promptWater(chatId: number) {
    return this.api.sendMessage(chatId, '💧 <b>Qancha suv ichdingiz?</b>', {
      keyboard: [
        WATER_STEPS.map((ml) => ({ text: `${ml} ml`, callback_data: `water:${ml}` })),
        [{ text: '1 litr', callback_data: 'water:1000' }],
      ],
    });
  }

  private async addWater(
    userId: number,
    chatId: number,
    messageId: number,
    ml: number
  ) {
    try {
      await this.backend.post(userId, '/api/data/water', {
        timestamp: new Date().toISOString(),
        amountMl: ml,
      });
      const s = await this.backend.get<any>(userId, '/api/summary/today');
      const target = s.profile.targetWaterMl || 2500;
      const now = s.totals.water;
      const done = now >= target;

      await this.api.editMessage(
        chatId,
        messageId,
        `💧 <b>+${ml} ml qo'shildi</b>\n\n` +
          `${bar(now, target)}  ${now} / ${target} ml\n\n` +
          (done
            ? '✅ Kunlik me\'yor bajarildi!'
            : `Yana <b>${Math.max(0, target - now)} ml</b> qoldi.`),
        done
          ? undefined
          : [WATER_STEPS.map((v) => ({ text: `+${v} ml`, callback_data: `water:${v}` }))]
      );
    } catch (e: any) {
      await this.api.editMessage(chatId, messageId, this.errorCard(e));
    }
  }

  // ─────────────────────────── tugmalar ───────────────────────────
  private async onCallback(cb: TgCallback) {
    const tgId = cb.from.id;
    const chatId = cb.message?.chat.id;
    const messageId = cb.message?.message_id;
    if (!chatId || !messageId) return;

    const userId = Telegram.userIdFor(tgId);
    const data = cb.data || '';

    if (!userId) {
      return void this.api.answerCallback(cb.id, 'Avval hisobni ulang: /start', true);
    }

    if (data === 'today') {
      await this.api.answerCallback(cb.id);
      return this.cmdToday(userId, chatId);
    }
    if (data === 'whatnow') {
      await this.api.answerCallback(cb.id);
      return this.cmdWhatNow(userId, chatId);
    }
    if (data === 'promo:check') {
      await this.api.answerCallback(cb.id, 'Tekshirilmoqda…');
      return this.promoCheck(userId, tgId, chatId, messageId);
    }
    if (data === 'promo:open') {
      const chan = this.channel.replace(/^@/, '');
      await this.api.answerCallback(cb.id);
      return void this.api.sendMessage(
        chatId,
        `📢 Kanal: https://t.me/${chan}` +
          (this.instagram ? `\n📸 Instagram: ${this.instagram}` : '') +
          '\n\nObuna bo\'lgach, "✅ Obuna bo\'ldim" tugmasini bosing.',
        { noPreview: false }
      );
    }
    if (data.startsWith('water:')) {
      const ml = Number(data.slice(6)) || 0;
      await this.api.answerCallback(cb.id, `+${ml} ml`);
      return this.addWater(userId, chatId, messageId, ml);
    }

    const pending = this.pending.get(chatId);

    if (data === 'cancel') {
      this.pending.delete(chatId);
      await this.api.answerCallback(cb.id, 'Bekor qilindi');
      return void this.api.editMessage(
        chatId,
        messageId,
        '❌ Bekor qilindi. Qaytadan aytib ko\'ring.'
      );
    }

    if (data.startsWith('type:')) {
      if (!pending) {
        return void this.api.answerCallback(cb.id, 'Muddati tugagan — qaytadan yuboring', true);
      }
      pending.type = data.slice(5);
      this.pending.set(chatId, pending);
      await this.api.answerCallback(cb.id, MEAL_TYPES[pending.type]);
      return void this.api.editMessage(
        chatId,
        messageId,
        this.mealCard(pending.parsed, pending.type, pending.raw),
        this.confirmKeyboard(pending.type)
      );
    }

    if (data === 'save') {
      if (!pending) {
        return void this.api.answerCallback(cb.id, 'Muddati tugagan — qaytadan yuboring', true);
      }
      await this.api.answerCallback(cb.id, 'Saqlanmoqda…');
      this.pending.delete(chatId);
      return this.saveMeal(userId, chatId, messageId, pending);
    }
  }

  private async saveMeal(
    userId: number,
    chatId: number,
    messageId: number,
    p: Pending
  ) {
    const m = p.parsed;
    const water = Number(m.waterMl) || 0;
    // Sof suv/choyda kaloriya yo'q — uni "ovqat" qatoriga yozsak, kunlik
    // ro'yxat 0 kkal yozuvlar bilan to'lib ketadi. Bunday holda faqat suv
    // hisoblanadi. Energetik yoki sharbatda esa ikkalasi ham yoziladi.
    const drinkOnly = water > 0 && Number(m.calories) < 25;
    try {
      if (!drinkOnly) {
        await this.backend.post(userId, '/api/data/meals', {
          name: m.name,
          type: p.type,
          timestamp: new Date().toISOString(),
          components: m.components || [],
          calories: Number(m.calories) || 0,
          protein: Number(m.protein) || 0,
          carbs: Number(m.carbs) || 0,
          fat: Number(m.fat) || 0,
          sugar: Number(m.sugar) || 0,
          fiber: Number(m.fiber) || 0,
          sodium: Number(m.sodium) || 0,
          vegServings: Number(m.vegServings) || 0,
          nova: Number(m.novaScore) || 1,
          cost: Number(m.cost) || 0,
          analysis: m.analysis || null,
        });
      }

      if (water > 0) {
        await this.backend.post(userId, '/api/data/water', {
          timestamp: new Date().toISOString(),
          amountMl: water,
        });
      }

      if (Number(m.cost) > 0) {
        await this.backend.post(userId, '/api/data/expenses', {
          date: new Date().toISOString().split('T')[0],
          amount: Number(m.cost),
          category: 'meal_cost',
          description: `${m.name} (Telegram)`,
        });
      }

      const parts: string[] = [];
      if (!drinkOnly) parts.push(`${Math.round(m.calories)} kkal`);
      if (water > 0) parts.push(`💧 ${water} ml`);
      if (Number(m.cost) > 0) parts.push(som(m.cost));

      await this.api.editMessage(
        chatId,
        messageId,
        `✅ <b>${esc(m.name)}</b> saqlandi\n` + parts.join(' · ')
      );
      await this.cmdToday(userId, chatId);
    } catch (e: any) {
      await this.api.editMessage(chatId, messageId, this.errorCard(e));
    }
  }

  // ─────────────────────────── bugungi holat ───────────────────────────
  private async cmdToday(userId: number, chatId: number) {
    try {
      const s = await this.backend.get<any>(userId, '/api/summary/today');
      const t = s.totals;
      const sc = s.score;
      const hour = new Date().getHours();
      const head = scoreHeadline(sc.total, hour, sc.hasData);

      if (!sc.hasData) {
        return void this.api.sendMessage(
          chatId,
          `${greeting(hour, s.profile.name)}!\n\n` +
            `${head.emoji} <b>${head.title}</b>\n${head.note}\n\n` +
            (streakLine(s.profile.streak) || ''),
          { replyKeyboard: MAIN_KEYBOARD }
        );
      }

      const L: string[] = [];
      L.push(`${head.emoji} <b>${head.title}</b> · ${sc.total}/100`);
      L.push(bar(sc.total, 100, 12));
      L.push(`<i>${head.note}</i>`);
      L.push('');

      // Ko'rsatkichlar — faqat muhimlari, tartib bilan.
      L.push(`🔥 Kaloriya   ${bar(t.calories, s.profile.targetCalories, 8)} ${t.calories}/${s.profile.targetCalories}`);
      L.push(`🥚 Oqsil      ${bar(t.protein, s.profile.targetProtein, 8)} ${t.protein}/${s.profile.targetProtein} g`);
      L.push(`🥗 Sabzavot   ${bar(t.vegServings, 5, 8)} ${t.vegServings}/5`);
      L.push(`💧 Suv        ${bar(t.water, s.profile.targetWaterMl, 8)} ${t.water}/${s.profile.targetWaterMl} ml`);

      const extras: string[] = [];
      if (t.sugar > 25) extras.push(`🍬 Shakar ${t.sugar} g — me'yordan ${t.sugar - 25} g ortiq`);
      if (t.sodium > 2000) extras.push(`🧂 Tuz yuqori (${t.sodium} mg)`);
      if (t.cost > 0) extras.push(`💰 Bugungi xarajat ${som(t.cost)}`);
      if (extras.length) {
        L.push('');
        L.push(extras.join('\n'));
      }

      const streak = streakLine(s.profile.streak);
      if (streak) {
        L.push('');
        L.push(`${streak}  ·  🍽 ${t.meals} ta taom`);
      }

      const step = nextStep(sc.weakest?.id, phaseOf(hour));
      if (step) {
        L.push('');
        L.push(`👉 <b>Keyingi qadam:</b> ${step}`);
      }

      await this.api.sendMessage(chatId, L.join('\n'), {
        keyboard: [
          [
            { text: '🍽 Ovqat', callback_data: 'whatnow' },
            { text: '💧 Suv', callback_data: 'water:300' },
          ],
          [{ text: '🔄 Yangilash', callback_data: 'today' }],
        ],
      });
    } catch (e: any) {
      await this.api.sendMessage(chatId, this.errorCard(e), {
        replyKeyboard: MAIN_KEYBOARD,
      });
    }
  }

  /** "Nima qilay?" — bitta aniq, bajariladigan javob. */
  private async cmdWhatNow(userId: number, chatId: number) {
    try {
      const s = await this.backend.get<any>(userId, '/api/summary/today');
      const sc = s.score;
      const hour = new Date().getHours();
      const phase = phaseOf(hour);

      if (!sc.hasData) {
        return void this.api.sendMessage(
          chatId,
          '👉 <b>Birinchi qadam:</b> bugun nima yeganingizni ayting.\n\n' +
            '🎙 Mikrofonni bosib: <i>«Nonushtaga 2 ta tuxum va non yedim»</i>',
          { replyKeyboard: MAIN_KEYBOARD }
        );
      }

      const step = nextStep(sc.weakest?.id, phase);
      const gain = sc.weakest ? Math.round(sc.weakest.max - sc.weakest.earned) : 0;
      const projected = projectedScore(sc.total, dayProgress(hour));

      const L = [
        `🎯 <b>Hozir eng foydalisi</b>`,
        '',
        step || 'Hammasi joyida — shu ruhda davom eting! 🎉',
      ];
      if (sc.weakest && gain > 0) {
        L.push('');
        L.push(`Bu <b>${sc.weakest.label}</b> bo'limi — hozir ${sc.weakest.detail}.`);
        L.push(`To'liq bajarsangiz ballga <b>+${gain}</b> qo'shiladi.`);
      }
      if (phase !== 'evening' && phase !== 'night') {
        L.push('');
        L.push(`<i>Shu sur'atda kun oxirida ~${projected} ball.</i>`);
      }

      await this.api.sendMessage(chatId, L.join('\n'), {
        keyboard: [
          [
            { text: '💧 +300 ml', callback_data: 'water:300' },
            { text: '📊 Bugun', callback_data: 'today' },
          ],
        ],
      });
    } catch (e: any) {
      await this.api.sendMessage(chatId, this.errorCard(e));
    }
  }

  // ═══════════════════════ BEPUL PREMIUM (dastlabki N kishi) ═══════════════════════

  /// Obuna sharti bilan bepul Premium.
  ///
  /// Telegram a'zoligi HAQIQATAN tekshiriladi (bot kanalda admin bo'lsa).
  /// Instagram'ni texnik jihatdan tekshirib bo'lmaydi — Instagram bunday
  /// so'rovga API bermaydi. Shuning uchun undan foydalanuvchi nomi so'raladi
  /// va keyinchalik qo'lda tekshirish mumkin. Buni foydalanuvchidan
  /// yashirmaymiz.
  private async cmdPremium(userId: number, tgId: number, chatId: number) {
    // Pullik obuna olganlar ham shu yerga tushadi — avval haqiqiy holatni
    // tekshiramiz, aksiya matnini keyin ko'rsatamiz.
    if (isPremiumActive(userId)) {
      const until = Profiles.get(userId)?.premiumUntil;
      const claimed = Promo.claimOf(userId);
      const line = until
        ? `Amal qiladi: <b>${new Date(until).toLocaleDateString('uz-UZ', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}</b> gacha`
        : 'Muddatsiz';
      return void this.api.sendMessage(
        chatId,
        `⭐️ <b>Premium faol!</b>\n\n${line}\n\n` +
          (claimed ? `Siz aksiyada <b>${claimed.slot}-o'rinda</b> qo'lga kiritgansiz.\n\n` : '') +
          `Cheksiz AI tahlil, to'liq xavf radari va butun statistika tarixi ochiq.`,
        { replyKeyboard: MAIN_KEYBOARD }
      );
    }

    const claim = Promo.claimOf(userId);
    if (claim) {
      return void this.api.sendMessage(
        chatId,
        `⭐️ <b>Premium sizda faol!</b>\n\n` +
          `Siz <b>${claim.slot}-o'rinda</b> qo'lga kiritgansiz.\n` +
          `Cheksiz AI tahlil, to'liq xavf radari va butun statistika tarixi ochiq.\n\n` +
          `Rahmat — sizdek dastlabki foydalanuvchilar loyihani olg'a suryapti. 🙏`,
        { replyKeyboard: MAIN_KEYBOARD }
      );
    }

    const taken = Promo.taken();
    const left = this.promoLimit - taken;
    if (left <= 0) {
      return this.offerPaidPlans(userId, chatId);
    }

    if (!this.channel) {
      return void this.api.sendMessage(
        chatId,
        '⭐️ Bepul Premium aksiyasi hali sozlanmoqda. Tez orada e\'lon qilamiz.'
      );
    }

    const chan = this.channel.replace(/^@/, '');
    const lines = [
      `⭐️ <b>Dastlabki ${this.promoLimit} kishiga Premium — BEPUL</b>`,
      '',
      `Qolgan joy: <b>${left}</b> ta`,
      '',
      'Nima ochiladi:',
      '• Cheksiz rasm orqali AI tahlil',
      '• Cheksiz AI kouch savollari',
      "• To'liq xavf radari va haftalik hisobot",
      '• Cheksiz statistika tarixi',
      '',
      '<b>Sharti — ikkalasiga obuna:</b>',
      `1️⃣ Telegram kanal: @${chan}`,
    ];
    if (this.instagram) lines.push(`2️⃣ Instagram: ${this.instagram}`);
    lines.push('', 'Obuna bo\'lgach, pastdagi tugmani bosing.');

    const kb: Keyboard = [
      [{ text: '📢 Kanalga o\'tish', callback_data: 'promo:open' }],
      [{ text: '✅ Obuna bo\'ldim — tekshirish', callback_data: 'promo:check' }],
    ];

    await this.api.sendMessage(chatId, lines.join('\n'), { keyboard: kb });
  }

  /**
   * Pullik rejalarni Click havolalari bilan ko'rsatadi.
   *
   * Har bosishda YANGI buyurtma ochiladi (`startCheckout`), chunki bitta
   * havolani ikki marta ishlatib bo'lmaydi — Click uni `merchant_trans_id`
   * bo'yicha bir martalik deb hisoblaydi.
   */
  private async offerPaidPlans(userId: number, chatId: number) {
    const kb: Keyboard = [];
    for (const plan of PLANS) {
      const checkout = startCheckout(userId, plan.id);
      if (!checkout) break;
      kb.push([
        {
          text: `${plan.title} — ${plan.amount.toLocaleString('ru-RU')} so'm`,
          url: checkout.payUrl,
        },
      ]);
    }

    if (kb.length === 0) {
      return void this.api.sendMessage(
        chatId,
        "⭐️ Obuna hozircha ulanmoqda. Tez orada e'lon qilamiz."
      );
    }

    await this.api.sendMessage(
      chatId,
      `⭐️ <b>UNUM Premium</b>\n\n` +
        `Bepul aksiya o'rinlari tugadi, lekin obuna ochiq.\n\n` +
        `Nima ochiladi:\n` +
        `• Cheksiz rasm va ovoz orqali AI tahlil\n` +
        `• Cheksiz AI kouch savollari\n` +
        `• To'liq xavf radari va haftalik hisobot\n` +
        `• Cheksiz statistika tarixi\n\n` +
        `To'lov <b>Click</b> orqali. Obuna avtomatik uzaytirilmaydi.`,
      { keyboard: kb }
    );
  }

  private async promoCheck(userId: number, tgId: number, chatId: number, messageId: number) {
    if (Promo.claimOf(userId)) {
      return void this.api.editMessage(chatId, messageId,
        '⭐️ Premium allaqachon sizda faol.');
    }
    if (Promo.taken() >= this.promoLimit) {
      return void this.api.editMessage(chatId, messageId,
        '⭐️ Afsuski, bepul o\'rinlar hozirgina tugadi.');
    }

    const status = await this.api.isChannelMember(this.channel, tgId);

    if (status === 'no') {
      const chan = this.channel.replace(/^@/, '');
      return void this.api.editMessage(
        chatId,
        messageId,
        `❌ <b>Kanalga obuna topilmadi.</b>\n\n` +
          `@${chan} ga obuna bo'ling va yana "tekshirish" tugmasini bosing.\n\n` +
          `<i>Agar hozirgina obuna bo'lgan bo'lsangiz, bir necha soniya kuting.</i>`,
        [
          [{ text: '📢 Kanalga o\'tish', callback_data: 'promo:open' }],
          [{ text: '🔄 Qayta tekshirish', callback_data: 'promo:check' }],
        ]
      );
    }

    if (status === 'unknown') {
      // Konfiguratsiya muammosi — foydalanuvchi aybdor emas, uni jazolamaymiz.
      console.error('promo: kanal a\'zoligini tekshirib bo\'lmadi — bot kanalda adminmi?');
      return void this.api.editMessage(
        chatId,
        messageId,
        '⚠️ Hozir tekshirib bo\'lmadi — texnik nosozlik.\n\n' +
          'Bir necha daqiqadan keyin qayta urinib ko\'ring, biz tuzatamiz.',
        [[{ text: '🔄 Qayta urinish', callback_data: 'promo:check' }]]
      );
    }

    // Telegram tasdiqlandi. Instagram uchun nom so'raymiz (ixtiyoriy qadam).
    if (this.instagram) {
      this.awaitingIg.add(tgId);
      return void this.api.editMessage(
        chatId,
        messageId,
        '✅ <b>Telegram obunasi tasdiqlandi!</b>\n\n' +
          `Endi Instagram'da ham obuna bo'ling: ${this.instagram}\n\n` +
          'So\'ng <b>Instagram foydalanuvchi nomingizni</b> yuboring ' +
          '(masalan: <code>@abdunodir</code>).'
      );
    }
    return this.grantPremium(userId, tgId, chatId, undefined, messageId);
  }

  private async saveIg(userId: number, tgId: number, chatId: number, text: string) {
    const ig = text.trim().replace(/^@/, '').slice(0, 40);
    if (!/^[A-Za-z0-9._]{2,40}$/.test(ig)) {
      return void this.api.sendMessage(
        chatId,
        "Instagram nomi noto'g'ri ko'rinyapti. Faqat nomini yuboring — " +
          'masalan <code>abdunodir</code>.'
      );
    }
    this.awaitingIg.delete(tgId);
    return this.grantPremium(userId, tgId, chatId, ig);
  }

  private async grantPremium(
    userId: number,
    tgId: number,
    chatId: number,
    ig?: string,
    editMessageId?: number
  ) {
    const slot = Promo.grant(userId, tgId, this.promoLimit, ig);
    if (slot == null) {
      const msg = Promo.claimOf(userId)
        ? '⭐️ Premium allaqachon sizda faol.'
        : '⭐️ Afsuski, bepul o\'rinlar hozirgina tugadi.';
      return void (editMessageId
        ? this.api.editMessage(chatId, editMessageId, msg)
        : this.api.sendMessage(chatId, msg));
    }

    const text =
      `🎉 <b>Tabriklaymiz! Premium ochildi.</b>\n\n` +
      `Siz <b>${slot}-o'rinda</b> — dastlabki ${this.promoLimit} kishidan birisiz.\n\n` +
      `Endi sizda:\n` +
      `• Cheksiz rasm orqali AI tahlil\n` +
      `• Cheksiz AI kouch\n` +
      `• To'liq xavf radari\n` +
      `• Cheksiz statistika tarixi\n\n` +
      `<i>Ilovani qayta oching — Premium belgisi paydo bo'ladi.</i>`;

    if (editMessageId) {
      await this.api.editMessage(chatId, editMessageId, text);
    } else {
      await this.api.sendMessage(chatId, text, { replyKeyboard: MAIN_KEYBOARD });
    }

    if (this.adminId) {
      this.api
        .sendMessage(
          this.adminId,
          `⭐️ Yangi Premium: #${slot} · tg:${tgId}` +
            (ig ? ` · ig:@${esc(ig)}` : '') +
            `\nQolgan joy: ${this.promoLimit - Promo.taken()}`
        )
        .catch(() => {});
    }
  }

  // ─────────────────────────── admin ───────────────────────────
  private async cmdAdmin(tgId: number, chatId: number, text: string) {
    if (!this.adminId || tgId !== this.adminId) {
      return void this.api.sendMessage(chatId, "Bunday buyruq yo'q.");
    }

    const parts = text.split(/\s+/);
    const sub = parts[1] || 'stats';

    if (sub === 'stats') {
      const taken = Promo.taken();
      const recent = Promo.recent(8);
      const L = [
        '🛠 <b>Admin panel</b>',
        '',
        `⭐️ Premium berilgan: <b>${taken}</b> / ${this.promoLimit}`,
        `Qolgan joy: <b>${this.promoLimit - taken}</b>`,
        `📢 Kanal: ${this.channel || '(sozlanmagan)'}`,
        `📸 Instagram: ${this.instagram || '(sozlanmagan)'}`,
        '',
        '<b>So\'nggi olganlar:</b>',
      ];
      if (recent.length === 0) {
        L.push('<i>hali yo\'q</i>');
      } else {
        for (const c of recent) {
          L.push(
            `#${c.slot} · tg:${c.telegram_id}` +
              (c.ig_username ? ` · ig:@${esc(c.ig_username)}` : '') +
              ` · ${c.claimed_at.slice(0, 10)}`
          );
        }
      }
      L.push('', '<code>/admin grant &lt;telegram_id&gt;</code> — qo\'lda berish');
      return void this.api.sendMessage(chatId, L.join('\n'));
    }

    if (sub === 'grant') {
      const target = Number(parts[2]);
      if (!target) {
        return void this.api.sendMessage(chatId, 'Foydalanish: /admin grant 123456789');
      }
      const uid = Telegram.userIdFor(target);
      if (!uid) {
        return void this.api.sendMessage(
          chatId, `tg:${target} hech qanday hisobga ulanmagan.`);
      }
      const slot = Promo.grant(uid, target, this.promoLimit, 'admin');
      return void this.api.sendMessage(
        chatId,
        slot == null
          ? 'Berib bo\'lmadi — allaqachon bor yoki joy tugagan.'
          : `✅ Berildi: #${slot} (tg:${target})`
      );
    }

    return void this.api.sendMessage(
      chatId, 'Buyruqlar: <code>/admin stats</code>, <code>/admin grant &lt;id&gt;</code>');
  }

  private cmdHelp(chatId: number) {
    return this.api.sendMessage(
      chatId,
      `<b>UNUM bot</b>\n\n` +
        `🎙 <b>Ovoz</b> — eng tez. Mikrofonni bosib ayting:\n` +
        `<i>«Tushlikka 35 minga bir porsiya osh yedim»</i>\n\n` +
        `✍️ <b>Matn</b> — shunchaki yozing:\n<i>«2 ta somsa va choy»</i>\n\n` +
        `Men aniqlayman: kaloriya, oqsil, shakar, tuz, sabzavot va narx. ` +
        `Siz tasdiqlaysiz — shundan keyingina saqlanadi.\n\n` +
        `<b>Pastdagi tugmalar</b>\n` +
        `🍽 Ovqat · 💧 Suv · 📊 Bugun · 🎯 Nima qilay?\n\n` +
        `<b>Buyruqlar</b>\n/kun /ovqat /suv /uzish\n\n` +
        `<i>UNUM tibbiy tashxis qo'ymaydi.</i>`,
      { replyKeyboard: MAIN_KEYBOARD }
    );
  }

  /** Xato — har doim keyingi qadam bilan. */
  private errorCard(e: any): string {
    const raw = String(e?.message || e || '');
    if (/limit|tugadi/i.test(raw)) {
      return (
        `⏳ <b>Bugungi bepul AI so'rovlari tugadi.</b>\n\n` +
        `Ertaga yangilanadi. Shu vaqtgacha suv va mashg'ulotni kiritishingiz mumkin — ` +
        `ular limitga kirmaydi.`
      );
    }
    if (/ulan|network|fetch|timeout/i.test(raw)) {
      return `📡 <b>Serverga ulanib bo'lmadi.</b>\n\nBir daqiqadan keyin qayta urinib ko'ring.`;
    }
    const short = raw.length > 140 ? raw.slice(0, 140) + '…' : raw;
    return `❌ ${esc(short)}\n\n<i>Qayta urinib ko'ring yoki boshqacha aytib ko'ring.</i>`;
  }
}
