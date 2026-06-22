"use client";

import React, { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useModal } from '@/context/ModalContext';
import { useAuth } from '@/context/AuthContext';
import { Gift, Loader2 } from 'lucide-react';

// Force dynamic so searchParams work correctly
export const dynamic = 'force-dynamic';

function SignupContent() {
    const searchParams = useSearchParams();
    const refCode = searchParams.get('ref');
    const { openRegister } = useModal();
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Store referral code so the register flow can pick it up
        if (refCode) {
            localStorage.setItem('referralCode', refCode);
        }
    }, [refCode]);

    useEffect(() => {
        if (loading) return;

        if (isAuthenticated) {
            // Already logged in — go to referral dashboard
            router.replace('/profile/referral');
            return;
        }

        // Not logged in — open the register modal automatically
        openRegister();
        // After a short delay, redirect to home so the modal has a page behind it
        const t = setTimeout(() => router.replace('/'), 300);
        return () => clearTimeout(t);
    }, [loading, isAuthenticated, openRegister, router]);

    // Splash while we figure out auth state
    return (
        <div className="min-h-screen bg-bg-deep flex flex-col items-center justify-center gap-6 text-center px-6">
            {/* Decorative glow */}
            <div className="absolute w-96 h-96 bg-brand-gold/8 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-brand-gold/10 border border-[#ff7a1a]/20 flex items-center justify-center">
                    <Gift size={36} className="text-[#ff7a1a]" />
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/10 border border-[#ff7a1a]/20 text-[#ff7a1a] text-xs font-bold uppercase tracking-wider">
                    🎁 Referral Invite
                </div>

                <h1 className="text-2xl font-bold text-white">You've been invited!</h1>
                <p className="text-text-muted text-sm max-w-xs leading-relaxed">
                    {refCode
                        ? <>Your referral code <span className="text-[#ff7a1a] font-mono font-bold">{refCode}</span> has been saved. Opening sign up for you...</>
                        : 'Opening sign up for you...'}
                </p>

                <Loader2 className="w-6 h-6 text-[#ff7a1a] animate-spin mt-2" />
            </div>
        </div>
    );
}

export default function AuthSignupPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-bg-deep flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[#ff7a1a] animate-spin" />
                </div>
            }
        >
            <SignupContent />
        </Suspense>
    );
}
