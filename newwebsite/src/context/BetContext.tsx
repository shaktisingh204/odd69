'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { betsApi, Bet as BetModel } from '@/services/bets';
import { sportsApi } from '@/services/sports';
import { useAuth } from './AuthContext';
import { useModal } from './ModalContext';
import { useWallet } from './WalletContext';
import { useSocket } from './SocketContext';
import { calculatePotentialWin } from '@/utils/sportsBetPricing';
import toast from 'react-hot-toast';


export interface Bet {
    id: string; // local ID for slip
    eventId: string;
    eventName: string;
    marketId: string;
    marketName: string;
    selectionId: string;
    selectionName: string;
    odds: number;
    rate?: number;
    marketType?: string;
    betType?: 'back' | 'lay';
    provider?: string;
    srSportId?: string;
    srMarketFullId?: string;
    srRunnerId?: string;
    srRunnerName?: string;
    srMarketName?: string;
    stake: number;
    potentialWin: number;
}

export type BetSelection = Omit<Bet, 'id' | 'stake' | 'potentialWin'>;

interface BetContextType {
    bets: Bet[];
    myBets: BetModel[];
    addBet: (bet: BetSelection) => void;
    removeBet: (id: string) => void;
    updateStake: (id: string, stake: number) => void;
    clearBets: () => void;
    totalStake: number;
    totalPotentialWin: number;
    placeBet: () => Promise<void>;
    placeSingleBet: (bet: BetSelection, stake?: number) => Promise<void>;
    bookBets: () => Promise<string>;
    loadBookedBet: (bookingId: string) => Promise<void>;
    refreshMyBets: () => Promise<void>;
    isBetslipOpen: boolean;
    toggleBetslip: () => void;
    oneClickEnabled: boolean;
    setOneClickEnabled: (enabled: boolean) => void;
    oneClickStake: number;
    setOneClickStake: (stake: number) => void;
    isOneClickPending: (eventId: string, marketId: string, selectionId: string) => boolean;
}

const BetContext = createContext<BetContextType | undefined>(undefined);
const ONE_CLICK_ENABLED_KEY = 'zeero_sports_one_click_enabled';
const ONE_CLICK_STAKE_KEY = 'zeero_sports_one_click_stake';
const DEFAULT_ONE_CLICK_STAKE = 100;

const normalizeStake = (stake: number) => {
    const parsed = Math.floor(Number(stake));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ONE_CLICK_STAKE;
};

const buildBetKey = (eventId: string, marketId: string, selectionId: string) =>
    `${eventId}::${marketId}::${selectionId}`;

const normalizeEventStatus = (value: string | null | undefined) =>
    String(value ?? '')
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_');

const isCompletedEventStatus = (value: string | null | undefined) =>
    [
        'CLOSED',
        'COMPLETED',
        'ENDED',
        'FINISHED',
        'ABANDONED',
        'SETTLED',
    ].includes(normalizeEventStatus(value));

type SportsOddsUpdateDetail = {
    eventId: string;
    marketId: string;
    selectionId: string;
    currentOdds: number;
};

const dispatchSportsOddsUpdated = (updates: SportsOddsUpdateDetail[]) => {
    if (typeof window === 'undefined' || updates.length === 0) return;

    window.dispatchEvent(new CustomEvent('sports:odds-updated', {
        detail: {
            eventIds: Array.from(new Set(updates.map((update) => update.eventId).filter(Boolean))),
            updates,
        },
    }));
};

const isAutoAcceptMatchOddsBet = (bet: Pick<Bet, 'marketType' | 'marketName'>) => {
    const marketType = String(bet.marketType || '').trim().toLowerCase();
    const marketName = String(bet.marketName || '').trim().toLowerCase();

    return (
        marketType === 'match' ||
        marketType === 'match1' ||
        marketType === 'match_odds' ||
        marketName.includes('match odds') ||
        marketName.includes('match winner')
    );
};

export function BetProvider({ children }: { children: React.ReactNode }) {
    const [bets, setBets] = useState<Bet[]>([]);
    const [myBets, setMyBets] = useState<BetModel[]>([]);
    const [isBetslipOpen, setIsBetslipOpen] = useState(false);
    const [oneClickEnabledState, setOneClickEnabledState] = useState(false);
    const [oneClickStakeState, setOneClickStakeState] = useState(DEFAULT_ONE_CLICK_STAKE);
    const [pendingOneClickKeys, setPendingOneClickKeys] = useState<Set<string>>(new Set());
    const pendingOneClickKeysRef = useRef<Set<string>>(new Set());
    const betsRef = useRef<Bet[]>([]);
    const { isAuthenticated } = useAuth();
    const { openLogin } = useModal();
    const { selectedWallet, selectedSubWallet, refreshWallet: refreshWalletBalance } = useWallet();
    const { socket } = useSocket();

    const toggleBetslip = () => setIsBetslipOpen(prev => !prev);

    useEffect(() => {
        betsRef.current = bets;
    }, [bets]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const storedEnabled = localStorage.getItem(ONE_CLICK_ENABLED_KEY);
        const storedStake = localStorage.getItem(ONE_CLICK_STAKE_KEY);

        setOneClickEnabledState(storedEnabled === '1');
        setOneClickStakeState(storedStake ? normalizeStake(Number(storedStake)) : DEFAULT_ONE_CLICK_STAKE);
    }, []);

    const setOneClickEnabled = (enabled: boolean) => {
        setOneClickEnabledState(enabled);
        if (typeof window !== 'undefined') {
            localStorage.setItem(ONE_CLICK_ENABLED_KEY, enabled ? '1' : '0');
        }
    };

    const setOneClickStake = (stake: number) => {
        const normalized = normalizeStake(stake);
        setOneClickStakeState(normalized);
        if (typeof window !== 'undefined') {
            localStorage.setItem(ONE_CLICK_STAKE_KEY, String(normalized));
        }
    };

    const isOneClickPending = (eventId: string, marketId: string, selectionId: string) =>
        pendingOneClickKeys.has(buildBetKey(eventId, marketId, selectionId));

    const refreshMyBets = useCallback(async () => {
        if (!isAuthenticated) {
            setMyBets([]);
            return;
        }
        try {
            const data = await betsApi.getMyBets();
            setMyBets(data);
        } catch (error) {
            console.error("Failed to fetch my bets", error);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        refreshMyBets();
    }, [refreshMyBets]);

    const buildSlipBet = (newBet: BetSelection, stake: number): Bet => ({
        ...newBet,
        id: buildBetKey(newBet.eventId, newBet.marketId, newBet.selectionId),
        stake,
        potentialWin: calculatePotentialWin({
            stake,
            odds: newBet.odds,
            rate: newBet.rate,
            betType: newBet.betType,
            marketType: newBet.marketType,
            marketName: newBet.marketName,
            selectionName: newBet.selectionName,
        }),
    });

    const addBet = (newBet: BetSelection) => {
        const nextId = buildBetKey(newBet.eventId, newBet.marketId, newBet.selectionId);
        const existing = bets.find(b => b.id === nextId);
        if (existing) return;

        setBets(prev => [...prev, buildSlipBet(newBet, DEFAULT_ONE_CLICK_STAKE)]);
    };

    const removeBet = (id: string) => {
        setBets(prev => prev.filter(b => b.id !== id));
    };

    const updateStake = (id: string, stake: number) => {
        setBets(prev => prev.map(b => {
            if (b.id === id) {
                return {
                    ...b,
                    stake,
                    potentialWin: calculatePotentialWin({
                        stake,
                        odds: b.odds,
                        rate: b.rate,
                        betType: b.betType,
                        marketType: b.marketType,
                        marketName: b.marketName,
                        selectionName: b.selectionName,
                    }),
                };
            }
            return b;
        }));
    };

    const clearBets = () => setBets([]);

    // ── Live market sync via Socket.IO ────────────────────────────────────────
    // Listens for socket-data events. For every market update:
    //  • If the market is suspended → remove all betslip selections in that market
    //  • If odds changed for a selection in the slip → silently update to latest odds
    useEffect(() => {
        if (!socket) return;

        const handleSocketData = (data: any) => {
            if (!data) return;
            if (betsRef.current.length === 0) return;

            const messageType = String(data.messageType ?? '');
            const isRelevantMessage =
                messageType === 'match_odds' ||
                messageType === 'odds' ||
                messageType === 'sportradar_odds' ||
                messageType === 'bookmaker_odds' ||
                messageType === 'bm_odds' ||
                data.ms !== undefined;
            if (!isRelevantMessage) return;

            // Collect market updates: { mid, eid, suspended, runners: {rid, backOdds}[] }
            const marketUpdates: { mid: string; eid?: string; suspended: boolean; runners: { rid: string; backOdds?: number }[] }[] = [];

            const isFancyGtype = (g?: string) => {
                if (!g) return false;
                const l = g.toLowerCase();
                return ['session', 'fancy', 'fancy2', 'khado', 'meter', 'oddeven', 'other fancy'].includes(l);
            };

            // match_odds / odds packets
            if ((messageType === 'match_odds' || messageType === 'odds' || messageType === 'sportradar_odds') && Array.isArray(data.data)) {
                data.data.forEach((update: any) => {
                    const rawMid = String(update.bmi || update.mid || update.id || '');
                    if (!rawMid) return;
                    
                    const eid = String(update.eid || data.eventId || '');
                    const mid = (messageType === 'sportradar_odds' && rawMid.includes(':'))
                        ? rawMid.split(':').pop()!
                        : rawMid;

                    const suspended = update.ms === 4;
                    const runners: { rid: string; backOdds?: number }[] = [];
                    if (!isFancyGtype(update.gtype) && Array.isArray(update.rt)) {
                        update.rt.forEach((r: any) => {
                            if (r.ib) { // back runner
                                runners.push({ rid: String(r.ri ?? r.id ?? ''), backOdds: r.rt });
                            }
                        });
                    }
                    marketUpdates.push({ mid, eid, suspended, runners });
                });
            }

            // bookmaker packets
            if ((messageType === 'bookmaker_odds' || messageType === 'bm_odds') && Array.isArray(data.data)) {
                data.data.forEach((update: any) => {
                    const mid = String(update.mid || update.id || update.bmi || '');
                    if (!mid) return;
                    const eid = String(update.eid || data.eventId || '');
                    const suspended = update.ms === 4;
                    const runners: { rid: string; backOdds?: number }[] = [];
                    if (Array.isArray(update.rt)) {
                        update.rt.forEach((r: any) => {
                            if (r.ib) runners.push({ rid: String(r.ri ?? r.id ?? ''), backOdds: r.rt });
                        });
                    }
                    marketUpdates.push({ mid, eid, suspended, runners });
                });
            }

            // top-level market status (ms field with id)
            if (data.ms !== undefined && data.id) {
                marketUpdates.push({ mid: String(data.id), eid: String(data.eventId || ''), suspended: data.ms === 4, runners: [] });
            }

            if (marketUpdates.length === 0) return;

            setBets(prev => {
                if (prev.length === 0) return prev;

                let next = [...prev];
                let anyChanged = false;
                const removedNames: string[] = [];
                const updatedOddsNames: string[] = [];
                const updatedOddsDetails: SportsOddsUpdateDetail[] = [];

                for (const mu of marketUpdates) {
                    if (mu.suspended) {
                        // Remove all bets in this market from the slip, strictly validating event IDs
                        const isMatch = (b: Bet) => {
                            if (b.marketId !== mu.mid) return false;
                            const isSrBet = String(b.eventId).startsWith('sr:');
                            if (mu.eid) return mu.eid === b.eventId;
                            return !isSrBet; // Protect SR bets from legacy ID-only matches
                        };
                        const toRemove = next.filter(isMatch);
                        if (toRemove.length > 0) {
                            toRemove.forEach(b => removedNames.push(b.selectionName || b.marketName));
                            next = next.filter(b => !isMatch(b));
                            anyChanged = true;
                        }
                        continue;
                    }

                    // Update odds for any bet whose marketId + selectionId matches
                    next = next.map(b => {
                        if (b.marketId !== mu.mid) return b;
                        
                        // Strict event validation:
                        // If the update has an eid, it MUST match the bet's eventId.
                        // If the bet is a Sportradar bet (starts with sr:match:) and the update has NO eid,
                        // it's a legacy update and MUST NOT corrupt the Sportradar bet.
                        const isSrBet = String(b.eventId).startsWith('sr:');
                        if (mu.eid) {
                            if (mu.eid !== b.eventId) return b;
                        } else {
                            if (isSrBet) return b; // Protect SR bets from legacy ID-only matches
                        }

                        const runnerUpdate = mu.runners.find(r => r.rid === b.selectionId);
                        if (!runnerUpdate || runnerUpdate.backOdds == null) return b;
                        const newOdds = runnerUpdate.backOdds;
                        if (newOdds === b.odds) return b; // unchanged
                        anyChanged = true;
                        updatedOddsNames.push(b.selectionName || b.marketName);
                        updatedOddsDetails.push({
                            eventId: b.eventId,
                            marketId: b.marketId,
                            selectionId: b.selectionId,
                            currentOdds: newOdds,
                        });
                        return {
                            ...b,
                            odds: newOdds,
                            potentialWin: calculatePotentialWin({
                                stake: b.stake,
                                odds: newOdds,
                                rate: b.rate,
                                betType: b.betType,
                                marketType: b.marketType,
                                marketName: b.marketName,
                                selectionName: b.selectionName,
                            }),
                        };
                    });
                }

                if (!anyChanged) return prev;

                // Fire toasts outside of the state update (after microtask)
                if (removedNames.length > 0) {
                    setTimeout(() => {
                        toast.error(
                            `Market suspended — ${removedNames.join(', ')} removed from your betslip.`,
                            { duration: 5000, id: 'market-suspended-betslip' }
                        );
                    }, 0);
                }
                if (updatedOddsNames.length > 0) {
                    setTimeout(() => {
                        toast(
                            `Odds updated: ${updatedOddsNames.join(', ')}`,
                            { icon: '📊', duration: 3000, id: 'odds-updated-betslip' }
                        );
                    }, 0);
                }
                if (updatedOddsDetails.length > 0) {
                    setTimeout(() => {
                        dispatchSportsOddsUpdated(updatedOddsDetails);
                    }, 0);
                }

                return next;
            });
        };

        socket.on('socket-data', handleSocketData);
        return () => { socket.off('socket-data', handleSocketData); };
    }, [socket]);
    // ─────────────────────────────────────────────────────────────────────────

    const totalStake = bets.reduce((sum, b) => sum + b.stake, 0);
    const totalPotentialWin = bets.reduce((sum, b) => sum + b.potentialWin, 0);

    const validateOddsBeforePlacement = async (betsToValidate: Bet[], syncSlipOdds: boolean) => {
        // ── Odds Validation ──────────────────────────────────────────────────
        // Before submitting, re-check current live odds for every selection.
        // If any changed, update the betslip and throw so the user reviews.
        try {
            const checkPayload = betsToValidate.map(b => ({
                eventId: b.eventId,
                marketId: b.marketId,
                selectionId: b.selectionId,
                odds: b.odds,
            }));

            const { success, results } = await sportsApi.checkOdds(checkPayload);

            if (success && results.length > 0) {
                const changed = results.filter(r => r.changed);
                const buildUpdatedBet = (bet: Bet, currentOdds: number | null | undefined) => {
                    const newOdds = currentOdds ?? bet.odds;
                    const effectiveMultiplier = bet.rate ?? newOdds;

                    return {
                        ...bet,
                        odds: newOdds,
                        potentialWin: calculatePotentialWin({
                            stake: bet.stake,
                            odds: newOdds,
                            rate: effectiveMultiplier,
                            betType: bet.betType,
                            marketType: bet.marketType,
                            marketName: bet.marketName,
                            selectionName: bet.selectionName,
                        }),
                    };
                };

                if (changed.length > 0) {
                    const closedUpdates = changed.filter(
                        (update) => update.eventClosed || isCompletedEventStatus(update.eventStatus),
                    );

                    if (closedUpdates.length > 0) {
                        const closedEventIds = new Set(
                            closedUpdates
                                .map((update) => update.eventId)
                                .filter(Boolean),
                        );

                        if (syncSlipOdds && closedEventIds.size > 0) {
                            setBets(prev => prev.filter((bet) => !closedEventIds.has(bet.eventId)));
                        }

                        throw new Error('Match completed — betting is closed for this event.');
                    }

                    dispatchSportsOddsUpdated(
                        changed.flatMap((update) => {
                            if (!update.eventId || update.currentOdds == null) return [];

                            return [{
                                eventId: update.eventId,
                                marketId: update.marketId,
                                selectionId: update.selectionId,
                                currentOdds: update.currentOdds,
                            }];
                        }),
                    );

                    if (syncSlipOdds) {
                        // Update bets state with fresh odds so user sees new values
                        setBets(prev => prev.map(b => {
                            const update = changed.find(
                                r => r.marketId === b.marketId && r.selectionId === b.selectionId
                            );
                            if (!update) return b;
                            return buildUpdatedBet(b, update.currentOdds);
                        }));
                    }

                    const betsToPlace = betsToValidate;

                    const suspendedCount = changed.filter(r => r.suspended).length;
                    if (suspendedCount > 0) {
                        throw new Error('Market Suspended — one or more markets are currently suspended.');
                    }

                    // Strict validation: ANY odds change requires explicit user review.
                    // Removed the auto-accept Match Odds bypass.
                    const requiresReview = changed.some((update) => {
                        const bet = betsToValidate.find(
                            candidate => candidate.marketId === update.marketId && candidate.selectionId === update.selectionId
                        );
                        return !!bet;
                    });

                    if (requiresReview) {
                        throw new Error('Odds changed — please review the updated odds and place again.');
                    }

                    return betsToPlace;
                }
            }
        } catch (oddsError: any) {
            // Re-throw odds errors so the UI can display them
            if (oddsError.message?.includes('Odds changed') || oddsError.message?.includes('Suspended')) {
                throw oddsError;
            }
            // Network/other error during check — fail open, proceed with bet
            console.warn('Odds check failed, proceeding with placement:', oddsError.message);
        }
        return betsToValidate;
        // ────────────────────────────────────────────────────────────────────
    };

    const submitPlacedBets = async (betsToPlace: Bet[]) => {
        for (const bet of betsToPlace) {
            await betsApi.placeBet({
                eventId: bet.eventId,
                eventName: bet.eventName,
                marketId: bet.marketId,
                marketName: bet.marketName,
                selectionId: bet.selectionId,
                selectionName: bet.selectionName,
                odds: bet.odds,
                rate: bet.rate,
                stake: bet.stake,
                walletType: selectedSubWallet,
                betType: bet.betType,
                srSportId: bet.srSportId,
                srMarketFullId: bet.srMarketFullId,
                srRunnerId: bet.srRunnerId,
                srRunnerName: bet.srRunnerName,
                srMarketName: bet.srMarketName,
            });
        }
    };

    const refreshAfterPlacement = async () => {
        await refreshMyBets();
        await refreshWalletBalance();
    };

    const ensureAuthenticated = () => {
        if (!isAuthenticated) {
            openLogin();
            throw new Error('Login required');
        }
    };

    const placeBet = async () => {
        ensureAuthenticated();

        if (bets.length === 0) return;

        const betsToPlace = await validateOddsBeforePlacement(bets, true);

        try {
            await submitPlacedBets(betsToPlace);
            clearBets();
            await refreshAfterPlacement();
        } catch (error) {
            console.error("Failed to place bets", error);
            throw error;
        }
    };

    const placeSingleBet = async (selection: BetSelection, stake = oneClickStakeState) => {
        ensureAuthenticated();

        const singleBet = buildSlipBet(selection, normalizeStake(stake));
        const pendingKey = buildBetKey(selection.eventId, selection.marketId, selection.selectionId);

        if (pendingOneClickKeysRef.current.has(pendingKey)) return;

        pendingOneClickKeysRef.current.add(pendingKey);

        setPendingOneClickKeys(prev => {
            const next = new Set(prev);
            next.add(pendingKey);
            return next;
        });

        try {
            const betsToPlace = await validateOddsBeforePlacement([singleBet], false);
            await submitPlacedBets(betsToPlace);
            await refreshAfterPlacement();
        } catch (error) {
            console.error('Failed to place one-click bet', error);
            throw error;
        } finally {
            pendingOneClickKeysRef.current.delete(pendingKey);
            setPendingOneClickKeys(prev => {
                const next = new Set(prev);
                next.delete(pendingKey);
                return next;
            });
        }
    };

    const bookBets = async () => {
        if (bets.length === 0) throw new Error('No bets to book');
        try {
            // Include rate and betType explicitly if they exist
            const payload = bets.map(b => ({
                eventId: b.eventId,
                eventName: b.eventName,
                marketId: b.marketId,
                marketName: b.marketName,
                selectionId: b.selectionId,
                selectionName: b.selectionName,
                odds: b.odds,
                stake: b.stake,
                potentialWin: b.potentialWin,
                rate: b.rate,
                betType: b.betType,
                marketType: b.marketType,
                provider: b.provider,
                srSportId: b.srSportId,
                srMarketFullId: b.srMarketFullId,
                srRunnerId: b.srRunnerId,
                srRunnerName: b.srRunnerName,
                srMarketName: b.srMarketName,
            }));
            const { bookingId } = await betsApi.bookBets(payload);
            return bookingId;
        } catch (error) {
            console.error('Failed to book bets', error);
            throw error;
        }
    };

    const loadBookedBet = async (bookingId: string) => {
        try {
            const booked = await betsApi.getBookedBets(bookingId);
            if (booked && booked.bets) {
                setBets(booked.bets);
            }
        } catch (error) {
            console.error('Failed to load booked bets', error);
            throw error;
        }
    };

    return (
        <BetContext.Provider value={{
            bets,
            myBets,
            addBet,
            removeBet,
            updateStake,
            clearBets,
            totalStake,
            totalPotentialWin,
            placeBet,
            placeSingleBet,
            bookBets,
            loadBookedBet,
            refreshMyBets,
            isBetslipOpen,
            toggleBetslip,
            oneClickEnabled: oneClickEnabledState,
            setOneClickEnabled,
            oneClickStake: oneClickStakeState,
            setOneClickStake,
            isOneClickPending,
        }}>
            {children}
        </BetContext.Provider>
    );
}

export function useBets() {
    const context = useContext(BetContext);
    if (context === undefined) {
        throw new Error('useBets must be used within a BetProvider');
    }
    return context;
}
