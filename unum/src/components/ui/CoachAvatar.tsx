import React from 'react';

/**
 * AI Coach robot avatari — SVG, tashqi rasm yuklamaydi.
 * Ko'zlari yashil, `pulse` bilan "tirik" ko'rinadi.
 */
export const CoachAvatar: React.FC<{ size?: number; pulse?: boolean; className?: string }> = ({
  size = 48,
  pulse = true,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    className={className}
    role="img"
    aria-label="AI Coach"
  >
    {/* Antenna */}
    <line x1="32" y1="8" x2="32" y2="15" stroke="#5A6663" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="32" cy="6" r="2.6" fill="#34D77F" />

    {/* Yon "quloqlar" */}
    <rect x="4" y="28" width="7" height="14" rx="3.5" fill="#2B3230" />
    <rect x="53" y="28" width="7" height="14" rx="3.5" fill="#2B3230" />

    {/* Bosh */}
    <rect x="10" y="15" width="44" height="38" rx="14" fill="#3A4341" />
    <rect x="10" y="15" width="44" height="38" rx="14" fill="url(#coachHead)" />

    {/* Ekran */}
    <rect x="16" y="23" width="32" height="20" rx="9" fill="#0F1413" />

    {/* Ko'zlar */}
    <circle cx="25.5" cy="33" r="4.6" fill="#22C55E">
      {pulse && (
        <animate attributeName="opacity" values="1;0.45;1" dur="2.6s" repeatCount="indefinite" />
      )}
    </circle>
    <circle cx="38.5" cy="33" r="4.6" fill="#22C55E">
      {pulse && (
        <animate attributeName="opacity" values="1;0.45;1" dur="2.6s" repeatCount="indefinite" />
      )}
    </circle>
    <circle cx="25.5" cy="33" r="1.8" fill="#0A1A10" />
    <circle cx="38.5" cy="33" r="1.8" fill="#0A1A10" />

    <defs>
      <linearGradient id="coachHead" x1="32" y1="15" x2="32" y2="53" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF" stopOpacity="0.10" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
    </defs>
  </svg>
);
