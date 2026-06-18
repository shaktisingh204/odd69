"use client";

import React, { useState } from "react";
import { Mail, Phone, ArrowLeft, CheckCircle, AlertCircle, Loader2, ShieldCheck, Lock, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import CountryCodeSelector, { Country, COUNTRIES } from "@/components/shared/CountryCodeSelector";

type Mode = "email" | "phone";
type PhoneStep = "enter_phone" | "verify_otp" | "new_password" | "done";

export default function ForgotPasswordPage() {
    const router = useRouter();

    // --- shared ---
    const [mode, setMode] = useState<Mode>("phone");

    // --- email flow ---
    const [email, setEmail] = useState("");
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailSuccess, setEmailSuccess] = useState(false);
    const [emailError, setEmailError] = useState("");

    // --- phone flow ---
    const [selectedCountry, setSelectedCountry] = useState<Country>(
        COUNTRIES.find((c) => c.iso === "IN")!
    );
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [newPass, setNewPass] = useState("");
    const [confirmPass, setConfirmPass] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [phoneStep, setPhoneStep] = useState<PhoneStep>("enter_phone");
    const [phoneLoading, setPhoneLoading] = useState(false);
    const [phoneError, setPhoneError] = useState("");

    const fullPhone = `${selectedCountry.code.replace(/-/g, "")}${phone}`.replace(/^\+/, "");

    // ── Email flow ─────────────────────────────────────────────────────────────
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailError("");
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setEmailError("Please enter a valid email address.");
            return;
        }
        setEmailLoading(true);
        try {
            await api.post("/auth/forgot-password", { email: email.trim() });
        } catch { /* anti-enumeration — always show success */ }
        finally {
            setEmailSuccess(true);
            setEmailLoading(false);
        }
    };

    // ── Phone flow: Step 1 — Send OTP ─────────────────────────────────────────
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setPhoneError("");
        if (!phone.trim() || !/^\d{7,15}$/.test(phone.trim())) {
            setPhoneError("Enter a valid phone number (7–15 digits).");
            return;
        }
        setPhoneLoading(true);
        try {
            await api.post("/auth/forgot-password-phone", { phoneNumber: `+${fullPhone}` });
            setPhoneStep("verify_otp");
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setPhoneError(typeof msg === "string" ? msg : "Failed to send OTP. Please try again.");
        } finally {
            setPhoneLoading(false);
        }
    };

    // ── Phone flow: Step 2 — Verify OTP ───────────────────────────────────────
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setPhoneError("");
        if (otp.length !== 6) { setPhoneError("Enter the 6-digit OTP."); return; }
        setPhoneLoading(true);
        try {
            await api.post("/auth/verify-otp", {
                phoneNumber: `+${fullPhone}`,
                code: otp,
                purpose: "FORGOT_PASSWORD",
            });
            setPhoneStep("new_password");
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setPhoneError(typeof msg === "string" ? msg : "Incorrect OTP. Please try again.");
        } finally {
            setPhoneLoading(false);
        }
    };

    // ── Phone flow: Step 3 — Reset Password ───────────────────────────────────
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPhoneError("");
        if (newPass.length < 6) { setPhoneError("Password must be at least 6 characters."); return; }
        if (newPass !== confirmPass) { setPhoneError("Passwords do not match."); return; }
        setPhoneLoading(true);
        try {
            await api.post("/auth/reset-password-phone", {
                phoneNumber: `+${fullPhone}`,
                code: otp,
                newPassword: newPass,
            });
            setPhoneStep("done");
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setPhoneError(typeof msg === "string" ? msg : "Failed to reset password. Please try again.");
        } finally {
            setPhoneLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-base p-4">
            <div className="w-full max-w-[440px]">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-text-muted hover:text-brand-gold text-sm font-medium mb-8 transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Home
                </Link>

                <div className="bg-auth-base border border-divider rounded-2xl p-8 shadow-xl">
                    {/* Logo */}
                    <div className="text-center mb-6">
                        <span className="text-3xl font-extrabold italic">
                            <span className="text-brand-gold">Ze</span>ero
                        </span>
                    </div>

                    <h1 className="font-poppins text-text-primary text-2xl font-extrabold mb-1 text-center">
                        Forgot Password?
                    </h1>
                    <p className="text-text-secondary text-sm mb-6 text-center">
                        Reset via email link or phone OTP
                    </p>

                    {/* Tab Toggle */}
                    <div className="flex bg-bg-elevated border border-divider rounded-xl p-1 mb-6">
                        {(["phone", "email"] as Mode[]).map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => { setMode(m); setPhoneError(""); setEmailError(""); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${mode === m
                                    ? "bg-indigo-600 text-white shadow-sm"
                                    : "text-text-muted hover:text-text-primary"
                                    }`}
                            >
                                {m === "phone" ? <Phone size={15} /> : <Mail size={15} />}
                                {m === "phone" ? "Phone OTP" : "Email Link"}
                            </button>
                        ))}
                    </div>

                    {/* ── EMAIL FLOW ──────────────────────────────────────────── */}
                    {mode === "email" && !emailSuccess && (
                        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">Email Address</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                    <input
                                        type="email"
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                                        className={`w-full h-[52px] bg-bg-elevated border rounded-xl pl-11 pr-4 text-text-primary text-[15px] font-medium outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted ${emailError ? "border-red-500 focus:ring-red-500/30" : "border-divider focus:border-brand-gold focus:ring-brand-gold/40"}`}
                                    />
                                </div>
                                {emailError && <p className="text-danger text-xs mt-1.5 ml-1 flex items-center gap-1"><AlertCircle size={11} />{emailError}</p>}
                            </div>
                            <button type="submit" disabled={emailLoading} className="w-full bg-auth-action text-text-inverse h-[52px] rounded-xl font-extrabold text-base uppercase tracking-wide transition-all hover:bg-brand-gold-hover hover:-translate-y-0.5 shadow-lg shadow-glow-gold active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-2">
                                {emailLoading ? <><Loader2 size={18} className="animate-spin" />Sending...</> : "Send Reset Link"}
                            </button>
                        </form>
                    )}
                    {mode === "email" && emailSuccess && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle size={32} className="text-green-400" />
                            </div>
                            <h2 className="text-text-primary text-xl font-bold mb-2">Check Your Email</h2>
                            <p className="text-text-secondary text-sm mb-6">
                                If an account exists for <strong className="text-text-primary">{email}</strong>, a reset link has been sent.
                            </p>
                            <button onClick={() => { setEmailSuccess(false); setEmail(""); }} className="text-brand-gold font-semibold text-sm hover:underline">
                                Try different email
                            </button>
                        </div>
                    )}

                    {/* ── PHONE FLOW ──────────────────────────────────────────── */}
                    {mode === "phone" && (
                        <>
                            {/* Step indicator */}
                            {phoneStep !== "done" && (
                                <div className="flex items-center gap-2 mb-5">
                                    {["enter_phone", "verify_otp", "new_password"].map((s, i) => (
                                        <React.Fragment key={s}>
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${phoneStep === s ? "border-indigo-500 bg-indigo-600 text-white" : ["verify_otp", "new_password", "done"].indexOf(phoneStep) > i ? "border-green-500 bg-green-500/20 text-green-400" : "border-divider text-text-muted"}`}>
                                                {["verify_otp", "new_password", "done"].indexOf(phoneStep) > i ? "✓" : i + 1}
                                            </div>
                                            {i < 2 && <div className={`flex-1 h-0.5 ${["verify_otp", "new_password", "done"].indexOf(phoneStep) > i ? "bg-green-500" : "bg-divider"}`} />}
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}

                            {/* Step 1: Enter Phone */}
                            {phoneStep === "enter_phone" && (
                                <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-1.5">Phone Number</label>
                                        <div className="flex gap-2">
                                            <CountryCodeSelector value={selectedCountry} onChange={setSelectedCountry} />
                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                placeholder="Phone number"
                                                value={phone}
                                                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setPhoneError(""); }}
                                                className={`flex-1 h-[52px] bg-bg-elevated border rounded-xl px-4 text-text-primary text-[15px] font-medium outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted ${phoneError ? "border-red-500 focus:ring-red-500/30" : "border-divider focus:border-brand-gold focus:ring-brand-gold/40"}`}
                                            />
                                        </div>
                                        {phoneError && <p className="text-danger text-xs mt-1.5 ml-1 flex items-center gap-1"><AlertCircle size={11} />{phoneError}</p>}
                                    </div>
                                    <button type="submit" disabled={phoneLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-[52px] rounded-xl font-extrabold text-base uppercase tracking-wide transition-all hover:-translate-y-0.5 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                                        {phoneLoading ? <><Loader2 size={18} className="animate-spin" />Sending OTP...</> : "Send OTP"}
                                    </button>
                                </form>
                            )}

                            {/* Step 2: Verify OTP */}
                            {phoneStep === "verify_otp" && (
                                <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                                    <p className="text-text-secondary text-sm">
                                        Enter the 6-digit OTP sent to <strong className="text-text-primary">+{fullPhone}</strong>
                                    </p>
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-1.5">OTP Code</label>
                                        <div className="relative">
                                            <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={6}
                                                placeholder="6-digit code"
                                                value={otp}
                                                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setPhoneError(""); }}
                                                className={`w-full h-[52px] bg-bg-elevated border rounded-xl pl-11 pr-4 text-text-primary text-[20px] font-bold tracking-[0.4em] outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted placeholder:text-base placeholder:tracking-normal ${phoneError ? "border-red-500 focus:ring-red-500/30" : "border-divider focus:border-indigo-500 focus:ring-indigo-500/40"}`}
                                            />
                                        </div>
                                        {phoneError && <p className="text-danger text-xs mt-1.5 ml-1 flex items-center gap-1"><AlertCircle size={11} />{phoneError}</p>}
                                    </div>
                                    <button type="submit" disabled={phoneLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-[52px] rounded-xl font-extrabold text-base uppercase tracking-wide transition-all hover:-translate-y-0.5 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                                        {phoneLoading ? <><Loader2 size={18} className="animate-spin" />Verifying...</> : "Verify OTP"}
                                    </button>
                                    <button type="button" onClick={() => setPhoneStep("enter_phone")} className="text-text-muted text-sm hover:text-brand-gold transition-colors text-center">
                                        ← Back / Resend OTP
                                    </button>
                                </form>
                            )}

                            {/* Step 3: New Password */}
                            {phoneStep === "new_password" && (
                                <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-1.5">New Password</label>
                                        <div className="relative">
                                            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                            <input
                                                type={showPass ? "text" : "password"}
                                                placeholder="Min. 6 characters"
                                                value={newPass}
                                                onChange={(e) => { setNewPass(e.target.value); setPhoneError(""); }}
                                                className={`w-full h-[52px] bg-bg-elevated border rounded-xl pl-11 pr-12 text-text-primary text-[15px] font-medium outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted ${phoneError ? "border-red-500 focus:ring-red-500/30" : "border-divider focus:border-indigo-500 focus:ring-indigo-500/40"}`}
                                            />
                                            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute inset-y-0 right-4 flex items-center text-text-muted hover:text-text-primary">
                                                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-1.5">Confirm Password</label>
                                        <div className="relative">
                                            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                            <input
                                                type={showPass ? "text" : "password"}
                                                placeholder="Repeat new password"
                                                value={confirmPass}
                                                onChange={(e) => { setConfirmPass(e.target.value); setPhoneError(""); }}
                                                className={`w-full h-[52px] bg-bg-elevated border rounded-xl pl-11 pr-4 text-text-primary text-[15px] font-medium outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted ${phoneError ? "border-red-500 focus:ring-red-500/30" : "border-divider focus:border-indigo-500 focus:ring-indigo-500/40"}`}
                                            />
                                        </div>
                                        {phoneError && <p className="text-danger text-xs mt-1.5 ml-1 flex items-center gap-1"><AlertCircle size={11} />{phoneError}</p>}
                                    </div>
                                    <button type="submit" disabled={phoneLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-[52px] rounded-xl font-extrabold text-base uppercase tracking-wide transition-all hover:-translate-y-0.5 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                                        {phoneLoading ? <><Loader2 size={18} className="animate-spin" />Resetting...</> : "Reset Password"}
                                    </button>
                                </form>
                            )}

                            {/* Done */}
                            {phoneStep === "done" && (
                                <div className="text-center py-4">
                                    <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle size={32} className="text-green-400" />
                                    </div>
                                    <h2 className="text-text-primary text-xl font-bold mb-2">Password Reset!</h2>
                                    <p className="text-text-secondary text-sm mb-6">Your password has been updated. You can now log in.</p>
                                    <button onClick={() => router.push("/")} className="w-full bg-auth-action text-text-inverse h-[50px] rounded-xl font-extrabold uppercase tracking-wide transition-all hover:bg-brand-gold-hover shadow-lg shadow-glow-gold">
                                        Back to Home
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    <p className="text-center text-sm text-text-secondary mt-6">
                        Remember your password?{" "}
                        <Link href="/" className="text-brand-gold font-bold hover:underline">Log In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
