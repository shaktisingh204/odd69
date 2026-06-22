"use client";

import React, { useState, useEffect } from "react";
import { X, ArrowRight, Sparkles, Wallet, Shield, Zap } from "lucide-react";
import { useModal } from "@/context/ModalContext";

const SignupDepositPrompt: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { openDeposit } = useModal();

    useEffect(() => {
        const handler = () => setIsOpen(true);
        window.addEventListener("show-signup-deposit-prompt", handler);
        return () => window.removeEventListener("show-signup-deposit-prompt", handler);
    }, []);

    if (!isOpen) return null;

    const handleDeposit = () => {
        setIsOpen(false);
        openDeposit();
    };

    const handleClose = () => setIsOpen(false);

    return (
        <>
            {/* Desktop: Centered 3D modal */}
            <div className="hidden md:flex fixed inset-0 z-[60] items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                <div
                    className="relative w-full max-w-[440px] rounded-3xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500"
                    style={{ perspective: "1200px" }}
                >
                    {/* 3D tilted card wrapper */}
                    <div
                        className="relative bg-gradient-to-br from-[#0F1016] via-[#141620] to-[#1C1E28] border border-white/[0.06] rounded-3xl shadow-xl"
                        style={{
                            transform: "rotateX(2deg) rotateY(-1deg)",
                            transformStyle: "preserve-3d",
                            boxShadow:
                                "0 25px 60px rgba(0,0,0,0.5), 0 0 80px rgba(255, 122, 26,0.03), inset 0 1px 0 rgba(255,255,255,0.1)",
                        }}
                    >
                        {/* Glow effects */}
                        <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#ff7a1a]/20 rounded-full blur-[80px] pointer-events-none" />
                        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-500/15 rounded-full blur-[60px] pointer-events-none" />

                        {/* Close button */}
                        <button
                            onClick={handleClose}
                            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.16] transition-colors text-white/60 hover:text-white"
                        >
                            <X size={16} />
                        </button>

                        <div className="relative z-[1] px-8 pt-10 pb-8 flex flex-col items-center text-center">
                            {/* 3D floating wallet icon */}
                            <div
                                className="relative mb-6"
                                style={{ transform: "translateZ(40px)", transformStyle: "preserve-3d" }}
                            >
                                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#ff7a1a] to-[#e85f00] flex items-center justify-center shadow-lg shadow-[#ff7a1a]/30 rotate-6">
                                    <Wallet size={44} className="text-white drop-shadow-lg -rotate-6" />
                                </div>
                                {/* Floating sparkle */}
                                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-yellow-400/90 flex items-center justify-center shadow-lg shadow-yellow-400/30 animate-bounce">
                                    <Sparkles size={16} className="text-yellow-900" />
                                </div>
                            </div>

                            {/* Congratulations text */}
                            <h2 className="text-2xl font-black text-white mb-1 tracking-tight">
                                Welcome to <span className="text-brand-gold">ODD</span>69!
                            </h2>
                            <p className="text-white/50 text-sm mb-6 max-w-[280px]">
                                Your account is ready. Make your first deposit and start winning today!
                            </p>

                            {/* Feature pills */}
                            <div className="flex gap-3 mb-8">
                                <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1.5">
                                    <Zap size={12} className="text-yellow-400" />
                                    <span className="text-[11px] text-white/70 font-medium">Instant</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1.5">
                                    <Shield size={12} className="text-green-400" />
                                    <span className="text-[11px] text-white/70 font-medium">Secure</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1.5">
                                    <Sparkles size={12} className="text-purple-400" />
                                    <span className="text-[11px] text-white/70 font-medium">Bonus</span>
                                </div>
                            </div>

                            {/* CTA Button */}
                            <button
                                onClick={handleDeposit}
                                className="group w-full h-[54px] rounded-xl bg-gradient-to-r from-[#ff7a1a] to-[#ff7a1a] hover:from-[#ff7a1a] hover:to-[#ff7a1a] text-white font-extrabold text-base uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-[#ff7a1a]/25 hover:shadow-[#ff7a1a]/40 hover:-translate-y-0.5 active:translate-y-0"
                            >
                                Make a Deposit
                                <ArrowRight
                                    size={18}
                                    className="group-hover:translate-x-1 transition-transform"
                                />
                            </button>

                            {/* Skip link */}
                            <button
                                onClick={handleClose}
                                className="mt-4 text-white/30 hover:text-white/60 text-xs font-medium transition-colors"
                            >
                                Maybe later
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile: Bottom sheet */}
            <div className="md:hidden fixed inset-0 z-[60] flex items-end bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                <div
                    className="w-full rounded-t-3xl overflow-hidden animate-in slide-in-from-bottom duration-500"
                    style={{ perspective: "1000px" }}
                >
                    <div
                        className="relative bg-gradient-to-br from-[#0F1016] via-[#141620] to-[#1C1E28] border-t border-x border-white/[0.06] rounded-t-3xl"
                        style={{
                            boxShadow:
                                "0 -15px 50px rgba(0,0,0,0.4), 0 0 60px rgba(255, 122, 26,0.02), inset 0 1px 0 rgba(255,255,255,0.1)",
                        }}
                    >
                        {/* Glow effects */}
                        <div className="absolute -top-16 right-8 w-40 h-40 bg-[#ff7a1a]/20 rounded-full blur-[60px] pointer-events-none" />
                        <div className="absolute -bottom-12 left-4 w-32 h-32 bg-indigo-500/10 rounded-full blur-[50px] pointer-events-none" />

                        {/* Drag handle */}
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-10 h-1 bg-white/[0.16] rounded-full" />
                        </div>

                        <div className="relative z-[1] px-6 pt-2 pb-8 flex flex-col items-center text-center">
                            {/* 3D floating wallet icon */}
                            <div
                                className="relative mb-5"
                                style={{ transform: "translateZ(30px)", transformStyle: "preserve-3d" }}
                            >
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#ff7a1a] to-[#e85f00] flex items-center justify-center shadow-lg shadow-[#ff7a1a]/30 rotate-6">
                                    <Wallet size={36} className="text-white drop-shadow-lg -rotate-6" />
                                </div>
                                <div className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-yellow-400/90 flex items-center justify-center shadow-lg shadow-yellow-400/30 animate-bounce">
                                    <Sparkles size={14} className="text-yellow-900" />
                                </div>
                            </div>

                            <h2 className="text-xl font-black text-white mb-1 tracking-tight">
                                Welcome to <span className="text-brand-gold">ODD</span>69!
                            </h2>
                            <p className="text-white/50 text-sm mb-5 max-w-[260px]">
                                Your account is ready. Deposit now and start winning!
                            </p>

                            {/* Feature pills */}
                            <div className="flex gap-2.5 mb-6">
                                <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1.5">
                                    <Zap size={11} className="text-yellow-400" />
                                    <span className="text-[10px] text-white/70 font-medium">Instant</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1.5">
                                    <Shield size={11} className="text-green-400" />
                                    <span className="text-[10px] text-white/70 font-medium">Secure</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1.5">
                                    <Sparkles size={11} className="text-purple-400" />
                                    <span className="text-[10px] text-white/70 font-medium">Bonus</span>
                                </div>
                            </div>

                            {/* CTA Button */}
                            <button
                                onClick={handleDeposit}
                                className="group w-full h-[52px] rounded-xl bg-gradient-to-r from-[#ff7a1a] to-[#ff7a1a] hover:from-[#ff7a1a] hover:to-[#ff7a1a] text-white font-extrabold text-[15px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-[#ff7a1a]/25"
                            >
                                Make a Deposit
                                <ArrowRight
                                    size={17}
                                    className="group-hover:translate-x-1 transition-transform"
                                />
                            </button>

                            {/* Skip link */}
                            <button
                                onClick={handleClose}
                                className="mt-3.5 text-white/30 hover:text-white/60 text-xs font-medium transition-colors pb-2"
                            >
                                Maybe later
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SignupDepositPrompt;
