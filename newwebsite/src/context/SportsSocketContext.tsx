"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { io, Socket } from "socket.io-client";

import { useAuth } from "./AuthContext";
import { getConfiguredSocketNamespace } from "@/utils/socketUrl";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";
type SocketTransportName = "polling" | "websocket";

interface SportsSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  reconnectAttempts: number;
  hasConnectedOnce: boolean;
  joinSportsLobby: () => void;
  leaveSportsLobby: () => void;
  joinMatchRoom: (matchId: string) => void;
  leaveMatchRoom: (matchId: string) => void;
}

const SportsSocketContext = createContext<SportsSocketContextType>({
  socket: null,
  isConnected: false,
  connectionStatus: "disconnected",
  reconnectAttempts: 0,
  hasConnectedOnce: false,
  joinSportsLobby: () => {},
  leaveSportsLobby: () => {},
  joinMatchRoom: () => {},
  leaveMatchRoom: () => {},
});

export const useSportsSocket = () => useContext(SportsSocketContext);

function buildTransportDebugUrl(
  baseUrl: string | null,
  path: string | null,
  transport: SocketTransportName,
  sid?: string | null,
) {
  if (!baseUrl || !path) return null;

  try {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const transportUrl = new URL(normalizedPath, baseUrl);

    if (transport === "websocket") {
      transportUrl.protocol = transportUrl.protocol === "https:" ? "wss:" : "ws:";
    }

    transportUrl.searchParams.set("EIO", "4");
    transportUrl.searchParams.set("transport", transport);

    if (sid) {
      transportUrl.searchParams.set("sid", sid);
    }

    return transportUrl.toString();
  } catch {
    return null;
  }
}

export function SportsSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);
  const { token } = useAuth();
  const pathname = usePathname();
  const endpoint = getConfiguredSocketNamespace("sports");
  const socketUrl = endpoint?.url ?? null;
  const socketPath = endpoint?.path ?? null;
  const pollingUrl = buildTransportDebugUrl(socketUrl, socketPath, "polling");
  const websocketUrl = buildTransportDebugUrl(socketUrl, socketPath, "websocket");

  const socketRef = useRef<Socket | null>(null);
  const joinedMatchRoomsRef = useRef<Set<string>>(new Set());
  const isLobbyJoinedRef = useRef(false);
  const forcedReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearForcedReconnectTimer = useCallback(() => {
    if (!forcedReconnectTimerRef.current) return;
    clearTimeout(forcedReconnectTimerRef.current);
    forcedReconnectTimerRef.current = null;
  }, []);

  const joinSportsLobby = useCallback(() => {
    isLobbyJoinedRef.current = true;
    const activeSocket = socketRef.current;
    if (activeSocket?.connected) {
      activeSocket.emit("join-sports-lobby");
    }
  }, []);

  const leaveSportsLobby = useCallback(() => {
    isLobbyJoinedRef.current = false;
    const activeSocket = socketRef.current;
    if (activeSocket?.connected) {
      activeSocket.emit("leave-sports-lobby");
    }
  }, []);

  const joinMatchRoom = useCallback((matchId: string) => {
    const normalizedMatchId = String(matchId || "").trim();
    if (!normalizedMatchId) return;

    joinedMatchRoomsRef.current.add(normalizedMatchId);
    const activeSocket = socketRef.current;
    if (activeSocket?.connected) {
      activeSocket.emit("join-match", normalizedMatchId);
    }
  }, []);

  const leaveMatchRoom = useCallback((matchId: string) => {
    const normalizedMatchId = String(matchId || "").trim();
    if (!normalizedMatchId) return;

    joinedMatchRoomsRef.current.delete(normalizedMatchId);
    const activeSocket = socketRef.current;
    if (activeSocket?.connected) {
      activeSocket.emit("leave-match", normalizedMatchId);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as typeof window & {
        __SPORTS_SOCKET_DEBUG__?: Record<string, unknown>;
      }).__SPORTS_SOCKET_DEBUG__ = {
        url: socketUrl,
        path: socketPath,
        pollingUrl,
        websocketUrl,
        route: pathname,
      };
    }

    if (!socketUrl || !socketPath) {
      console.error("[SportsSocket] No valid sports socket endpoint available", {
        url: socketUrl,
        path: socketPath,
        route: pathname,
      });
      clearForcedReconnectTimer();
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setConnectionStatus("disconnected");
      setReconnectAttempts(0);
      setHasConnectedOnce(false);
      joinedMatchRoomsRef.current.clear();
      isLobbyJoinedRef.current = false;
      return;
    }

    setConnectionStatus("connecting");
    setHasConnectedOnce(false);

    console.info("[SportsSocket] Resolved endpoint", {
      url: socketUrl,
      path: socketPath,
      pollingUrl,
      websocketUrl,
      route: pathname,
    });

    const socketInstance = io(socketUrl, {
      path: socketPath,
      transports: ["polling", "websocket"],
      autoConnect: false,
      auth: token ? { token } : {},
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      randomizationFactor: 0.3,
      timeout: 10000,
    });
    socketRef.current = socketInstance;

    socketInstance.on("connect", () => {
      if (socketRef.current !== socketInstance) return;

      clearForcedReconnectTimer();
      const engineSid = socketInstance.io.engine?.id ?? null;
      const connectedPollingUrl = buildTransportDebugUrl(socketUrl, socketPath, "polling", engineSid);
      const connectedWebsocketUrl = buildTransportDebugUrl(socketUrl, socketPath, "websocket", engineSid);

      console.info("[SportsSocket] Connected", {
        id: socketInstance.id,
        transport: socketInstance.io.engine.transport.name,
        sid: engineSid,
        url: socketUrl,
        path: socketPath,
        pollingUrl: connectedPollingUrl,
        websocketUrl: connectedWebsocketUrl,
      });

      if (typeof window !== "undefined") {
        (window as typeof window & {
          __SPORTS_SOCKET_DEBUG__?: Record<string, unknown>;
        }).__SPORTS_SOCKET_DEBUG__ = {
          url: socketUrl,
          path: socketPath,
          route: pathname,
          sid: engineSid,
          transport: socketInstance.io.engine.transport.name,
          pollingUrl: connectedPollingUrl,
          websocketUrl: connectedWebsocketUrl,
        };
      }

      setIsConnected(true);
      setConnectionStatus("connected");
      setReconnectAttempts(0);
      setHasConnectedOnce(true);

      if (isLobbyJoinedRef.current) {
        socketInstance.emit("join-sports-lobby");
      }

      joinedMatchRoomsRef.current.forEach((matchId) => {
        socketInstance.emit("join-match", matchId);
      });
    });

    socketInstance.on("disconnect", (reason) => {
      if (socketRef.current !== socketInstance) return;

      clearForcedReconnectTimer();
      console.info("[SportsSocket] Disconnected", { reason });
      setIsConnected(false);

      if (reason === "io client disconnect") {
        setConnectionStatus("disconnected");
        setReconnectAttempts(0);
        return;
      }

      if (reason === "io server disconnect") {
        setConnectionStatus("reconnecting");
        forcedReconnectTimerRef.current = setTimeout(() => {
          if (socketRef.current === socketInstance && socketInstance.disconnected) {
            socketInstance.connect();
          }
        }, 2000);
      } else {
        setConnectionStatus("reconnecting");
      }
    });

    socketInstance.io.on("reconnect_attempt", (attempt) => {
      if (socketRef.current !== socketInstance) return;
      setConnectionStatus("reconnecting");
      setReconnectAttempts(attempt);
    });

    socketInstance.io.on("reconnect_failed", () => {
      if (socketRef.current !== socketInstance) return;
      setConnectionStatus("disconnected");
    });

    socketInstance.on("connect_error", (err) => {
      if (socketRef.current !== socketInstance) return;
      console.warn("[SportsSocket] Connect error", {
        message: err.message,
        url: socketUrl,
        path: socketPath,
        pollingUrl,
        websocketUrl,
        route: pathname,
      });
      setIsConnected(false);
      setConnectionStatus("reconnecting");
    });

    socketInstance.on("connect", () => {
      const engine = socketInstance.io.engine;
      if (!engine) return;

      engine.removeAllListeners("upgrade");
      engine.on("upgrade", (transport: { name: string }) => {
        if (socketRef.current !== socketInstance) return;

        const engineSid = socketInstance.io.engine?.id ?? null;
        const upgradedPollingUrl = buildTransportDebugUrl(socketUrl, socketPath, "polling", engineSid);
        const upgradedWebsocketUrl = buildTransportDebugUrl(socketUrl, socketPath, "websocket", engineSid);
        const transportUrl = transport.name === "websocket"
          ? upgradedWebsocketUrl
          : upgradedPollingUrl;

        console.info("[SportsSocket] Transport upgraded", {
          transport: transport.name,
          sid: engineSid,
          url: socketUrl,
          path: socketPath,
          pollingUrl: upgradedPollingUrl,
          websocketUrl: upgradedWebsocketUrl,
          transportUrl,
        });

        if (typeof window !== "undefined") {
          (window as typeof window & {
            __SPORTS_SOCKET_DEBUG__?: Record<string, unknown>;
          }).__SPORTS_SOCKET_DEBUG__ = {
            url: socketUrl,
            path: socketPath,
            route: pathname,
            sid: engineSid,
            transport: transport.name,
            pollingUrl: upgradedPollingUrl,
            websocketUrl: upgradedWebsocketUrl,
            transportUrl,
          };
        }
      });
    });

    setSocket(socketInstance);

    console.info("[SportsSocket] Opening connection", {
      url: socketUrl,
      path: socketPath,
      pollingUrl,
      websocketUrl,
      route: pathname,
    });

    socketInstance.connect();

    return () => {
      clearForcedReconnectTimer();
      socketInstance.disconnect();
      if (socketRef.current === socketInstance) {
        socketRef.current = null;
      }
    };
  }, [clearForcedReconnectTimer, pathname, pollingUrl, socketPath, socketUrl, token, websocketUrl]);

  return (
    <SportsSocketContext.Provider
      value={{
        socket,
        isConnected,
        connectionStatus,
        reconnectAttempts,
        hasConnectedOnce,
        joinSportsLobby,
        leaveSportsLobby,
        joinMatchRoom,
        leaveMatchRoom,
      }}
    >
      {children}
    </SportsSocketContext.Provider>
  );
}
