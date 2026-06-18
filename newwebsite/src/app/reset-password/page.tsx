"use client";

import React, { useState, Suspense } from "react";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/services/api";

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token") || "";

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    if (!token) {
        return (
            <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-danger-alpha-10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={32} className="text-danger" />
                </div>
                <h2 className="text-text-primary text-xl font-bold mb-2">Invalid Link</h2>
                <p className="text-text-secondary text-sm mb-6">
                    This password reset link is invalid or missing. Please request a new one.
                </p>
                <Link href="/forgot-password" className="text-brand-gold font-semibold hover:underline">
                    Request New Link
                </Link>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            await api.post("/auth/reset-password", { token, newPassword });
            setSuccess(true);
            setTimeout(() => router.push("/"), 3000);
        } catch (err: any) {
            const msg = err.response?.data?.message || "This link may be expired or already used. Please request a new one.";
            setError(Array.isArray(msg) ? msg.join(", ") : msg);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-400" />
                </div>
                <h2 className="text-text-primary text-xl font-bold mb-2">Password Reset!</h2>
                <p className="text-text-secondary text-sm mb-2">
                    Your password has been changed successfully.
                </p>
                <p className="text-text-muted text-xs">Redirecting to login in 3 seconds...</p>
            </div>
        );
    }

    return (
        <>
            <div className="mb-6">
                <h1 className="font-poppins text-text-primary text-2xl font-extrabold mb-1">
                    Set New Password
                </h1>
                <p className="text-text-secondary text-sm">
                    Choose a strong password for your account.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* New Password */}
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                        New Password
                    </label>
                    <div className="relative">
                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Minimum 6 characters"
                            value={newPassword}
                            onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                            className="w-full h-[52px] bg-bg-elevated border border-divider rounded-xl pl-11 pr-12 text-text-primary text-[15px] font-medium outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted focus:border-brand-gold focus:ring-brand-gold/40"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-muted hover:text-text-primary transition-colors"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                {/* Confirm Password */}
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                        Confirm Password
                    </label>
                    <div className="relative">
                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                        <input
                            type={showConfirm ? "text" : "password"}
                            placeholder="Repeat your password"
                            value={confirmPassword}
                            onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                            className="w-full h-[52px] bg-bg-elevated border border-divider rounded-xl pl-11 pr-12 text-text-primary text-[15px] font-medium outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted focus:border-brand-gold focus:ring-brand-gold/40"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-muted hover:text-text-primary transition-colors"
                        >
                            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-start gap-2.5 bg-danger-alpha-10 border border-red-500/30 rounded-xl px-4 py-3">
                        <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" />
                        <p className="text-danger text-[13px] font-medium leading-snug">{error}</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-auth-action text-text-inverse h-[52px] rounded-xl font-extrabold text-base uppercase tracking-wide transition-all hover:bg-brand-gold-hover hover:-translate-y-0.5 shadow-lg shadow-glow-gold active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Resetting...
                        </>
                    ) : "Reset Password"}
                </button>

                <p className="text-center text-sm text-text-secondary">
                    <Link href="/forgot-password" className="text-brand-gold font-bold hover:underline">
                        Request a new link
                    </Link>
                </p>
            </form>
        </>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-base p-4">
            <div className="w-full max-w-[440px]">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-text-muted hover:text-brand-gold text-sm font-medium mb-8 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to Home
                </Link>

                <div className="bg-auth-base border border-divider rounded-2xl p-8 shadow-xl">
                    <div className="text-center mb-8">
                        <span className="text-3xl font-extrabold italic">
                            <span className="text-brand-gold">Ze</span>ero
                        </span>
                    </div>

                    <Suspense fallback={<div className="text-center text-text-muted">Loading...</div>}>
                        <ResetPasswordForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
