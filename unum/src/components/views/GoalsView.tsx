import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Crown, Loader2, Plus, Target, Trash2 } from 'lucide-react';
import { TopBar, TopBarAction } from '../shell/TopBar';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import {
  api,
  GOAL_CATEGORIES,
  type Goal,
  type GoalCategory,
  type GoalInput,
  type GoalsResponse,
  type Prediction,
} from '../../lib/api';
import { GoalEditor } from '../flows/GoalEditor';

const categoryLabel = (id: GoalCategory) =>
  GOAL_CATEGORIES.find((c) => c.id === id)?.label ?? 'Shaxsiy';

/**
 * Deadline matni. Muddat o'tib ketgan bo'lsa qizil — bu yagona joyda
 * hisoblanadi, aks holda ro'yxat va tahrir ekrani har xil kun ko'rsatardi.
 */
function deadlineText(goal: Goal): { text: string; danger: boolean } | null {
  if (goal.daysLeft == null) return null;
  if (goal.status === 'done') return { text: 'Bajarildi', danger: false };
  if (goal.daysLeft < 0) return { text: `${Math.abs(goal.daysLeft)} kun kechikdi`, danger: true };
  if (goal.daysLeft === 0) return { text: 'Bugun tugaydi', danger: true };
  return { text: `${goal.daysLeft} kun qoldi`, danger: goal.daysLeft <= 7 };
}

const GoalCard: React.FC<{
  goal: Goal;
  prediction?: Prediction;
  onOpen: () => void;
}> = ({ goal, prediction, onOpen }) => {
  const dl = deadlineText(goal);
  return (
    <Card onClick={onOpen} className="mb-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">{goal.title}</p>
          <p className="mt-0.5 text-[11.5px] text-[#7B8481]">
            {categoryLabel(goal.category)}
            {goal.milestonesTotal > 0 &&
              ` · ${goal.milestonesDone}/${goal.milestonesTotal} bosqich`}
            {goal.metric &&
              ` · ${goal.metric.current}/${goal.metric.target} ${goal.metric.unit}`}
          </p>
        </div>
        <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[#22C55E]">
          {goal.progressPercent}%
        </span>
      </div>

      <ProgressBar percent={goal.progressPercent} color="#22C55E" className="mt-3" />

      {dl && (
        <p className={`mt-2 text-[11.5px] ${dl.danger ? 'text-[#F87171]' : 'text-[#98A29E]'}`}>
          {dl.text}
        </p>
      )}

      {/* Prognoz — faqat aytadigan gap bo'lganda. Ma'lumot yetarli
          bo'lmaganda satr ko'rsatilsa, u shovqinga aylanadi. */}
      {prediction && prediction.onTrack != null && goal.status === 'active' && (
        <p
          className="mt-1.5 text-[11.5px] leading-snug"
          style={{ color: prediction.onTrack ? '#34D77F' : '#F0A868' }}
        >
          {prediction.message}
        </p>
      )}
    </Card>
  );
};

export const GoalsView: React.FC<{ header?: React.ReactNode }> = ({ header }) => {
  const [data, setData] = useState<GoalsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});

  const load = () =>
    api
      .goals()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));

  useEffect(() => {
    load();
    // Prognoz premium funksiya — qulflangan bo'lsa jim o'tamiz, maqsadlar
    // ro'yxati baribir ishlashi kerak.
    api.predictions()
      .then((r) => {
        if (!('predictions' in r)) return;
        setPredictions(Object.fromEntries(r.predictions.map((p) => [p.goalId, p])));
      })
      .catch(() => {});
  }, []);

  const active = data?.goals.filter((g) => g.status === 'active') ?? [];
  const done = data?.goals.filter((g) => g.status === 'done') ?? [];
  const archived = data?.goals.filter((g) => g.status === 'archived') ?? [];

  // Chegaraga yetgan bo'lsa tugmani OLDINDAN o'chiramiz — bosib, keyin
  // 403 xatosini ko'rsatish yomon tajriba.
  const atLimit = data?.limit != null && active.length >= data.limit;

  const save = async (input: GoalInput) => {
    setSaving(true);
    setError(null);
    try {
      if (editing && editing !== 'new') await api.updateGoal(editing.id, input);
      else await api.createGoal(input);
      await load();
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (goal: Goal) => {
    setSaving(true);
    try {
      await api.deleteGoal(goal.id);
      await load();
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar
        title="Maqsadlar"
        right={
          <TopBarAction
            label="Yangi maqsad"
            onClick={() => setEditing('new')}
          >
            <Plus size={20} strokeWidth={2.2} />
          </TopBarAction>
        }
      />

      <div className="px-4 pb-[120px] pt-2">
        {header}
        {!data && !error && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#22C55E]" />
          </div>
        )}

        {error && (
          <Card className="mb-3">
            <p className="text-[13px] text-[#F87171]">{error}</p>
          </Card>
        )}

        {data && active.length === 0 && done.length === 0 && (
          <div className="pt-14 text-center">
            <Target size={38} className="mx-auto mb-3 text-[#2E3735]" strokeWidth={1.6} />
            <p className="text-[16px] font-semibold text-white">Hali maqsad yo&rsquo;q</p>
            <p className="mx-auto mt-1.5 max-w-[280px] text-[13px] leading-snug text-[#7B8481]">
              Birinchi maqsadingizni qo&rsquo;shing — UNUM uni bosqichlarga bo&rsquo;lib,
              har kuni nima qilish kerakligini ko&rsquo;rsatadi.
            </p>
            <Button className="mt-5" onClick={() => setEditing('new')}>
              Maqsad qo&rsquo;shish
            </Button>
          </div>
        )}

        {active.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            prediction={predictions[g.id]}
            onOpen={() => setEditing(g)}
          />
        ))}

        {data && active.length > 0 && (
          <>
            {atLimit ? (
              <Card className="mt-1 border-[#22C55E]/25 bg-[#22C55E]/[0.06]">
                <div className="flex items-start gap-2.5">
                  <Crown size={18} className="mt-0.5 shrink-0 text-[#22C55E]" />
                  <div>
                    <p className="text-[13.5px] font-semibold text-white">
                      Bepul rejada {data.limit} ta maqsad
                    </p>
                    <p className="mt-0.5 text-[12px] leading-snug text-[#98A29E]">
                      Cheksiz maqsad uchun Premium. Yoki mavjud maqsadni arxivlang.
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <Button variant="secondary" full className="mt-1" onClick={() => setEditing('new')}>
                <Plus size={17} /> Yangi maqsad
              </Button>
            )}
          </>
        )}

        {done.length > 0 && (
          <>
            <h2 className="mb-2.5 mt-6 text-[13px] font-semibold tracking-tight text-[#7B8481]">
              Bajarilgan ({done.length})
            </h2>
            {done.map((g) => (
              <GoalCard key={g.id} goal={g} onOpen={() => setEditing(g)} />
            ))}
          </>
        )}

        {archived.length > 0 && (
          <>
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="mt-6 mb-2.5 text-[13px] font-semibold tracking-tight text-[#7B8481]"
            >
              Arxiv ({archived.length}) {showArchived ? '▴' : '▾'}
            </button>
            {showArchived && archived.map((g) => (
              <GoalCard key={g.id} goal={g} onOpen={() => setEditing(g)} />
            ))}
          </>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <GoalEditor
            goal={editing === 'new' ? null : editing}
            saving={saving}
            onSave={save}
            onDelete={editing === 'new' ? undefined : () => remove(editing)}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};
