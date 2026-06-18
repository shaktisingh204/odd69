"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import MaintenanceState from "./MaintenanceState";
import { useModal } from "@/context/ModalContext";

export default function PlatformMaintenanceGuard({
    children,
    isBlocked,
    message,
    allowedUsers
}: {
    children: ReactNode;
    isBlocked: boolean;
    message: string;
    allowedUsers: string[];
}) {
    const { user, loading, isAuthenticated } = useAuth();
    const { openLogin } = useModal();
    const [renderBlocked, setRenderBlocked] = useState(isBlocked);

    useEffect(() => {
        if (!isBlocked) {
            setRenderBlocked(false);
            return;
        }

        if (loading) return; // Wait until loaded

        if (isAuthenticated && user) {
            const hasAccess = allowedUsers.some((u: string) => {
                const search = u.toLowerCase().trim();
                return search === user.username?.toLowerCase() || search === user.email?.toLowerCase();
            });

            if (hasAccess) {
                setRenderBlocked(false);
                return;
            }
        }

        setRenderBlocked(true);

    }, [isBlocked, isAuthenticated, loading, user, allowedUsers]);

    if (!renderBlocked) return <>{children}</>;

    if (loading && isBlocked) {
        return <div className="min-h-[100dvh] bg-bg-deep" />;
    }

    return (
        <div className="relative z-[999999]" style={{ minHeight: '100dvh', background: '#09090b' }}>
            <MaintenanceState
                title="Platform Maintenance In Progress"
                message={message}
                backHref="/"
                backLabel="Refresh Later"
                fullScreen
            />
            {/* Hidden admin login trigger */}
            <button
                onClick={openLogin}
                className="fixed bottom-0 right-0 w-24 h-24 opacity-0 cursor-pointer"
                aria-label="Admin Login Access"
            />
        </div>
    );
}
