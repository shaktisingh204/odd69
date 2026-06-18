"use client";

/**
 * DailyCheckInAutoPrompt
 *
 * Silently mounted in the layout. After 2.5s, checks if the user
 * hasn't claimed today AND has deposited, then shows the modal.
 * Dismissed for 24h (per day) after close.
 *
 * Fully suppressed when the admin disables the daily check-in system.
 */

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import DailyCheckInModal from "./DailyCheckInModal";

export default function DailyCheckInAutoPrompt() {
  const { user } = useAuth();
  const { fiatBalance, depositWageringDone, depositWageringRequired } = useWallet();
  const [show, setShow]         = useState(false);
  const [enabled, setEnabled]   = useState<boolean | null>(null); // null = loading
  const [hidden, setHidden]     = useState<boolean | null>(null);

  const hasDeposited =
    fiatBalance > 0 || depositWageringDone > 0 || depositWageringRequired > 0;

  // ── Fetch admin config once ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch("/api/daily-checkin/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setEnabled(d?.enabled !== false); setHidden(d?.hidden === true); } })
      .catch(() => { if (!cancelled) { setEnabled(true); setHidden(false); } }); // fail open
    return () => { cancelled = true; };
  }, []);

  // ── Auto-show timer ──────────────────────────────────────────────────────
  useEffect(() => {
    // Wait until config is loaded; bail if disabled, hidden, or missing user/deposit
    if (enabled === null || enabled === false || hidden || !user || !hasDeposited) return;

    const timer = setTimeout(() => {
      const storedKey  = `checkin_${user.id || "guest"}`;
      const dismissKey = `checkin_dismissed_${user.id || "guest"}`;
      const today = new Date().toDateString();

      if (localStorage.getItem(dismissKey) === today) return;

      const stored = localStorage.getItem(storedKey);
      if (!stored) { setShow(true); return; }
      const { lastCheckin } = JSON.parse(stored);
      if (!lastCheckin || new Date(lastCheckin).toDateString() !== today) setShow(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, [user, hasDeposited, enabled, hidden]);

  const handleClose = () => {
    setShow(false);
    if (user) {
      localStorage.setItem(
        `checkin_dismissed_${user.id || "guest"}`,
        new Date().toDateString()
      );
    }
  };

  if (!show || !user || !enabled) return null;

  return <DailyCheckInModal onClose={handleClose} hasDeposited={hasDeposited} />;
}
