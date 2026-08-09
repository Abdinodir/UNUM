import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { UnumProvider, useUnum } from './context/UnumContext';
import { TabBar } from './components/shell/TabBar';
import { RadialAddMenu } from './components/shell/RadialAddMenu';
import { HomeView } from './components/views/HomeView';
import { PlanTab } from './components/views/PlanTab';
import { AnalysisView } from './components/views/AnalysisView';
import { CoachView } from './components/views/CoachView';
import { ProfileView } from './components/views/ProfileView';
import { AddFlow } from './components/flows/AddFlow';
import { AuthFlow } from './components/flows/AuthFlow';

const AppShell: React.FC = () => {
  const {
    auth,
    bootstrapping,
    profile,
    activeTab,
    setActiveTab,
    addMenuOpen,
    setAddMenuOpen,
    addFlowMetric,
    setAddFlowMetric,
  } = useUnum();

  // Server bilan birinchi tekshiruv tugamaguncha hech narsa ko'rsatmaymiz —
  // aks holda sessiya bor bo'lsa ham kirish ekrani bir lahza chaqnaydi.
  if (bootstrapping) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#22C55E] animate-spin" />
      </div>
    );
  }

  // Sessiya yo'q yoki onboarding tugallanmagan bo'lsa — kirish oqimi
  if (auth.status !== 'authenticated' || !profile.onboarded) {
    return <AuthFlow />;
  }

  const view = {
    home: <HomeView />,
    goals: <PlanTab />,
    analysis: <AnalysisView />,
    coach: <CoachView />,
    profile: <ProfileView />,
  }[activeTab];

  return (
    <>
      {/* Yagona skroll konteyneri — TopBar uning ichida sticky turadi */}
      <div className="h-full overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {view}
          </motion.div>
        </AnimatePresence>
      </div>

      <RadialAddMenu
        open={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        onSelect={(metric) => {
          setAddMenuOpen(false);
          setAddFlowMetric(metric);
        }}
      />

      <TabBar
        active={activeTab}
        onChange={(tab) => {
          setAddMenuOpen(false);
          setActiveTab(tab);
        }}
        addOpen={addMenuOpen}
        onToggleAdd={() => setAddMenuOpen(!addMenuOpen)}
      />

      <AnimatePresence>
        {addFlowMetric && (
          <AddFlow metric={addFlowMetric} onClose={() => setAddFlowMetric(null)} />
        )}
      </AnimatePresence>
    </>
  );
};

export default function App() {
  return (
    <UnumProvider>
      {/*
        Ilova qobig'i aynan viewport balandligida (100dvh — Chrome'da URL paneli
        chiqib-kirganda ham to'g'ri o'lchov). Skroll faqat ichkarida bo'ladi,
        shuning uchun sahifa "cho'zilib" ketmaydi va pastdagi tugmalar
        har doim ekranda qoladi.
      */}
      <div className="h-[100dvh] w-full bg-[#0A0C0B] flex justify-center overflow-hidden">
        <div className="w-full max-w-[430px] h-full relative overflow-hidden">
          <AppShell />
        </div>
      </div>
    </UnumProvider>
  );
}
