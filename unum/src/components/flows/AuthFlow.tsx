import React from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Download,
  GraduationCap,
  HeartPulse,
  Loader2,
  Minus,
  MoonStar,
  MoreHorizontal,
  PersonStanding,
  Plus,
  Smartphone,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useUnum } from '../../context/UnumContext';
import { METRICS, RADAR_ORDER, type MetricKey } from '../../theme';
import type { ActivityLevel, AuthProvider, Gender } from '../../types';
import { ACTIVITY_LABELS } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { RadarPentagon } from '../ui/RadarPentagon';
import { ScoreRing } from '../ui/ScoreRing';
import { CoachAvatar } from '../ui/CoachAvatar';
import { MetricBadge } from '../ui/MetricIcon';
import { triggerHaptic } from '../../utils/haptics';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

type Step =
  | 'login'
  | 'welcome'
  | 'disclaimer'
  | 'about'
  | 'goal'
  | 'goalDetail'
  | 'permissions'
  | 'building'
  | 'ready';

/** Yuqoridagi progress chizig'i ko'rsatiladigan qadamlar */
const PROGRESS_STEPS: Step[] = ['about', 'goal', 'goalDetail', 'permissions', 'building'];

interface GoalOption {
  id: string;
  label: string;
  Icon: typeof Utensils;
  /** Ballanadigan metrika. `null` — kuzatiladi, lekin BALLANMAYDI (masalan namoz). */
  metric: MetricKey | null;
}

const GOAL_OPTIONS: GoalOption[] = [
  { id: 'nutrition', label: "Sog'lom ovqatlanish", Icon: Utensils, metric: 'nutrition' },
  { id: 'steps', label: "Ko'proq yurish", Icon: PersonStanding, metric: 'steps' },
  { id: 'sleep', label: 'Uyquni yaxshilash', Icon: MoonStar, metric: 'sleep' },
  { id: 'screen', label: 'Screen Timeni kamaytirish', Icon: Smartphone, metric: 'screen' },
  { id: 'reading', label: "Ko'proq kitob o'qish", Icon: BookOpen, metric: 'goals' },
  { id: 'finance', label: 'Xarajatlarni nazorat qilish', Icon: Coins, metric: 'goals' },
  { id: 'ielts', label: 'IELTSga tayyorlanish', Icon: GraduationCap, metric: 'goals' },
  { id: 'prayer', label: "Namozga ko'proq e'tibor", Icon: HeartPulse, metric: null },
  { id: 'other', label: 'Boshqa maqsad', Icon: MoreHorizontal, metric: 'goals' },
];

const PERMISSIONS = [
  { id: 'steps', title: 'Qadamlarni kuzatish', desc: "Qadam va masofani o'lchash", Icon: PersonStanding },
  { id: 'screen', title: 'Screen Time', desc: 'Telefon foydalanish vaqtini kuzatish', Icon: Smartphone },
  { id: 'health', title: "Health ma'lumotlari", desc: 'Uyqu, yurak urishi va hokazo', Icon: HeartPulse },
  { id: 'notify', title: 'Bildirishnomalar', desc: 'Eslatmalar va motivatsiya uchun', Icon: Bell },
];

export const AuthFlow: React.FC = () => {
  const { auth, providers, authError, signIn, completeOnboarding, profile } = useUnum();

  // Google'dan qaytgach sessiya bor, lekin onboarding hali tugamagan —
  // shunda kirish ekranini emas, "Xush kelibsiz" dan boshlaymiz.
  const [step, setStep] = React.useState<Step>(
    auth.status === 'authenticated' ? 'welcome' : 'login'
  );
  const [acknowledged, setAcknowledged] = React.useState(false);

  // "Siz haqingizda" maydonlari
  const [name, setName] = React.useState(profile.name);
  const [age, setAge] = React.useState(String(profile.age));
  const [gender, setGender] = React.useState<Gender>(profile.gender);
  const [heightCm, setHeightCm] = React.useState(String(profile.heightCm));
  const [weightKg, setWeightKg] = React.useState(String(profile.weightKg));
  const [activity, setActivity] = React.useState<ActivityLevel>(profile.activity);

  const [goalId, setGoalId] = React.useState<string | null>(null);
  const [weightIntent, setWeightIntent] = React.useState<'lose' | 'keep' | 'gain'>('lose');
  const [deltaKg, setDeltaKg] = React.useState(8);
  const [granted, setGranted] = React.useState<string[]>([]);

  const goal = GOAL_OPTIONS.find((g) => g.id === goalId) ?? null;
  const progressIndex = PROGRESS_STEPS.indexOf(step);

  // "Reja tayyorlanmoqda" ekrani o'zi yakunlanadi
  React.useEffect(() => {
    if (step !== 'building') return;
    const t = setTimeout(() => setStep('ready'), 2600);
    return () => clearTimeout(t);
  }, [step]);

  // Google bosilganda brauzer serverga, u yerdan Google'ga ketadi.
  // Qaytganda `auth` allaqachon `authenticated` bo'ladi.
  const handleSignIn = (p: AuthProvider) => signIn(p);

  const finish = () => {
    const targetWeight =
      weightIntent === 'keep'
        ? Number(weightKg)
        : weightIntent === 'lose'
          ? Number(weightKg) - deltaKg
          : Number(weightKg) + deltaKg;

    completeOnboarding({
      name: name.trim() || profile.name,
      age: Number(age) || profile.age,
      gender,
      heightCm: Number(heightCm) || profile.heightCm,
      weightKg: Number(weightKg) || profile.weightKg,
      targetWeightKg: Math.max(30, Math.round(targetWeight)),
      activity,
    });
  };

  const back = () => {
    const order: Step[] = [
      'login',
      'welcome',
      'disclaimer',
      'about',
      'goal',
      'goalDetail',
      'permissions',
    ];
    const i = order.indexOf(step);
    if (i > 0) setStep(order[i - 1]);
  };

  return (
    <div className="h-full flex flex-col px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+20px)]">
      {/* Tepa qator: orqaga + progress */}
      {step !== 'login' && step !== 'ready' && step !== 'building' && (
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <button
            onClick={back}
            aria-label="Orqaga"
            className="w-9 h-9 -ml-2 flex items-center justify-center rounded-full active:bg-white/[0.06]"
          >
            <ChevronLeft size={22} className="text-white" />
          </button>
          {progressIndex >= 0 && (
            <div className="flex-1 h-1 rounded-full bg-white/[0.08] overflow-hidden">
              <motion.div
                className="h-full bg-[#22C55E] rounded-full"
                animate={{ width: `${((progressIndex + 1) / PROGRESS_STEPS.length) * 100}%` }}
                transition={{ duration: 0.35 }}
              />
            </div>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="flex-1 flex flex-col min-h-0"
        >
          {/* ---------------------------------------------------- 1. Kirish */}
          {step === 'login' && (
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-center gap-2.5 mb-10">
                <UnumMark size={34} />
                <span className="text-[30px] font-bold tracking-tight text-white">UNUM</span>
              </div>

              <h1 className="text-[20px] font-semibold text-white text-center mb-2">Kirish</h1>
              <p className="text-[13px] text-[#98A29E] text-center leading-[1.5] mb-8 px-4">
                Hisobingizga Google yoki Apple ID orqali xavfsiz kiring. Parol yaratish shart
                emas.
              </p>

              {authError && (
                <p className="text-[12.5px] text-[#F87171] text-center mb-4">{authError}</p>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => handleSignIn('google')}
                  disabled={!providers.google}
                  className="w-full h-[54px] rounded-[16px] bg-white text-[#1F1F1F] font-semibold text-[15px] flex items-center justify-center gap-3 active:opacity-90 disabled:opacity-40"
                >
                  <GoogleMark />
                  Google bilan kirish
                </button>
                <button
                  onClick={() => handleSignIn('apple')}
                  disabled={!providers.apple}
                  className="w-full h-[54px] rounded-[16px] bg-black border border-white/15 text-white font-semibold text-[15px] flex items-center justify-center gap-3 active:opacity-90 disabled:opacity-40"
                >
                  <AppleMark />
                  Apple bilan kirish
                </button>
              </div>

              {!providers.apple && (
                <p className="text-[11.5px] text-[#616B67] text-center mt-3">
                  Apple orqali kirish tez orada qo'shiladi.
                </p>
              )}

              <InstallBanner />

              <p className="text-[11px] text-[#616B67] text-center leading-[1.5] mt-8 px-2">
                Davom etish orqali siz Foydalanish shartlari va Maxfiylik siyosatiga rozilik
                bildirasiz. UNUM sizning parolingizni ko'rmaydi va saqlamaydi.
              </p>
            </div>
          )}

          {/* ------------------------------------------------ 2. Xush kelibsiz */}
          {step === 'welcome' && (
            <div className="flex-1 flex flex-col">
              <div className="text-center pt-4">
                <span className="text-[34px]">🎉</span>
                <h1 className="text-[24px] font-bold text-white mt-2 leading-tight">
                  UNUMga
                  <br />
                  xush kelibsiz!
                </h1>
                <p className="text-[13px] text-[#98A29E] leading-[1.55] mt-3 px-2">
                  Biz sizning maqsadlaringizni kuzatib boramiz, tahlil qilamiz va AI yordamida
                  ularga erishishingizga yordam beramiz.
                </p>
              </div>

              <div className="flex-1 flex items-center justify-center">
                <RadarPentagon
                  values={
                    RADAR_ORDER.reduce(
                      (acc, k) => ({ ...acc, [k]: 62 }),
                      {} as Record<MetricKey, number>
                    )
                  }
                  size={250}
                  showScale={false}
                />
              </div>

              <Button full onClick={() => setStep('disclaimer')}>
                Boshlash
              </Button>
            </div>
          )}

          {/* ------------------------------------------------- 3. Ogohlantirish */}
          {step === 'disclaimer' && (
            <div className="flex-1 flex flex-col">
              <div className="text-center pt-6">
                <span className="mx-auto w-16 h-16 rounded-full bg-[#EF4444]/12 flex items-center justify-center">
                  <AlertTriangle size={30} className="text-[#F87171]" />
                </span>
                <h1 className="text-[22px] font-bold text-[#F87171] mt-3">Muhim</h1>
              </div>

              <Card className="mt-6 space-y-4">
                <p className="text-[13.5px] leading-[1.6] text-[#C7CFCC]">
                  UNUM tavsiyalari AI tomonidan yaratiladi va ular tibbiy, moliyaviy yoki
                  professional maslahat o'rnini bosmaydi.
                </p>
                <p className="text-[13.5px] leading-[1.6] text-[#C7CFCC]">
                  Muhim qarorlar qabul qilishdan oldin mutaxassis (shifokor yoki boshqa
                  mutaxassis) bilan maslahatlashing.
                </p>
              </Card>

              <button
                onClick={() => setAcknowledged(!acknowledged)}
                className="flex items-center gap-3 mt-6"
              >
                <span
                  className={`w-[22px] h-[22px] rounded-[7px] flex items-center justify-center border transition-colors ${
                    acknowledged
                      ? 'bg-[#22C55E] border-[#22C55E]'
                      : 'bg-transparent border-white/20'
                  }`}
                >
                  {acknowledged && <Check size={14} className="text-[#07130C]" strokeWidth={3} />}
                </span>
                <span className="text-[14px] text-white">Tushundim</span>
              </button>

              <div className="mt-auto pt-8">
                <Button full disabled={!acknowledged} onClick={() => setStep('about')}>
                  Davom etish
                </Button>
              </div>
            </div>
          )}

          {/* -------------------------------------------- 4. Siz haqingizda */}
          {step === 'about' && (
            <div className="flex-1 flex flex-col overflow-y-auto">
              <h1 className="text-[22px] font-bold text-white">Siz haqingizda</h1>
              <p className="text-[13px] text-[#98A29E] leading-[1.5] mt-1.5 mb-5">
                To'g'ri ma'lumotlar AI tahlilini aniqroq qilishga yordam beradi.
              </p>

              <div className="space-y-3">
                <Field label="Ism">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="w-full bg-transparent text-[15px] text-white outline-none"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Yosh">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={10}
                      max={100}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full bg-transparent text-[15px] text-white outline-none tabular"
                    />
                  </Field>

                  <Field label="Jins">
                    <div className="flex gap-1.5">
                      {(['male', 'female'] as Gender[]).map((g) => (
                        <button
                          key={g}
                          onClick={() => setGender(g)}
                          className={`flex-1 h-8 rounded-[9px] text-[12.5px] font-medium transition-colors ${
                            gender === g
                              ? 'bg-[#22C55E]/18 text-[#34D77F] border border-[#22C55E]/35'
                              : 'bg-white/[0.05] text-[#98A29E]'
                          }`}
                        >
                          {g === 'male' ? 'Erkak' : 'Ayol'}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                <Field label="Bo'y (sm)">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={100}
                    max={230}
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="w-full bg-transparent text-[15px] text-white outline-none tabular"
                  />
                </Field>

                <Field label="Vazn (kg)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={25}
                    max={300}
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full bg-transparent text-[15px] text-white outline-none tabular"
                  />
                </Field>

                <Field label="Faollik darajasi">
                  <div className="flex gap-1.5">
                    {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((a) => (
                      <button
                        key={a}
                        onClick={() => setActivity(a)}
                        className={`flex-1 h-8 rounded-[9px] text-[12.5px] font-medium transition-colors ${
                          activity === a
                            ? 'bg-[#22C55E]/18 text-[#34D77F] border border-[#22C55E]/35'
                            : 'bg-white/[0.05] text-[#98A29E]'
                        }`}
                      >
                        {ACTIVITY_LABELS[a]}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <p className="text-[11px] text-[#616B67] leading-[1.5] mt-4">
                Kunlik kaloriya va oqsil me'yori shu ma'lumotlardan avtomatik hisoblanadi —
                raqamlarni o'zingiz kiritishingiz shart emas.
              </p>

              <div className="mt-auto pt-6">
                <Button full onClick={() => setStep('goal')}>
                  Davom etish
                </Button>
              </div>
            </div>
          )}

          {/* ----------------------------------------------- 5. Maqsad tanlash */}
          {step === 'goal' && (
            <div className="flex-1 flex flex-col overflow-y-auto">
              <h1 className="text-[22px] font-bold text-white text-center">
                Asosiy maqsadingiz nima?
              </h1>
              <p className="text-[13px] text-[#98A29E] text-center leading-[1.5] mt-1.5 mb-5">
                Hozir siz uchun eng muhim bo'lgan maqsadni tanlang.
              </p>

              <div className="grid grid-cols-3 gap-2.5">
                {GOAL_OPTIONS.map(({ id, label, Icon }) => {
                  const active = goalId === id;
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        triggerHaptic('light', true);
                        setGoalId(id);
                      }}
                      className={`aspect-square rounded-[16px] flex flex-col items-center justify-center gap-2 px-1.5 transition-colors ${
                        active
                          ? 'bg-[#22C55E]/15 border border-[#22C55E]/45'
                          : 'bg-[#131717] border border-white/[0.07]'
                      }`}
                    >
                      <Icon
                        size={22}
                        strokeWidth={1.9}
                        className={active ? 'text-[#34D77F]' : 'text-[#C7CFCC]'}
                      />
                      <span
                        className={`text-[10.5px] leading-[1.25] text-center ${
                          active ? 'text-[#34D77F]' : 'text-[#98A29E]'
                        }`}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[11.5px] text-[#616B67] text-center mt-4">
                Faqat bittasini tanlang. Qolganlarini keyin qo'shishingiz mumkin.
              </p>

              {goal?.metric === null && (
                <p className="text-[11.5px] text-[#98A29E] text-center leading-[1.5] mt-3 px-3">
                  Bu maqsad kuzatiladi, lekin <span className="text-white">ballanmaydi</span> —
                  UNUM ibodatga baho qo'ymaydi.
                </p>
              )}

              <div className="mt-auto pt-6">
                <Button full disabled={!goalId} onClick={() => setStep('goalDetail')}>
                  Davom etish
                </Button>
              </div>
            </div>
          )}

          {/* --------------------------------------- 6. Maqsad tafsilotlari */}
          {step === 'goalDetail' && goal && (
            <div className="flex-1 flex flex-col overflow-y-auto">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-11 h-11 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/35 flex items-center justify-center">
                  <goal.Icon size={21} className="text-[#34D77F]" strokeWidth={1.9} />
                </span>
                <h1 className="text-[19px] font-semibold text-white">{goal.label}</h1>
              </div>

              <h2 className="text-[15px] font-semibold text-white mb-2.5">Maqsadingiz nima?</h2>
              <div className="space-y-2">
                {(
                  [
                    { key: 'lose', label: 'Vazn tashlash' },
                    { key: 'keep', label: 'Vaznni ushlab turish' },
                    { key: 'gain', label: 'Vazn olish' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setWeightIntent(opt.key)}
                    className="w-full flex items-center gap-3 h-[50px] px-4 rounded-[14px] bg-[#131717] border border-white/[0.07]"
                  >
                    <span
                      className={`w-[19px] h-[19px] rounded-full border-2 flex items-center justify-center ${
                        weightIntent === opt.key ? 'border-[#22C55E]' : 'border-white/20'
                      }`}
                    >
                      {weightIntent === opt.key && (
                        <span className="w-[9px] h-[9px] rounded-full bg-[#22C55E]" />
                      )}
                    </span>
                    <span className="text-[14.5px] text-white">{opt.label}</span>
                  </button>
                ))}
              </div>

              {weightIntent !== 'keep' && (
                <>
                  <h2 className="text-[15px] font-semibold text-white mt-6 mb-2.5">
                    Qancha kg {weightIntent === 'lose' ? 'tashlamoqchisiz' : 'olmoqchisiz'}?
                  </h2>
                  <div className="flex items-center justify-between h-[56px] px-3 rounded-[14px] bg-[#131717] border border-white/[0.07]">
                    <Stepper
                      icon={<Minus size={18} />}
                      onClick={() => setDeltaKg((v) => Math.max(1, v - 1))}
                      label="Kamaytirish"
                    />
                    <span className="text-[19px] font-bold text-white tabular">{deltaKg} kg</span>
                    <Stepper
                      icon={<Plus size={18} />}
                      onClick={() => setDeltaKg((v) => Math.min(40, v + 1))}
                      label="Oshirish"
                    />
                  </div>
                  <p className="text-[11.5px] text-[#616B67] text-center mt-2">
                    Tavsiya: 4 – 10 kg
                  </p>
                </>
              )}

              <div className="mt-auto pt-6">
                <Button full onClick={() => setStep('permissions')}>
                  Davom etish
                </Button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------- 7. Ruxsatlar */}
          {step === 'permissions' && (
            <div className="flex-1 flex flex-col overflow-y-auto">
              <h1 className="text-[22px] font-bold text-white text-center">Kerakli ruxsatlar</h1>
              <p className="text-[13px] text-[#98A29E] text-center leading-[1.5] mt-1.5 mb-5">
                UNUM sizga aniqroq tavsiyalar berishi uchun quyidagi ruxsatlar kerak.
              </p>

              <Card flush className="divide-y divide-white/[0.05]">
                {PERMISSIONS.map(({ id, title, desc, Icon }) => {
                  const isGranted = granted.includes(id);
                  return (
                    <div key={id} className="flex items-center gap-3 px-4 py-3.5">
                      <span className="w-9 h-9 rounded-[11px] bg-white/[0.06] flex items-center justify-center shrink-0">
                        <Icon size={17} className="text-[#C7CFCC]" strokeWidth={1.9} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-medium text-white">{title}</span>
                        <span className="block text-[11.5px] text-[#7B8481] mt-0.5">{desc}</span>
                      </span>
                      <button
                        onClick={() =>
                          setGranted((prev) =>
                            isGranted ? prev.filter((p) => p !== id) : [...prev, id]
                          )
                        }
                        className={`text-[12px] font-semibold px-3 py-1.5 rounded-full shrink-0 ${
                          isGranted
                            ? 'bg-[#22C55E]/15 text-[#34D77F]'
                            : 'bg-white/[0.06] text-[#98A29E]'
                        }`}
                      >
                        {isGranted ? 'Berildi ✓' : 'Ruxsat berish'}
                      </button>
                    </div>
                  );
                })}
              </Card>

              <p className="text-[11.5px] text-[#616B67] text-center leading-[1.5] mt-4">
                🔒 Ma'lumotlaringiz maxfiy va xavfsiz. Istalgan vaqtda sozlamalardan
                o'chirishingiz mumkin.
              </p>

              <div className="mt-auto pt-6">
                <Button full onClick={() => setStep('building')}>
                  Davom etish
                </Button>
              </div>
            </div>
          )}

          {/* -------------------------------------- 8. Reja tayyorlanmoqda */}
          {step === 'building' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <h1 className="text-[21px] font-bold text-white leading-tight px-4">
                AI siz uchun shaxsiy reja tuzyapti…
              </h1>
              <p className="text-[13px] text-[#98A29E] mt-2">Bu bir necha soniya davom etadi.</p>

              <div className="relative my-10">
                <motion.span
                  className="absolute inset-0 rounded-full border-2 border-[#22C55E]/30"
                  animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="w-[150px] h-[150px] rounded-full bg-[#22C55E]/[0.07] border border-[#22C55E]/25 flex items-center justify-center">
                  <CoachAvatar size={86} />
                </span>
              </div>

              <div className="space-y-3">
                {[
                  "Ma'lumotlaringiz tahlil qilinmoqda",
                  'Maqsadlaringiz moslashtirilmoqda',
                  'Kundalik reja tayyorlanmoqda',
                ].map((line, i) => (
                  <motion.div
                    key={line}
                    initial={{ opacity: 0.25 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + i * 0.7 }}
                    className="flex items-center gap-2.5"
                  >
                    <Check size={15} className="text-[#34D77F]" strokeWidth={3} />
                    <span className="text-[13.5px] text-[#C7CFCC]">{line}</span>
                  </motion.div>
                ))}
              </div>

              <Loader2 size={20} className="text-[#22C55E] animate-spin mt-8" />
            </div>
          )}

          {/* ---------------------------------------------------- 9. Tayyor */}
          {step === 'ready' && (
            <div className="flex-1 flex flex-col">
              <div className="text-center pt-6">
                <span className="text-[32px]">🎉</span>
                <h1 className="text-[24px] font-bold text-white mt-2">Tayyor!</h1>
                <p className="text-[13px] text-[#98A29E] leading-[1.5] mt-2">
                  Bugungi rejangiz tayyor. Boshlashga tayyormisiz?
                </p>
              </div>

              <Card className="mt-6 flex items-center gap-4">
                <ScoreRing value={0} size={76} thickness={7} />
                <div className="flex-1">
                  <span className="block text-[13.5px] font-semibold text-white">UNUM Score</span>
                  <div className="flex items-end gap-[3px] h-6 mt-2">
                    {Array.from({ length: 10 }, (_, i) => (
                      <span
                        key={i}
                        className="flex-1 rounded-[2px] bg-white/[0.08]"
                        style={{ height: `${20 + i * 6}%` }}
                      />
                    ))}
                  </div>
                  <span className="block text-[11px] text-[#7B8481] mt-1.5">
                    Birinchi qaydingizdan keyin hisoblanadi
                  </span>
                </div>
              </Card>

              <div className="mt-4">
                <div className="flex items-baseline justify-between mb-2.5">
                  <h2 className="text-[15px] font-semibold text-white">Bugungi vazifalar</h2>
                  <span className="text-[12.5px] text-[#34D77F]">Barchasini ko'rish</span>
                </div>

                <Card flush className="divide-y divide-white/[0.05]">
                  {RADAR_ORDER.slice(0, 4).map((key) => (
                    <div key={key} className="flex items-center gap-3 px-4 py-3">
                      <MetricBadge metric={key} size={32} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13.5px] font-medium text-white truncate">
                          {METRICS[key].label}
                        </span>
                        <span className="block text-[11px] text-[#7B8481] mt-0.5">
                          Maqsad belgilandi
                        </span>
                      </span>
                      <span className="text-[12.5px] text-[#7B8481] tabular shrink-0">0%</span>
                    </div>
                  ))}
                </Card>
              </div>

              <div className="mt-auto pt-6">
                <p className="text-[11px] text-[#616B67] text-center mb-3">
                  {auth.provider === 'apple' ? 'Apple ID' : 'Google'} orqali kirdingiz
                  {auth.email ? ` · ${auth.email}` : ''}
                </p>
                <Button full onClick={finish}>
                  <Sparkles size={17} />
                  Boshlash
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Yordamchi komponentlar                                              */
/* ------------------------------------------------------------------ */

/** "Ilovani o'rnatish" taklifi — brauzer ruxsat berganda ko'rinadi */
const InstallBanner: React.FC = () => {
  const { canInstall, needsManualSteps, install } = useInstallPrompt();
  if (!canInstall) return null;

  return (
    <div className="mt-6 rounded-[16px] bg-[#22C55E]/[0.08] border border-[#22C55E]/25 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <Download size={18} className="text-[#34D77F] shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="block text-[13.5px] font-semibold text-white">
            UNUMni ilova sifatida o'rnating
          </span>
          <span className="block text-[11.5px] text-[#98A29E] mt-0.5">
            {needsManualSteps
              ? "Ulashish → \"Bosh ekranga qo'shish\""
              : 'Brauzer paneli yo‘qoladi, tezroq ochiladi'}
          </span>
        </div>
        {!needsManualSteps && (
          <button
            onClick={() => void install()}
            className="shrink-0 text-[12.5px] font-semibold text-[#34D77F] px-3 py-1.5 rounded-full bg-[#22C55E]/15"
          >
            O'rnatish
          </button>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block rounded-[14px] bg-[#131717] border border-white/[0.07] px-4 py-2.5">
    <span className="block text-[11px] text-[#7B8481] mb-1">{label}</span>
    {children}
  </label>
);

const Stepper: React.FC<{ icon: React.ReactNode; onClick: () => void; label: string }> = ({
  icon,
  onClick,
  label,
}) => (
  <button
    onClick={onClick}
    aria-label={label}
    className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center text-white active:bg-white/[0.12]"
  >
    {icon}
  </button>
);

/** UNUM yashil "U + o'q" belgisi */
const UnumMark: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
    <path
      d="M7 5v13a9 9 0 0 0 18 0V5"
      stroke="#22C55E"
      strokeWidth="3.4"
      strokeLinecap="round"
      fill="none"
    />
    <path d="M20 11l5-6 1 7z" fill="#34D77F" />
  </svg>
);

const GoogleMark: React.FC = () => (
  <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden>
    <path
      fill="#4285F4"
      d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z"
    />
    <path
      fill="#34A853"
      d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.5 46 24 46z"
    />
    <path
      fill="#FBBC05"
      d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5A22 22 0 0 0 2 24c0 3.6.9 6.9 2.5 9.9l7.3-5.7z"
    />
    <path
      fill="#EA4335"
      d="M24 10.3c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 3.8 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9.5 12.2-9.5z"
    />
  </svg>
);

const AppleMark: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.2 1.7 2.5 3 2.4 1.2 0 1.6-.8 3.1-.8s1.9.8 3.1.7c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.5-1-2.5-3.6zM14.1 5.2c.7-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.2 1.9-1 3 1 .1 2.1-.5 2.8-1.4z" />
  </svg>
);
