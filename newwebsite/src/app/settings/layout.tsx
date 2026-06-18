"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LeftSidebar from "@/components/layout/LeftSidebar";
import { useAuth } from "@/context/AuthContext";
import { useModal } from "@/context/ModalContext";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const { openLogin } = useModal();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            openLogin();
            router.replace("/");
        }
    }, [authLoading, isAuthenticated, openLogin, router]);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-bg-base flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!isAuthenticated) return null;

    return (
        <div className="h-screen overflow-hidden bg-bg-base font-[family-name:var(--font-poppins)] flex flex-col">
            <Header />
            <div className="flex flex-1 overflow-hidden pt-[60px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
                <LeftSidebar collapsedOnly />
                <main className="flex-1 min-w-0 bg-bg-base overflow-y-auto overflow-x-hidden">
                    <div className="max-w-[860px] mx-auto px-4 md:px-8 py-6">
                        {children}
                    </div>
                    <Footer />
                </main>
            </div>
        </div>
    );
}
