import React from 'react';

interface ViewfinderBracketsProps {
  className?: string;
  sizeClass?: string;
}

/**
 * Renders precision warm terracotta/gold L-shaped viewfinder corner brackets
 * framing key editorial panels and stages.
 */
export function ViewfinderBrackets({
  className = 'border-[#c9644c]/70',
  sizeClass = 'h-4 w-4 sm:h-5 sm:w-5',
}: ViewfinderBracketsProps) {
  return (
    <>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-2.5 left-2.5 border-t border-l ${sizeClass} ${className}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-2.5 right-2.5 border-t border-r ${sizeClass} ${className}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-2.5 left-2.5 border-b border-l ${sizeClass} ${className}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-2.5 right-2.5 border-b border-r ${sizeClass} ${className}`}
      />
    </>
  );
}

/**
 * Subtle constellation signal graphic flanking editorial copy.
 */
export function SignalConstellationSVG() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 640 80"
      className="pointer-events-none mx-auto h-12 w-full max-w-2xl opacity-75 sm:h-14"
      fill="none"
    >
      {/* Left constellation cluster */}
      <path
        d="M42 52 L118 22 L174 36"
        stroke="rgba(218, 168, 98, 0.25)"
        strokeWidth="1"
      />
      <circle cx="42" cy="52" r="5" fill="#d4a15a" fillOpacity="0.55" />
      <circle cx="42" cy="52" r="9" fill="#d4a15a" fillOpacity="0.14" />
      <circle cx="118" cy="22" r="3" fill="#c9644c" fillOpacity="0.7" />
      <circle cx="174" cy="36" r="2.5" fill="#e6b86e" fillOpacity="0.6" />

      {/* Right constellation cluster */}
      <path
        d="M466 36 L526 20 L586 48"
        stroke="rgba(218, 168, 98, 0.25)"
        strokeWidth="1"
      />
      <circle cx="466" cy="36" r="2.5" fill="#c9644c" fillOpacity="0.65" />
      <circle cx="526" cy="20" r="3.5" fill="#c9644c" fillOpacity="0.7" />
      <circle cx="586" cy="48" r="5" fill="#e6b86e" fillOpacity="0.6" />
      <circle cx="586" cy="48" r="9" fill="#e6b86e" fillOpacity="0.14" />
    </svg>
  );
}

export const OBSIDIAN_SURFACE =
  'rounded-xl border border-[#d4a55c]/20 bg-[#16100b]/92 shadow-[0_12px_36px_rgba(0,0,0,0.45)] backdrop-blur-sm';

export const OBSIDIAN_SUB_SURFACE =
  'rounded-lg border border-[#d4a55c]/16 bg-[#1d150f]/80';

export const OBSIDIAN_INPUT =
  'rounded-lg border border-[#d4a55c]/28 bg-[#0e0a07] text-[#faf5ee] placeholder:text-[#7f6f5d] focus:border-[#e6b86e] focus:outline-none focus:ring-2 focus:ring-[#e6b86e]/20';

