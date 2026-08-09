import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Users } from './db';
import { seedUser } from './seed';

// The signing secret MUST come from the environment. A hard-coded fallback
// would let anyone who can read this repo mint tokens for any account, so in
// production we refuse to boot without it.
//
// Resolved lazily, not at module load: this module is imported by server.ts,
// and ES import evaluation runs *before* server.ts calls dotenv.config(), so
// reading process.env at the top level would never see the .env file.
// server.ts calls assertAuthConfig() right after loading the env instead, which
// keeps the fail-fast behaviour without the ordering trap.
let cachedSecret: string | null = null;

function jwtSecret(): string {
  if (cachedSecret) return cachedSecret;

  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET is missing or shorter than 32 characters. Set it in .env before starting in production.'
    );
  }
  console.warn('⚠️ JWT_SECRET is not set — using an ephemeral dev secret. Tokens reset on every restart.');
  cachedSecret = `dev-only-${crypto.randomBytes(24).toString('hex')}`;
  return cachedSecret;
}

/** Call once at boot, after dotenv.config(), so a bad config fails immediately. */
export function assertAuthConfig(): void {
  jwtSecret();
}

const TOKEN_TTL = '30d';

/** Web sessiyasi shu nomdagi httpOnly cookie'da (oauth.ts bilan bir xil bo'lishi shart) */
export const SESSION_COOKIE = 'unum_session';

export interface AuthedRequest extends Request {
  userId?: number;
}

function sign(userId: number): string {
  return jwt.sign({ uid: userId }, jwtSecret(), { expiresIn: TOKEN_TTL });
}

/**
 * Telegram bot uchun token. Bot foydalanuvchining parolini bilmaydi — u
 * `telegram_links` jadvali orqali kim ekanini biladi va shu asosda o'z
 * HTTP API'miz bilan gaplashadi. Shu tufayli bot ilova bilan bir xil
 * validatsiya, limit va normalizatsiyadan o'tadi.
 */
export function mintToken(userId: number): string {
  return sign(userId);
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function register(req: Request, res: Response) {
  try {
    let { email, password, name } = req.body || {};
    email = String(email || '').trim().toLowerCase();
    name = String(name || '').trim() || 'Chempion';

    if (!emailRe.test(email)) {
      return res.status(400).json({ error: "Email noto'g'ri formatda" });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: "Parol kamida 6 belgidan iborat bo'lishi kerak" });
    }
    if (Users.byEmail(email)) {
      return res.status(409).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
    }

    const hash = await bcrypt.hash(String(password), 10);
    const userId = Users.create(email, hash, name);
    seedUser(userId, name);

    return res.json({
      token: sign(userId),
      user: { id: userId, email, name },
    });
  } catch (err: any) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'Ro\'yxatdan o\'tishda xatolik' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    let { email, password } = req.body || {};
    email = String(email || '').trim().toLowerCase();

    const user = Users.byEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
    }
    const ok = await bcrypt.compare(String(password || ''), user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
    }
    return res.json({
      token: sign(user.id),
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err: any) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Kirishda xatolik' });
  }
}

/**
 * Permanently delete the signed-in account and every row that belongs to it.
 * Google Play requires an in-app account deletion path for apps with accounts.
 */
export async function deleteAccount(req: AuthedRequest, res: Response) {
  try {
    const user = Users.byIdWithHash(req.userId!);
    if (!user) return res.status(404).json({ error: 'Hisob topilmadi' });

    // Deleting health data is irreversible — require the password again.
    //
    // Telefon orqali ro'yxatdan o'tganlarning paroli tasodifiy yaratilgan va
    // ular uni bilmaydi. Ulardan parol so'rasak hisobni HECH QACHON o'chira
    // olmasdi — bu Google Play talabini buzadi. Bunday hisoblarda egalik
    // JWT bilan allaqachon isbotlangan (SMS kodi orqali olingan), shuning
    // uchun qo'shimcha parol so'ralmaydi.
    if (!user.phone) {
      const { password } = req.body || {};
      const ok = await bcrypt.compare(String(password || ''), user.password_hash);
      if (!ok) return res.status(401).json({ error: "Parol noto'g'ri" });
    }

    Users.remove(req.userId!);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('deleteAccount error:', err);
    return res.status(500).json({ error: "Hisobni o'chirishda xatolik" });
  }
}

export async function changePassword(req: AuthedRequest, res: Response) {
  try {
    const user = Users.byIdWithHash(req.userId!);
    if (!user) return res.status(404).json({ error: 'Hisob topilmadi' });

    const { currentPassword, newPassword } = req.body || {};
    const ok = await bcrypt.compare(String(currentPassword || ''), user.password_hash);
    if (!ok) return res.status(401).json({ error: "Joriy parol noto'g'ri" });
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: "Yangi parol kamida 6 belgidan iborat bo'lishi kerak" });
    }

    Users.setPasswordHash(req.userId!, await bcrypt.hash(String(newPassword), 10));
    return res.json({ ok: true, token: sign(req.userId!) });
  } catch (err: any) {
    console.error('changePassword error:', err);
    return res.status(500).json({ error: 'Parolni almashtirishda xatolik' });
  }
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  // Ikki manba: mobil ilova `Bearer` sarlavhasini yuboradi, web esa httpOnly
  // cookie'ni. Cookie'ni JS o'qiy olmaydi, shuning uchun XSS uni o'g'irlay
  // olmaydi — web uchun bu Bearer + localStorage'dan xavfsizroq.
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE] || '';

  if (!token) {
    return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
  }
  try {
    const payload = jwt.verify(token, jwtSecret()) as { uid: number };
    // Reject tokens whose user no longer exists (e.g. after a DB reset).
    if (!Users.byId(payload.uid)) {
      return res.status(401).json({ error: 'Hisob topilmadi, qayta kiring' });
    }
    req.userId = payload.uid;
    next();
  } catch {
    return res.status(401).json({ error: 'Sessiya muddati tugagan, qayta kiring' });
  }
}
