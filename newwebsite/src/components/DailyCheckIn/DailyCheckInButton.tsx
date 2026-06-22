"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RiCoupon3Fill } from "react-icons/ri";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import DailyCheckInModal from "./DailyCheckInModal";

interface Props {
  compact?: boolean;
}

export default function DailyCheckInButton({ compact = false }: Props) {
  const { user } = useAuth();
  const { fiatBalance, depositWageringDone, depositWageringRequired } = useWallet();

  const [isOpen, setIsOpen]           = useState(false);
  const [hasPending, setHasPending]   = useState(false);
  // null = loading, true/false = resolved
  const [enabled, setEnabled]         = useState<boolean | null>(null);
  const [hidden, setHidden]           = useState<boolean | null>(null);

  const hasDeposited =
    fiatBalance > 0 || depositWageringDone > 0 || depositWageringRequired > 0;

  // ── Fetch admin config once (fail open) ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch("/api/daily-checkin/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setEnabled(d?.enabled !== false); setHidden(d?.hidden === true); } })
      .catch(() => { if (!cancelled) { setEnabled(true); setHidden(false); } }); // fail open
    return () => { cancelled = true; };
  }, []);

  // ── Check if today's reward is pending ──────────────────────────────────
  const checkPending = useCallback(() => {
    if (!user) return;
    const storedKey = `checkin_${user.id || "guest"}`;
    const stored = localStorage.getItem(storedKey);
    if (!stored) { setHasPending(true); return; }
    const { lastCheckin } = JSON.parse(stored);
    const today = new Date().toDateString();
    setHasPending(!lastCheckin || new Date(lastCheckin).toDateString() !== today);
  }, [user]);

  useEffect(() => {
    checkPending();
    const id = setInterval(checkPending, 60_000);
    return () => clearInterval(id);
  }, [checkPending]);

  // Hide:  no user, or still loading config, or admin disabled it, or hidden
  if (!user || enabled === null || enabled === false || hidden) return null;

  const isGlowing = hasPending && hasDeposited;

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.92 }}
        aria-label="Daily Rewards & Offers"
        title="Daily Rewards"
        className="relative flex items-center justify-center flex-shrink-0"
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: isGlowing
            ? "linear-gradient(135deg, rgba(255, 122, 26,0.18) 0%, rgba(200,136,12,0.10) 100%)"
            : "rgba(255,255,255,0.04)",
          border: isGlowing
            ? "1.5px solid rgba(255, 122, 26,0.6)"
            : "1px solid rgba(255,255,255,0.09)",
          boxShadow: isGlowing
            ? "0 0 12px rgba(255, 122, 26,0.6), 0 0 28px rgba(255, 122, 26,0.28), 0 0 56px rgba(255, 122, 26,0.025)"
            : "none",
          color: isGlowing ? "#EFA05B" : "#66635F",
        }}
      >
        {/* Pulse ring layer 1 */}
        {isGlowing && (
          <motion.span
            animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              inset: -1,
              borderRadius: 11,
              border: "2px solid rgba(255, 122, 26,0.55)",
              pointerEvents: "none",
            }}
          />
        )}
        {/* Pulse ring layer 2 */}
        {isGlowing && (
          <motion.span
            animate={{ scale: [1, 1.9, 1], opacity: [0.25, 0, 0.25] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            style={{
              position: "absolute",
              inset: -1,
              borderRadius: 11,
              border: "2px solid rgba(255, 122, 26,0.28)",
              pointerEvents: "none",
            }}
          />
        )}

        <RiCoupon3Fill size={18} />

        {/* Red notification dot */}
        {isGlowing && (
          <AnimatePresence>
            <motion.span
              key="offer-badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 14 }}
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#E24C4C",
                border: "2px solid #111",
                boxShadow: "0 0 6px rgba(226,76,76,0.7)",
              }}
            />
          </AnimatePresence>
        )}
      </motion.button>

      {isOpen && (
        <DailyCheckInModal
          hasDeposited={hasDeposited}
          onClose={() => { setIsOpen(false); checkPending(); }}
        />
      )}
    </>
  );
}
