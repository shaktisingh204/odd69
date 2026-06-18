'use client';

// ─────────────────────────────────────────────────────────────
// OddsChip — pressable odds pill with gold flash on click
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
      className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 transition-all active:scale-95 cursor-pointer ${
        pressed
          ? 'border-brand-gold/60 bg-brand-alpha-12 shadow-glow-gold'
          : 'border-divider bg-odds-default hover:border-brand-gold/30 hover:bg-brand-alpha-08'
      }`}
    >
      <span className="text-[11px] text-text-muted">{label}</span>
      <span className={`text-[13px] font-adx-bold transition-colors ${pressed ? 'text-brand-gold' : 'text-odds-default'}`}>
        {value}
      </span>
    </button>
  );
}
