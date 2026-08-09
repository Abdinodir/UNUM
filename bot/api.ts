/**
 * Telegram Bot API bilan ishlash — minimal qatlam.
 *
 * Kutubxona ishlatilmadi: bizga kerak bo'lgani atigi bir nechta metod, va
 * `fetch` Node 20 da o'rnatilgan. Bu bog'liqlikni va uning yangilanishlarini
 * kuzatib yurish zaruratini yo'q qiladi.
 */

const API = 'https://api.telegram.org';

export interface TgUser {
  id: number;
  first_name?: string;
  username?: string;
}

export interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string };
  date: number;
  text?: string;
  voice?: { file_id: string; duration: number; mime_type?: string; file_size?: number };
  audio?: { file_id: string; duration: number; mime_type?: string; file_size?: number };
  photo?: { file_id: string; file_size?: number; width: number; height: number }[];
  caption?: string;
}

export interface TgCallback {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallback;
}

/**
 * Inline tugma: yo botga signal yuboradi (`callback_data`), yo tashqi
 * manzilni ochadi (`url`) — Telegram ikkalasini bir tugmada qabul qilmaydi.
 * To'lov havolasi aynan `url` bo'lishi shart.
 */
export type Keyboard = ({ text: string; callback_data: string } | { text: string; url: string })[][];

/** Chat ostida doimiy turadigan tugmalar. */
export type ReplyKeyboard = string[][];

export class TelegramApi {
  constructor(private token: string) {}

  private async call<T = any>(method: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API}/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const json: any = await res.json();
    if (!json.ok) {
      throw new Error(`Telegram ${method}: ${json.description || res.status}`);
    }
    return json.result as T;
  }

  getMe() {
    return this.call<{ id: number; username: string; first_name: string }>('getMe');
  }

  /**
   * Long polling. `timeout` soniya ichida yangilik bo'lmasa bo'sh ro'yxat
   * qaytadi — bu Telegram tomonidan tavsiya etilgan usul va webhook uchun
   * public HTTPS sertifikat talab qilmaydi.
   */
  async getUpdates(offset: number, timeout = 30): Promise<TgUpdate[]> {
    const res = await fetch(`${API}/bot${this.token}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offset,
        timeout,
        allowed_updates: ['message', 'callback_query'],
      }),
      // Telegram `timeout` soniya ushlab turadi — undan biroz ko'proq kutamiz.
      signal: AbortSignal.timeout((timeout + 15) * 1000),
    });
    const json: any = await res.json();
    if (!json.ok) throw new Error(`getUpdates: ${json.description}`);
    return json.result as TgUpdate[];
  }

  sendMessage(
    chatId: number,
    text: string,
    opts: {
      keyboard?: Keyboard;
      replyKeyboard?: ReplyKeyboard;
      replyTo?: number;
      noPreview?: boolean;
    } = {}
  ) {
    let markup: unknown;
    if (opts.keyboard) {
      markup = { inline_keyboard: opts.keyboard };
    } else if (opts.replyKeyboard) {
      markup = {
        keyboard: opts.replyKeyboard.map((row) => row.map((text) => ({ text }))),
        resize_keyboard: true,
        is_persistent: true,
      };
    }
    return this.call<TgMessage>('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: opts.noPreview !== false },
      reply_to_message_id: opts.replyTo,
      reply_markup: markup,
    });
  }

  editMessage(chatId: number, messageId: number, text: string, keyboard?: Keyboard) {
    return this.call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
    }).catch(() => {
      // "message is not modified" — zararsiz, e'tiborsiz qoldiramiz.
    });
  }

  answerCallback(id: string, text?: string, alert = false) {
    return this.call('answerCallbackQuery', {
      callback_query_id: id,
      text,
      show_alert: alert,
    }).catch(() => {});
  }

  sendChatAction(chatId: number, action: 'typing' | 'upload_voice' | 'record_voice') {
    return this.call('sendChatAction', { chat_id: chatId, action }).catch(() => {});
  }

  setMyCommands(commands: { command: string; description: string }[]) {
    return this.call('setMyCommands', { commands }).catch(() => {});
  }

  /**
   * Foydalanuvchi kanalga a'zomi.
   *
   * Bot kanalda ADMIN bo'lishi shart — aks holda Telegram bu ma'lumotni
   * bermaydi va biz "tekshirib bo'lmadi" holatini qaytaramiz.
   */
  async isChannelMember(
    channel: string,
    userId: number
  ): Promise<'yes' | 'no' | 'unknown'> {
    try {
      const r = await this.call<{ status: string }>('getChatMember', {
        chat_id: channel.startsWith('@') ? channel : `@${channel}`,
        user_id: userId,
      });
      return ['creator', 'administrator', 'member', 'restricted'].includes(r.status)
        ? 'yes'
        : 'no';
    } catch (e: any) {
      const msg = String(e?.message || '');
      // "user not found" — a'zo emas; qolgani konfiguratsiya muammosi.
      if (/user not found|PARTICIPANT_ID_INVALID/i.test(msg)) return 'no';
      console.error('isChannelMember:', msg);
      return 'unknown';
    }
  }

  /** Fayl mazmunini yuklab oladi (ovozli xabar, rasm). */
  async downloadFile(fileId: string): Promise<Buffer> {
    const file = await this.call<{ file_path: string }>('getFile', { file_id: fileId });
    const res = await fetch(`${API}/file/bot${this.token}/${file.file_path}`);
    if (!res.ok) throw new Error(`Fayl yuklanmadi: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
