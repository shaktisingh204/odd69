"use client";

import React, { useState, Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LeftSidebar from "@/components/layout/LeftSidebar";

import { useAuth } from "@/context/AuthContext";
import { useModal } from "@/context/ModalContext";

export default function ProfileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [selectedSportId, setSelectedSportId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'live' | 'line'>('live');

    const { isAuthenticated, loading: authLoading } = useAuth();
    const { openLogin } = useModal();
    const router = useRouter();
    const pathname = usePathname();

    const isReferralPage = pathname === '/profile/referral';

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            openLogin();
            router.replace('/');
        }
    }, [authLoading, isAuthenticated, openLogin, router]);

    // Show spinner while auth state resolves to avoid flash of protected content
    if (authLoading) {
        return (
            <div className="min-h-screen bg-bg-base flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Block render until redirect fires
    if (!isAuthenticated) {
        return null;
    }



    return (
        <div className="h-screen overflow-hidden bg-bg-base font-[family-name:var(--font-poppins)] flex flex-col">
            <Header />
            <div className={`flex flex-1 overflow-hidden pt-[60px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full ${isReferralPage ? 'justify-center' : ''}`}>
                {/* Left Sidebar — hidden on mobile for referral page (collapsedOnly there blocks mobile taps) */}
                <Suspense fallback={<div className="hidden md:flex w-[70px] bg-bg-deep border-r border-white/[0.04] h-[calc(100vh-64px)] sticky top-[64px]" />}>
                    <div className={isReferralPage ? 'hidden md:block' : ''}>
                        <LeftSidebar
                            selectedSportId={selectedSportId}
                            onSelectSport={setSelectedSportId}
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                            collapsedOnly={isReferralPage}
                        />
                    </div>
                </Suspense>

                {/* Main Content Area */}
                <main className={`flex-1 min-w-0 border-white/[0.04] bg-bg-base overflow-y-auto overflow-x-hidden ${isReferralPage ? 'w-full xl:max-w-[75%] mx-auto' : ''}`}>
                    <div className="max-w-[900px] mx-auto px-4 md:px-8 py-6">
                        {children}
                    </div>
                    <Footer />
                </main>
            </div>
        </div>
    );
}
