import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * "Bu tibbiy maslahat emas" ogohlantirishi.
 * AI matn ko'rsatiladigan HAR BIR joyda majburiy — dizaynda ham shunday.
 */
export const Disclaimer: React.FC<{ text?: string; className?: string }> = ({
  text = "Ushbu tavsiyalar AI tomonidan siz kiritgan ma'lumotlar asosida shakllantirilgan. Ular taxminiy bo'lib, tibbiy yoki professional maslahat o'rnini bosmaydi.",
  className = '',
}) => (
  <div
    className={`flex items-start gap-2.5 rounded-[16px] bg-[#EF4444]/[0.09] border border-[#EF4444]/20 px-3.5 py-3 ${className}`}
  >
    <AlertTriangle size={15} className="text-[#F87171] shrink-0 mt-[1px]" />
    <p className="text-[11.5px] leading-[1.5] text-[#E5A5A5]">{text}</p>
  </div>
);
