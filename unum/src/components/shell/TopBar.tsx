import React, { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Sarlavha yonidagi pastga qaragan strelka (profil almashtirish) */
  chevron?: boolean;
  onTitleClick?: () => void;
  right?: ReactNode;
  className?: string;
}

/** Ekran tepasidagi sarlavha qatori — safe area hisobga olingan. */
export const TopBar: React.FC<Props> = ({
  title,
  subtitle,
  chevron,
  onTitleClick,
  right,
  className = '',
}) => (
  <header
    className={`sticky top-0 z-30 bg-[#0A0C0B]/92 backdrop-blur-xl px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 ${className}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <button
          onClick={onTitleClick}
          disabled={!onTitleClick}
          className="flex items-center gap-1.5 text-left disabled:cursor-default"
        >
          <h1 className="text-[26px] font-bold tracking-tight text-white leading-none truncate">
            {title}
          </h1>
          {chevron && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="m6 9 6 6 6-6"
                stroke="#98A29E"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        {subtitle && (
          <p className="text-[12.5px] text-[#98A29E] mt-1.5 truncate">{subtitle}</p>
        )}
      </div>

      {right && <div className="shrink-0 pt-1">{right}</div>}
    </div>
  </header>
);

/** Tepa o'ngdagi dumaloq ikonka tugmasi (qo'ng'iroq, kalendar, sozlama) */
export const TopBarAction: React.FC<{
  children: ReactNode;
  onClick?: () => void;
  label: string;
  /** O'ng yuqorida yashil nuqta (o'qilmagan bildirishnoma) */
  dot?: boolean;
}> = ({ children, onClick, label, dot }) => (
  <button
    onClick={onClick}
    aria-label={label}
    className="relative w-10 h-10 flex items-center justify-center rounded-full active:bg-white/[0.06] text-white"
  >
    {children}
    {dot && (
      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#22C55E] ring-2 ring-[#0A0C0B]" />
    )}
  </button>
);
