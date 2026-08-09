import React, { ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Sarlavha bo'lsa tepada tortish chizig'i ostida ko'rsatiladi */
  title?: string;
  className?: string;
}

/** Pastdan chiqadigan modal. Fon bosilganda va Esc bosilganda yopiladi. */
export const Sheet: React.FC<Props> = ({ open, onClose, children, title, className = '' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className={`relative w-full max-w-[430px] max-h-[88dvh] overflow-y-auto rounded-t-[28px] bg-[#131717] border-t border-x border-white/[0.08] pb-[env(safe-area-inset-bottom)] ${className}`}
          >
            <div className="sticky top-0 z-10 bg-[#131717] pt-2.5 pb-1">
              <div className="mx-auto w-10 h-1 rounded-full bg-white/15" />
              {title && (
                <h2 className="text-center text-[16px] font-semibold text-white mt-3">{title}</h2>
              )}
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
