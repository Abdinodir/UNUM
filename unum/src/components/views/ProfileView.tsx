import React from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  CreditCard,
  Crown,
  Download,
  Globe,
  HelpCircle,
  History,
  LifeBuoy,
  Link2,
  LogOut,
  Mail,
  MessageSquare,
  Moon,
  Plus,
  Receipt,
  Ruler,
  Settings,
  Shield,
  Sparkles,
  Target,
  Trash2,
  User,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useUnum } from '../../context/UnumContext';
import { METRICS, RADAR_ORDER, scoreLabel } from '../../theme';
import { ACTIVITY_LABELS } from '../../types';
import { useBilling, formatUntil } from '../../lib/useBilling';
import { PremiumView } from './PremiumView';
import { TopBar, TopBarAction } from '../shell/TopBar';
import { Card, SectionHeader } from '../ui/Card';
import { ListGroup, ListRow } from '../ui/ListRow';
import { ScoreRing } from '../ui/ScoreRing';
import { MetricBadge } from '../ui/MetricIcon';
import { ProgressBar } from '../ui/ProgressBar';
import { Toggle } from '../ui/Toggle';
import { SubScreen } from '../ui/SubScreen';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';

type ProfileScreen =
  | 'personal'
  | 'goals'
  | 'integrations'
  | 'subscription'
  | 'settings'
  | 'privacy'
  | 'help'
  | null;

export const ProfileView: React.FC = () => {
  const { profile, score, signOut, deleteAccount } = useUnum();
  const [screen, setScreen] = React.useState<ProfileScreen>(null);
  const [confirm, setConfirm] = React.useState<'signout' | 'delete' | null>(null);
  // Obuna holati serverdan — mock `subscription` dan EMAS.
  const { status: billing } = useBilling();

  return (
    <>
      <TopBar
        title="Profil"
        right={
          <TopBarAction label="Sozlamalar" onClick={() => setScreen('settings')}>
            <Settings size={20} strokeWidth={1.9} />
          </TopBarAction>
        }
      />

      <div className="px-4 pb-[120px] space-y-4">
        {/* Foydalanuvchi */}
        <Card onClick={() => setScreen('personal')} className="flex items-center gap-3">
          <span className="w-14 h-14 rounded-full bg-[#1B2020] border border-white/[0.08] flex items-center justify-center shrink-0">
            <User size={24} className="text-[#98A29E]" />
          </span>
          <div className="flex-1 min-w-0">
            <span className="block text-[16px] font-semibold text-white truncate">
              {profile.name}
            </span>
            <span className="block text-[12.5px] text-[#98A29E] truncate">{profile.email}</span>
          </div>
          <ChevronRight size={18} className="text-[#4B5450] shrink-0" />
        </Card>

        {/* UNUM Score */}
        <Card className="flex items-center gap-4">
          <ScoreRing value={score} size={78} thickness={7} />
          <div className="flex-1 min-w-0">
            <span className="block text-[14px] font-semibold text-white">UNUM Score</span>
            <div className="flex items-end gap-[3px] h-7 mt-2">
              {[42, 55, 48, 62, 58, 70, 66, 74, 71, 78].map((v, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-[2px] bg-[#22C55E]"
                  style={{ height: `${v}%`, opacity: 0.35 + (i / 10) * 0.65 }}
                />
              ))}
            </div>
            <span className="block text-[11.5px] text-[#34D77F] mt-2">
              {scoreLabel(score)} yo'ldasiz! 🚀
            </span>
          </div>
        </Card>

        {/* Premium */}
        <button
          onClick={() => setScreen('subscription')}
          className="w-full flex items-center gap-3 rounded-[20px] px-4 py-4 text-left"
          style={{ background: 'linear-gradient(100deg, #1B7F4B, #22C55E)' }}
        >
          <Crown size={22} className="text-[#FDE68A] shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-bold text-white">UNUM Premium</span>
            <span className="block text-[11.5px] text-white/80 mt-0.5">
              {billing?.premium
                ? `Faol${
                    formatUntil(billing.premiumUntil)
                      ? ` · ${formatUntil(billing.premiumUntil)} gacha`
                      : ''
                  }`
                : 'Obuna faol emas'}
            </span>
          </span>
          <ChevronRight size={18} className="text-white/80 shrink-0" />
        </button>

        {/* Menyu */}
        <ListGroup>
          <ListRow
            icon={<User size={18} className="text-[#98A29E]" />}
            title="Shaxsiy ma'lumotlar"
            onClick={() => setScreen('personal')}
            divider
          />
          <ListRow
            icon={<Target size={18} className="text-[#98A29E]" />}
            title="Maqsadlarim"
            onClick={() => setScreen('goals')}
            divider
          />
          <ListRow
            icon={<Link2 size={18} className="text-[#98A29E]" />}
            title="Integratsiyalar"
            onClick={() => setScreen('integrations')}
            divider
          />
          <ListRow
            icon={<Bell size={18} className="text-[#98A29E]" />}
            title="Bildirishnomalar va sozlamalar"
            onClick={() => setScreen('settings')}
            divider
          />
          <ListRow
            icon={<Shield size={18} className="text-[#98A29E]" />}
            title="Maxfiylik va ma'lumotlar"
            onClick={() => setScreen('privacy')}
            divider
          />
          <ListRow
            icon={<LifeBuoy size={18} className="text-[#98A29E]" />}
            title="Yordam va qo'llab-quvvatlash"
            onClick={() => setScreen('help')}
            divider
          />
          <ListRow
            icon={<LogOut size={18} className="text-[#F87171]" />}
            title="Akkauntdan chiqish"
            danger
            onClick={() => setConfirm('signout')}
          />
        </ListGroup>

        <p className="text-center text-[11px] text-[#4B5450] pt-2">UNUM · v1.0.0</p>
      </div>

      <AnimatePresence>
        {screen === 'personal' && <PersonalScreen onClose={() => setScreen(null)} />}
        {screen === 'goals' && <GoalsScreen onClose={() => setScreen(null)} />}
        {screen === 'integrations' && <IntegrationsScreen onClose={() => setScreen(null)} />}
        {screen === 'subscription' && <PremiumView onBack={() => setScreen(null)} />}
        {screen === 'settings' && <SettingsScreen onClose={() => setScreen(null)} />}
        {screen === 'privacy' && (
          <PrivacyScreen onClose={() => setScreen(null)} onDelete={() => setConfirm('delete')} />
        )}
        {screen === 'help' && <HelpScreen onClose={() => setScreen(null)} />}
      </AnimatePresence>

      {/* Chiqish tasdiqlash */}
      <Sheet open={confirm === 'signout'} onClose={() => setConfirm(null)}>
        <div className="px-5 pb-8 pt-4 text-center">
          <span className="mx-auto w-14 h-14 rounded-full bg-[#1B2020] flex items-center justify-center mb-4">
            <LogOut size={24} className="text-[#98A29E]" />
          </span>
          <h2 className="text-[17px] font-semibold text-white">Akkauntdan chiqish</h2>
          <p className="text-[13px] text-[#98A29E] leading-[1.5] mt-2 mb-6">
            Akkauntingizdan chiqmoqchimisiz? Qayta kirganingizda ma'lumotlaringiz saqlanib
            qoladi.
          </p>
          <div className="space-y-2.5">
            <Button variant="dangerSolid" full onClick={signOut}>
              Chiqish
            </Button>
            <Button variant="secondary" full onClick={() => setConfirm(null)}>
              Bekor qilish
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Akkauntni o'chirish tasdiqlash */}
      <Sheet open={confirm === 'delete'} onClose={() => setConfirm(null)}>
        <div className="px-5 pb-8 pt-4 text-center">
          <span className="mx-auto w-14 h-14 rounded-full bg-[#EF4444]/15 flex items-center justify-center mb-4">
            <AlertTriangle size={24} className="text-[#F87171]" />
          </span>
          <h2 className="text-[17px] font-semibold text-[#F87171]">Ogohlantirish!</h2>
          <p className="text-[13px] text-[#98A29E] leading-[1.5] mt-2 mb-6">
            Akkauntingizni o'chirsangiz, barcha ma'lumotlaringiz butunlay o'chiriladi va qayta
            tiklab bo'lmaydi.
          </p>
          <div className="space-y-2.5">
            <Button variant="dangerSolid" full onClick={deleteAccount}>
              Akkauntni o'chirish
            </Button>
            <Button variant="secondary" full onClick={() => setConfirm(null)}>
              Bekor qilish
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* 1. Shaxsiy ma'lumotlar                                              */
/* ------------------------------------------------------------------ */

const PersonalScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { profile } = useUnum();

  return (
    <SubScreen title="Shaxsiy ma'lumotlar" onBack={onClose}>
      <SectionHeader title="Asosiy ma'lumotlar" />
      <ListGroup className="mb-5">
        <ListRow title="Ism" value={profile.name} chevron={false} divider />
        <ListRow title="Yosh" value={`${profile.age}`} chevron={false} divider />
        <ListRow
          title="Jins"
          value={profile.gender === 'male' ? 'Erkak' : 'Ayol'}
          chevron={false}
          divider
        />
        <ListRow title="Bo'y" value={`${profile.heightCm} sm`} chevron={false} divider />
        <ListRow title="Vazn" value={`${profile.weightKg} kg`} chevron={false} divider />
        <ListRow
          title="Maqsad vazni"
          value={`${profile.targetWeightKg} kg`}
          chevron={false}
          divider
        />
        <ListRow
          title="Faollik darajasi"
          value={ACTIVITY_LABELS[profile.activity]}
          chevron={false}
        />
      </ListGroup>

      <SectionHeader title="Qo'shimcha ma'lumotlar" />
      <ListGroup className="mb-5">
        <ListRow
          icon={<Moon size={17} className="text-[#98A29E]" />}
          title="Uyqu vaqti"
          value={profile.sleepWindow}
          chevron={false}
          divider
        />
        <ListRow title="Sog'liq cheklovlari" value={profile.healthLimits} chevron={false} divider />
        <ListRow title="Allergiyalar" value={profile.allergies} chevron={false} />
      </ListGroup>

      <div className="flex items-start gap-2.5 rounded-[16px] bg-[#22C55E]/[0.07] border border-[#22C55E]/20 px-3.5 py-3">
        <Shield size={15} className="text-[#34D77F] shrink-0 mt-0.5" />
        <p className="text-[11.5px] leading-[1.5] text-[#A7C4B4]">
          Bu ma'lumotlar siz uchun tavsiyalar berish va tahlillarni aniqroq qilish uchun
          ishlatiladi. Ma'lumotlaringiz shifrlangan holda saqlanadi va uchinchi tomonga
          berilmaydi.
        </p>
      </div>
    </SubScreen>
  );
};

/* ------------------------------------------------------------------ */
/* 2. Maqsadlarim                                                      */
/* ------------------------------------------------------------------ */

const GoalsScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { metrics, recommendations } = useUnum();

  return (
    <SubScreen
      title="Maqsadlarim"
      onBack={onClose}
      action={
        <button
          aria-label="Yangi maqsad"
          className="w-9 h-9 flex items-center justify-center rounded-full active:bg-white/[0.06]"
        >
          <Plus size={20} className="text-white" />
        </button>
      }
    >
      <p className="text-[12.5px] leading-[1.5] text-[#98A29E] mb-4">
        Maqsadlaringizni boshqaring, o'zgartiring va o'z rivojlanishingizni kuzating.
      </p>

      <div className="space-y-3">
        {RADAR_ORDER.map((key) => {
          const m = metrics[key];
          const meta = METRICS[key];
          const rec = recommendations.find((r) => r.metric === key);

          return (
            <Card key={key}>
              <div className="flex items-start gap-3">
                <MetricBadge metric={key} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[14.5px] font-medium text-white truncate">
                      {meta.label}
                    </span>
                    <span className="text-[12.5px] text-[#98A29E] tabular shrink-0">
                      {m.target} {m.unit}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 mt-1 mb-2">
                    <span className="text-[11.5px] text-[#7B8481]">
                      Joriy: {m.current} {m.unit}
                    </span>
                    <span
                      className="text-[12.5px] font-semibold tabular"
                      style={{ color: meta.color }}
                    >
                      {m.percent}%
                    </span>
                  </div>
                  <ProgressBar percent={m.percent} color={meta.color} />
                </div>
              </div>

              {rec && (
                <div className="flex items-start gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                  <Sparkles size={13} className="text-[#34D77F] shrink-0 mt-0.5" />
                  <p className="text-[11.5px] leading-[1.45] text-[#98A29E]">
                    <span className="text-[#34D77F] font-medium">AI tavsiyasi:</span>{' '}
                    {rec.advice}
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <ListGroup className="mt-4">
        <ListRow
          icon={<History size={17} className="text-[#98A29E]" />}
          title="Tugatilgan maqsadlar tarixi"
          onClick={() => {}}
        />
      </ListGroup>
    </SubScreen>
  );
};

/* ------------------------------------------------------------------ */
/* 3. Integratsiyalar                                                  */
/* ------------------------------------------------------------------ */

const IntegrationsScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { integrations, setIntegrationConnected } = useUnum();

  return (
    <SubScreen title="Integratsiyalar" onBack={onClose}>
      <p className="text-[12.5px] leading-[1.5] text-[#98A29E] mb-4">
        Ma'lumotlaringizni aniqroq tahlil qilish uchun hisoblaringizni ulang.
      </p>

      <ListGroup className="mb-4">
        {integrations.map((item, i) => (
          <ListRow
            key={item.key}
            divider={i < integrations.length - 1}
            chevron={!item.nativeOnly}
            icon={
              <span
                className="w-8 h-8 rounded-[9px] flex items-center justify-center"
                style={{ background: `${item.color}1F`, color: item.color }}
              >
                <Link2 size={15} />
              </span>
            }
            title={item.name}
            subtitle={item.description}
            value={
              item.nativeOnly ? (
                // Brauzerda bu API'lar umuman yo'q — noto'g'ri "Ulangan" ko'rsatmaymiz
                <span className="text-[#616B67]">
                  {item.key === 'google_fit' ? 'Mavjud emas' : 'Faqat ilovada'}
                </span>
              ) : (
                <span className={item.connected ? 'text-[#34D77F]' : 'text-[#F59E0B]'}>
                  {item.connected ? 'Ulangan' : 'Ulash'}
                </span>
              )
            }
            onClick={
              item.nativeOnly
                ? undefined
                : () => void setIntegrationConnected(item.key, !item.connected)
            }
          />
        ))}
      </ListGroup>

      <p className="text-[11px] leading-[1.5] text-[#616B67]">
        Google Calendar shu yerdan ulanadi — UNUM faqat <b>o'qish</b> ruxsatini so'raydi,
        hech narsa yozmaydi. Uzganingizda ruxsat Google tomonida ham bekor qilinadi.
      </p>
      <p className="text-[11px] leading-[1.5] text-[#616B67] mt-2">
        Apple Health, Health Connect, Smartwatch va Screen Time brauzerda mavjud emas —
        ular mobil ilovada ulanadi. Google Fit'ni Google 2026-yil oxirida to'xtatadi,
        shuning uchun qadam va uyqu ma'lumoti Health Connect orqali olinadi.
      </p>
    </SubScreen>
  );
};

/* ------------------------------------------------------------------ */
/* 4. Obuna                                                            */
/* ------------------------------------------------------------------ */

/*
 * Eski `SubscriptionScreen` OLIB TASHLANDI.
 *
 * U mock ma'lumot ko'rsatardi: soxta karta raqami (•••• 4242), soxta
 * "keyingi to'lov sanasi" va hech narsa qilmaydigan tugmalar. Obuna faol
 * bo'lmasa ham "Premium imkoniyatlari" ro'yxati ko'rinardi.
 *
 * O'rniga `PremiumView` — u haqiqiy `/api/billing/status` javobini o'qiydi
 * va Click orqali to'lovni boshlaydi.
 */

/* ------------------------------------------------------------------ */
/* 5. Sozlamalar                                                       */
/* ------------------------------------------------------------------ */

const LANGUAGE_LABELS = { uz: "O'zbekcha", ru: 'Русский', en: 'English' } as const;

const SettingsScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { settings, updateSettings } = useUnum();

  return (
    <SubScreen title="Bildirishnomalar va sozlamalar" onBack={onClose}>
      <ListGroup>
        <ListRow
          icon={<Bell size={17} className="text-[#98A29E]" />}
          title="Bildirishnomalar"
          chevron={false}
          divider
          value={
            <Toggle
              checked={settings.notifications}
              onChange={(v) => updateSettings({ notifications: v })}
              label="Bildirishnomalar"
            />
          }
        />
        <ListRow
          icon={<MessageSquare size={17} className="text-[#98A29E]" />}
          title="Eslatmalar"
          chevron={false}
          divider
          value={
            <Toggle
              checked={settings.reminders}
              onChange={(v) => updateSettings({ reminders: v })}
              label="Eslatmalar"
            />
          }
        />
        <ListRow
          icon={<Moon size={17} className="text-[#98A29E]" />}
          title="Tungi rejim"
          chevron={false}
          divider
          value={
            <Toggle
              checked={settings.nightMode}
              onChange={(v) => updateSettings({ nightMode: v })}
              label="Tungi rejim"
            />
          }
        />
        <ListRow
          icon={<Globe size={17} className="text-[#98A29E]" />}
          title="Til"
          value={LANGUAGE_LABELS[settings.language]}
          onClick={() =>
            updateSettings({
              language: settings.language === 'uz' ? 'ru' : settings.language === 'ru' ? 'en' : 'uz',
            })
          }
          divider
        />
        <ListRow
          icon={<Ruler size={17} className="text-[#98A29E]" />}
          title="O'lchov birliklari"
          value={settings.units === 'metric' ? 'Metrik (kg, sm)' : 'Imperial (lb, ft)'}
          onClick={() =>
            updateSettings({ units: settings.units === 'metric' ? 'imperial' : 'metric' })
          }
          divider
        />
        <ListRow
          icon={<Sparkles size={17} className="text-[#98A29E]" />}
          title="Haftaning boshlanishi"
          value={settings.weekStart === 'mon' ? 'Dushanba' : 'Yakshanba'}
          onClick={() =>
            updateSettings({ weekStart: settings.weekStart === 'mon' ? 'sun' : 'mon' })
          }
        />
      </ListGroup>
    </SubScreen>
  );
};

/* ------------------------------------------------------------------ */
/* 6. Maxfiylik                                                        */
/* ------------------------------------------------------------------ */

const PrivacyScreen: React.FC<{ onClose: () => void; onDelete: () => void }> = ({
  onClose,
  onDelete,
}) => (
  <SubScreen title="Maxfiylik va ma'lumotlar" onBack={onClose}>
    <ListGroup>
      <ListRow
        icon={<Download size={17} className="text-[#98A29E]" />}
        title="Ma'lumotlarimni yuklab olish"
        subtitle="Barcha yozuvlar JSON formatida"
        onClick={() => {}}
        divider
      />
      <ListRow
        icon={<Sparkles size={17} className="text-[#98A29E]" />}
        title="AI uchun ishlatiladigan ma'lumotlar"
        onClick={() => {}}
        divider
      />
      <ListRow
        icon={<Trash2 size={17} className="text-[#98A29E]" />}
        title="Ma'lumotlarni o'chirish"
        subtitle="Yozuvlar o'chadi, akkaunt qoladi"
        onClick={() => {}}
        divider
      />
      <ListRow
        icon={<BookOpen size={17} className="text-[#98A29E]" />}
        title="Maxfiylik siyosati"
        onClick={() => {}}
        divider
      />
      <ListRow
        icon={<Trash2 size={17} className="text-[#F87171]" />}
        title="Akkauntni o'chirish"
        danger
        onClick={() => {
          onClose();
          onDelete();
        }}
      />
    </ListGroup>
  </SubScreen>
);

/* ------------------------------------------------------------------ */
/* 7. Yordam                                                           */
/* ------------------------------------------------------------------ */

const HelpScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <SubScreen title="Yordam va qo'llab-quvvatlash" onBack={onClose}>
    <ListGroup>
      <ListRow
        icon={<HelpCircle size={17} className="text-[#98A29E]" />}
        title="FAQ"
        onClick={() => {}}
        divider
      />
      <ListRow
        icon={<Mail size={17} className="text-[#98A29E]" />}
        title="Biz bilan bog'lanish"
        onClick={() => {}}
        divider
      />
      <ListRow
        icon={<AlertTriangle size={17} className="text-[#98A29E]" />}
        title="Muammo haqida xabar berish"
        onClick={() => {}}
        divider
      />
      <ListRow
        icon={<MessageSquare size={17} className="text-[#98A29E]" />}
        title="Taklif yuborish"
        onClick={() => {}}
      />
    </ListGroup>
  </SubScreen>
);
