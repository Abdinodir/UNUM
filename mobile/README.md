# NutriStock AI — Mobil ilova (Flutter)

Android va iOS uchun NutriStock AI ilovasi. Web versiyaning to'liq nusxasi:
oshxona zaxirasi, taomlar kundaligi, AI kouch, xarajatlar, tana progressi,
sog'liq/faollik, suv hisoblagichi, gamifikatsiya (XP/daraja/seriya/yutuqlar).

AI (ChatGPT/OpenAI) **backend server orqali** ishlaydi — token ilovada emas,
serverda saqlanadi.

**Barcha ma'lumotlar backend ma'lumotlar bazasida (SQLite)** saqlanadi. Ilova
**login/register** talab qiladi; har bir foydalanuvchi o'z hisobiga ega va
barcha amallar (zaxira, taomlar, xarajatlar, progress...) server orqali bazaga
yoziladi — lokal statik ma'lumot yo'q.

### Backend endpointlari
- `POST /api/auth/register`, `POST /api/auth/login` — JWT token qaytaradi
- `GET/PUT /api/profile` — profil (foydalanuvchiga bog'liq)
- `GET/POST/PUT/DELETE /api/data/:collection` — inventory, food, meals, water,
  body, expenses, activities, achievements, coach
- `POST /api/gemini/*` — AI (auth talab qiladi)

DB fayli: `nutristock.db` (server ildizida). `.env` da `JWT_SECRET` sozlash mumkin.

## 1. Backendni ishga tushirish

Backend loyihaning ildiz papkasida (`../`) joylashgan (`server.ts`).

```bash
cd ..
cp .env.example .env
# .env ichida OPENAI_API_KEY="sk-..." ni o'z tokeningizga almashtiring
npm install
npm run dev          # http://0.0.0.0:3000 da ishlaydi
```

Endpointlar: `/api/health`, `/api/gemini/parse-meal`,
`/api/gemini/generate-meal-plan`, `/api/gemini/coach-chat`,
`/api/gemini/analyze-photo`.

> Eslatma: `/api/gemini/...` yo'l nomlari web versiya bilan mos bo'lishi uchun
> saqlab qolindi, lekin ichkarida **OpenAI (ChatGPT)** ishlatiladi.

### Serverni public qilish (real telefon uchun)
Real qurilma `10.0.2.2` yoki LAN IP'ga ula olmaydi. Serverni public URL'da
oching (Tailscale Funnel, ngrok yoki deploy) va o'sha URL'ni ilovada kiriting
(Profil → Sozlamalar → AI server manzili).

## 2. Ilovani ishga tushirish

```bash
flutter pub get
flutter run                       # ulangan qurilma/emulyatorda
```

### Server manzilini sozlash
- **Android emulyator + lokal server**: standart `http://10.0.2.2:3000` ishlaydi.
- **Real telefon**: ilovada Profil → Sozlamalar → *AI server manzili*ga public
  URL'ni kiriting va "Saqlash va ulanishni tekshirish" tugmasini bosing.
- Standart qiymat: `lib/config.dart` → `AppConfig.defaultBackendUrl`.

## 3. Release qurilishi

```bash
flutter build apk --release        # Android APK
flutter build appbundle --release  # Play Market uchun AAB
flutter build ios --release        # iOS (macOS + Xcode kerak)
```

## Arxitektura
- **Holat**: `provider` + `ChangeNotifier` (`lib/state/app_state.dart`)
- **Saqlash**: `shared_preferences` (offline, localStorage o'rnida)
- **AI**: `lib/services/ai_service.dart` → backend
- **Grafiklar**: `fl_chart`
- **Modellar**: `lib/models.dart` (web `src/types.ts` nusxasi)
- **Ekranlar**: `lib/screens/*` (10 ta ekran)
