'use client';

// ─────────────────────────────────────────────────────────────
// OddsChip — pressable odds pill with orange flash on click (v2)
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';

interface OddsChipProps {
  label: string;
  value: string;
  onClick?: () => void;
}

export default function OddsChip({ label, value, onClick }: OddsChipProps) {
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 300);
    onClick?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 outline-none transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] cursor-pointer motion-reduce:transition-none motion-reduce:active:scale-100 ${
        pressed
          ? 'border-[#ff7a1a]/70 bg-[#ff7a1a]/12'
          : 'border-white/[0.08] bg-[#1a1510] hover:border-[#ff7a1a]/40 hover:bg-[#ff7a1a]/[0.08] focus-visible:border-[#ff7a1a]/40 focus-visible:bg-[#ff7a1a]/[0.08]'
      }`}
      style={pressed ? { boxShadow: 'inset 0 0 0 1px rgba(255,122,26,0.55), 0 0 16px rgba(255,122,26,0.30)' } : undefined}
    >
      <span className="text-[11px] text-white/55">{label}</span>
      <span className={`text-[13px] font-extrabold transition-colors duration-200 ${pressed ? 'text-[#ff7a1a]' : 'text-white'}`}>
        {value}
      </span>
    </button>
  );
}
