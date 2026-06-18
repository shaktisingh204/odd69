"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

interface OriginalsAccessState {
  allowed: boolean;
  accessMode: "ALL" | "ALLOW_LIST";
}

export function useOriginalsAccess() {
  const { token, loading: authLoading } = useAuth();
  const [accessState, setAccessState] = useState<OriginalsAccessState>({
    allowed: false,
    accessMode: "ALLOW_LIST",
  });
  const [resolvedToken, setResolvedToken] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const handleRefresh = () => setRefreshTick((current) => current + 1);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleRefresh();
      }
    };

    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (authLoading || !token) {
      return;
    }

    api.get("/originals/access/me")
      .then((response) => {
        if (cancelled) {
          return;
        }

        const data = response.data || {};
        setAccessState({
          allowed: !!data.allowed,
          accessMode: data.accessMode === "ALL" ? "ALL" : "ALLOW_LIST",
        });
        setResolvedToken(token);
      })
      .catch(() => {
        if (!cancelled) {
          setAccessState({ allowed: false, accessMode: "ALLOW_LIST" });
          setResolvedToken(token);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, token, refreshTick]);

  const accessLoading = !!token && resolvedToken !== token;

  return {
    canAccessOriginals: !!token && resolvedToken === token && accessState.allowed,
    accessMode: accessState.accessMode,
    loading: authLoading || (!!token && accessLoading),
  };
}
