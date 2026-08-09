import React, { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface Props {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** O'ng tomondagi qiymat yoki holat */
  value?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  danger?: boolean;
  /** Ostidagi ajratuvchi chiziq (guruh ichidagi oxirgi qatorda kerak emas) */
  divider?: boolean;
  className?: string;
}

export const ListRow: React.FC<Props> = ({
  icon,
  title,
  subtitle,
  value,
  onClick,
  chevron = true,
  danger = false,
  divider = false,
  className = '',
}) => {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${
        divider ? 'border-b border-white/[0.05]' : ''
      } ${onClick ? 'active:bg-white/[0.03]' : ''} ${className}`}
    >
      {icon && <span className="shrink-0 flex items-center justify-center">{icon}</span>}

      <span className="flex-1 min-w-0">
        <span
          className={`block text-[15px] font-medium truncate ${
            danger ? 'text-[#F87171]' : 'text-white'
          }`}
        >
          {title}
        </span>
        {subtitle && (
          <span className="block text-[12px] text-[#98A29E] truncate mt-0.5">{subtitle}</span>
        )}
      </span>

      {value && <span className="shrink-0 text-[13px] text-[#98A29E]">{value}</span>}
      {onClick && chevron && <ChevronRight size={18} className="shrink-0 text-[#4B5450]" />}
    </Wrapper>
  );
};

/** Kartaga o'ralgan qatorlar guruhi */
export const ListGroup: React.FC<{ children: ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`rounded-[20px] bg-[#131717] border border-white/[0.07] overflow-hidden ${className}`}>
    {children}
  </div>
);
