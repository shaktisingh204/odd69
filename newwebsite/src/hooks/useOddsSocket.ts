'use client';

// ─────────────────────────────────────────────────────────────────────────────
// useOddsSocket — real-time Odds API hook
//
// Joins the 'odds-sports' Socket.IO room on mount, listens for:
//   'odds-api-update'  → { sport_key, events[], synced_at }
//   'odds-api-scores'  → { sport_key, scores[], synced_at }
//
// Returns a map keyed by sport_key so consumers can efficiently update
// only the affected sport's events without re-fetching everything.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { useSocket } from '@/context/SocketContext';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

export interface OddsMarket {
  key: string;
  last_update?: string;
  outcomes: OddsOutcome[];
}

export interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

export interface OddsScore {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
  last_update: string | null;
}

interface OddsUpdate {
  sport_key: string;
  events: OddsEvent[];
  synced_at: string;
}

interface ScoresUpdate {
  sport_key: string;
  scores: OddsScore[];
  synced_at: string;
}

export interface OddsSocketState {
  /** Map of sport_key → latest events array (updated in real-time via socket) */
  eventsBySport: Record<string, OddsEvent[]>;
  /** Map of sport_key → latest scores array */
  scoresBySport: Record<string, OddsScore[]>;
  /** Timestamp of last socket message received */
  lastUpdate: Date | null;
  /** Whether the socket room has been joined */
  isJoined: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useOddsSocket
 *
 * Usage:
 *   const { eventsBySport, scoresBySport, lastUpdate, isJoined } = useOddsSocket();
 *   const eplEvents = eventsBySport['soccer_epl'] ?? [];
 */
export function useOddsSocket(): OddsSocketState {
  const { socket, isConnected } = useSocket();
  const [state, setState] = useState<OddsSocketState>({
    eventsBySport: {},
    scoresBySport: {},
    lastUpdate: null,
    isJoined: false,
  });

  // Track join state in a ref to avoid stale closure issues
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (!socket || !isConnected) {
      hasJoinedRef.current = false;
      setState((prev) => ({ ...prev, isJoined: false }));
      return;
    }

    // Join the odds-sports room
    if (!hasJoinedRef.current) {
      socket.emit('join-odds-sports');
      hasJoinedRef.current = true;
      setState((prev) => ({ ...prev, isJoined: true }));
    }

    // ── Odds update handler ──────────────────────────────────────
    const handleOddsUpdate = (payload: OddsUpdate) => {
      if (!payload?.sport_key || !Array.isArray(payload.events)) return;
      setState((prev) => ({
        ...prev,
        eventsBySport: {
          ...prev.eventsBySport,
          [payload.sport_key]: payload.events,
        },
        lastUpdate: new Date(),
      }));
    };

    // ── Scores update handler ────────────────────────────────────
    const handleScoresUpdate = (payload: ScoresUpdate) => {
      if (!payload?.sport_key || !Array.isArray(payload.scores)) return;
      setState((prev) => ({
        ...prev,
        scoresBySport: {
          ...prev.scoresBySport,
          [payload.sport_key]: payload.scores,
        },
        lastUpdate: new Date(),
      }));
    };

    socket.on('odds-api-update', handleOddsUpdate);
    socket.on('odds-api-scores', handleScoresUpdate);

    return () => {
      socket.off('odds-api-update', handleOddsUpdate);
      socket.off('odds-api-scores', handleScoresUpdate);

      // Leave room on unmount
      socket.emit('leave-odds-sports');
      hasJoinedRef.current = false;
    };
  }, [socket, isConnected]);

  return state;
}
