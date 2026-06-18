"use client";

import React, { useState } from "react";
import { Phone, Lock, Eye, EyeOff, ShieldCheck, CheckCircle, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Step = "enter_phone" | "verify_otp" | "new_password" | "done";

// Common country dial codes
const DIAL_CODES = [
    { code: "+91", label: "🇮🇳 +91" },
    { code: "+1", label: "🇺🇸 +1" },
    { code: "+44", label: "🇬🇧 +44" },
    { code: "+971", label: "🇦🇪 +971" },
    { code: "+92", label: "🇵🇰 +92" },
    { code: "+880", label: "🇧🇩 +880" },
    { code: "+977", label: "🇳🇵 +977" },
    { code: "+65", label: "🇸🇬 +65" },
    { code: "+60", label: "🇲🇾 +60" },
];

async function apiPost(path: string, body: object) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Request failed");
    return data;
}

export default function AdminForgotPasswordPage() {
    const router = useRouter();

    const [dialCode, setDialCode] = useState("+91");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [newPass, setNewPass] = useState("");
    const [confirmPass, setConfirmPass] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [step, setStep] = useState<Step>("enter_phone");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const phoneE164 = `${dialCode}${phone}`;

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!phone.trim() || !/^\d{7,15}$/.test(phone.trim())) {
            setError("Enter a valid phone number (7–15 digits).");
            return;
        }
        setLoading(true);
        try {
            await apiPost("/auth/forgot-password-phone", { phoneNumber: phoneE164 });
            setStep("verify_otp");
        } catch (err: any) {
            setError(err.message || "Failed to send OTP.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (otp.length !== 6) { setError("Enter the 6-digit OTP."); return; }
        setLoading(true);
        try {
            await apiPost("/auth/verify-otp", {
                phoneNumber: phoneE164,
                code: otp,
                purpose: "FORGOT_PASSWORD",
            });
            setStep("new_password");
        } catch (err: any) {
            setError(err.message || "Incorrect OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (newPass.length < 6) { setError("Password must be at least 6 characters."); return; }
        if (newPass !== confirmPass) { setError("Passwords do not match."); return; }
        setLoading(true);
        try {
            await apiPost("/auth/reset-password-phone", {
                phoneNumber: phoneE164,
                code: otp,
                newPassword: newPass,
            });
            setStep("done");
        } catch (err: any) {
            setError(err.message || "Failed to reset password.");
        } finally {
            setLoading(false);
        }
    };

    const STEPS: Step[] = ["enter_phone", "verify_otp", "new_password"];
    const stepIndex = STEPS.indexOf(step);

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-indigo-600 p-8 text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <ShieldCheck className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Reset Admin Password</h1>
                    <p className="text-indigo-100 mt-2 text-sm">Verify your phone number to reset</p>
                </div>

                <div className="p-8">
                    {/* Step indicator */}
                    {step !== "done" && (
                        <div className="flex items-center gap-2 mb-6">
                            {STEPS.map((s, i) => (
                                <React.Fragment key={s}>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${step === s ? "border-indigo-600 bg-indigo-600 text-white" : stepIndex > i ? "border-green-500 bg-green-50 text-green-600" : "border-gray-200 text-gray-400"}`}>
                                        {stepIndex > i ? "✓" : i + 1}
                                    </div>
                                    {i < 2 && <div className={`flex-1 h-0.5 ${stepIndex > i ? "bg-green-400" : "bg-gray-200"}`} />}
                                </React.Fragment>
                            ))}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 flex items-center gap-2 mb-4">
                            <AlertCircle size={15} /> {error}
                        </div>
                    )}

                    {/* Step 1: Enter Phone */}
                    {step === "enter_phone" && (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">Phone Number</label>
                                <div className="flex gap-2">
                                    <select
                                        value={dialCode}
                                        onChange={(e) => setDialCode(e.target.value)}
                                        className="pl-3 pr-2 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-medium bg-gray-50"
                                    >
                                        {DIAL_CODES.map((d) => (
                                            <option key={d.code} value={d.code}>{d.label}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        placeholder="Phone number"
                                        value={phone}
                                        onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setError(""); }}
                                        className="flex-1 pl-4 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed">
                                {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Sending OTP...</> : <><Phone size={17} />Send OTP</>}
                            </button>
                        </form>
                    )}

                    {/* Step 2: Verify OTP */}
                    {step === "verify_otp" && (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Enter the 6-digit OTP sent to <strong className="text-gray-900">{phoneE164}</strong>
                            </p>
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">OTP Code</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="Enter 6-digit code"
                                    value={otp}
                                    onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                                    className="w-full pl-4 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-xl font-bold tracking-[0.4em] text-center"
                                />
                            </div>
                            <button type="submit" disabled={loading || otp.length !== 6} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed">
                                {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Verifying...</> : "Verify OTP"}
                            </button>
                            <button type="button" onClick={() => { setStep("enter_phone"); setOtp(""); setError(""); }} className="w-full text-sm text-gray-500 hover:text-indigo-600 transition-colors">
                                ← Back / Resend OTP
                            </button>
                        </form>
                    )}

                    {/* Step 3: New Password */}
                    {step === "new_password" && (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type={showPass ? "text" : "password"}
                                        placeholder="Min. 6 characters"
                                        value={newPass}
                                        onChange={(e) => { setNewPass(e.target.value); setError(""); }}
                                        className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    />
                                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">Confirm Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type={showPass ? "text" : "password"}
                                        placeholder="Repeat new password"
                                        value={confirmPass}
                                        onChange={(e) => { setConfirmPass(e.target.value); setError(""); }}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed">
                                {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Resetting...</> : "Reset Password"}
                            </button>
                        </form>
                    )}

                    {/* Done */}
                    {step === "done" && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="text-green-500 w-8 h-8" />
                            </div>
                            <h2 className="text-gray-900 text-xl font-bold mb-2">Password Reset!</h2>
                            <p className="text-gray-500 text-sm mb-6">Your admin password has been updated. You can now sign in.</p>
                            <button onClick={() => router.push("/")} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors">
                                Go to Login
                            </button>
                        </div>
                    )}

                    <div className="mt-6 text-center">
                        <Link href="/" className="text-sm text-indigo-600 hover:underline font-medium inline-flex items-center gap-1">
                            <ArrowLeft size={14} /> Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
