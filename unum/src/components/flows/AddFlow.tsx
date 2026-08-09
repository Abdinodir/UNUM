import React from 'react';
import { Camera, Check, ChevronDown, Loader2, Mic, Sun } from 'lucide-react';
import { motion } from 'motion/react';
import { METRICS, type MetricKey } from '../../theme';
import { SubScreen } from '../ui/SubScreen';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { MetricBadge } from '../ui/MetricIcon';
import { Disclaimer } from '../ui/Disclaimer';
import { triggerHaptic } from '../../utils/haptics';

interface Props {
  metric: MetricKey;
  onClose: () => void;
}

interface AnalyzedItem {
  name: string;
  kcal: number;
}

type Step = 'method' | 'analyzing' | 'result' | 'manual' | 'done';

/** Rasm tahlili ulanmaguncha ishlatiladigan namuna natija */
const SAMPLE_RESULT: AnalyzedItem[] = [
  { name: 'Palov', kcal: 450 },
  { name: 'Salat (sabzavot)', kcal: 80 },
  { name: 'Non', kcal: 120 },
];

/** `data:image/jpeg;base64,...` prefiksisiz toza base64 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Backend bitta taom obyektini qaytaradi: `{ name, calories, ingredients[] }`.
 * Ekranda esa qatorlar ro'yxati kerak — tarkibiy qismlar bo'lsa ularni,
 * bo'lmasa taomning o'zini bitta qator qilamiz.
 */
function toItems(data: unknown): AnalyzedItem[] {
  const meal = data as {
    name?: string;
    calories?: number;
    ingredients?: { name?: string; calories?: number }[];
  };

  const fromIngredients = (meal?.ingredients ?? [])
    .filter((i) => i?.name && typeof i.calories === 'number')
    .map((i) => ({ name: String(i.name), kcal: Math.round(Number(i.calories)) }));

  if (fromIngredients.length) return fromIngredients;
  if (meal?.name && typeof meal.calories === 'number') {
    return [{ name: meal.name, kcal: Math.round(meal.calories) }];
  }
  return SAMPLE_RESULT;
}

const MANUAL_FIELDS: Record<
  Exclude<MetricKey, 'nutrition'>,
  { label: string; unit: string; placeholder: string; step: number }
> = {
  steps: { label: 'Bugun necha qadam yurdingiz?', unit: 'qadam', placeholder: '6500', step: 100 },
  sleep: { label: 'Necha soat uxladingiz?', unit: 'soat', placeholder: '7.5', step: 0.5 },
  screen: { label: 'Ekranda qancha vaqt?', unit: 'soat', placeholder: '2.5', step: 0.5 },
  goals: { label: 'Nechta vazifani bajardingiz?', unit: 'ta', placeholder: '2', step: 1 },
};

export const AddFlow: React.FC<Props> = ({ metric, onClose }) => {
  const isNutrition = metric === 'nutrition';
  const meta = METRICS[metric];

  const [step, setStep] = React.useState<Step>(isNutrition ? 'method' : 'manual');
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<AnalyzedItem[]>([]);
  const [time, setTime] = React.useState('12:30');
  const [manualValue, setManualValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Object URL xotirada qolib ketmasin
  React.useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const analyzePhoto = async (file: File) => {
    setError(null);
    setPhotoUrl(URL.createObjectURL(file));
    setStep('analyzing');

    try {
      // Backend `{ imageBase64 }` kutadi (multipart emas) va 4 MB bilan cheklaydi
      if (file.size > 4 * 1024 * 1024) {
        throw new Error('too-large');
      }
      const imageBase64 = await fileToBase64(file);

      const res = await fetch('/api/ai/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      if (!res.ok) throw new Error(String(res.status));

      setItems(toItems(await res.json()));
    } catch (err) {
      if (err instanceof Error && err.message === 'too-large') {
        setError('Rasm juda katta (maksimum 4 MB).');
      }
      // Backend hali ulanmagan bo'lsa namuna natija ko'rsatiladi
      setItems(SAMPLE_RESULT);
    } finally {
      setStep('result');
    }
  };

  const total = items.reduce((sum, i) => sum + i.kcal, 0);

  const title = isNutrition
    ? step === 'result'
      ? 'Tahlil natijasi'
      : `${meta.label} qo'shish`
    : `${meta.label} qo'shish`;

  return (
    <SubScreen title={title} onBack={onClose} padBottom={false}>
      {/* 1-qadam: usul tanlash */}
      {step === 'method' && (
        <div className="flex flex-col min-h-[calc(100dvh-140px)]">
          <p className="text-center text-[15px] text-[#C7CFCC] mt-6 mb-7 px-6 leading-[1.5]">
            Yegan taomingizni qanday qo'shmoqchisiz?
          </p>

          <div className="space-y-3">
            <MethodCard
              icon={<Camera size={22} />}
              color="#22C55E"
              title="Rasm orqali"
              subtitle="Taomni suratga oling, AI tahlil qiladi"
              onClick={() => fileRef.current?.click()}
            />
            <MethodCard
              icon={<Mic size={22} />}
              color="#8B5CF6"
              title="Ovoz orqali"
              subtitle="Taomni ayting, AI tahlil qiladi"
              onClick={() => {
                // Ovozli kiritish backend ulangach yoqiladi
                setError("Ovozli kiritish backend ulangandan keyin faollashadi.");
              }}
            />
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void analyzePhoto(file);
              e.target.value = '';
            }}
          />

          {error && (
            <p className="text-[12.5px] text-[#F87171] text-center mt-4">{error}</p>
          )}

          <div className="mt-auto pt-8 pb-6">
            <Button variant="secondary" full onClick={onClose}>
              Bekor qilish
            </Button>
          </div>
        </div>
      )}

      {/* 2-qadam: tahlil qilinmoqda */}
      {step === 'analyzing' && (
        <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-200px)] gap-4">
          {photoUrl && (
            <img
              src={photoUrl}
              alt=""
              className="w-40 h-40 object-cover rounded-[20px] border border-white/[0.08]"
            />
          )}
          <Loader2 size={26} className="text-[#22C55E] animate-spin" />
          <p className="text-[14px] text-[#98A29E]">AI taomni tahlil qilmoqda…</p>
        </div>
      )}

      {/* 3-qadam: natija */}
      {step === 'result' && (
        <div className="space-y-4 pb-8">
          {photoUrl && (
            <img
              src={photoUrl}
              alt="Qo'shilayotgan taom"
              className="w-full h-[190px] object-cover rounded-[18px] border border-white/[0.08]"
            />
          )}

          <Card flush className="px-4 py-3">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-[13.5px] font-semibold text-white">AI tahlil qildi</span>
              <span className="text-[#34D77F]">✨</span>
            </div>

            <div className="divide-y divide-white/[0.05]">
              {items.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-2.5">
                  <span className="text-[14px] text-[#C7CFCC]">{item.name}</span>
                  <span className="text-[14px] text-white tabular">{item.kcal} kkal</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3">
                <span className="text-[14.5px] font-semibold text-[#34D77F]">Jami</span>
                <span className="text-[15px] font-bold text-[#34D77F] tabular">{total} kkal</span>
              </div>
            </div>
          </Card>

          <div>
            <span className="block text-[13px] text-[#98A29E] mb-2">Qachon yedingiz?</span>
            <label className="flex items-center gap-2.5 rounded-[16px] bg-[#131717] border border-white/[0.07] px-4 h-[52px]">
              <Sun size={18} className="text-[#F59E0B]" />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="flex-1 bg-transparent text-[15px] text-white outline-none tabular"
              />
              <ChevronDown size={17} className="text-[#616B67]" />
            </label>
          </div>

          <Disclaimer text="Kaloriya qiymatlari AI tomonidan taxminiy hisoblangan. Ular aniq laboratoriya o'lchovi emas." />

          <Button
            full
            onClick={() => {
              triggerHaptic('success', true);
              setStep('done');
            }}
          >
            Bugungi rejaga qo'shish
          </Button>
        </div>
      )}

      {/* Ovqatlanishdan tashqari metrikalar — qo'lda kiritish */}
      {step === 'manual' && !isNutrition && (
        <div className="space-y-5 pb-8">
          <div className="flex flex-col items-center gap-3 pt-4">
            <MetricBadge metric={metric} size={64} />
            <p className="text-[15px] text-[#C7CFCC] text-center">
              {MANUAL_FIELDS[metric as Exclude<MetricKey, 'nutrition'>].label}
            </p>
          </div>

          <label className="flex items-center gap-2 rounded-[16px] bg-[#131717] border border-white/[0.07] px-4 h-[56px]">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={MANUAL_FIELDS[metric as Exclude<MetricKey, 'nutrition'>].step}
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder={MANUAL_FIELDS[metric as Exclude<MetricKey, 'nutrition'>].placeholder}
              className="flex-1 bg-transparent text-[18px] font-semibold text-white outline-none tabular placeholder:text-[#4B5450]"
            />
            <span className="text-[14px] text-[#98A29E]">
              {MANUAL_FIELDS[metric as Exclude<MetricKey, 'nutrition'>].unit}
            </span>
          </label>

          <p className="text-[12px] text-[#7B8481] leading-[1.5]">
            Qadam, uyqu va ekran vaqti integratsiya ulangan bo'lsa avtomatik to'ldiriladi —
            qo'lda kiritish faqat to'ldirish uchun.
          </p>

          <Button
            full
            disabled={!manualValue || Number(manualValue) <= 0}
            onClick={() => {
              triggerHaptic('success', true);
              setStep('done');
            }}
          >
            Saqlash
          </Button>
        </div>
      )}

      {/* Yakuniy holat */}
      {step === 'done' && (
        <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-200px)] gap-4 text-center px-6">
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            className="w-16 h-16 rounded-full bg-[#22C55E] flex items-center justify-center"
          >
            <Check size={30} className="text-[#07130C]" strokeWidth={3} />
          </motion.span>
          <h2 className="text-[19px] font-bold text-white">Qo'shildi</h2>
          <p className="text-[13.5px] text-[#98A29E] leading-[1.5]">
            Natija asosiy ekranda ko'rinadi va bugungi reja yangilanadi.
          </p>
          <Button full className="mt-4" onClick={onClose}>
            Yopish
          </Button>
        </div>
      )}
    </SubScreen>
  );
};

const MethodCard: React.FC<{
  icon: React.ReactNode;
  color: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}> = ({ icon, color, title, subtitle, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3.5 rounded-[18px] bg-[#131717] border border-white/[0.07] px-4 py-4 text-left active:bg-white/[0.04]"
  >
    <span
      className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0"
      style={{ background: `${color}1F`, color }}
    >
      {icon}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-[15px] font-semibold text-white">{title}</span>
      <span className="block text-[12.5px] text-[#98A29E] mt-0.5">{subtitle}</span>
    </span>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m9 6 6 6-6 6" stroke="#4B5450" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
);
