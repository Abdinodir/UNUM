/**
 * Google va Apple orqali kirish + tashqi integratsiyalar (Google Fit, Calendar).
 *
 * Ikki xil oqim qo'llab-quvvatlanadi:
 *
 *   1. WEB (brauzer) — authorization code flow:
 *        GET  /api/auth/oauth/google           → Google'ga yo'naltiradi
 *        GET  /api/auth/oauth/google/callback  → sessiyani httpOnly cookie'ga yozadi
 *      Token JS'ga KO'RINMAYDI, shuning uchun XSS uni o'g'irlay olmaydi.
 *
 *   2. MOBIL (Flutter) — native SDK id_token beradi:
 *        POST /api/auth/oauth/google/token  { idToken }  → JWT qaytaradi
 *      Telefonda token Keychain / EncryptedSharedPreferences'da turadi.
 *
 * Mijoz yuborgan profil ma'lumotiga HECH QACHON ishonilmaydi — ism va email
 * faqat serverda tekshirilgan `id_token` ichidan olinadi.
 */
import crypto from 'crypto';
import type { Request, Response } from 'express';
import type { JWTPayload } from 'jose';
import { Integrations, Users, type UserRow } from './db';
import { SESSION_COOKIE } from './auth';
import { seedUser } from './seed';

/* ------------------------------------------------------------------ */
/* Konfiguratsiya                                                      */
/* ------------------------------------------------------------------ */

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/**
 * `jose` — ESM-only paket, backend esa CJS bundle. Statik import
 * `ERR_REQUIRE_ESM` beradi, shuning uchun dinamik import bilan bir marta
 * yuklab, keshlab qo'yamiz (esbuild dinamik import()ni o'zgartirmaydi).
 */
let josePromise: Promise<typeof import('jose')> | null = null;
function jose(): Promise<typeof import('jose')> {
  josePromise ??= import('jose');
  return josePromise;
}

/** JWKS to'plamlari kalitlarni keshlaydi, shuning uchun bir marta yaratiladi */
const jwksCache = new Map<string, Awaited<ReturnType<typeof makeJwks>>>();
async function makeJwks(url: string) {
  const { createRemoteJWKSet } = await jose();
  return createRemoteJWKSet(new URL(url));
}
async function jwks(url: string) {
  const hit = jwksCache.get(url);
  if (hit) return hit;
  const created = await makeJwks(url);
  jwksCache.set(url, created);
  return created;
}

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

/** Ilova qaysi public manzilda turadi — redirect URI shundan yasaladi */
function appUrl(): string {
  return (process.env.APP_PUBLIC_URL || '').replace(/\/+$/, '');
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && appUrl());
}

/** Apple Developer a'zoligi tasdiqlanmaguncha o'chiq turadi */
export function appleConfigured(): boolean {
  return Boolean(
    process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY &&
      appUrl()
  );
}

const REDIRECT = {
  login: () => `${appUrl()}/api/auth/oauth/google/callback`,
  integration: () => `${appUrl()}/api/integrations/google/callback`,
  apple: () => `${appUrl()}/api/auth/oauth/apple/callback`,
};

/* ------------------------------------------------------------------ */
/* CSRF himoyasi: state + nonce                                        */
/* ------------------------------------------------------------------ */

interface PendingAuth {
  nonce: string;
  /** Integratsiya oqimida kim ulayotgani */
  userId?: number;
  /** Qaysi oqim: kirish yoki integratsiya */
  kind: 'login' | 'integration';
  provider: string;
  createdAt: number;
}

/**
 * `state` qiymatlari xotirada, 10 daqiqa yashaydi.
 * Bitta jarayon ishlaydi (systemd `unum.service`), shuning uchun Map yetarli.
 * Ko'p jarayonga o'tilsa bu Redis'ga ko'chirilishi kerak.
 */
const pending = new Map<string, PendingAuth>();
const STATE_TTL_MS = 10 * 60 * 1000;

function newState(entry: Omit<PendingAuth, 'createdAt' | 'nonce'>): { state: string; nonce: string } {
  // Eskirganlarini tozalab turamiz — cheksiz o'smasin
  const now = Date.now();
  for (const [k, v] of pending) {
    if (now - v.createdAt > STATE_TTL_MS) pending.delete(k);
  }

  const state = crypto.randomBytes(24).toString('base64url');
  const nonce = crypto.randomBytes(16).toString('base64url');
  pending.set(state, { ...entry, nonce, createdAt: now });
  return { state, nonce };
}

function takeState(state: string): PendingAuth | null {
  const entry = pending.get(state);
  if (!entry) return null;
  pending.delete(state); // bir marta ishlatiladi
  if (Date.now() - entry.createdAt > STATE_TTL_MS) return null;
  return entry;
}

/* ------------------------------------------------------------------ */
/* Token shifrlash (integratsiyalar uchun)                             */
/* ------------------------------------------------------------------ */

function encKey(): Buffer {
  const raw = process.env.TOKEN_ENC_KEY || '';
  if (raw.length < 64) {
    throw new Error(
      'TOKEN_ENC_KEY 32 baytlik hex bo\'lishi kerak. Yarating: openssl rand -hex 32'
    );
  }
  return Buffer.from(raw.slice(0, 64), 'hex');
}

/** AES-256-GCM. Natija: iv.tag.ciphertext (hammasi base64url) */
export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
}

export function decryptToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encKey(),
    Buffer.from(ivB64, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/* ------------------------------------------------------------------ */
/* id_token tekshirish                                                 */
/* ------------------------------------------------------------------ */

interface IdTokenClaims extends JWTPayload {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
}

/**
 * Google `id_token` ni tekshiradi.
 *
 * `audience` ro'yxati: web klient + (kelajakda) Android/iOS klient ID'lari.
 * Mobil SDK o'z klient ID'si bilan token beradi, shuning uchun bir nechta
 * `aud` qabul qilinadi — lekin faqat BIZGA tegishli bo'lganlari.
 */
async function verifyGoogleIdToken(idToken: string): Promise<IdTokenClaims> {
  const audiences = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
  ].filter(Boolean) as string[];

  if (!audiences.length) throw new Error('GOOGLE_CLIENT_ID sozlanmagan');

  const { jwtVerify } = await jose();
  const { payload } = await jwtVerify(idToken, await jwks(GOOGLE_JWKS_URL), {
    issuer: GOOGLE_ISSUERS,
    audience: audiences,
    clockTolerance: 60,
  });
  return payload as IdTokenClaims;
}

async function verifyAppleIdToken(idToken: string): Promise<IdTokenClaims> {
  const audiences = [process.env.APPLE_CLIENT_ID, process.env.APPLE_BUNDLE_ID].filter(
    Boolean
  ) as string[];
  if (!audiences.length) throw new Error('APPLE_CLIENT_ID sozlanmagan');

  const { jwtVerify } = await jose();
  const { payload } = await jwtVerify(idToken, await jwks(APPLE_JWKS_URL), {
    issuer: 'https://appleid.apple.com',
    audience: audiences,
    clockTolerance: 60,
  });
  return payload as IdTokenClaims;
}

/* ------------------------------------------------------------------ */
/* Hisobni topish yoki yaratish                                        */
/* ------------------------------------------------------------------ */

function isVerified(claims: IdTokenClaims): boolean {
  // Google `boolean`, Apple `"true"` string qaytaradi
  return claims.email_verified === true || claims.email_verified === 'true';
}

/**
 * Hisobni provayder `sub` bo'yicha topadi; bo'lmasa email bo'yicha ulaydi;
 * u ham bo'lmasa yangi hisob ochadi.
 *
 * Email bo'yicha ulash FAQAT provayder emailni tasdiqlagan bo'lsa bajariladi —
 * aks holda tasdiqlanmagan email bilan begona hisobni egallash mumkin bo'lardi.
 */
function resolveUser(provider: 'google' | 'apple', claims: IdTokenClaims): UserRow {
  const sub = claims.sub;
  const bySub = provider === 'google' ? Users.byGoogleSub(sub) : Users.byAppleSub(sub);
  if (bySub) return bySub;

  const email = String(claims.email || '').trim().toLowerCase();
  const displayName = String(claims.name || claims.given_name || '').trim();

  if (email && isVerified(claims)) {
    const existing = Users.byEmail(email);
    if (existing) {
      if (provider === 'google') Users.linkGoogle(existing.id, sub);
      else Users.linkApple(existing.id, sub);
      if (displayName && !existing.name) Users.setName(existing.id, displayName);
      return (provider === 'google' ? Users.byGoogleSub(sub) : Users.byAppleSub(sub))!;
    }
  }

  // Yangi hisob. Parol ishlatilmaydi — tasodifiy hash qo'yamiz, hech kim bilmaydi.
  // Apple private-relay emaili ham shu ko'rinishda saqlanadi.
  const fallbackEmail = email || `${provider}_${sub}@oauth.unum.local`;
  const randomHash = crypto.randomBytes(32).toString('hex');
  const name = displayName || 'Chempion';

  const userId = Users.create(fallbackEmail, randomHash, name);
  seedUser(userId, name);
  if (provider === 'google') Users.linkGoogle(userId, sub);
  else Users.linkApple(userId, sub);

  return (provider === 'google' ? Users.byGoogleSub(sub) : Users.byAppleSub(sub))!;
}

/* ------------------------------------------------------------------ */
/* Sessiya cookie'si (web)                                             */
/* ------------------------------------------------------------------ */

export { SESSION_COOKIE } from './auth';

/**
 * Sessiya tokeni httpOnly cookie'da. `SameSite=Lax` — OAuth qaytishi
 * (top-level GET navigatsiya) cookie'ni yuboradi, lekin uchinchi tomon
 * POST so'rovlari yubormaydi, ya'ni CSRF himoyalangan.
 */
export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
}

/* ------------------------------------------------------------------ */
/* Marshrutlar: kirish                                                 */
/* ------------------------------------------------------------------ */

/** Google'ga yo'naltirish (web oqimi) */
export function googleLoginStart(_req: Request, res: Response) {
  if (!googleConfigured()) {
    return res.status(503).json({ error: 'Google kirish hali sozlanmagan' });
  }

  const { state, nonce } = newState({ kind: 'login', provider: 'google' });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set('redirect_uri', REDIRECT.login());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('prompt', 'select_account');

  res.redirect(url.toString());
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}

async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  return (await res.json()) as TokenResponse;
}

/**
 * Google'dan qaytish. Muvaffaqiyatda sessiya cookie'si qo'yiladi va
 * foydalanuvchi ilovaga qaytariladi.
 */
export function googleLoginCallback(signToken: (userId: number) => string) {
  return async (req: Request, res: Response) => {
    const backToApp = (params = '') => res.redirect(`${appUrl()}/app/${params}`);

    try {
      const { code, state, error } = req.query as Record<string, string | undefined>;
      if (error) return backToApp('?auth=cancelled');
      if (!code || !state) return backToApp('?auth=failed');

      const entry = takeState(state);
      if (!entry || entry.kind !== 'login' || entry.provider !== 'google') {
        return backToApp('?auth=failed');
      }

      const tokens = await exchangeCode(code, REDIRECT.login());
      if (!tokens.id_token) return backToApp('?auth=failed');

      const claims = await verifyGoogleIdToken(tokens.id_token);
      // Replay himoyasi: id_token ichidagi nonce biz yuborganiga teng bo'lishi shart
      if (claims.nonce !== entry.nonce) return backToApp('?auth=failed');

      const user = resolveUser('google', claims);
      setSessionCookie(res, signToken(user.id));
      return backToApp('?auth=ok');
    } catch (err) {
      console.error('googleLoginCallback error:', err);
      return backToApp('?auth=failed');
    }
  };
}

/* ------------------------------------------------------------------ */
/* Apple bilan kirish (web oqimi)                                      */
/* ------------------------------------------------------------------ */

/**
 * Apple `client_secret` — bu doimiy satr EMAS, har safar yangidan
 * imzolanadigan ES256 JWT. `.p8` kaliti bilan imzolanadi va eng ko'pi bilan
 * 6 oy yashaydi; biz 30 daqiqalik qisqa muddat qo'yamiz — u faqat token
 * almashish paytida kerak.
 */
async function appleClientSecret(): Promise<string> {
  const { SignJWT, importPKCS8 } = await jose();

  // `.env` da yangi qator `\n` sifatida yozilgan bo'lishi mumkin
  const pem = (process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const key = await importPKCS8(pem, 'ES256');

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: process.env.APPLE_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setAudience('https://appleid.apple.com')
    .setSubject(process.env.APPLE_CLIENT_ID!) // Services ID
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(key);
}

/** Apple'ga yo'naltirish */
export function appleLoginStart(_req: Request, res: Response) {
  if (!appleConfigured()) {
    return res.status(503).json({ error: 'Apple kirish hali sozlanmagan' });
  }

  const { state, nonce } = newState({ kind: 'login', provider: 'apple' });
  const url = new URL('https://appleid.apple.com/auth/authorize');
  url.searchParams.set('client_id', process.env.APPLE_CLIENT_ID!);
  url.searchParams.set('redirect_uri', REDIRECT.apple());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'name email');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  // `scope` so'ralganda Apple MAJBURAN form_post talab qiladi —
  // ya'ni qaytish GET emas, POST bo'ladi.
  url.searchParams.set('response_mode', 'form_post');

  res.redirect(url.toString());
}

/**
 * Apple'dan qaytish. Diqqat: bu POST (form_post) va foydalanuvchi ismi
 * FAQAT BIRINCHI ruxsatda keladi — keyingi kirishlarda bo'lmaydi, shuning
 * uchun uni o'sha zahoti saqlab qolamiz.
 */
export function appleLoginCallback(signToken: (userId: number) => string) {
  return async (req: Request, res: Response) => {
    const backToApp = (params = '') => res.redirect(`${appUrl()}/app/${params}`);

    try {
      const { code, state, error, user } = (req.body || {}) as Record<string, string>;
      if (error) return backToApp('?auth=cancelled');
      if (!code || !state) return backToApp('?auth=failed');

      const entry = takeState(state);
      if (!entry || entry.kind !== 'login' || entry.provider !== 'apple') {
        return backToApp('?auth=failed');
      }

      const body = new URLSearchParams({
        code,
        client_id: process.env.APPLE_CLIENT_ID!,
        client_secret: await appleClientSecret(),
        redirect_uri: REDIRECT.apple(),
        grant_type: 'authorization_code',
      });

      const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      const tokens = (await tokenRes.json()) as TokenResponse;
      if (!tokens.id_token) return backToApp('?auth=failed');

      const claims = await verifyAppleIdToken(tokens.id_token);
      if (claims.nonce !== entry.nonce) return backToApp('?auth=failed');

      // Ism faqat birinchi marta keladi — id_token ichida yo'q
      if (user) {
        try {
          const parsed = JSON.parse(user) as { name?: { firstName?: string; lastName?: string } };
          const full = [parsed.name?.firstName, parsed.name?.lastName]
            .filter(Boolean)
            .join(' ')
            .trim();
          if (full) claims.name = full;
        } catch {
          /* noto'g'ri JSON — ismsiz davom etamiz */
        }
      }

      const account = resolveUser('apple', claims);
      setSessionCookie(res, signToken(account.id));
      return backToApp('?auth=ok');
    } catch (err) {
      console.error('appleLoginCallback error:', err);
      return backToApp('?auth=failed');
    }
  };
}

/** Mobil oqim: native SDK bergan id_token → bizning JWT */
export function oauthTokenLogin(signToken: (userId: number) => string) {
  return async (req: Request, res: Response) => {
    try {
      const provider = String(req.params.provider || '');
      const idToken = String(req.body?.idToken || '');
      if (!idToken) return res.status(400).json({ error: 'idToken yuborilmadi' });

      let claims: IdTokenClaims;
      if (provider === 'google') {
        if (!process.env.GOOGLE_CLIENT_ID) {
          return res.status(503).json({ error: 'Google kirish hali sozlanmagan' });
        }
        claims = await verifyGoogleIdToken(idToken);
      } else if (provider === 'apple') {
        if (!appleConfigured()) {
          return res.status(503).json({ error: 'Apple kirish hali sozlanmagan' });
        }
        claims = await verifyAppleIdToken(idToken);
      } else {
        return res.status(404).json({ error: 'Notanish provayder' });
      }

      const user = resolveUser(provider as 'google' | 'apple', claims);
      return res.json({
        token: signToken(user.id),
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (err) {
      // Tafsilot faqat serverda — mijozga qaysi tekshiruv yiqilganini aytmaymiz
      console.error('oauthTokenLogin error:', err);
      return res.status(401).json({ error: "Kirish tasdiqlanmadi" });
    }
  };
}

/* ------------------------------------------------------------------ */
/* Marshrutlar: integratsiyalar (Google Fit / Calendar)                */
/* ------------------------------------------------------------------ */

/**
 * Eng tor scope'lar — faqat O'QISH. Yozish huquqi hech qachon so'ralmaydi.
 *
 * Google Fit ATAYLAB yo'q: Google Fit API'lariga yangi ro'yxatdan o'tish
 * 2024-yil 1-maydan beri yopiq va API'lar 2026-yil oxirida butunlay o'chadi.
 * Qadam/uyqu ma'lumoti Android'da Health Connect orqali olinadi (native qatlam).
 */
const INTEGRATION_SCOPES: Record<string, string> = {
  google_calendar: 'https://www.googleapis.com/auth/calendar.readonly',
};

export function integrationStart(req: Request & { userId?: number }, res: Response) {
  if (!googleConfigured()) {
    return res.status(503).json({ error: 'Google integratsiyasi hali sozlanmagan' });
  }

  const provider = String(req.params.provider || '');
  const scope = INTEGRATION_SCOPES[provider];
  if (!scope) return res.status(404).json({ error: 'Notanish integratsiya' });

  const { state } = newState({ kind: 'integration', provider, userId: req.userId });

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set('redirect_uri', REDIRECT.integration());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'offline'); // refresh_token kerak
  url.searchParams.set('prompt', 'consent');

  // Mijoz bu manzilni yangi oynada ochadi
  res.json({ url: url.toString() });
}

export async function integrationCallback(req: Request, res: Response) {
  const backToApp = (params: string) => res.redirect(`${appUrl()}/app/${params}`);

  try {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    if (error) return backToApp('?integration=cancelled');
    if (!code || !state) return backToApp('?integration=failed');

    const entry = takeState(state);
    if (!entry || entry.kind !== 'integration' || !entry.userId) {
      return backToApp('?integration=failed');
    }

    const tokens = await exchangeCode(code, REDIRECT.integration());
    if (!tokens.access_token) return backToApp('?integration=failed');

    Integrations.upsert({
      user_id: entry.userId,
      provider: entry.provider,
      access_token: encryptToken(tokens.access_token),
      refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      scope: tokens.scope || INTEGRATION_SCOPES[entry.provider] || '',
      expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
    });

    return backToApp(`?integration=${encodeURIComponent(entry.provider)}`);
  } catch (err) {
    console.error('integrationCallback error:', err);
    return backToApp('?integration=failed');
  }
}

export function integrationList(req: Request & { userId?: number }, res: Response) {
  // Tokenlar QAYTARILMAYDI — faqat ulanish holati
  res.json({ connected: Integrations.list(req.userId!) });
}

/**
 * Ulanishni uzish. Tokenni bazadan o'chirish YETARLI EMAS —
 * uni Google tomonida ham bekor qilamiz, aks holda ruxsat kuchda qoladi.
 */
export async function integrationDisconnect(req: Request & { userId?: number }, res: Response) {
  const provider = String(req.params.provider || '');
  const row = Integrations.get(req.userId!, provider);

  if (row) {
    try {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: decryptToken(row.refresh_token || row.access_token),
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      // Google javob bermasa ham lokal yozuvni o'chiramiz
      console.warn('revoke failed:', err);
    }
    Integrations.remove(req.userId!, provider);
  }

  res.json({ ok: true });
}
