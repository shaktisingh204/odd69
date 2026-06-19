import Link from 'next/link';
import {
  Plus,
  Zap,
  ShieldCheck,
  Send,
  Home,
  LogIn,
} from 'lucide-react';
import Icon3D from './Icon3D';

export type BalanceBarProps = {
  /** main/fiat wallet */
  mainSymbol?: string;
  mainBalance?: number;
  /** crypto wallet */
  cryptoSymbol?: string;
  cryptoBalance?: number;
  /** bonus wallet amount */
  bonus?: number;
  isAuthenticated?: boolean;
  /** hide the second quick-actions row (top-bar usage) */
  compact?: boolean;
  /** actions — wired from the home shell */
  onDeposit?: () => void;
  onBonus?: () => void;
  onLogin?: () => void;
  eventHref?: string;
  supportHref?: string;
  homeHref?: string;
};

/** Compact money formatter — keeps the pill narrow for large balances */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BalanceBar({
  mainSymbol = 'RM',
  mainBalance = 0,
  cryptoSymbol = '$',
  cryptoBalance = 0,
  bonus = 0,
  isAuthenticated = false,
  compact = false,
  onDeposit,
  onBonus,
  onLogin,
  eventHref = '/sports',
  supportHref = '/support',
  homeHref = '/',
}: BalanceBarProps = {}) {
  return (
    <div className="flex w-full flex-col gap-3">
      {/* Row 1 — balance + deposit */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBonus}
          className="odd69-press flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#0d9488] to-[#115e59] py-2 pl-2 pr-4 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(13,148,136,0.4)]"
        >
          <Icon3D name="gift" size={26} float />
          <span className="tabular-nums">{fmt(bonus)}</span>
        </button>

        <span className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#13202f] px-3.5 py-2.5 text-[13px] font-bold text-white">
          <span className="grid h-5 min-w-5 place-items-center rounded-md bg-[#1f3147] px-1 text-[10px] text-[#9fb2c9]">{mainSymbol}</span>
          <span className="tabular-nums">{fmt(mainBalance)}</span>
        </span>

        <span className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#13202f] px-3.5 py-2.5 text-[13px] font-bold text-white">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-[#1f3147] text-[10px] text-[#56d6b6]">{cryptoSymbol}</span>
          <span className="tabular-nums">{fmt(cryptoBalance)}</span>
        </span>

        {isAuthenticated ? (
          <button
            type="button"
            onClick={onDeposit}
            className="odd69-press flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#ea580c] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(234,88,12,0.45)]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} /> Deposit
          </button>
        ) : (
          <button
            type="button"
            onClick={onLogin}
            className="odd69-press flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.45)]"
          >
            <LogIn className="h-4 w-4" strokeWidth={2.4} /> Login
          </button>
        )}
      </div>

      {/* Row 2 — event + quick actions */}
      {!compact && (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={eventHref}
          className="odd69-press flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-white shadow-[0_8px_20px_rgba(37,99,235,0.45)]"
        >
          <Zap className="h-4 w-4" /> Go to the event
        </Link>

        <Link
          href={supportHref}
          className="odd69-press grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#0d9488] to-[#115e59] text-white"
          aria-label="Support"
        >
          <ShieldCheck className="h-4 w-4" />
        </Link>

        <Link
          href={eventHref}
          className="odd69-press grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white"
          aria-label="Events"
        >
          <Send className="h-4 w-4" />
        </Link>

        <Link
          href={homeHref}
          className="odd69-press grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white"
          aria-label="Home"
        >
          <Home className="h-4 w-4" />
        </Link>
      </div>
      )}
    </div>
  );
}
