# UNUM web — xavfsizlik auditi

Sana: 2026-08-03 · Ko'rib chiqilgan kod: `unum/` (AI Studio varianti) + `../server.ts` (asosiy backend)

---

## 1. Topilgan muammolar va holati

| # | Muammo | Jiddiylik | Holat |
|---|--------|-----------|-------|
| 1 | Studio serverida **hech qanday autentifikatsiya yo'q** — `/api/gemini/*` ochiq edi, istalgan kishi Gemini kalitingiz hisobidan so'rov yubora olardi | 🔴 Yuqori | ✅ Tuzatildi |
| 2 | **Rate limit yo'q** — bir skript bilan AI hisobini bo'shatish mumkin edi | 🔴 Yuqori | ✅ Tuzatildi |
| 3 | Server `0.0.0.0:3000` da tinglardi — dev rejimida butun LAN'ga ochiq | 🟠 O'rta | ✅ Tuzatildi |
| 4 | **CSP, HSTS, X-Frame-Options va boshqa xavfsizlik sarlavhalari yo'q** — XSS va clickjacking uchun ochiq | 🟠 O'rta | ✅ Tuzatildi |
| 5 | **Prompt injection**: foydalanuvchi matni to'g'ridan-to'g'ri promptga qo'shilardi (`"${message}"`), tirnoqdan chiqib tizim ko'rsatmasini bekor qilish mumkin edi | 🟠 O'rta | ✅ Tuzatildi (AI qatlami olib tashlandi) |
| 6 | Ikkita alohida AI backend (Gemini bu yerda, OpenAI asosiy loyihada) — ikki xil limit, ikki xil kalit, ikki xil filtr | 🟠 O'rta | ✅ Tuzatildi |
| 7 | Barcha ma'lumot (profil, sog'liq yozuvlari, chat) `localStorage`'da **ochiq matnda** saqlanardi | 🟠 O'rta | ✅ Tuzatildi |
| 8 | Xato matnlari mijozga uzatilardi (`console.error` + stack) | 🟡 Past | ✅ Tuzatildi |
| 9 | Bundleda ishlatilmaydigan `recharts`, `canvas-confetti` — ortiqcha hujum yuzasi | 🟡 Past | ✅ Tuzatildi |
| 10 | Sessiya tokeni `localStorage`'da saqlanishi rejalashtirilgan edi (XSS bilan o'g'irlanadi) | 🔴 Yuqori | ✅ Tuzatildi — httpOnly cookie |
| 11 | Asosiy backend CORS'i `Access-Control-Allow-Origin: *` | 🟡 Past | ✅ Xavfsiz — `Allow-Credentials` berilmaydi, cookie cross-origin ketmaydi |

---

## 2. Nima qilindi

### 2.1 AI qatlami olib tashlandi
Studio serveridagi `@google/genai` va barcha prompt kodlari o'chirildi. Endi
`unum/server.ts` — bu **statik host + tor proksi**. Sabablari:

- **Kalit sirti kichrayadi.** `GEMINI_API_KEY` endi umuman kerak emas; yagona AI
  kaliti asosiy backendning `.env` faylida turadi.
- **Prompt injection yo'qoladi.** Bu serverda endi prompt yo'q.
- **Limit yagona.** Kunlik AI cheklovi (bepul 12 / premium 120) asosiy
  backendda hisoblanadi va uni chetlab o'tib bo'lmaydi.

### 2.2 Tor proksi (ochiq proksi emas)
`PROXY_ROUTES` — oq ro'yxat. Ro'yxatda yo'q yo'l 404 qaytaradi. Uzatiladigan
sarlavhalar faqat `Authorization` (Bearer) va `Content-Type`; `Cookie`, `Host`
va `X-Forwarded-*` **uzatilmaydi**.

### 2.3 Xavfsizlik sarlavhalari
`Content-Security-Policy` (prodda `script-src 'self'` — inline skript yo'q),
`Strict-Transport-Security`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
`Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`.

`Permissions-Policy` sog'liq ilovasi uchun moslangan: `camera=(self)`,
`microphone=(self)` — taom rasmi va ovozli kiritish uchun; `geolocation=()`,
`payment=()`, `usb=()` — butunlay yopiq.

### 2.4 Rate limit
- `/api/*` → 120 so'rov / daqiqa
- `/api/ai/*` → 12 so'rov / daqiqa

Bu asosiy backenddagi **kunlik** hisob-limitiga qo'shimcha qatlam.

### 2.5 Tinglash manzili
`HOST` sukut bo'yicha: prodda `0.0.0.0` (funnel ortida), aks holda `127.0.0.1`.
Dev serverni tasodifan LAN'ga ochib qo'yish endi imkonsiz.

### 2.6 Mijozdagi saqlash
`localStorage`'ga endi **faqat UI holati** yoziladi (`unum_ui_v2`: onboarding
tugagani va sozlamalar). Profil, sog'liq yozuvlari, chat tarixi va tokenlar
saqlanmaydi — ular server sessiyasidan keladi.

---

## 3. Kirish va integratsiyalar (bajarildi)

### 3.1 Sessiya — httpOnly cookie ✅
`oauth.ts` sessiyani `unum_session` nomli **httpOnly + Secure + SameSite=Lax**
cookie'da beradi. Token JS'ga umuman ko'rinmaydi → XSS uni o'g'irlay olmaydi.

Mobil ilova (Flutter) `Authorization: Bearer` bilan davom etadi — u yerda
cookie muammosi yo'q, token Keychain / EncryptedSharedPreferences'da turadi.
`requireAuth` ikkala manbani ham qabul qiladi.

**CSRF:** `SameSite=Lax` cross-site POST'da cookie yubormaydi; qo'shimcha qatlam
sifatida `server.ts` da cookie bilan kelgan holat o'zgartiruvchi so'rovlarning
`Origin`/`Referer` sarlavhasi tekshiriladi. Bearer bilan kelgan so'rovlarga
tegilmaydi — ularda brauzer avtomatik hech narsa qo'shmaydi.

CORS `*` bo'lib qoldi, lekin bu xavfsiz: `Access-Control-Allow-Credentials`
**berilmaydi**, ya'ni cookie hech qachon cross-origin yuborilmaydi.

### 3.2 Google Sign-In ✅ / Apple ⏸
Ikki oqim: web uchun authorization code (`/api/auth/oauth/google` →
`/callback`), mobil uchun `POST /api/auth/oauth/:provider/token` (native SDK
bergan `id_token`).

- `state` (CSRF) va `nonce` (replay) serverda tekshiriladi, bir marta ishlatiladi, TTL 10 daqiqa
- `id_token` imzosi **serverda** tekshiriladi (JWKS, `iss`/`aud`/`exp`) —
  mijoz yuborgan profilga hech qachon ishonilmaydi
- `users` jadvaliga `google_sub` / `apple_sub` / `email_verified` qo'shildi
- **Hisob birlashtirish faqat `email_verified` bo'lsa** — aks holda
  tasdiqlanmagan email bilan begona hisobni egallash mumkin bo'lardi
- Apple kodi yozilgan, `appleConfigured()` bayrog'i ortida — Developer
  enrollment tasdiqlangach `.env` ga kalitlar qo'shiladi

### 3.3 Integratsiyalar (Google Fit / Calendar) ✅
- Tokenlar **AES-256-GCM** bilan shifrlangan holda `integrations` jadvalida;
  kalit `.env` dagi `TOKEN_ENC_KEY`. Mijozga **hech qachon** berilmaydi —
  `/api/integrations` faqat ulanish holatini qaytaradi
- Eng tor scope, faqat o'qish: `fitness.activity.read`, `calendar.readonly`
- "Ulanishni uzish" tokenni Google `/revoke` orqali ham bekor qiladi —
  bazadan o'chirish yetarli emas

## 4. Ochiq qolgan ishlar

### 4.1 Sog'liq ma'lumotlari maxfiyligi
- Play/App Store talabi: sog'liq ma'lumotlari reklama uchun ishlatilmasligi kerak
- Ma'lumot eksporti (`Ma'lumotlarimni yuklab olish`) va o'chirish tugmalari UI'da
  bor, lekin backendga ulanmagan — ular ishlashi Play talabidir
- AI'ga yuboriladigan ma'lumot minimallashtirilsin: ism, aniq tug'ilgan sana va
  joylashuv promptga kiritilmasin

---

## 5. Yaxshi holatda ekani tasdiqlangan narsalar (asosiy backend)

Asosiy `../server.ts` va `../auth.ts` allaqachon yaxshi himoyalangan:

- `JWT_SECRET` majburiy, prodda 32 belgidan qisqa bo'lsa server ishga tushmaydi
- Barcha ma'lumot endpointlari `requireAuth` ortida
- Parollar `bcrypt` (10 raund)
- `authLimiter` 15 daqiqada 12 urinish (brute-force)
- `aiLimiter` **hisob bo'yicha** (IP bo'yicha emas) kunlik cheklov
- `apiLimiter` 240 so'rov/daqiqa
- OTP: soatiga 3 / kuniga 10, SHA-256 xesh, `timingSafeEqual`
- `PUT /api/profile` mijozning `premium` qiymatini e'tiborsiz qoldiradi
- JSON tanasi 6 MB bilan cheklangan
- `trust proxy` to'g'ri sozlangan (rate limit haqiqiy IP ni ko'radi)

---

## 6. Sinov qoidasi

**Localhost'da sinalmaydi.** Barcha sinovlar public URL orqali:

```
https://your-server.example.com/app  ← web ilova
https://your-server.example.com      ← backend API
```

Deploy: `./deploy.sh` (web) va `../deploy.sh` (backend).

⚠️ Funnel portlari to'lgan (443 → TDIU, 8443 → backend, 10000 → LiveKit),
shuning uchun web ilova backendning `/app` yo'lida beriladi.
