import Database from 'better-sqlite3';
import path from 'path';

// SQLite file lives next to the server (persists across restarts).
// server.ts imports 'dotenv/config' before this module, so DB_PATH is set.
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'unum.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT 'Chempion',
  created_at    TEXT NOT NULL
);

-- Telefon bilan kirish. SMS PUL turgani uchun bu jadval ayni paytda
-- suiiste'molga qarshi hisoblagich vazifasini ham bajaradi.
CREATE TABLE IF NOT EXISTS phone_otps (
  phone       TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  -- Noto'g'ri kod kiritish urinishlari: 6 xonali kodni brute-force qilishning
  -- oldini oladi.
  attempts    INTEGER NOT NULL DEFAULT 0,
  -- Oxirgi yuborilgan vaqt va shu kundagi yuborishlar soni.
  last_sent   INTEGER NOT NULL,
  sent_today  INTEGER NOT NULL DEFAULT 1,
  day         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id         TEXT NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, collection, id)
);

CREATE INDEX IF NOT EXISTS idx_items_user_col ON items (user_id, collection);

-- Telegram bot: bitta hisob ↔ bitta Telegram foydalanuvchisi.
CREATE TABLE IF NOT EXISTS telegram_links (
  telegram_id INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tg_user ON telegram_links (user_id);

-- Bir martalik ulanish kodlari (ilovada ko'rsatiladi, botga kiritiladi).
CREATE TABLE IF NOT EXISTS link_codes (
  code       TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

-- Dastlabki N foydalanuvchiga bepul Premium.
-- slot — nechanchi bo'lib olgani. UNIQUE bo'lgani uchun ikki kishi bir xil
-- raqamni ololmaydi va limitdan oshib ketmaydi.
CREATE TABLE IF NOT EXISTS promo_claims (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  telegram_id  INTEGER NOT NULL,
  slot         INTEGER NOT NULL UNIQUE,
  ig_username  TEXT,
  claimed_at   TEXT NOT NULL
);

-- To'lovlar (hozircha Click). Bitta qator = bitta buyurtma.
-- id ayni paytda Click'ga yuboriladigan merchant_trans_id — shuning uchun
-- u INTEGER va o'zgarmas. Click callback'lari aynan shu bo'yicha topadi.
--
-- Pul BUTUN SO'MDA saqlanadi. Click amount ni kasr bilan yuboradi
-- ("12000.00"), lekin bazada float saqlash taqqoslashda xatoga olib keladi.
CREATE TABLE IF NOT EXISTS payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT 'click',
  plan            TEXT NOT NULL,
  -- Reja qancha kunga premium beradi. Narx/reja keyin o'zgarsa ham, allaqachon
  -- to'langan buyurtma o'sha paytdagi shartlar bo'yicha hisoblanishi uchun
  -- qatorning o'zida saqlanadi.
  days            INTEGER NOT NULL,
  amount          INTEGER NOT NULL,
  -- created → prepared → paid. Bekor qilinganda: cancelled.
  state           TEXT NOT NULL DEFAULT 'created',
  click_trans_id  TEXT,
  click_paydoc_id TEXT,
  created_at      TEXT NOT NULL,
  prepared_at     TEXT,
  paid_at         TEXT,
  cancelled_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id, created_at DESC);

-- Bir Click tranzaksiyasi faqat bitta buyurtmaga tegishli bo'lishi mumkin.
-- Callback takror kelganda (Click qayta urinadi) ikkinchi yozuv paydo bo'lmaydi.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_click_trans
  ON payments (click_trans_id) WHERE click_trans_id IS NOT NULL;
`);

// Allowed collection names (per-user document collections)
export const COLLECTIONS = [
  'inventory',
  'food',
  'meals',
  'water',
  'body',
  'expenses',
  'activities',
  'achievements',
  'coach',
  // 4 ustun: ibodat (ballanmaydi), rivojlanish, uyqu
  'prayers',
  'focus',
  'sleep',
  // Kundalik — foydalanuvchining o'z matni. AI haftalik hisobotda
  // undan foydalanishi mumkin, lekin BALLGA ta'sir qilmaydi:
  // yozgan-yozmagani uchun odam baholanmasligi kerak.
  'journal',
] as const;

export type Collection = (typeof COLLECTIONS)[number];

export function isCollection(name: string): name is Collection {
  return (COLLECTIONS as readonly string[]).includes(name);
}

// Mavjud bazalarda `phone` ustuni bo'lmasligi mumkin — qo'shib qo'yamiz.
// SQLite da IF NOT EXISTS yo'q, shuning uchun xatoni yutamiz.
try {
  db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
} catch { /* ustun allaqachon bor */ }
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users (phone) WHERE phone IS NOT NULL');
} catch { /* indeks allaqachon bor */ }

// ---------- Google / Apple orqali kirish ----------
// `sub` — provayderdagi barqaror foydalanuvchi identifikatori. Email o'zgarishi
// mumkin, `sub` esa o'zgarmaydi, shuning uchun hisob aynan shunga bog'lanadi.
//
// `email_verified` MUHIM: bir xil email bilan mavjud hisobga ulanishga faqat
// provayder emailni tasdiqlagan bo'lsa ruxsat beramiz. Aks holda kimdir
// tasdiqlanmagan email bilan ro'yxatdan o'tib, boshqa odamning hisobini
// egallab olishi mumkin edi.
for (const sql of [
  'ALTER TABLE users ADD COLUMN google_sub TEXT',
  'ALTER TABLE users ADD COLUMN apple_sub TEXT',
  'ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0',
]) {
  try {
    db.exec(sql);
  } catch { /* ustun allaqachon bor */ }
}
for (const sql of [
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub) WHERE google_sub IS NOT NULL',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_sub ON users (apple_sub) WHERE apple_sub IS NOT NULL',
]) {
  try {
    db.exec(sql);
  } catch { /* indeks allaqachon bor */ }
}

// ---------- Tashqi integratsiyalar (Google Fit, Calendar) ----------
// Access/refresh tokenlar SHU YERDA, shifrlangan holda turadi va HECH QACHON
// mijozga yuborilmaydi. Shifrlash kaliti .env dagi TOKEN_ENC_KEY.
db.exec(`
  CREATE TABLE IF NOT EXISTS integrations (
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider      TEXT    NOT NULL,
    access_token  TEXT    NOT NULL,
    refresh_token TEXT,
    scope         TEXT    NOT NULL DEFAULT '',
    expires_at    TEXT,
    connected_at  TEXT    NOT NULL,
    PRIMARY KEY (user_id, provider)
  )
`);

// ---------- prepared statements ----------
const stmt = {
  insertUser: db.prepare(
    'INSERT INTO users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)'
  ),
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  userByGoogleSub: db.prepare('SELECT * FROM users WHERE google_sub = ?'),
  userByAppleSub: db.prepare('SELECT * FROM users WHERE apple_sub = ?'),
  linkGoogle: db.prepare('UPDATE users SET google_sub = ?, email_verified = 1 WHERE id = ?'),
  linkApple: db.prepare('UPDATE users SET apple_sub = ?, email_verified = 1 WHERE id = ?'),
  setName: db.prepare('UPDATE users SET name = ? WHERE id = ?'),

  getIntegration: db.prepare('SELECT * FROM integrations WHERE user_id = ? AND provider = ?'),
  listIntegrations: db.prepare('SELECT provider, scope, connected_at FROM integrations WHERE user_id = ?'),
  upsertIntegration: db.prepare(`
    INSERT INTO integrations (user_id, provider, access_token, refresh_token, scope, expires_at, connected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, provider) DO UPDATE SET
      access_token  = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, integrations.refresh_token),
      scope         = excluded.scope,
      expires_at    = excluded.expires_at
  `),
  deleteIntegration: db.prepare('DELETE FROM integrations WHERE user_id = ? AND provider = ?'),
  userById: db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?'),
  userByIdWithHash: db.prepare('SELECT * FROM users WHERE id = ?'),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
  setPasswordHash: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),

  getProfile: db.prepare('SELECT data FROM profiles WHERE user_id = ?'),
  upsertProfile: db.prepare(`
    INSERT INTO profiles (user_id, data) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data
  `),

  listItems: db.prepare(
    'SELECT id, data FROM items WHERE user_id = ? AND collection = ? ORDER BY sort_order ASC, created_at ASC'
  ),
  insertItem: db.prepare(
    'INSERT INTO items (id, user_id, collection, data, created_at, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  updateItem: db.prepare(
    'UPDATE items SET data = ? WHERE user_id = ? AND collection = ? AND id = ?'
  ),
  deleteItem: db.prepare(
    'DELETE FROM items WHERE user_id = ? AND collection = ? AND id = ?'
  ),
  maxSort: db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) AS m FROM items WHERE user_id = ? AND collection = ?'
  ),
  countItems: db.prepare(
    'SELECT COUNT(*) AS n FROM items WHERE user_id = ? AND collection = ?'
  ),
};

const tgStmt = {
  linkGet: db.prepare('SELECT user_id FROM telegram_links WHERE telegram_id = ?'),
  linkSet: db.prepare(`
    INSERT INTO telegram_links (telegram_id, user_id, linked_at) VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET user_id = excluded.user_id, linked_at = excluded.linked_at
  `),
  linkDel: db.prepare('DELETE FROM telegram_links WHERE telegram_id = ?'),
  linkByUser: db.prepare('SELECT telegram_id FROM telegram_links WHERE user_id = ?'),

  codeSet: db.prepare(`
    INSERT INTO link_codes (code, user_id, expires_at) VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET user_id = excluded.user_id, expires_at = excluded.expires_at
  `),
  codeGet: db.prepare('SELECT user_id, expires_at FROM link_codes WHERE code = ?'),
  codeDel: db.prepare('DELETE FROM link_codes WHERE code = ?'),
  codeDelByUser: db.prepare('DELETE FROM link_codes WHERE user_id = ?'),
  codePurge: db.prepare('DELETE FROM link_codes WHERE expires_at < ?'),
};

export const Telegram = {
  /** Telegram foydalanuvchisi qaysi hisobga ulangan. */
  userIdFor(telegramId: number): number | null {
    const row = tgStmt.linkGet.get(telegramId) as { user_id: number } | undefined;
    return row ? row.user_id : null;
  },
  link(telegramId: number, userId: number) {
    tgStmt.linkSet.run(telegramId, userId, new Date().toISOString());
    tgStmt.codeDelByUser.run(userId);
  },
  unlink(telegramId: number) {
    tgStmt.linkDel.run(telegramId);
  },
  telegramIdFor(userId: number): number | null {
    const row = tgStmt.linkByUser.get(userId) as { telegram_id: number } | undefined;
    return row ? row.telegram_id : null;
  },

  /**
   * Ilova ko'rsatadigan bir martalik kod. 10 daqiqada eskiradi va ishlatilgach
   * o'chiriladi — shuning uchun uni kimdir ko'rib qolsa ham foydasi bo'lmaydi.
   */
  createCode(userId: number): string {
    tgStmt.codePurge.run(Date.now());
    tgStmt.codeDelByUser.run(userId);
    // O'xshash belgilar (0/O, 1/I) chiqarib tashlangan — og'zaki aytish oson.
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    tgStmt.codeSet.run(code, userId, Date.now() + 10 * 60 * 1000);
    return code;
  },
  consumeCode(code: string): number | null {
    tgStmt.codePurge.run(Date.now());
    const row = tgStmt.codeGet.get(code.toUpperCase().trim()) as
      | { user_id: number; expires_at: number }
      | undefined;
    if (!row || row.expires_at < Date.now()) return null;
    tgStmt.codeDel.run(code.toUpperCase().trim());
    return row.user_id;
  },
};

const promoStmt = {
  count: db.prepare('SELECT COUNT(*) AS n FROM promo_claims'),
  byUser: db.prepare('SELECT * FROM promo_claims WHERE user_id = ?'),
  maxSlot: db.prepare('SELECT COALESCE(MAX(slot), 0) AS m FROM promo_claims'),
  insert: db.prepare(`
    INSERT INTO promo_claims (user_id, telegram_id, slot, ig_username, claimed_at)
    VALUES (?, ?, ?, ?, ?)
  `),
  list: db.prepare(
    'SELECT * FROM promo_claims ORDER BY slot DESC LIMIT ?'
  ),
};

export interface PromoClaim {
  user_id: number;
  telegram_id: number;
  slot: number;
  ig_username: string | null;
  claimed_at: string;
}

export const Promo = {
  taken(): number {
    return (promoStmt.count.get() as { n: number }).n;
  },
  claimOf(userId: number): PromoClaim | undefined {
    return promoStmt.byUser.get(userId) as PromoClaim | undefined;
  },
  recent(limit = 10): PromoClaim[] {
    return promoStmt.list.all(limit) as PromoClaim[];
  },

  /**
   * Bepul Premium beradi va nechanchi o'rin ekanini qaytaradi.
   *
   * Slot raqami UNIQUE va yozuv bitta tranzaksiyada qo'shiladi — shuning
   * uchun bir vaqtda kelgan ikki so'rov bir xil raqamni ololmaydi va
   * limitdan oshib ketmaydi.
   * `null` qaytsa — joylar tugagan yoki allaqachon olingan.
   */
  grant(userId: number, telegramId: number, limit: number, ig?: string): number | null {
    const tx = db.transaction((): number | null => {
      if (promoStmt.byUser.get(userId)) return null;
      const taken = (promoStmt.count.get() as { n: number }).n;
      if (taken >= limit) return null;
      const slot = (promoStmt.maxSlot.get() as { m: number }).m + 1;
      promoStmt.insert.run(
        userId, telegramId, slot, ig ?? null, new Date().toISOString()
      );
      // Premium faqat server tomonidan yoqiladi. Aksiya sharti — 1 yil.
      grantPremium(userId, 365);
      return slot;
    });
    return tx();
  },
};

// ---------- to'lovlar ----------
const payStmt = {
  insert: db.prepare(`
    INSERT INTO payments (user_id, provider, plan, days, amount, state, created_at)
    VALUES (?, 'click', ?, ?, ?, 'created', ?)
  `),
  byId: db.prepare('SELECT * FROM payments WHERE id = ?'),
  byClickTrans: db.prepare('SELECT * FROM payments WHERE click_trans_id = ?'),
  listByUser: db.prepare(
    'SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ),
  // Faqat 'created' holatidan 'prepared' ga o'tkazamiz. WHERE dagi state sharti
  // takroriy Prepare so'rovi holatni orqaga surib yuborishiga yo'l qo'ymaydi.
  prepare_: db.prepare(`
    UPDATE payments SET state = 'prepared', click_trans_id = ?, click_paydoc_id = ?,
           prepared_at = ?
     WHERE id = ? AND state IN ('created', 'prepared')
  `),
  complete: db.prepare(`
    UPDATE payments SET state = 'paid', paid_at = ?
     WHERE id = ? AND state = 'prepared'
  `),
  cancel: db.prepare(`
    UPDATE payments SET state = 'cancelled', cancelled_at = ?
     WHERE id = ? AND state != 'paid'
  `),
};

export interface PaymentRow {
  id: number;
  user_id: number;
  provider: string;
  plan: string;
  days: number;
  amount: number;
  state: 'created' | 'prepared' | 'paid' | 'cancelled';
  click_trans_id: string | null;
  click_paydoc_id: string | null;
  created_at: string;
  prepared_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
}

export const Payments = {
  create(userId: number, plan: string, days: number, amount: number): PaymentRow {
    const info = payStmt.insert.run(
      userId, plan, days, amount, new Date().toISOString()
    );
    return payStmt.byId.get(Number(info.lastInsertRowid)) as PaymentRow;
  },
  byId(id: number): PaymentRow | undefined {
    return payStmt.byId.get(id) as PaymentRow | undefined;
  },
  byClickTrans(clickTransId: string): PaymentRow | undefined {
    return payStmt.byClickTrans.get(clickTransId) as PaymentRow | undefined;
  },
  listByUser(userId: number, limit = 20): PaymentRow[] {
    return payStmt.listByUser.all(userId, limit) as PaymentRow[];
  },
  markPrepared(id: number, clickTransId: string, paydocId: string | null): boolean {
    const r = payStmt.prepare_.run(
      clickTransId, paydocId, new Date().toISOString(), id
    );
    return r.changes > 0;
  },
  /**
   * To'lovni yakunlaydi VA premiumni yoqadi — bitta tranzaksiyada.
   *
   * Ikkisi bo'linmasligi shart: pul o'tib, premium yoqilmay qolgan holat
   * foydalanuvchi uchun eng yomon natija. Shuningdek `state = 'prepared'`
   * sharti tufayli Click callback'ni ikki marta yuborsa premium ikki marta
   * uzaytirilmaydi — ikkinchi urinishda `changes = 0` bo'ladi.
   */
  markPaid(id: number): boolean {
    const tx = db.transaction((): boolean => {
      const row = payStmt.byId.get(id) as PaymentRow | undefined;
      if (!row) return false;
      if (payStmt.complete.run(new Date().toISOString(), id).changes === 0) return false;
      grantPremium(row.user_id, row.days);
      return true;
    });
    return tx();
  },
  cancel(id: number): boolean {
    return payStmt.cancel.run(new Date().toISOString(), id).changes > 0;
  },
};

/**
 * Premiumni `days` kunga uzaytiradi (profil ichida saqlanadi).
 *
 * Amaldagi obuna tugamagan bo'lsa — uning oxiridan davom etadi, ya'ni
 * muddatidan oldin to'lagan odam kun yo'qotmaydi.
 *
 * `premium` bayrog'i mijozga qulay bo'lgani uchun qoldirilgan, lekin
 * HAQIQAT MANBAI — `premiumUntil`. Tekshiruv uchun `isPremiumActive`.
 */
export function grantPremium(userId: number, days: number): string {
  const profile = Profiles.get(userId) || {};
  const now = Date.now();
  const current = Date.parse(profile.premiumUntil || '');
  const base = Number.isFinite(current) && current > now ? current : now;
  const until = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
  Profiles.set(userId, { ...profile, premium: true, premiumUntil: until });
  return until;
}

/**
 * Premium amal qiladimi.
 *
 * `premiumUntil` yo'q bo'lsa — bu shu maydon paydo bo'lishidan oldin promo
 * olgan hisob; ularning premiumi muddatsiz qoladi (orqaga qarab buzmaymiz).
 */
export function isPremiumActive(userId: number): boolean {
  const profile = Profiles.get(userId);
  if (!profile || profile.premium !== true) return false;
  if (!profile.premiumUntil) return true;
  const until = Date.parse(profile.premiumUntil);
  return !Number.isFinite(until) || until > Date.now();
}

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
  /** Telefon orqali kirganlarda to'ldiriladi; email hisoblarda null. */
  phone: string | null;
  /** Google `sub` — provayderdagi barqaror ID. Email o'zgarsa ham o'zgarmaydi. */
  google_sub: string | null;
  /** Apple `sub`. */
  apple_sub: string | null;
  /** Provayder emailni tasdiqlaganmi (0/1). Hisob birlashtirishda shart. */
  email_verified: number;
}

export interface IntegrationRow {
  user_id: number;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  scope: string;
  expires_at: string | null;
  connected_at: string;
}

export const Users = {
  create(email: string, passwordHash: string, name: string): number {
    const info = stmt.insertUser.run(email, passwordHash, name, new Date().toISOString());
    return Number(info.lastInsertRowid);
  },
  byEmail(email: string): UserRow | undefined {
    return stmt.userByEmail.get(email) as UserRow | undefined;
  },
  byId(id: number) {
    return stmt.userById.get(id) as { id: number; email: string; name: string; created_at: string } | undefined;
  },
  byIdWithHash(id: number): UserRow | undefined {
    return stmt.userByIdWithHash.get(id) as UserRow | undefined;
  },
  setPasswordHash(id: number, hash: string) {
    stmt.setPasswordHash.run(hash, id);
  },
  /** Hard delete. profiles/items rows go with it via ON DELETE CASCADE. */
  remove(id: number) {
    stmt.deleteUser.run(id);
  },

  byGoogleSub(sub: string): UserRow | undefined {
    return stmt.userByGoogleSub.get(sub) as UserRow | undefined;
  },
  byAppleSub(sub: string): UserRow | undefined {
    return stmt.userByAppleSub.get(sub) as UserRow | undefined;
  },
  linkGoogle(userId: number, sub: string) {
    stmt.linkGoogle.run(sub, userId);
  },
  linkApple(userId: number, sub: string) {
    stmt.linkApple.run(sub, userId);
  },
  setName(userId: number, name: string) {
    stmt.setName.run(name, userId);
  },
};

/**
 * Tashqi xizmat tokenlari (Google Fit, Calendar).
 * Tokenlar shifrlangan matn sifatida keladi va shu holda saqlanadi —
 * shifrlash/deshifrlash `oauth.ts` da bajariladi.
 */
export const Integrations = {
  get(userId: number, provider: string): IntegrationRow | undefined {
    return stmt.getIntegration.get(userId, provider) as IntegrationRow | undefined;
  },
  list(userId: number): { provider: string; scope: string; connected_at: string }[] {
    return stmt.listIntegrations.all(userId) as {
      provider: string;
      scope: string;
      connected_at: string;
    }[];
  },
  upsert(row: Omit<IntegrationRow, 'connected_at'> & { connected_at?: string }) {
    stmt.upsertIntegration.run(
      row.user_id,
      row.provider,
      row.access_token,
      row.refresh_token ?? null,
      row.scope,
      row.expires_at ?? null,
      row.connected_at ?? new Date().toISOString()
    );
  },
  remove(userId: number, provider: string) {
    stmt.deleteIntegration.run(userId, provider);
  },
};

export const Profiles = {
  get(userId: number): any | null {
    const row = stmt.getProfile.get(userId) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : null;
  },
  set(userId: number, data: any) {
    stmt.upsertProfile.run(userId, JSON.stringify(data));
  },
};

let counter = 0;
function genId(prefix: string) {
  counter = (counter + 1) % 100000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

export const Items = {
  count(userId: number, collection: string): number {
    return (stmt.countItems.get(userId, collection) as { n: number }).n;
  },
  list(userId: number, collection: string): any[] {
    const rows = stmt.listItems.all(userId, collection) as { id: string; data: string }[];
    return rows.map((r) => ({ ...JSON.parse(r.data), id: r.id }));
  },
  create(userId: number, collection: string, data: any): any {
    const id = (data && data.id) ? String(data.id) : genId(collection.slice(0, 3));
    const obj = { ...data, id };
    const max = (stmt.maxSort.get(userId, collection) as { m: number }).m;
    stmt.insertItem.run(id, userId, collection, JSON.stringify(obj), new Date().toISOString(), max + 1);
    return obj;
  },
  update(userId: number, collection: string, id: string, data: any): any {
    const obj = { ...data, id };
    stmt.updateItem.run(JSON.stringify(obj), userId, collection, id);
    return obj;
  },
  remove(userId: number, collection: string, id: string) {
    stmt.deleteItem.run(userId, collection, id);
  },
  bulkInsert(userId: number, collection: string, list: any[]) {
    const tx = db.transaction((rows: any[]) => {
      let i = 0;
      for (const data of rows) {
        const id = data.id ? String(data.id) : genId(collection.slice(0, 3));
        stmt.insertItem.run(id, userId, collection, JSON.stringify({ ...data, id }), new Date().toISOString(), ++i);
      }
    });
    tx(list);
  },
};
