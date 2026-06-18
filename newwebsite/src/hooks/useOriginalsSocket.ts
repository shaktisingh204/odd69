"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { getConfiguredSocketNamespace } from "@/utils/socketUrl";

type OriginalsEventPayload = Record<string, unknown>;
type OriginalsErrorPayload = { message: string };
type WalletType = "fiat" | "crypto";

export interface MinesStartedPayload {
  gameId: string;
  serverSeedHash: string;
  clientSeed?: string;
  betAmount: number;
  mineCount: number;
  walletType: WalletType;
  revealedTiles: number[];
  multiplier: number;
  status: string;
}

export interface MinesTileResultPayload {
  hit: false;
  tileIndex: number;
  revealedTiles: number[];
  multiplier: number;
  potentialPayout: number;
  nearMiss?: boolean;
}

export interface MinesGameOverPayload {
  hit: true;
  tileIndex: number;
  minePositions: number[];
  serverSeed: string;
  revealedTiles: number[];
  payout?: number;
}

export interface MinesCashoutPayload {
  gameId: string;
  status: string;
  multiplier: number;
  payout: number;
  potentialPayout: number;
  betAmount: number;
  minePositions: number[];
  serverSeed: string;
  clientSeed: string;
  revealedTiles: number[];
}

export interface MinesReconnectedPayload {
  gameId: string;
  serverSeedHash: string;
  clientSeed?: string;
  betAmount: number;
  mineCount: number;
  walletType: WalletType;
  revealedTiles: number[];
  multiplier: number;
  potentialPayout: number;
  status: string;
}

export interface OriginalsBigWinPayload {
  username?: string;
  multiplier: number;
  payout: number;
  game?: string;
  ts?: number;
}

export interface OriginalsEngagementPayload {
  type?: string;
  message: string;
}

export interface OriginalsStatsPayload {
  activePlayers: number;
}

export interface OriginalsSocketOptions {
  game: "mines" | "crash" | "dice";
  onStarted?: (data: MinesStartedPayload) => void;
  onTileResult?: (data: MinesTileResultPayload) => void;
  onGameOver?: (data: MinesGameOverPayload) => void;
  onCashoutSuccess?: (data: MinesCashoutPayload) => void;
  onReconnected?: (data: MinesReconnectedPayload) => void;
  onNoActive?: () => void;
  onError?: (err: OriginalsErrorPayload) => void;
  onLiveBet?: (data: OriginalsEventPayload) => void;
  onBigWin?: (data: OriginalsBigWinPayload) => void;
  onEngagement?: (data: OriginalsEngagementPayload) => void;
  onStats?: (data: OriginalsStatsPayload) => void;
}

export function useOriginalsSocket(opts: OriginalsSocketOptions) {
  const { token, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const optsRef = useRef(opts);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  useEffect(() => {
    const endpoint = getConfiguredSocketNamespace("originals");
    if (!endpoint) {
      return;
    }

    const socket = io(endpoint.url, {
      path: endpoint.path,
      auth: { token: token || "" },
      transports: ["websocket", "polling"],
      upgrade: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setReconnecting(false);
      socket.emit("join-originals", { game: optsRef.current.game });
      if (optsRef.current.game === "mines" && isAuthenticated) {
        socket.emit("mines:active");
      }
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      if (reason === "io server disconnect") {
        setTimeout(() => socket.connect(), 2000);
      }
    });
    socket.on("connect_error", (err) => {
      setConnected(false);
      console.error("[useOriginalsSocket] connect_error:", err.message);
    });
    socket.on("reconnect_attempt", () => {
      setReconnecting(true);
    });
    socket.on("reconnect", () => {
      setReconnecting(false);
    });

    socket.on("mines:started", (data: MinesStartedPayload) => optsRef.current.onStarted?.(data));
    socket.on("mines:tile-result", (data: MinesTileResultPayload) => optsRef.current.onTileResult?.(data));
    socket.on("mines:game-over", (data: MinesGameOverPayload) => optsRef.current.onGameOver?.(data));
    socket.on("mines:cashout-success", (data: MinesCashoutPayload) => optsRef.current.onCashoutSuccess?.(data));
    socket.on("mines:reconnected", (data: MinesReconnectedPayload) => optsRef.current.onReconnected?.(data));
    socket.on("mines:no-active", () => optsRef.current.onNoActive?.());
    socket.on("mines:error", (err: OriginalsErrorPayload) => optsRef.current.onError?.(err));

    socket.on("originals:live-bet", (data: OriginalsEventPayload) => optsRef.current.onLiveBet?.(data));
    socket.on("originals:big-win", (data: OriginalsBigWinPayload) => optsRef.current.onBigWin?.(data));
    socket.on("originals:engagement", (data: OriginalsEngagementPayload) => optsRef.current.onEngagement?.(data));
    socket.on("originals:stats", (data: OriginalsStatsPayload) => optsRef.current.onStats?.(data));

    return () => {
      socket.emit("leave-originals", { game: optsRef.current.game });
      socket.disconnect();
    };
  }, [isAuthenticated, opts.game, token]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const startGame = useCallback(
    (data: {
      betAmount: number;
      mineCount: number;
      clientSeed?: string;
      walletType?: "fiat" | "crypto";
      useBonus?: boolean;
    }) => {
      socketRef.current?.emit("mines:start", data);
    },
    [],
  );

  const revealTile = useCallback((gameId: string, tileIndex: number) => {
    socketRef.current?.emit("mines:reveal", { gameId, tileIndex });
  }, []);

  const cashout = useCallback((gameId: string) => {
    socketRef.current?.emit("mines:cashout", { gameId });
  }, []);

  return { connected, reconnecting, emit, startGame, revealTile, cashout };
}
