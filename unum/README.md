# UNUM web

UNUM ilovasining React/Vite versiyasi. Dizayn manbai — 2026-08-03 dagi
6 ta referens skrinshot. Bu yerda tasdiqlangan UI keyin `../mobile/` Flutter
ilovasiga ekran-ekran ko'chiriladi.

## Arxitektura

```
brauzer ──► unum-web (funnel 443)  ──proksi──►  UNUM backend (funnel 8443)
            statik + tor proksi                 OpenAI, SQLite, Score, foods
```

Bu ilovada **AI kaliti ham, baza ham yo'q**. `server.ts` faqat statik fayllarni
beradi va oq ro'yxatdagi `/api/*` yo'llarini asosiy backendga uzatadi.
Batafsil: [SECURITY.md](./SECURITY.md).

## Tuzilish

```
src/
  theme.ts                 dizayn tokenlari, 5 ta metrika (rang/ikonka/nom)
  types.ts                 ma'lumot modeli
  data/mock.ts             prototip raqamlari (backend ulangach o'chadi)
  context/UnumContext.tsx  yagona holat manbai
  components/
    ui/                    Card, Button, SegmentedControl, RadarPentagon,
                           ScoreRing, Sparkline, HeatmapGrid, ListRow,
                           Toggle, Sheet, SubScreen, Disclaimer, CoachAvatar
    shell/                 TopBar, TabBar (5 tab), RadialAddMenu
    views/                 HomeView, AnalysisView, CoachView, ProfileView
    flows/                 AuthFlow (onboarding), AddFlow (qayd qo'shish)
.legacy/                   eski AI Studio kodi — build'ga kirmaydi, o'chirilmagan
```

## Ishga tushirish

**Localhost'da sinalmaydi.** Barcha sinov public URL orqali:

```bash
./deploy.sh          # build → serverga rsync → systemd → Tailscale Funnel
```

Keyin: `https://your-server.example.com`

```bash
# Loglar
ssh abdunodir@your-server.example.com 'journalctl --user -u unum-web -f'
```

## Qat'iy qoidalar

- **Valyuta konvertatsiyasi yo'q** — barcha narxlar allaqachon so'mda.
- **Ibodat ballanmaydi.** Onboardingda maqsad sifatida tanlash mumkin, lekin
  Score'ga kirmaydi va unga baho berilmaydi (`GOAL_OPTIONS` da `metric: null`).
- **AI matni ko'rsatilgan har bir joyda `<Disclaimer />` bo'lishi shart.**
- Unum Score deterministik: bir xil ma'lumot → bir xil ball.
