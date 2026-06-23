"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import { io, Socket } from "socket.io-client";
import { toast } from "react-hot-toast";
import OriginalsShell from "@/components/originals/OriginalsShell";
import OriginalsControls from "@/components/originals/OriginalsControls";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";
import { getConfiguredSocketNamespace } from "@/utils/socketUrl";
import { fireWin, fireBigWin, playSound } from "@/utils/originalsFx";

/* ──────────────────────────────────────────────────────────────────────────
 * Realtime timed Wingo rooms — '/color' socket namespace.
 *
 * Backend contract (newbackend/src/color-rounds/color-round.{gateway,service}.ts):
 *   emit  color:bet {room, betType, selection, amount, walletType?, useBonus?}
 *   emit  color:get-history {room}     · color:get-my-bets · color:get-state
 *   recv  color:state {rooms:[{room,period,status,timeLeft,lockIn,serverSeedHash}]}
 *   recv  color:round-open {room,period,serverSeedHash,endsIn,lockIn}
 *   recv  color:lock {room,period}
 *   recv  color:result {room,period,result,resultColors,size,serverSeed,serverSeedHash}
 *   recv  color:win {room,period,result,resultColors,size,payout,bets}
 *   recv  color:player-bet {room,period,username,betType,selection,amount}
 *   recv  color:history {history:{[room]:[...]}}  · color:history-data {room,history}
 *   recv  color:my-bets {bets}  · color:bet-placed {...}  · color:error {message}
 * ────────────────────────────────────────────────────────────────────────── */

type Room = "30s" | "1m" | "3m" | "5m";
type BetType = "color" | "number" | "bigsmall";
type Phase = "BETTING" | "LOCKED" | "SETTLED";
type WalletType = "fiat" | "crypto";

const ROOMS: { id: Room; label: string; durationMs: number }[] = [
  { id: "30s", label: "Wingo 30s", durationMs: 30_000 },
  { id: "1m", label: "Wingo 1Min", durationMs: 60_000 },
  { id: "3m", label: "Wingo 3Min", durationMs: 180_000 },
  { id: "5m", label: "Wingo 5Min", durationMs: 300_000 },
];

const ACCENT = "#ff9a3d";
const LOCK_WINDOW_MS = 5000;
const NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

interface RoomState {
  room: Room;
  period: number;
  status: Phase;
  timeLeft: number; // ms until draw (server-reported, then locally interpolated)
  lockIn?: number;
  serverSeedHash: string;
}

interface HistoryRow {
  room: Room;
  period: number;
  result: number;
  resultColors: string[];
  size: string;
  serverSeed?: string;
  serverSeedHash?: string;
  settledAt?: string;
}

interface MyBet {
  betId: string;
  room: Room;
  period: number;
  betType: BetType;
  selection: string;
  amount: number;
  status: "PENDING" | "WON" | "LOST";
  payout: number;
  multiplier: number;
  walletType: string;
  currency: string;
  createdAt?: string;
}

interface PlayerBet {
  id: string;
  username: string;
  betType: BetType;
  selection: string;
  amount: number;
}

interface ResultPayload {
  room: Room;
  period: number;
  result: number;
  resultColors: string[];
  size: string;
  serverSeed?: string;
  serverSeedHash?: string;
}

interface WinPayload {
  room: Room;
  period: number;
  result: number;
  payout: number;
}

/* ── Number → colors mapping (matches backend colorsForNumber) ─────────────── */
function colorsForNumber(n: number): string[] {
  if (n === 0) return ["red", "violet"];
  if (n === 5) return ["green", "violet"];
  if (n % 2 === 1) return ["green"];
  return ["red"];
}

/** Ball fill for a number (split gradient on 0/5). */
function ballStyle(n: number): React.CSSProperties {
  const c = colorsForNumber(n);
  if (c.includes("violet") && c.length > 1) {
    const base = c[0] === "red" ? "#ef4444" : "#10b981";
    return {
      background: `linear-gradient(135deg, ${base} 0 50%, #a855f7 50% 100%)`,
    };
  }
  if (c[0] === "red") return { background: "#ef4444" };
  if (c[0] === "green") return { background: "#10b981" };
  return { background: "#a855f7" };
}

function colorDotBg(c: string): string {
  if (c === "red") return "#ef4444";
  if (c === "green") return "#10b981";
  return "#a855f7";
}

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* Selection model for the betting panel. */
type Selection =
  | { betType: "color"; selection: "green" | "violet" | "red" }
  | { betType: "number"; selection: string }
  | { betType: "bigsmall"; selection: "big" | "small" };

function selectionLabel(sel: Selection): string {
  if (sel.betType === "number") return `Number ${sel.selection}`;
  if (sel.betType === "bigsmall")
    return sel.selection === "big" ? "Big" : "Small";
  return sel.selection.charAt(0).toUpperCase() + sel.selection.slice(1);
}

function selectionPayout(sel: Selection): string {
  if (sel.betType === "number") return "×9";
  if (sel.betType === "bigsmall") return "×2";
  if (sel.selection === "violet") return "×4.5";
  return "×2";
}

export default function ColorPage() {
  const { refreshWallet, fiatBalance, cryptoBalance, cryptoOnly } = useWallet();
  const { token } = useAuth();
  const reduceMotion = useReducedMotion();

  /* ── Controls state ──────────────────────────────────────────────────── */
  const [betInput, setBetInput] = useState("10");
  const [walletType, setWalletType] = useState<WalletType>("crypto");
  const [useBonus, setUseBonus] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [multiplierQty, setMultiplierQty] = useState(1);

  /* ── Room / round state ──────────────────────────────────────────────── */
  const [room, setRoom] = useState<Room>("30s");
  const [states, setStates] = useState<Record<Room, RoomState>>({} as Record<Room, RoomState>);
  const [nowTick, setNowTick] = useState(0); // forces countdown re-render

  /* ── History / orders / live feed ────────────────────────────────────── */
  const [history, setHistory] = useState<Record<Room, HistoryRow[]>>({} as Record<Room, HistoryRow[]>);
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [playerBets, setPlayerBets] = useState<PlayerBet[]>([]);
  const [bottomTab, setBottomTab] = useState<"history" | "chart" | "orders">("history");

  /* ── Reveal / modal state ────────────────────────────────────────────── */
  const [reveal, setReveal] = useState<ResultPayload | null>(null); // current room's last draw
  const [shuffleDigit, setShuffleDigit] = useState<number | null>(null);
  const [countdownNum, setCountdownNum] = useState<number | null>(null); // 5..1 overlay
  const [resultModal, setResultModal] = useState<
    | { won: true; payout: number; result: number; size: string }
    | { won: false; result: number; size: string }
    | null
  >(null);

  /* ── Pending bet confirm popup ───────────────────────────────────────── */
  const [confirmSel, setConfirmSel] = useState<Selection | null>(null);
  const [agreeRules, setAgreeRules] = useState(true);

  /* ── Rules sheet ─────────────────────────────────────────────────────── */
  const [rulesOpen, setRulesOpen] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const roomRef = useRef<Room>(room);
  const statesRef = useRef(states);
  const shuffleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTickSec = useRef<number>(-1);
  const lockedSoundFor = useRef<number>(-1); // period we've already buzzed for

  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    statesRef.current = states;
  }, [states]);

  const balance = walletType === "crypto" ? cryptoBalance : fiatBalance;

  /* Force crypto wallet when the platform is crypto-only. */
  useEffect(() => {
    if (cryptoOnly && walletType !== "crypto") {
      setWalletType("crypto");
      setUseBonus(false);
    }
  }, [cryptoOnly, walletType]);

  /* ── Socket lifecycle ────────────────────────────────────────────────── */
  useEffect(() => {
    const endpoint = getConfiguredSocketNamespace("color");
    if (!endpoint) return;

    const tkn = token || (typeof window !== "undefined" ? localStorage.getItem("token") || "" : "");
    const s = io(endpoint.url, {
      path: endpoint.path,
      auth: { token: tkn },
      transports: ["websocket", "polling"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
    });
    socketRef.current = s;

    const ingestStates = (rooms: RoomState[]) => {
      setStates((prev) => {
        const next = { ...prev };
        for (const r of rooms) {
          next[r.room] = { ...r };
        }
        return next;
      });
    };

    s.on("color:state", (d: { rooms: RoomState[] }) => {
      if (Array.isArray(d?.rooms)) ingestStates(d.rooms);
    });

    s.on(
      "color:round-open",
      (d: {
        room: Room;
        period: number;
        serverSeedHash: string;
        endsIn: number;
        lockIn: number;
      }) => {
        setStates((prev) => ({
          ...prev,
          [d.room]: {
            room: d.room,
            period: d.period,
            status: "BETTING",
            timeLeft: d.endsIn,
            lockIn: d.lockIn,
            serverSeedHash: d.serverSeedHash,
          },
        }));
        if (d.room === roomRef.current) {
          // New round → clear the previous reveal, re-enable the panel.
          setReveal(null);
          setShuffleDigit(null);
          setCountdownNum(null);
          lastTickSec.current = -1;
          lockedSoundFor.current = -1;
        }
      },
    );

    s.on("color:lock", (d: { room: Room; period: number }) => {
      setStates((prev) => {
        const cur = prev[d.room];
        if (!cur) return prev;
        return { ...prev, [d.room]: { ...cur, status: "LOCKED" } };
      });
      if (d.room === roomRef.current && lockedSoundFor.current !== d.period) {
        lockedSoundFor.current = d.period;
        playSound("crash"); // lock buzz
        if (!reduceMotion) startCountdownOverlay();
      }
    });

    s.on("color:result", (d: ResultPayload) => {
      // Update shared history immediately.
      setHistory((prev) => {
        const arr = prev[d.room] ? [...prev[d.room]] : [];
        if (!arr.some((h) => h.period === d.period)) {
          arr.unshift({
            room: d.room,
            period: d.period,
            result: d.result,
            resultColors: d.resultColors,
            size: d.size,
            serverSeed: d.serverSeed,
            serverSeedHash: d.serverSeedHash,
            settledAt: new Date().toISOString(),
          });
        }
        return { ...prev, [d.room]: arr.slice(0, 40) };
      });
      setStates((prev) => {
        const cur = prev[d.room];
        if (!cur) return prev;
        return { ...prev, [d.room]: { ...cur, status: "SETTLED" } };
      });

      if (d.room === roomRef.current) {
        runRevealAnimation(d);
      }
    });

    s.on("color:win", (d: WinPayload) => {
      // A win arrived for this player on some room — refresh wallet + celebrate.
      void refreshWallet();
      playSound("win");
      // Defer the modal so it lands just after the ball reveal animation.
      if (modalTimer.current) clearTimeout(modalTimer.current);
      modalTimer.current = setTimeout(
        () => {
          setResultModal({
            won: true,
            payout: d.payout,
            result: d.result,
            size: d.result >= 5 ? "Big" : "Small",
          });
          // No exact multiplier in the payload — gate the bigger fanfare on size.
          if (d.payout >= 1000) fireBigWin();
          else fireWin();
        },
        reduceMotion ? 0 : 700,
      );
    });

    s.on(
      "color:player-bet",
      (d: {
        room: Room;
        period: number;
        username: string;
        betType: BetType;
        selection: string;
        amount: number;
      }) => {
        if (d.room !== roomRef.current) return;
        setPlayerBets((prev) =>
          [
            {
              id: `${d.username}-${d.period}-${Math.random().toString(36).slice(2, 7)}`,
              username: d.username,
              betType: d.betType,
              selection: d.selection,
              amount: d.amount,
            },
            ...prev,
          ].slice(0, 12),
        );
      },
    );

    s.on("color:history", (d: { history: Record<Room, HistoryRow[]> }) => {
      if (d?.history) setHistory((prev) => ({ ...prev, ...d.history }));
    });

    s.on("color:history-data", (d: { room: Room; history: HistoryRow[] }) => {
      if (d?.room) setHistory((prev) => ({ ...prev, [d.room]: d.history }));
    });

    s.on("color:my-bets", (d: { bets: MyBet[] }) => {
      if (Array.isArray(d?.bets)) setMyBets(d.bets);
    });

    s.on("color:bet-placed", (d: { betType: BetType; selection: string; amount: number }) => {
      void refreshWallet();
      s.emit("color:get-my-bets");
      toast.success(`Bet placed · ${d.amount.toLocaleString("en-US")}`);
    });

    s.on("color:error", (d: { message: string }) => {
      toast.error(d?.message || "Bet failed");
    });

    s.on("connect", () => {
      s.emit("color:get-state");
      s.emit("color:get-my-bets");
    });
    s.on("connect_error", () => {
      // silent; auto-reconnect handles it
    });
    s.on("disconnect", (reason) => {
      if (reason === "io server disconnect") setTimeout(() => s.connect(), 2000);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* ── Local 250ms countdown interpolation + tick sound ────────────────── */
  useEffect(() => {
    const iv = setInterval(() => {
      setStates((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const k of Object.keys(prev) as Room[]) {
          const st = prev[k];
          if (!st) continue;
          const nt = Math.max(0, st.timeLeft - 250);
          if (nt !== st.timeLeft) {
            next[k] = { ...st, timeLeft: nt };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      setNowTick((t) => t + 1);
    }, 250);
    return () => clearInterval(iv);
  }, []);

  /* Soft tick once per second during the active room's open phase. */
  useEffect(() => {
    const st = states[room];
    if (!st || st.status !== "BETTING") return;
    const sec = Math.ceil(st.timeLeft / 1000);
    if (sec !== lastTickSec.current && sec > 0 && st.timeLeft > LOCK_WINDOW_MS) {
      lastTickSec.current = sec;
      playSound("tick");
    }
  }, [nowTick, room, states]);

  /* ── 5-4-3-2-1 lock overlay ──────────────────────────────────────────── */
  const startCountdownOverlay = useCallback(() => {
    if (countdownTimer.current) clearTimeout(countdownTimer.current);
    let n = 5;
    setCountdownNum(n);
    playSound("tick");
    const step = () => {
      n -= 1;
      if (n <= 0) {
        setCountdownNum(null);
        countdownTimer.current = null;
        return;
      }
      setCountdownNum(n);
      playSound("tick");
      countdownTimer.current = setTimeout(step, 1000);
    };
    countdownTimer.current = setTimeout(step, 1000);
  }, []);

  /* ── Reveal animation: shuffle → snap to result ──────────────────────── */
  const runRevealAnimation = useCallback(
    (d: ResultPayload) => {
      setCountdownNum(null);
      if (reduceMotion) {
        setShuffleDigit(null);
        setReveal(d);
        playSound("reveal");
        // Lose modal for non-winners is handled by absence of color:win; show a
        // soft "result" indicator via reveal. Auto-dismiss handled below.
        scheduleLoseModalCheck(d);
        return;
      }
      // 250ms shuffle of random digits, then snap.
      if (shuffleTimer.current) clearInterval(shuffleTimer.current);
      let frames = 0;
      shuffleTimer.current = setInterval(() => {
        setShuffleDigit(Math.floor(Math.random() * 10));
        frames += 1;
        if (frames >= 5) {
          if (shuffleTimer.current) clearInterval(shuffleTimer.current);
          shuffleTimer.current = null;
          setShuffleDigit(null);
          setReveal(d);
          playSound("reveal");
          scheduleLoseModalCheck(d);
        }
      }, 50);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduceMotion],
  );

  /**
   * If no color:win arrives shortly after a result (the player either didn't
   * bet or lost), show a gentle "better luck" modal — but only when the player
   * actually had a pending bet on this period.
   */
  const scheduleLoseModalCheck = useCallback((d: ResultPayload) => {
    if (modalTimer.current) clearTimeout(modalTimer.current);
    const hadBet = myBetsRef.current.some(
      (b) => b.room === d.room && b.period === d.period,
    );
    if (!hadBet) return;
    modalTimer.current = setTimeout(() => {
      // color:win fires before this for winners and overrides via its own timer;
      // so re-check whether this period turned into a win in myBets.
      const won = myBetsRef.current.some(
        (b) => b.room === d.room && b.period === d.period && b.status === "WON",
      );
      if (won) return;
      playSound("lose");
      setResultModal({ won: false, result: d.result, size: d.size });
    }, 900);
  }, []);

  const myBetsRef = useRef<MyBet[]>([]);
  useEffect(() => {
    myBetsRef.current = myBets;
  }, [myBets]);

  /* Auto-dismiss the result modal. */
  useEffect(() => {
    if (!resultModal) return;
    const t = setTimeout(
      () => setResultModal(null),
      resultModal.won ? 3200 : 1600,
    );
    return () => clearTimeout(t);
  }, [resultModal]);

  /* ── Cleanup all timers on unmount ───────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (shuffleTimer.current) clearInterval(shuffleTimer.current);
      if (countdownTimer.current) clearTimeout(countdownTimer.current);
      if (modalTimer.current) clearTimeout(modalTimer.current);
    };
  }, []);

  /* When the active room changes, clear transient reveal + request history. */
  useEffect(() => {
    setReveal(null);
    setShuffleDigit(null);
    setCountdownNum(null);
    setPlayerBets([]);
    socketRef.current?.emit("color:get-history", { room });
  }, [room]);

  /* ── Derived ─────────────────────────────────────────────────────────── */
  const st = states[room];
  const phase: Phase = st?.status ?? "BETTING";
  const period = st?.period ?? 0;
  const timeLeft = st?.timeLeft ?? 0;
  const isLocked = phase !== "BETTING" || timeLeft <= LOCK_WINDOW_MS;
  const totalStake = useMemo(() => {
    const base = parseFloat(betInput) || 0;
    return base * Math.max(1, quantity) * Math.max(1, multiplierQty);
  }, [betInput, quantity, multiplierQty]);

  const roomHistory = useMemo(() => history[room] ?? [], [history, room]);

  /* Total this player has staked on the current open period. */
  const stakedThisRound = useMemo(
    () =>
      myBets
        .filter((b) => b.room === room && b.period === period)
        .reduce((s2, b) => s2 + b.amount, 0),
    [myBets, room, period],
  );

  /* ── Place a bet ─────────────────────────────────────────────────────── */
  const placeBet = useCallback(
    (sel: Selection) => {
      const amount = totalStake;
      if (!socketRef.current) return toast.error("Not connected");
      if (isLocked) return toast.error("Betting closed — wait for next round");
      if (!amount || amount <= 0) return toast.error("Invalid bet amount");
      if (amount > balance) return toast.error("Insufficient balance");
      playSound("bet");
      socketRef.current.emit("color:bet", {
        room,
        betType: sel.betType,
        selection: sel.selection,
        amount,
        walletType,
        useBonus,
      });
    },
    [totalStake, isLocked, balance, room, walletType, useBonus],
  );

  /* Open the confirm popup for a tapped selection. */
  const requestBet = useCallback(
    (sel: Selection) => {
      if (isLocked) return toast.error("Betting closed — wait for next round");
      setConfirmSel(sel);
    },
    [isLocked],
  );

  const confirmBet = useCallback(() => {
    if (!confirmSel) return;
    if (!agreeRules) return toast.error("Please agree to the rules");
    placeBet(confirmSel);
    setConfirmSel(null);
  }, [confirmSel, agreeRules, placeBet]);

  /* ── Chart / trend stats ─────────────────────────────────────────────── */
  const chart = useMemo(() => {
    const numFreq = new Array(10).fill(0) as number[];
    const numMissing = new Array(10).fill(-1) as number[]; // rounds since last seen
    let big = 0,
      small = 0,
      red = 0,
      green = 0,
      violet = 0;
    roomHistory.forEach((h, idx) => {
      numFreq[h.result] += 1;
      if (numMissing[h.result] === -1) numMissing[h.result] = idx;
      if (h.size === "Big") big += 1;
      else small += 1;
      h.resultColors.forEach((c) => {
        if (c === "red") red += 1;
        else if (c === "green") green += 1;
        else if (c === "violet") violet += 1;
      });
    });
    // any never-seen number → missing = full length
    for (let i = 0; i < 10; i++)
      if (numMissing[i] === -1) numMissing[i] = roomHistory.length;
    return { numFreq, numMissing, big, small, red, green, violet };
  }, [roomHistory]);

  /* ────────────────────────────────────────────────────────────────────── */

  const accent = ACCENT;
  const activeRoom = ROOMS.find((r) => r.id === room)!;

  return (
    <OriginalsShell
      gameKey="color"
      title="Color"
      tags={["# Wingo", "# ODD69 Originals", "# Provably Fair"]}
      controls={
        <OriginalsControls
          betInput={betInput}
          setBetInput={setBetInput}
          walletType={walletType}
          setWalletType={setWalletType}
          useBonus={useBonus}
          setUseBonus={setUseBonus}
          locked={false}
          accent={accent}
          footer={
            <div className="space-y-2">
              {/* Quantity + multiplier */}
              <div>
                <label className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider mb-1.5 block">
                  Quantity
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-lg bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af] hover:text-white font-bold"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center py-1.5 bg-bg-deep-3 border border-white/[0.06] rounded-lg text-white font-black text-sm">
                    {quantity}
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-8 h-8 rounded-lg bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af] hover:text-white font-bold"
                  >
                    +
                  </button>
                </div>
                <div className="grid grid-cols-6 gap-1 mt-2">
                  {[1, 5, 10, 20, 50, 100].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMultiplierQty(m)}
                      className={`py-1 rounded text-[10px] font-bold transition-all ${
                        multiplierQty === m
                          ? "text-black"
                          : "bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af]"
                      }`}
                      style={
                        multiplierQty === m ? { background: accent } : undefined
                      }
                    >
                      X{m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live total */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-deep-3 border border-white/[0.06]">
                <span className="text-[11px] text-[#6b7280] font-bold uppercase tracking-wider">
                  Total Bet
                </span>
                <span className="text-base font-black" style={{ color: accent }}>
                  ${totalStake.toLocaleString("en-US")}
                </span>
              </div>

              {stakedThisRound > 0 && (
                <div className="flex items-center justify-between text-[11px] px-1">
                  <span className="text-[#6b7280]">Staked this round</span>
                  <span className="text-white font-bold">
                    ${stakedThisRound.toLocaleString("en-US")}
                  </span>
                </div>
              )}
            </div>
          }
          action={
            <div className="space-y-2">
              <p className="text-[11px] text-[#6b7280] leading-snug text-center">
                Tap a color, number, or Big/Small on the board to bet into the
                live round.
              </p>
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                className="w-full py-2.5 rounded-lg bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af] hover:text-white text-xs font-bold transition-all"
              >
                How to play / Payouts
              </button>
            </div>
          }
        />
      }
    >
      <div
        className="relative w-full h-full flex flex-col p-3 md:p-4 overflow-y-auto"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, #2a1407 0%, #1a0d08 45%, #0d0705 100%)",
          minHeight: 360,
        }}
      >
        {/* ── Room tabs ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {ROOMS.map((r) => {
            const active = r.id === room;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRoom(r.id)}
                className={`py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all ${
                  active
                    ? "text-black shadow-lg"
                    : "bg-white/[0.04] border border-white/[0.06] text-[#9ca3af] hover:text-white"
                }`}
                style={active ? { background: accent } : undefined}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* ── Header card: how-to + last results | period + countdown ───── */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 mb-3 flex items-stretch gap-3">
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#9ca3af] hover:text-white mb-2"
            >
              <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[9px]">
                ?
              </span>
              How to play
            </button>
            <div className="flex items-center gap-1.5">
              {roomHistory.slice(0, 5).map((h) => (
                <div
                  key={h.period}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white border border-white/20"
                  style={ballStyle(h.result)}
                >
                  {h.result}
                </div>
              ))}
              {roomHistory.length === 0 && (
                <span className="text-[11px] text-[#6b7280]">Loading…</span>
              )}
            </div>
          </div>
          <div className="text-right flex flex-col justify-center min-w-[110px]">
            <div className="text-[10px] text-[#6b7280] font-bold uppercase tracking-wider">
              {activeRoom.label}
            </div>
            <div className="font-mono text-[11px] text-[#9ca3af] truncate">
              {period || "—"}
            </div>
            <CountdownClock
              ms={timeLeft}
              locked={isLocked}
              reduceMotion={!!reduceMotion}
            />
          </div>
        </div>

        {/* ── Draw stage (ball reveal) ──────────────────────────────────── */}
        <div className="relative rounded-2xl bg-black/30 border border-white/[0.06] py-5 mb-3 flex flex-col items-center justify-center overflow-hidden">
          {/* lock 5-4-3-2-1 overlay */}
          <AnimatePresence>
            {countdownNum != null && (
              <motion.div
                key={`cd-${countdownNum}`}
                initial={{ scale: 0.6, opacity: 0, rotateY: -60 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                exit={{ scale: 1.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm"
              >
                <span
                  className="text-7xl font-black"
                  style={{ color: accent, textShadow: "0 0 30px rgba(255,154,61,0.6)" }}
                >
                  {countdownNum}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-[10px] uppercase tracking-widest text-[#6b7280] mb-2">
            {phase === "BETTING" && !isLocked
              ? "Place your bets"
              : isLocked && !reveal && phase !== "SETTLED"
                ? "Betting closed"
                : "Result"}
          </div>

          {/* The ball */}
          <div className="relative" style={{ width: 96, height: 96 }}>
            <AnimatePresence mode="wait">
              {reveal ? (
                <motion.div
                  key={`ball-${reveal.period}`}
                  initial={
                    reduceMotion
                      ? { scale: 1, opacity: 1 }
                      : { scale: 0.5, opacity: 0, filter: "blur(6px)" }
                  }
                  animate={{
                    scale: reduceMotion ? 1 : [0.5, 1.15, 1],
                    opacity: 1,
                    filter: "blur(0px)",
                  }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.45, times: [0, 0.6, 1], ease: "easeOut" }
                  }
                  className="w-24 h-24 rounded-full flex flex-col items-center justify-center text-white border-2"
                  style={{
                    ...ballStyle(reveal.result),
                    borderColor: reveal.resultColors.includes("violet")
                      ? "#c084fc"
                      : "rgba(255,255,255,0.4)",
                    boxShadow: reveal.resultColors.includes("violet")
                      ? "0 0 28px rgba(168,85,247,0.7)"
                      : "0 0 24px rgba(255,154,61,0.4)",
                  }}
                >
                  <span className="text-4xl font-black leading-none">
                    {reveal.result}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-90">
                    {reveal.size}
                  </span>
                </motion.div>
              ) : shuffleDigit != null ? (
                <motion.div
                  key="shuffle"
                  className="w-24 h-24 rounded-full flex items-center justify-center bg-white/[0.06] border-2 border-white/20 text-4xl font-black text-white"
                  style={{ filter: "blur(2px)" }}
                >
                  {shuffleDigit}
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  className="w-24 h-24 rounded-full flex items-center justify-center bg-white/[0.04] border-2 border-dashed border-white/15 text-3xl font-black text-[#4b5563]"
                  animate={
                    isLocked && !reduceMotion ? { scale: [1, 1.04, 1] } : { scale: 1 }
                  }
                  transition={{ repeat: isLocked ? Infinity : 0, duration: 0.6 }}
                >
                  ?
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* color chips on result */}
          {reveal && (
            <div className="flex items-center gap-1.5 mt-3">
              {reveal.resultColors.map((c) => (
                <span
                  key={c}
                  className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-white"
                  style={{ background: colorDotBg(c) }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Bet board ─────────────────────────────────────────────────── */}
        <div
          className={`transition-opacity duration-200 ${isLocked ? "opacity-55 pointer-events-none" : "opacity-100"}`}
        >
          {/* Color buttons */}
          <div className="grid grid-cols-3 gap-2 mb-2.5">
            {(
              [
                { c: "green", bg: "linear-gradient(135deg,#10b981,#059669)", label: "Green", mult: "×2" },
                { c: "violet", bg: "linear-gradient(135deg,#a855f7,#7c3aed)", label: "Violet", mult: "×4.5" },
                { c: "red", bg: "linear-gradient(135deg,#ef4444,#dc2626)", label: "Red", mult: "×2" },
              ] as const
            ).map((opt) => {
              const win =
                reveal && reveal.resultColors.includes(opt.c) && phase === "SETTLED";
              const dim = reveal && !win && phase === "SETTLED";
              return (
                <button
                  key={opt.c}
                  type="button"
                  disabled={isLocked}
                  onClick={() =>
                    requestBet({ betType: "color", selection: opt.c })
                  }
                  className={`relative py-4 rounded-xl font-black text-white text-sm flex flex-col items-center gap-0.5 transition-all active:scale-[0.97] ${
                    win ? "ring-2 ring-[#ff9a3d]" : ""
                  }`}
                  style={{
                    background: opt.bg,
                    opacity: dim ? 0.4 : 1,
                    boxShadow: win ? "0 0 22px rgba(255,154,61,0.6)" : "none",
                  }}
                >
                  <span>{opt.label}</span>
                  <span className="text-[10px] opacity-80">{opt.mult}</span>
                </button>
              );
            })}
          </div>

          {/* Number grid */}
          <div className="grid grid-cols-5 gap-2 mb-2.5">
            {NUMBERS.map((n) => {
              const win = reveal && reveal.result === n && phase === "SETTLED";
              const dim = reveal && !win && phase === "SETTLED";
              return (
                <button
                  key={n}
                  type="button"
                  disabled={isLocked}
                  onClick={() =>
                    requestBet({ betType: "number", selection: String(n) })
                  }
                  className={`relative aspect-square rounded-full flex flex-col items-center justify-center text-white font-black transition-all active:scale-[0.94] ${
                    win ? "ring-2 ring-[#ff9a3d]" : "border border-white/15"
                  }`}
                  style={{
                    ...ballStyle(n),
                    opacity: dim ? 0.4 : 1,
                    boxShadow: win ? "0 0 18px rgba(255,154,61,0.6)" : "none",
                  }}
                >
                  <span className="text-base leading-none">{n}</span>
                  <span className="text-[8px] opacity-75 mt-0.5">×9</span>
                </button>
              );
            })}
          </div>

          {/* Big / Small */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { sel: "big", label: "Big", range: "5-9", bg: "linear-gradient(135deg,#f59e0b,#d97706)" },
                { sel: "small", label: "Small", range: "0-4", bg: "linear-gradient(135deg,#3b82f6,#2563eb)" },
              ] as const
            ).map((opt) => {
              const winSize = reveal
                ? reveal.result >= 5
                  ? "big"
                  : "small"
                : null;
              const win = winSize === opt.sel && phase === "SETTLED";
              const dim = reveal && !win && phase === "SETTLED";
              return (
                <button
                  key={opt.sel}
                  type="button"
                  disabled={isLocked}
                  onClick={() =>
                    requestBet({ betType: "bigsmall", selection: opt.sel })
                  }
                  className={`py-3 rounded-xl font-black text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97] ${
                    win ? "ring-2 ring-[#ff9a3d]" : ""
                  }`}
                  style={{
                    background: opt.bg,
                    opacity: dim ? 0.4 : 1,
                    boxShadow: win ? "0 0 20px rgba(255,154,61,0.6)" : "none",
                  }}
                >
                  {opt.label}
                  <span className="text-[10px] opacity-80">
                    {opt.range} · ×2
                  </span>
                </button>
              );
            })}
          </div>

          {isLocked && (
            <div className="mt-2 text-center text-[11px] font-bold text-red-400">
              Betting closed — wait for the next round
            </div>
          )}
        </div>

        {/* ── Live bets feed ────────────────────────────────────────────── */}
        {playerBets.length > 0 && (
          <div className="mt-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-2 max-h-[88px] overflow-hidden">
            <div className="text-[9px] uppercase tracking-widest text-[#6b7280] mb-1 px-1">
              Live bets
            </div>
            <div className="space-y-0.5">
              <AnimatePresence initial={false}>
                {playerBets.slice(0, 4).map((b) => (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-between text-[11px] px-1"
                  >
                    <span className="text-[#9ca3af]">
                      {b.username}{" "}
                      <span className="text-[#6b7280]">
                        · {b.betType === "number" ? `#${b.selection}` : b.selection}
                      </span>
                    </span>
                    <span className="text-white font-bold">
                      ${b.amount.toLocaleString("en-US")}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ── Bottom tabs: History / Chart / My Orders ──────────────────── */}
        <div className="mt-3">
          <div className="flex gap-1.5 mb-2">
            {(["history", "chart", "orders"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setBottomTab(t);
                  if (t === "orders") socketRef.current?.emit("color:get-my-bets");
                }}
                className={`flex-1 py-2 rounded-lg text-[11px] font-bold capitalize transition-all ${
                  bottomTab === t
                    ? "text-black"
                    : "bg-white/[0.04] border border-white/[0.06] text-[#9ca3af]"
                }`}
                style={bottomTab === t ? { background: accent } : undefined}
              >
                {t === "history" ? "Game History" : t === "chart" ? "Chart" : "My Orders"}
              </button>
            ))}
          </div>

          {bottomTab === "history" && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 text-[9px] uppercase tracking-wider text-[#6b7280] border-b border-white/[0.06]">
                <span>Period</span>
                <span>Result</span>
                <span>Colors</span>
              </div>
              <div className="max-h-[220px] overflow-y-auto">
                {roomHistory.map((h) => (
                  <div
                    key={h.period}
                    className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-1.5 border-b border-white/[0.03] last:border-0"
                  >
                    <span className="font-mono text-[11px] text-[#9ca3af] truncate">
                      {h.period}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white border border-white/20"
                        style={ballStyle(h.result)}
                      >
                        {h.result}
                      </span>
                      <span className="text-[9px] font-bold text-[#9ca3af] w-8">
                        {h.size}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 justify-end">
                      {h.resultColors.map((c) => (
                        <span
                          key={c}
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: colorDotBg(c) }}
                        />
                      ))}
                    </span>
                  </div>
                ))}
                {roomHistory.length === 0 && (
                  <div className="px-3 py-4 text-center text-[11px] text-[#6b7280]">
                    No results yet
                  </div>
                )}
              </div>
            </div>
          )}

          {bottomTab === "chart" && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-3">
              {/* Big/Small + color distribution */}
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[#6b7280] mb-1">
                    Big / Small
                  </div>
                  <DistBar a={chart.big} b={chart.small} aLabel="Big" bLabel="Small" aColor="#f59e0b" bColor="#3b82f6" />
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[#6b7280] mb-1">
                    Colors
                  </div>
                  <div className="flex gap-2">
                    <ColorCount label="G" n={chart.green} color="#10b981" />
                    <ColorCount label="V" n={chart.violet} color="#a855f7" />
                    <ColorCount label="R" n={chart.red} color="#ef4444" />
                  </div>
                </div>
              </div>
              {/* Number frequency + missing */}
              <div>
                <div className="text-[9px] uppercase tracking-wider text-[#6b7280] mb-1.5">
                  Number frequency · missing count (last {roomHistory.length})
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {NUMBERS.map((n) => (
                    <div
                      key={n}
                      className="flex flex-col items-center rounded-lg bg-white/[0.03] border border-white/[0.06] py-1.5"
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                        style={ballStyle(n)}
                      >
                        {n}
                      </span>
                      <span className="text-[10px] text-white font-bold mt-0.5">
                        {chart.numFreq[n]}×
                      </span>
                      <span className="text-[8px] text-[#6b7280]">
                        miss {chart.numMissing[n]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {bottomTab === "orders" && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] max-h-[240px] overflow-y-auto">
              {myBets.length === 0 && (
                <div className="px-3 py-4 text-center text-[11px] text-[#6b7280]">
                  No bets yet
                </div>
              )}
              {myBets.map((b) => (
                <div
                  key={b.betId}
                  className="flex items-center justify-between px-3 py-2 border-b border-white/[0.03] last:border-0"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] text-white font-bold">
                      {b.betType === "number"
                        ? `#${b.selection}`
                        : b.selection}
                      <span className="text-[#6b7280] font-normal ml-1.5">
                        {b.room} · {b.period}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#6b7280]">
                      Stake ${b.amount.toLocaleString("en-US")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-[11px] font-black ${
                        b.status === "WON"
                          ? "text-emerald-400"
                          : b.status === "LOST"
                            ? "text-red-400"
                            : "text-[#9ca3af]"
                      }`}
                    >
                      {b.status === "WON"
                        ? `+$${b.payout.toLocaleString("en-US")}`
                        : b.status === "LOST"
                          ? "Lost"
                          : "Pending"}
                    </div>
                    {b.status === "WON" && (
                      <div className="text-[9px] text-[#6b7280]">
                        ×{b.multiplier}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm bet popup ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmSel && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setConfirmSel(null)}
            />
            <motion.div
              initial={{ scale: 0.9, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              className="relative w-full max-w-xs rounded-2xl bg-bg-modal-2 border border-white/[0.08] p-5"
            >
              <div className="text-center mb-4">
                <div className="text-[11px] uppercase tracking-widest text-[#6b7280]">
                  Confirm bet · {activeRoom.label}
                </div>
                <div className="text-xl font-black text-white mt-1">
                  Join {selectionLabel(confirmSel)}{" "}
                  <span style={{ color: accent }}>
                    {selectionPayout(confirmSel)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-[12px] mb-4">
                <Row label="Base amount" value={`$${(parseFloat(betInput) || 0).toLocaleString("en-US")}`} />
                <Row label="Quantity" value={String(quantity)} />
                <Row label="Multiplier" value={`X${multiplierQty}`} />
                <div className="border-t border-white/[0.08] my-1.5" />
                <Row
                  label="Total bet"
                  value={`$${totalStake.toLocaleString("en-US")}`}
                  bold
                />
              </div>

              <label className="flex items-center gap-2 text-[11px] text-[#9ca3af] mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeRules}
                  onChange={(e) => setAgreeRules(e.target.checked)}
                  className="accent-[#ff9a3d]"
                />
                I agree to the game rules
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmSel(null)}
                  className="py-3 rounded-xl bg-bg-deep-3 border border-white/[0.06] text-[#9ca3af] font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmBet}
                  className="py-3 rounded-xl text-black font-black text-sm"
                  style={{ background: accent }}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Result modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {resultModal && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setResultModal(null)}
            />
            <motion.div
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { scale: 0.85, opacity: 0 }
              }
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 20 }
              }
              className={`relative w-full max-w-[280px] rounded-2xl border p-6 text-center ${
                resultModal.won
                  ? "bg-bg-modal-2 border-[#ff9a3d]/40"
                  : "bg-bg-modal-2 border-white/[0.08]"
              }`}
            >
              <div
                className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl font-black text-white border-2 border-white/30 mb-3"
                style={ballStyle(resultModal.result)}
              >
                {resultModal.result}
              </div>
              {resultModal.won ? (
                <>
                  <div className="text-lg font-black text-white">
                    Congratulations!
                  </div>
                  <CountUp
                    to={resultModal.payout}
                    reduceMotion={!!reduceMotion}
                  />
                </>
              ) : (
                <>
                  <div className="text-lg font-black text-white">
                    Better luck next round
                  </div>
                  <div className="text-[12px] text-[#9ca3af] mt-1">
                    Result {resultModal.result} · {resultModal.size}
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={() => setResultModal(null)}
                className="mt-4 text-[11px] text-[#6b7280] hover:text-white"
              >
                Tap to dismiss
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Rules sheet ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {rulesOpen && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setRulesOpen(false)}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-bg-modal-2 border border-white/[0.08] p-5 max-h-[80vh] overflow-y-auto"
            >
              <div className="text-base font-black text-white mb-3">
                How to play Wingo
              </div>
              <div className="space-y-2 text-[12px] text-[#9ca3af] leading-relaxed">
                <p>
                  Each room runs continuous timed rounds. Bet on a color, an
                  exact number, or Big/Small before betting locks in the final
                  5 seconds. At 00:00 one shared number 0–9 is drawn for every
                  player in the room.
                </p>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 space-y-1">
                  <div>0 = Red + Violet (Small)</div>
                  <div>5 = Green + Violet (Big)</div>
                  <div>1, 3, 7, 9 = Green · 2, 4, 6, 8 = Red</div>
                  <div>Small = 0–4 · Big = 5–9</div>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 space-y-1">
                  <div>Green / Red: ×2 (×1.5 when shared with violet on 0/5)</div>
                  <div>Violet: ×4.5 (result is 0 or 5)</div>
                  <div>Number: ×9 · Big / Small: ×2</div>
                </div>
                <p className="text-[11px] text-[#6b7280]">
                  A small house edge is applied to payouts. Each round is
                  provably fair — the server seed hash is committed before
                  betting closes and revealed after the draw (see the Fairness
                  panel).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRulesOpen(false)}
                className="mt-4 w-full py-3 rounded-xl text-black font-black text-sm"
                style={{ background: accent }}
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </OriginalsShell>
  );
}

/* ── Small presentational helpers ──────────────────────────────────────────── */

function CountdownClock({
  ms,
  locked,
  reduceMotion,
}: {
  ms: number;
  locked: boolean;
  reduceMotion: boolean;
}) {
  const red = locked || ms <= LOCK_WINDOW_MS;
  const pulse = !reduceMotion && ms <= 10_000 && ms > 0;
  return (
    <motion.div
      animate={pulse ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ repeat: pulse ? Infinity : 0, duration: 1 }}
      className="text-2xl font-black font-mono tabular-nums"
      style={{
        color: red ? "#ef4444" : "#ffffff",
        transition: "color 150ms ease",
        textShadow: red ? "0 0 14px rgba(239,68,68,0.5)" : "none",
      }}
    >
      {fmtClock(ms)}
    </motion.div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#6b7280]">{label}</span>
      <span className={bold ? "text-white font-black" : "text-white font-bold"}>
        {value}
      </span>
    </div>
  );
}

function CountUp({ to, reduceMotion }: { to: number; reduceMotion: boolean }) {
  const [n, setN] = useState(reduceMotion ? to : 0);
  useEffect(() => {
    if (reduceMotion) return; // already initialised to `to`
    let raf = 0;
    const start = performance.now();
    const dur = 600;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(to * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, reduceMotion]);
  return (
    <div
      className="text-2xl font-black mt-1"
      style={{ color: ACCENT, textShadow: "0 0 16px rgba(255,154,61,0.6)" }}
    >
      +${Math.round(n).toLocaleString("en-US")}
    </div>
  );
}

function DistBar({
  a,
  b,
  aLabel,
  bLabel,
  aColor,
  bColor,
}: {
  a: number;
  b: number;
  aLabel: string;
  bLabel: string;
  aColor: string;
  bColor: string;
}) {
  const total = a + b || 1;
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.04]">
        <div style={{ width: `${(a / total) * 100}%`, background: aColor }} />
        <div style={{ width: `${(b / total) * 100}%`, background: bColor }} />
      </div>
      <div className="flex justify-between text-[10px] text-[#9ca3af] mt-1">
        <span>
          {aLabel} {a}
        </span>
        <span>
          {bLabel} {b}
        </span>
      </div>
    </div>
  );
}

function ColorCount({
  label,
  n,
  color,
}: {
  label: string;
  n: number;
  color: string;
}) {
  return (
    <div className="flex-1 rounded-lg bg-white/[0.03] border border-white/[0.06] py-1.5 flex flex-col items-center">
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white"
        style={{ background: color }}
      >
        {label}
      </span>
      <span className="text-[11px] text-white font-bold mt-0.5">{n}</span>
    </div>
  );
}
