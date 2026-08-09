import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, startGoogleLogin } from '../lib/api';
import { profileFromServer, profileToServer } from '../lib/profileMap';
import type { MetricKey } from '../theme';
import type {
  ActivityHeatmap,
  AiInsight,
  AuthProvider,
  AuthState,
  ChatMessage,
  Integration,
  IntegrationKey,
  MetricMap,
  PartnerOffer,
  Period,
  PlanItem,
  Recommendation,
  Settings,
  TabType,
  TrendCard,
  UserProfile,
} from '../types';
import {
  INITIAL_INTEGRATIONS,
  INITIAL_PROFILE,
  INITIAL_SETTINGS,
} from '../data/mock';
import { triggerHaptic } from '../utils/haptics';
import { buildMetrics, type Summary } from '../lib/liveMetrics';
import { buildInsights } from '../lib/liveInsights';
import { buildPlan, buildRecommendations } from '../lib/liveCoach';

/** Ma'lumot kelgunicha — hammasi nol. Mock qiymat KO'RSATILMAYDI. */
const EMPTY_METRICS: MetricMap = buildMetrics(
  {
    date: '', score: { total: 0, hasData: false, grade: '' },
    profile: { targetCalories: 2200, targetProtein: 126, targetWaterMl: 2500,
      streak: 0, level: 1, xp: 0 },
    totals: { calories: 0, protein: 0, water: 0, meals: 0, steps: 0,
      activeMinutes: 0, vegServings: 0, sugar: 0, cost: 0 },
  },
  null,
  null,
);

/**
 * Faqat UI holati saqlanadi (tanlangan tab, onboarding tugagani, sozlamalar).
 * Sog'liq ma'lumotlari va tokenlar localStorage'ga YOZILMAYDI —
 * ular server sessiyasidan keladi (xavfsizlik auditiga qarang).
 */
const UI_STORAGE_KEY = 'unum_ui_v2';

interface PersistedUi {
  onboarded: boolean;
  settings: Settings;
}

function loadUi(): PersistedUi | null {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedUi) : null;
  } catch {
    return null;
  }
}

function saveUi(next: PersistedUi) {
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private rejimda localStorage bloklangan bo'lishi mumkin — jim o'tamiz */
  }
}

interface UnumContextValue {
  // Sessiya
  auth: AuthState;
  /** Server bilan birinchi tekshiruv tugamaguncha `true` */
  bootstrapping: boolean;
  /** Qaysi kirish usullari serverda sozlangan */
  providers: { google: boolean; apple: boolean };
  authError: string | null;
  signIn: (provider: AuthProvider) => void;
  signOut: () => void;
  deleteAccount: () => void;

  // Foydalanuvchi
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
  completeOnboarding: (patch: Partial<UserProfile>) => void;

  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;

  // Ma'lumotlar
  metrics: MetricMap;
  /** Bugun umuman ma'lumot bormi — 0 ballni "yomon kun" deb ko'rsatmaslik uchun. */
  scoreHasData: boolean;
  /** Kunlik holatni serverdan qayta o'qiydi (yozuv qo'shilgach chaqiriladi). */
  reloadSummary: () => Promise<void>;
  period: Period;
  setPeriod: (p: Period) => void;
  score: number;
  previousScore: number;
  insights: AiInsight[];
  trends: TrendCard[];
  heatmap: ActivityHeatmap;
  mostActiveDay: string;
  mostActiveHour: string;

  recommendations: Recommendation[];
  plan: PlanItem[];
  togglePlanItem: (id: string) => void;
  partners: PartnerOffer[];

  chat: ChatMessage[];
  isCoachTyping: boolean;
  sendChatMessage: (text: string) => Promise<void>;

  integrations: Integration[];
  setIntegrationConnected: (key: IntegrationKey, connected: boolean) => void | Promise<void>;


  // Navigatsiya
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
  addMenuOpen: boolean;
  setAddMenuOpen: (open: boolean) => void;
  addFlowMetric: MetricKey | null;
  setAddFlowMetric: (m: MetricKey | null) => void;
}

const UnumContext = createContext<UnumContextValue | undefined>(undefined);

export const UnumProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const persisted = useMemo(loadUi, []);

  const [auth, setAuth] = useState<AuthState>({ status: 'anonymous' });
  const [bootstrapping, setBootstrapping] = useState(true);
  /** Serverdan o'qilgan xom profil — yozishda begona maydonlarni saqlab qolish uchun */
  const rawProfileRef = useRef<Record<string, unknown>>({});
  const [providers, setProviders] = useState({ google: false, apple: false });
  const [authError, setAuthError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>({
    ...INITIAL_PROFILE,
    onboarded: persisted?.onboarded ?? false,
  });
  const [settings, setSettings] = useState<Settings>(persisted?.settings ?? INITIAL_SETTINGS);

  // ⚠️ Ko'rsatkichlar HAQIQIY ma'lumotdan quriladi. Ilgari bu yerda
  // `INITIAL_METRICS` (mock) turardi va har bir foydalanuvchi bir xil
  // soxta raqamni ko'rardi.
  const [metrics, setMetrics] = useState<MetricMap>(EMPTY_METRICS);
  const [score, setScore] = useState(0);
  const [scoreHasData, setScoreHasData] = useState(false);

  /**
   * Haqiqiy kunlik holatni yuklaydi.
   *
   * Xato bo'lsa nol qoladi — eski mock qiymatga QAYTMAYDI. Tarmoq
   * uzilganda "78 ball" ko'rsatish yolg'on bo'lardi.
   */
  const reloadSummary = React.useCallback(async () => {
    try {
      const [s, sleep] = await Promise.all([
        api.summaryToday(),
        api.sleepLogs().catch(() => []),
      ]);
      const today = (s as Summary).date;
      const last = sleep.find((x) => x.date === today);
      const minutes = last
        ? Math.max(0, (Date.parse(last.wakeTime) - Date.parse(last.bedTime)) / 60000)
        : null;

      setMetrics(buildMetrics(s as Summary, minutes && minutes <= 960 ? minutes : null, null));
      setInsights(buildInsights((s as any).score));
      setRecommendations(buildRecommendations((s as any).score));
      setPlan(buildPlan((s as any).score));
      setScore((s as Summary).score.total);
      setScoreHasData((s as Summary).score.hasData);
    } catch {
      /* kirilmagan yoki tarmoq yo'q — nol holat qoladi */
    }
  }, []);
  const [period, setPeriod] = useState<Period>('day');
  // Kuzatuvlar HAQIQIY ball komponentlaridan quriladi (liveInsights.ts).
  const [insights, setInsights] = useState<AiInsight[]>(buildInsights(null));
  // Trend kartalari haqiqiy tarixni talab qiladi — u hali yig'ilmagan.
  // Soxta grafik chizgandan ko'ra bo'sh ro'yxat.
  const [trends] = useState<TrendCard[]>([]);
  // Faollik xaritasi soatlik tarixni talab qiladi — u yig'ilmaydi.
  // Tasodifiy sonlar o'rniga nol: ekran buni "ma'lumot yo'q" deb chizadi.
  const [heatmap] = useState<ActivityHeatmap>(
    () => Array.from({ length: 7 }, () => Array.from({ length: 14 }, () => 0))
  );
  // Tavsiyalar HAQIQIY ball komponentlaridan (liveCoach.ts).
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  // ⚠️ HAMKORLAR OLIB TASHLANDI: `data/mock.ts` da mavjud bo'lmagan
  // takliflar haqiqiy kompaniya nomi bilan ko'rsatilardi (masalan
  // "Englify — 7 kun bepul sinov"). Haqiqiy shartnoma bo'lmaguncha
  // bunday blok ko'rsatilmasligi kerak.
  const partners: PartnerOffer[] = [];
  // Chat BO'SH boshlanadi. Ilgari bu yerda foydalanuvchi hech qachon
  // yozmagan savol-javob turardi va u o'z suhbati deb ko'rinardi.
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [isCoachTyping, setIsCoachTyping] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>(INITIAL_INTEGRATIONS);
  // ⚠️ Soxta obuna holati (karta •••• 4242) OLIB TASHLANDI.
  // Haqiqiy holat serverdan: `lib/useBilling.ts` → /api/billing/status.

  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addFlowMetric, setAddFlowMetric] = useState<MetricKey | null>(null);

  const persist = useCallback((next: Partial<PersistedUi>) => {
    saveUi({
      onboarded: next.onboarded ?? profile.onboarded,
      settings: next.settings ?? settings,
    });
  }, [profile.onboarded, settings]);

  /**
   * Ochilishda: qaysi provayderlar bor va sessiya mavjudmi.
   * Google'dan qaytganda URL'da `?auth=ok|failed|cancelled` bo'ladi — uni
   * o'qib, manzil qatorini tozalaymiz.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const authResult = params.get('auth');
      if (authResult === 'failed') setAuthError('Kirish amalga oshmadi. Qayta urinib ko‘ring.');
      if (authResult === 'cancelled') setAuthError('Kirish bekor qilindi.');
      if (authResult) {
        params.delete('auth');
        const qs = params.toString();
        window.history.replaceState({}, '', `/app/${qs ? `?${qs}` : ''}`);
      }

      try {
        const list = await api.providers();
        if (!cancelled) setProviders(list);
      } catch {
        /* server javob bermasa tugmalar o'chiq qoladi */
      }

      try {
        const me = await api.me();
        void reloadSummary();
        if (cancelled) return;
        setAuth({ status: 'authenticated', email: me.email });

        // Hisob emaili va ismi — haqiqat manbai `users` jadvali, mock emas
        setProfile((prev) => ({
          ...prev,
          email: me.email || prev.email,
          name: me.name || prev.name,
        }));

        // Onboarding holatida SERVER haqiqat manbai. localStorage'ga ishonib
        // bo'lmaydi: boshqa hisob bilan kirilgan bo'lishi mumkin.
        try {
          const saved = await api.getProfile();
          if (!cancelled && saved && typeof saved === 'object') {
            // Xom yozuvni saqlab qo'yamiz — yozishda Flutter ilovasining
            // maydonlarini yo'qotmaslik uchun kerak
            rawProfileRef.current = saved;
            setProfile((prev) => ({ ...prev, ...profileFromServer(saved) }));
          }
        } catch {
          // Profil yo'q (404) — bu hisob uchun onboarding hali o'tilmagan
          if (!cancelled) setProfile((prev) => ({ ...prev, onboarded: false }));
        }
      } catch {
        if (!cancelled) setAuth({ status: 'anonymous' });
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((provider: AuthProvider) => {
    setAuthError(null);
    if (provider === 'google') {
      // Server Google'ga yo'naltiradi va cookie bilan qaytaradi
      startGoogleLogin();
      return;
    }
    setAuthError('Apple orqali kirish hali yoqilmagan.');
  }, []);

  const signOut = useCallback(() => {
    void api.logout().catch(() => undefined);
    setAuth({ status: 'anonymous' });
    setProfile({ ...INITIAL_PROFILE, onboarded: false });
    setActiveTab('home');
  }, []);

  const deleteAccount = useCallback(() => {
    try {
      localStorage.removeItem(UI_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setProfile({ ...INITIAL_PROFILE, onboarded: false });
    setAuth({ status: 'anonymous' });
    setActiveTab('home');
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const completeOnboarding = useCallback(
    (patch: Partial<UserProfile>) => {
      setProfile((prev) => {
        const next = { ...prev, ...patch, onboarded: true };
        // Serverga yozamiz — qurilma almashsa ham onboarding qayta so'ralmaydi.
        // `profileToServer` mavjud yozuv ustiga faqat o'z maydonlarimizni qo'yadi,
        // shunda Flutter ilovasining maydonlari buzilmaydi.
        void api
          .putProfile(profileToServer(rawProfileRef.current, next))
          .then((saved) => {
            rawProfileRef.current = saved;
          })
          .catch(() => undefined);
        return next;
      });
      persist({ onboarded: true });
      triggerHaptic('success', true);
    },
    [persist]
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persist({ settings: next });
        return next;
      });
    },
    [persist]
  );

  const togglePlanItem = useCallback((id: string) => {
    setPlan((prev) => prev.map((p) => (p.id === id ? { ...p, planned: !p.planned } : p)));
    triggerHaptic('light', true);
  }, []);

  /**
   * Google Fit / Calendar — haqiqiy OAuth.
   * Qolganlari (Apple Health, Health Connect, Smartwatch, Screen Time) brauzerda
   * umuman mavjud emas: ular native qatlamda, Flutter ilovasida ulanadi.
   */
  const setIntegrationConnected = useCallback(
    async (key: IntegrationKey, connected: boolean) => {
      const target = INITIAL_INTEGRATIONS.find((i) => i.key === key);
      if (!target || target.nativeOnly) return;

      try {
        if (connected) {
          const { url } = await api.integrationConnectUrl(key);
          window.location.href = url;
          return;
        }
        await api.integrationDisconnect(key);
        setIntegrations((prev) => prev.map((i) => (i.key === key ? { ...i, connected: false } : i)));
      } catch {
        /* xatoni yutamiz — holat o'zgarmaydi */
      }
    },
    []
  );

  /** Serverdagi haqiqiy ulanish holatini o'qib, ro'yxatni yangilaymiz */
  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    let cancelled = false;

    void api
      .integrations()
      .then(({ connected }) => {
        if (cancelled) return;
        const live = new Set(connected.map((c) => c.provider));
        setIntegrations((prev) =>
          prev.map((i) => (i.nativeOnly ? i : { ...i, connected: live.has(i.key) }))
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [auth.status]);

  const sendChatMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const history = [...chat, { id: `u-${Date.now()}`, sender: 'user' as const, text: trimmed }];
      setChat(history);
      setIsCoachTyping(true);

      try {
        // Backend `{ messages: [{ sender, text }] }` kutadi va oxirgi 12 tasini oladi
        const res = await fetch('/api/ai/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history.map((m) => ({ sender: m.sender, text: m.text })),
          }),
        });
        const data = await res.json();
        setChat((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: 'ai',
            showDisclaimer: true,
            text:
              typeof data?.text === 'string' && data.text.trim()
                ? data.text
                : "Hozircha javob bera olmadim. Birozdan so'ng qayta urinib ko'ring.",
          },
        ]);
      } catch {
        setChat((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: 'ai',
            showDisclaimer: true,
            text: "Aloqa uzildi. Internet ulanishini tekshirib, qayta urinib ko'ring.",
          },
        ]);
      } finally {
        setIsCoachTyping(false);
      }
    },
    [chat]
  );

  const value: UnumContextValue = {
    auth,
    bootstrapping,
    providers,
    authError,
    signIn,
    signOut,
    deleteAccount,
    profile,
    updateProfile,
    completeOnboarding,
    settings,
    updateSettings,
    metrics,
    period,
    setPeriod,
    score,
    scoreHasData,
    // O'tgan hafta o'rtachasi hali hisoblanmaydi (haftalik hisobot
    // premium endpointida). Soxta 72 ni ko'rsatgandan ko'ra 0 yaxshi.
    previousScore: 0,
    reloadSummary,
    insights,
    trends,
    heatmap,
    // Bu ikkisi hali hisoblanmaydi — soxta "Payshanba / 15:00" o'rniga
    // bo'sh qiymat, ekran buni "ma'lumot yo'q" deb ko'rsatadi.
    mostActiveDay: '',
    mostActiveHour: '',
    recommendations,
    plan,
    togglePlanItem,
    partners,
    chat,
    isCoachTyping,
    sendChatMessage,
    integrations,
    setIntegrationConnected,
    activeTab,
    setActiveTab,
    addMenuOpen,
    setAddMenuOpen,
    addFlowMetric,
    setAddFlowMetric,
  };

  return <UnumContext.Provider value={value}>{children}</UnumContext.Provider>;
};

export const useUnum = (): UnumContextValue => {
  const ctx = useContext(UnumContext);
  if (!ctx) throw new Error('useUnum faqat UnumProvider ichida ishlatiladi');
  return ctx;
};
