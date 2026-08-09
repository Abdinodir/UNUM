import React, { ReactNode } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';

interface Props {
  title: string;
  onBack: () => void;
  children: ReactNode;
  /** Sarlavha o'ngidagi harakat (masalan "+" tugmasi) */
  action?: ReactNode;
  /** Pastki tab bar ostida qolmasligi uchun qo'shimcha bo'shliq */
  padBottom?: boolean;
}

/**
 * O'ngdan siljib chiqadigan to'liq ekranli ost-sahifa.
 * Dizayndagi "‹ Shaxsiy ma'lumotlar" ko'rinishidagi barcha ekranlar shu qobiqda.
 */
export const SubScreen: React.FC<Props> = ({ title, onBack, children, action, padBottom = true }) => (
  <motion.div
    initial={{ x: '100%', opacity: 0.6 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: '100%', opacity: 0.6 }}
    transition={{ type: 'spring', stiffness: 400, damping: 40 }}
    className="fixed inset-0 z-40 bg-[#0A0C0B] flex flex-col"
  >
    <header className="relative shrink-0 flex items-center gap-2 px-3 pt-[calc(env(safe-area-inset-top)+14px)] pb-3 border-b border-white/[0.05]">
      <button
        onClick={onBack}
        aria-label="Orqaga"
        className="w-9 h-9 -ml-1 flex items-center justify-center rounded-full active:bg-white/[0.06]"
      >
        <ChevronLeft size={22} className="text-white" />
      </button>
      <h1 className="flex-1 text-center text-[17px] font-semibold text-white truncate pr-9">
        {title}
      </h1>
      {action && <div className="absolute right-3">{action}</div>}
    </header>

    <div className={`flex-1 overflow-y-auto px-4 pt-4 ${padBottom ? 'pb-[120px]' : 'pb-6'}`}>
      {children}
    </div>
  </motion.div>
);
