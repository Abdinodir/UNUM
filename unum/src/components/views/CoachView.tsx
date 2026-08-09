import React from 'react';
import { CalendarCheck, ChevronRight, Mic, Send, Sparkles, TrendingUp } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { useUnum } from '../../context/UnumContext';
import { METRICS, scoreLabel } from '../../theme';
import type { Recommendation } from '../../types';
import { TopBar, TopBarAction } from '../shell/TopBar';
import { Card, SectionHeader } from '../ui/Card';
import { MetricBadge, MetricGlyph } from '../ui/MetricIcon';
import { CoachAvatar } from '../ui/CoachAvatar';
import { ScoreRing } from '../ui/ScoreRing';
import { Disclaimer } from '../ui/Disclaimer';
import { SubScreen } from '../ui/SubScreen';
import { Button } from '../ui/Button';
import { GoalCoachCard } from './GoalCoachCard';

type Screen = 'chat' | 'plans' | null;

export const CoachView: React.FC = () => {
  const { recommendations, partners, score, setActiveTab } = useUnum();
  const [detail, setDetail] = React.useState<Recommendation | null>(null);
  const [screen, setScreen] = React.useState<Screen>(null);

  return (
    <>
      <TopBar
        title={
          <span className="inline-flex items-center gap-1.5">
            AI Coach
            <Sparkles size={17} className="text-[#34D77F]" />
          </span>
        }
        right={
          <TopBarAction label="Rejalar" onClick={() => setScreen('plans')}>
            <CalendarCheck size={21} strokeWidth={1.9} className="text-[#22C55E]" />
          </TopBarAction>
        }
      />

      <div className="px-4 pb-[120px] space-y-5">
        <Disclaimer />

        {/* Maqsad kouchi — mavjud ovqatlanish chatidan alohida, chunki
            javob hisoblangan ko'rsatkichlarga tayanadi. */}
        <GoalCoachCard onUpgrade={() => setActiveTab('profile')} />

        {/* Bugungi holat */}
        <Card className="flex items-center gap-4">
          <ScoreRing value={score} size={86} thickness={7} />
          <div className="min-w-0">
            <span className="block text-[13px] text-[#98A29E]">Bugungi holat</span>
            <span className="block text-[15px] font-semibold text-white mt-0.5">
              O'rtacha natija: <span className="text-[#34D77F]">{scoreLabel(score)}</span>
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-[#98A29E] mt-1.5">
              <TrendingUp size={13} className="text-[#34D77F]" />
              Bugun 7 000 qadamga erishishga harakat qiling
            </span>
          </div>
        </Card>

        {/* Tavsiyalar — HAQIQIY ball komponentlaridan quriladi (liveCoach.ts).
            Ma'lumot bo'lmasa o'ylab topilgan tavsiya ko'rsatilmaydi. */}
        <div>
          <SectionHeader title="Tavsiyalar" />
          {recommendations.length === 0 ? (
            <Card>
              <p className="text-[13px] leading-snug text-[#98A29E]">
                Tavsiya berish uchun avval bugungi yozuv kerak. Bitta taom yoki
                bir stakan suv kiriting.
              </p>
            </Card>
          ) : (
          <Card flush className="divide-y divide-white/[0.05]">
            {recommendations.map((rec) => {
              const meta = METRICS[rec.metric];
              return (
                <button
                  key={rec.id}
                  onClick={() => setDetail(rec)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left active:bg-white/[0.03]"
                >
                  <MetricBadge metric={rec.metric} size={36} className="mt-0.5" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14.5px] font-medium text-white">{rec.title}</span>
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: `${meta.color}1F`, color: meta.color }}
                      >
                        {rec.tag}
                      </span>
                    </div>
                    <p className="text-[12px] leading-[1.45] text-[#98A29E] mt-1 line-clamp-2">
                      {rec.summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <span
                      className="text-[14px] font-semibold tabular"
                      style={{ color: meta.color }}
                    >
                      {rec.percent}%
                    </span>
                    <ChevronRight size={16} className="text-[#4B5450]" />
                  </div>
                </button>
              );
            })}
          </Card>
          )}
        </div>

        {/* ⚠️ "Hamkor tavsiyalari" bo'limi OLIB TASHLANDI: u mavjud
            bo'lmagan takliflarni haqiqiy kompaniya nomi bilan ko'rsatardi.
            Haqiqiy shartnoma bo'lganda qaytariladi. */}
        {partners.length > 0 && (
        <div>
          <SectionHeader title="Hamkor tavsiyalari" />
          <div className="snap-row">
            {partners.map((p) => (
              <div
                key={p.id}
                className="w-[132px] rounded-[16px] bg-[#131717] border border-white/[0.07] p-3"
              >
                <span
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[15px] font-bold mb-2"
                  style={{ background: `${p.color}22`, color: p.color }}
                >
                  {p.badge}
                </span>
                <span className="block text-[13px] font-semibold text-white truncate">
                  {p.name}
                </span>
                <span className="block text-[10.5px] text-[#7B8481] leading-[1.35] mt-0.5 line-clamp-2">
                  {p.description}
                </span>
                <span className="block text-[11px] font-semibold text-[#34D77F] mt-2">
                  {p.offer}
                </span>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* AI chat kirish qatori */}
        <div>
          <SectionHeader title="AI chat" />
          <button
            onClick={() => setScreen('chat')}
            className="w-full flex items-center gap-2.5"
            aria-label="AI chatni ochish"
          >
            <CoachAvatar size={40} pulse={false} />
            <span className="flex-1 flex items-center gap-2 h-[46px] rounded-[16px] bg-[#131717] border border-white/[0.07] px-3.5">
              <span className="flex-1 text-left text-[13.5px] text-[#616B67]">
                Savolingizni yozing…
              </span>
              <span className="w-7 h-7 rounded-full bg-[#22C55E] flex items-center justify-center">
                <Mic size={14} className="text-[#07130C]" />
              </span>
              <span className="w-7 h-7 rounded-full bg-[#1B2020] flex items-center justify-center">
                <Send size={13} className="text-[#98A29E]" />
              </span>
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {detail && <RecommendationDetail rec={detail} onClose={() => setDetail(null)} />}
        {screen === 'chat' && <ChatScreen onClose={() => setScreen(null)} />}
        {screen === 'plans' && <PlansScreen onClose={() => setScreen(null)} />}
      </AnimatePresence>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Tavsiya tafsiloti                                                   */
/* ------------------------------------------------------------------ */

const RecommendationDetail: React.FC<{ rec: Recommendation; onClose: () => void }> = ({
  rec,
  onClose,
}) => {
  const meta = METRICS[rec.metric];

  return (
    <SubScreen title="Tavsiya" onBack={onClose} padBottom={false}>
      <div className="space-y-5 pb-8">
        <div className="flex items-start gap-3.5">
          <MetricBadge metric={rec.metric} size={54} />
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-[17px] font-semibold text-white">{rec.title}</h2>
            <p className="text-[12.5px] leading-[1.5] text-[#98A29E] mt-1.5">{rec.summary}</p>
          </div>
        </div>

        <div>
          <h3 className="text-[14.5px] font-semibold text-white mb-2.5">
            Nima uchun tavsiya qilinmoqda?
          </h3>
          <Card flush className="divide-y divide-white/[0.05]">
            {rec.reasons.map((reason, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span
                  className="w-7 h-7 rounded-[9px] flex items-center justify-center shrink-0"
                  style={{ background: `${meta.color}1F`, color: meta.color }}
                >
                  <MetricGlyph metric={rec.metric} size={14} />
                </span>
                <p className="text-[13px] leading-[1.45] text-[#C7CFCC] pt-0.5">{reason}</p>
              </div>
            ))}
          </Card>
        </div>

        <div>
          <h3 className="text-[14.5px] font-semibold text-white mb-2">Tavsiya</h3>
          <Card>
            <p className="text-[13.5px] leading-[1.55] text-[#C7CFCC]">{rec.advice}</p>
          </Card>
        </div>

        <Disclaimer />

        <Button full onClick={onClose}>
          Tushunarli
        </Button>
      </div>
    </SubScreen>
  );
};

/* ------------------------------------------------------------------ */
/* AI chat                                                             */
/* ------------------------------------------------------------------ */

const ChatScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { chat, isCoachTyping, sendChatMessage } = useUnum();
  const [draft, setDraft] = React.useState('');
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.length, isCoachTyping]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void sendChatMessage(text);
  };

  return (
    <SubScreen title="AI chat" onBack={onClose} padBottom={false}>
      <div className="space-y-3.5 pb-[92px]">
        {chat.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="text-[14px] font-medium text-white">Savolingizni yozing</p>
            <p className="mx-auto mt-1.5 max-w-[260px] text-[12.5px] leading-snug text-[#7B8481]">
              Ovqatlanish, suv va harakat bo&rsquo;yicha savol bering — javob
              sizning bugungi yozuvlaringizga tayanadi.
            </p>
          </div>
        )}
        {chat.map((msg) =>
          msg.sender === 'user' ? (
            <div key={msg.id} className="flex justify-end">
              <p className="max-w-[80%] rounded-[16px] rounded-tr-[6px] bg-[#22C55E]/16 border border-[#22C55E]/25 px-3.5 py-2.5 text-[13.5px] leading-[1.45] text-[#DCFCE7]">
                {msg.text}
              </p>
            </div>
          ) : (
            <div key={msg.id} className="space-y-2.5">
              {msg.showDisclaimer && (
                <Disclaimer text="Ushbu javob umumiy tavsiya hisoblanadi. Agar sizda surunkali kasallik yoki sog'liq bilan bog'liq muammo bo'lsa, albatta shifokor bilan maslahatlashing." />
              )}
              <div className="rounded-[16px] rounded-tl-[6px] bg-[#131717] border border-white/[0.07] px-3.5 py-3">
                <div className="text-[13.5px] leading-[1.55] text-[#C7CFCC] [&_ul]:mt-1.5 [&_ul]:space-y-1.5 [&_li]:pl-1 [&_li]:list-disc [&_ul]:ml-4 [&_strong]:text-white [&_p]:mb-2 last:[&_p]:mb-0">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          )
        )}

        {isCoachTyping && (
          <div className="flex items-center gap-2 text-[12.5px] text-[#7B8481]">
            <CoachAvatar size={26} />
            <span>AI yozmoqda…</span>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Yozish qatori */}
      <div className="fixed bottom-0 inset-x-0 z-10">
        <div className="mx-auto max-w-[430px] px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 bg-gradient-to-t from-[#0A0C0B] via-[#0A0C0B] to-transparent">
          <div className="flex items-center gap-2 h-[48px] rounded-[16px] bg-[#131717] border border-white/[0.07] px-3.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Savolingizni yozing…"
              className="flex-1 bg-transparent text-[13.5px] text-white outline-none placeholder:text-[#616B67]"
            />
            <button
              aria-label="Ovozli yozish"
              className="w-8 h-8 rounded-full bg-[#22C55E] flex items-center justify-center shrink-0"
            >
              <Mic size={15} className="text-[#07130C]" />
            </button>
            <button
              onClick={submit}
              disabled={!draft.trim()}
              aria-label="Yuborish"
              className="w-8 h-8 rounded-full bg-[#1B2020] flex items-center justify-center shrink-0 disabled:opacity-40"
            >
              <Send size={14} className="text-[#98A29E]" />
            </button>
          </div>
        </div>
      </div>
    </SubScreen>
  );
};

/* ------------------------------------------------------------------ */
/* Imkoniyatlar va rejalar                                             */
/* ------------------------------------------------------------------ */

const PLAN_TABS = [
  { key: 'today', label: 'Bugungi reja' },
  { key: 'week', label: 'Haftalik reja' },
  { key: 'goals', label: 'Maqsadlar' },
] as const;

const PlansScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { plan, togglePlanItem } = useUnum();
  const [tab, setTab] = React.useState<(typeof PLAN_TABS)[number]['key']>('today');

  return (
    <SubScreen title="Imkoniyatlar va rejalar" onBack={onClose} padBottom={false}>
      <div className="flex items-center gap-1 p-1 rounded-[14px] bg-[#131717] border border-white/[0.06] mb-4">
        {PLAN_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 h-9 rounded-[11px] text-[12.5px] font-medium transition-colors ${
              tab === t.key
                ? 'bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#34D77F]'
                : 'text-[#98A29E]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 pb-[96px]">
        {plan.length === 0 && (
          <Card>
            <p className="text-[13px] leading-snug text-[#98A29E]">
              Reja bugungi ko&rsquo;rsatkichlardan tuziladi. Avval taom yoki
              suv kiriting.
            </p>
          </Card>
        )}
        {plan.map((item) => {
          const meta = METRICS[item.metric];
          return (
            <Card key={item.id}>
              <div className="flex items-start gap-3">
                <MetricBadge metric={item.metric} size={36} />
                <div className="flex-1 min-w-0">
                  <span className="block text-[14.5px] font-medium text-white">{item.title}</span>
                  <p className="text-[12.5px] leading-[1.45] text-[#98A29E] mt-1">{item.body}</p>
                </div>
              </div>
              <div className="flex justify-end mt-2.5">
                <button
                  onClick={() => togglePlanItem(item.id)}
                  className="text-[12.5px] font-semibold"
                  style={{ color: item.planned ? meta.color : '#34D77F' }}
                >
                  {item.planned ? 'Rejaga qo‘shildi ✓' : 'Reja qilish'}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="fixed bottom-0 inset-x-0">
        <div className="mx-auto max-w-[430px] px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 bg-gradient-to-t from-[#0A0C0B] via-[#0A0C0B] to-transparent">
          <Button full onClick={onClose}>
            Reja qo'shish yoki o'zgartirish
          </Button>
        </div>
      </div>
    </SubScreen>
  );
};
