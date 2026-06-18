
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getConfiguredSocketEndpoint } from '@/utils/socketUrl';

// ─── Connection states ────────────────────────────────────────────────────────
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    connectionStatus: ConnectionStatus;
    /** Number of reconnection attempts since last successful connect */
    reconnectAttempts: number;
    hasConnectedOnce: boolean;
    joinMatchRoom: (matchId: string) => void;
    leaveMatchRoom: (matchId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    connectionStatus: 'disconnected',
    reconnectAttempts: 0,
    hasConnectedOnce: false,
    joinMatchRoom: () => {},
    leaveMatchRoom: () => {},
});

export const useSocket = () => useContext(SocketContext);

type SocketTransportName = 'polling' | 'websocket';

function buildTransportDebugUrl(
    baseUrl: string | null,
    path: string | null,
    transport: SocketTransportName,
    sid?: string | null
) {
    if (!baseUrl || !path) return null;

    try {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        const transportUrl = new URL(normalizedPath, baseUrl);

        if (transport === 'websocket') {
            transportUrl.protocol = transportUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        }

        transportUrl.searchParams.set('EIO', '4');
        transportUrl.searchParams.set('transport', transport);

        if (sid) {
            transportUrl.searchParams.set('sid', sid);
        }

        return transportUrl.toString();
    } catch {
        return null;
    }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const [hasConnectedOnce, setHasConnectedOnce] = useState(false);
    const { user, token } = useAuth();
    const pathname = usePathname();
    const socketEndpoint = getConfiguredSocketEndpoint();
    const socketUrl = socketEndpoint?.url ?? null;
    const socketPath = socketEndpoint?.path ?? null;
    const pollingUrl = buildTransportDebugUrl(socketUrl, socketPath, 'polling');
    const websocketUrl = buildTransportDebugUrl(socketUrl, socketPath, 'websocket');

    // Track rooms to re-join on reconnect
    const joinedRoomsRef = useRef<Set<string>>(new Set());
    const userIdRef = useRef<number | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const forcedReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const shouldConnect = Boolean(
        pathname === '/' ||
        pathname?.startsWith('/profile') ||
        pathname?.startsWith('/sports')
    );

    const clearForcedReconnectTimer = useCallback(() => {
        if (!forcedReconnectTimerRef.current) return;
        clearTimeout(forcedReconnectTimerRef.current);
        forcedReconnectTimerRef.current = null;
    }, []);

    const joinMatchRoom = useCallback((matchId: string) => {
        const normalizedMatchId = String(matchId || '').trim();
        if (!normalizedMatchId) return;

        joinedRoomsRef.current.add(normalizedMatchId);

        const activeSocket = socketRef.current;
        if (activeSocket?.connected) {
            activeSocket.emit('join-match', normalizedMatchId);
        }
    }, []);

    const leaveMatchRoom = useCallback((matchId: string) => {
        const normalizedMatchId = String(matchId || '').trim();
        if (!normalizedMatchId) return;

        joinedRoomsRef.current.delete(normalizedMatchId);

        const activeSocket = socketRef.current;
        if (activeSocket?.connected) {
            activeSocket.emit('leave-match', normalizedMatchId);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as typeof window & {
                __SOCKET_DEBUG__?: Record<string, unknown>;
            }).__SOCKET_DEBUG__ = {
                url: socketUrl,
                path: socketPath,
                pollingUrl,
                websocketUrl,
                route: pathname,
                shouldConnect,
            };
        }

        if (shouldConnect) {
            console.info('[Socket] Resolved endpoint', {
                url: socketUrl,
                path: socketPath,
                pollingUrl,
                websocketUrl,
                route: pathname,
            });
        }

        if (!shouldConnect || !socketUrl || !socketPath) {
            if (shouldConnect) {
                console.error('[Socket] No valid socket endpoint available', {
                    url: socketUrl,
                    path: socketPath,
                    pollingUrl,
                    websocketUrl,
                    route: pathname,
                });
            }
            clearForcedReconnectTimer();
            socketRef.current?.disconnect();
            socketRef.current = null;
            setSocket(null);
            setIsConnected(false);
            setConnectionStatus('disconnected');
            setReconnectAttempts(0);
            setHasConnectedOnce(false);
            joinedRoomsRef.current.clear();
            return;
        }

        setConnectionStatus('connecting');
        setHasConnectedOnce(false);

        console.info('[Socket] Opening connection', {
            url: socketUrl,
            path: socketPath,
            pollingUrl,
            websocketUrl,
            route: pathname,
        });

        const socketInstance = io(socketUrl, {
            path: socketPath,
            transports: ['polling', 'websocket'], // Start with polling, then upgrade behind proxy/CDN
            autoConnect: false,
            auth: token ? { token } : {},
            upgrade: true,
            // ── Reconnection config ───────────────────────────────
            reconnection: true,
            reconnectionAttempts: Infinity, // Never give up
            reconnectionDelay: 1000,        // Start at 1s
            reconnectionDelayMax: 15000,    // Cap at 15s
            randomizationFactor: 0.3,       // 30% jitter
            timeout: 10000,                 // Connection timeout
        });
        socketRef.current = socketInstance;

        // ── Connected ────────────────────────────────────────────
        socketInstance.on('connect', () => {
            if (socketRef.current !== socketInstance) return;

            clearForcedReconnectTimer();
            const engineSid = socketInstance.io.engine?.id ?? null;
            const connectedPollingUrl = buildTransportDebugUrl(socketUrl, socketPath, 'polling', engineSid);
            const connectedWebsocketUrl = buildTransportDebugUrl(socketUrl, socketPath, 'websocket', engineSid);
            console.log('[Socket] Connected:', socketInstance.id, {
                transport: socketInstance.io.engine.transport.name,
                sid: engineSid,
                url: socketUrl,
                path: socketPath,
                pollingUrl: connectedPollingUrl,
                websocketUrl: connectedWebsocketUrl,
            });

            if (typeof window !== 'undefined') {
                (window as typeof window & {
                    __SOCKET_DEBUG__?: Record<string, unknown>;
                }).__SOCKET_DEBUG__ = {
                    url: socketUrl,
                    path: socketPath,
                    route: pathname,
                    shouldConnect,
                    transport: socketInstance.io.engine.transport.name,
                    sid: engineSid,
                    pollingUrl: connectedPollingUrl,
                    websocketUrl: connectedWebsocketUrl,
                };
            }

            setIsConnected(true);
            setConnectionStatus('connected');
            setReconnectAttempts(0);
            setHasConnectedOnce(true);

            // Re-join match rooms on reconnect
            joinedRoomsRef.current.forEach(matchId => {
                console.log('[Socket] Re-joining match room:', matchId);
                socketInstance.emit('join-match', matchId);
            });

            // Re-join user room
            const uid = userIdRef.current;
            if (uid) {
                socketInstance.emit('subscribeToUserRoom', { userId: uid });
            }
        });

        // ── Disconnected ─────────────────────────────────────────
        socketInstance.on('disconnect', (reason) => {
            if (socketRef.current !== socketInstance) return;

            clearForcedReconnectTimer();
            console.log('[Socket] Disconnected:', reason);
            setIsConnected(false);

            if (reason === 'io client disconnect') {
                setConnectionStatus('disconnected');
                setReconnectAttempts(0);
                return;
            }

            // If the server forced disconnect (e.g., backend restart),
            // socket.io halts auto-reconnect natively. We must override and manually connect.
            if (reason === 'io server disconnect') {
                console.log('[Socket] Server forced disconnect. Manual reconnect triggered...');
                setConnectionStatus('reconnecting');
                forcedReconnectTimerRef.current = setTimeout(() => {
                    if (socketRef.current === socketInstance && socketInstance.disconnected) {
                        socketInstance.connect();
                    }
                }, 2000);
            } else {
                // For 'ping timeout' or 'transport close', Socket.IO inherently auto-reconnects
                setConnectionStatus('reconnecting');
            }
        });

        // ── Reconnect attempt ────────────────────────────────────
        socketInstance.io.on('reconnect_attempt', (attempt) => {
            if (socketRef.current !== socketInstance) return;
            console.log(`[Socket] Reconnect attempt #${attempt}`);
            setConnectionStatus('reconnecting');
            setReconnectAttempts(attempt);
        });

        // ── Reconnected ──────────────────────────────────────────
        socketInstance.io.on('reconnect', (attempt) => {
            if (socketRef.current !== socketInstance) return;
            console.log(`[Socket] Reconnected after ${attempt} attempt(s)`);
            // 'connect' handler above takes care of re-joining rooms
        });

        // ── Reconnect failed ─────────────────────────────────────
        socketInstance.io.on('reconnect_failed', () => {
            if (socketRef.current !== socketInstance) return;
            console.error('[Socket] Reconnection failed after max attempts');
            setConnectionStatus('disconnected');
        });

        // ── Connect error ────────────────────────────────────────
        socketInstance.on('connect_error', (err) => {
            if (socketRef.current !== socketInstance) return;
            console.warn('[Socket] Connect error:', err.message, {
                url: socketUrl,
                path: socketPath,
                pollingUrl,
                websocketUrl,
                route: pathname,
            });
            setIsConnected(false);
            const loweredMessage = err.message.toLowerCase();
            const isAuthError =
                loweredMessage.includes('invalid token') ||
                loweredMessage.includes('unauthorized');

            setConnectionStatus(isAuthError ? 'disconnected' : 'reconnecting');
        });

        setSocket(socketInstance);

        socketInstance.on('connect', () => {
            const engine = socketInstance.io.engine;
            if (engine) {
                // Ensure no duplicate listeners on reconnect
                engine.removeAllListeners('upgrade');
                engine.on('upgrade', (transport: { name: string }) => {
                    if (socketRef.current !== socketInstance) return;
                    const engineSid = socketInstance.io.engine?.id ?? null;
                    const upgradedPollingUrl = buildTransportDebugUrl(socketUrl, socketPath, 'polling', engineSid);
                    const upgradedWebsocketUrl = buildTransportDebugUrl(socketUrl, socketPath, 'websocket', engineSid);
                    console.info('[Socket] Transport upgraded', {
                        transport: transport.name,
                        sid: engineSid,
                        url: socketUrl,
                        path: socketPath,
                        pollingUrl: upgradedPollingUrl,
                        websocketUrl: upgradedWebsocketUrl,
                        transportUrl: transport.name === 'websocket'
                            ? upgradedWebsocketUrl
                            : upgradedPollingUrl,
                    });

                    if (typeof window !== 'undefined') {
                        (window as typeof window & {
                            __SOCKET_DEBUG__?: Record<string, unknown>;
                        }).__SOCKET_DEBUG__ = {
                            url: socketUrl,
                            path: socketPath,
                            route: pathname,
                            shouldConnect,
                            transport: transport.name,
                            sid: engineSid,
                            pollingUrl: upgradedPollingUrl,
                            websocketUrl: upgradedWebsocketUrl,
                            transportUrl: transport.name === 'websocket'
                                ? upgradedWebsocketUrl
                                : upgradedPollingUrl,
                        };
                    }
                });
            }
        });

        socketInstance.connect();

        return () => {
            clearForcedReconnectTimer();
            socketInstance.disconnect();
            if (socketRef.current === socketInstance) {
                socketRef.current = null;
            }
        };
    }, [clearForcedReconnectTimer, pathname, pollingUrl, shouldConnect, socketPath, socketUrl, token, websocketUrl]);

    // ── User room subscription ────────────────────────────────────────────────
    useEffect(() => {
        const userId = Number(user?.id || user?.userId);
        userIdRef.current = userId || null;

        if (socket && isConnected && userId) {
            console.log('[Socket] Joining User Room:', userId);
            socket.emit('subscribeToUserRoom', { userId });
        }
    }, [socket, isConnected, user]);

    return (
        <SocketContext.Provider value={{ socket, isConnected, connectionStatus, reconnectAttempts, hasConnectedOnce, joinMatchRoom, leaveMatchRoom }}>
            {children}
        </SocketContext.Provider>
    );
};
