"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Eye, EyeOff, AlertCircle, Mail, Lock, Loader2 } from "lucide-react";
import api from "@/services/api";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import CountryCodeSelector, { Country, COUNTRIES } from "@/components/shared/CountryCodeSelector";

interface LoginModalProps {
    onClose?: () => void;
    onRegisterClick?: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onRegisterClick }) => {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    
    // Login modes
    const [loginMode, setLoginMode] = useState<"password" | "otp">("password");
    const [otpStep, setOtpStep] = useState<"form" | "verify">("form");
    
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [otpCode, setOtpCode] = useState('');
    
    // Optional Country Code specifically for phone detection if users want to pick
    const [showCountryCode, setShowCountryCode] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES.find(c => c.iso === 'IN')!);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
    const [resendCooldown, setResendCooldown] = useState(0);
    const [otpExpiresIn, setOtpExpiresIn] = useState(0);
    const cooldownRef = useRef<NodeJS.Timeout | null>(null);
    const expiryRef = useRef<NodeJS.Timeout | null>(null);
    const { login } = useAuth();

    const startCooldown = useCallback(() => {
        setResendCooldown(60);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        cooldownRef.current = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) {
                    clearInterval(cooldownRef.current!);
                    cooldownRef.current = null;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    const startExpiryTimer = useCallback((seconds: number) => {
        setOtpExpiresIn(seconds);
        if (expiryRef.current) clearInterval(expiryRef.current);
        expiryRef.current = setInterval(() => {
            setOtpExpiresIn(prev => {
                if (prev <= 1) {
                    clearInterval(expiryRef.current!);
                    expiryRef.current = null;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    useEffect(() => {
        return () => {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            if (expiryRef.current) clearInterval(expiryRef.current);
        };
    }, []);

    const clearErrors = () => { setError(''); setFieldErrors({}); };

    const handleModeChange = (mode: "password" | "otp") => {
        setLoginMode(mode);
        setOtpStep("form");
        clearErrors();
    };

    // Auto-detect if identifier looks like purely digits - then show Country Code selector safely
    const handleIdentifierChange = (val: string) => {
        setIdentifier(val);
        clearErrors();
        // If it starts with digits, we can optionally show the country code selector to help them
        if (/^\d+$/.test(val)) {
            setShowCountryCode(true);
        } else {
            setShowCountryCode(false);
        }
    };

    const validateForm = () => {
        const errs: { [key: string]: string } = {};
        if (!identifier.trim()) {
            errs.identifier = 'Email, Phone, or Username is required';
        }
        
        if (loginMode === 'password') {
            if (!password) {
                errs.password = 'Password is required';
            }
        }
        
        if (loginMode === 'otp' && otpStep === 'verify') {
            if (!otpCode || otpCode.length < 6) {
                errs.otpCode = 'Enter 6-digit OTP';
            }
        }
        
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const getResolvedIdentifier = () => {
        const raw = identifier.trim();
        // If they left the country code visible and it's purely digits, assume phone
        if (showCountryCode && /^\d+$/.test(raw)) {
            // Strip any leading + from country code and merge
            return `${selectedCountry.code.replace(/-/g, '')}${raw}`;
        }
        return raw;
    };

    const handleSendOtp = async () => {
        clearErrors();
        if (!identifier.trim()) {
            setFieldErrors({ identifier: 'Enter your Email or Phone Number to receive OTP' });
            return;
        }

        const isEmail = identifier.includes('@');
        
        setLoading(true);
        try {
            const resolvedIdentifier = getResolvedIdentifier();
            
            if (isEmail) {
                await api.post('/auth/send-email-otp', { email: resolvedIdentifier, purpose: 'LOGIN' });
            } else {
                // Determine raw phone format
                const phonePayload = resolvedIdentifier.startsWith('+') ? resolvedIdentifier : `+${resolvedIdentifier}`;
                await api.post('/auth/send-otp', { phoneNumber: phonePayload, purpose: 'LOGIN' });
            }
            
            setOtpStep("verify");
            setOtpCode('');
            startCooldown();
            startExpiryTimer(isEmail ? 600 : 120); // email: 10min, phone: 2min
            toast.success("OTP sent successfully");
        } catch (err: any) {
            const status = err.response?.status;
            const rawMsg = err.response?.data?.message;
            const msgStr = Array.isArray(rawMsg) ? rawMsg.join(', ') : (rawMsg || '');
            if (status === 429) setError('Too many attempts. Please wait and try again.');
            else if (msgStr) setError(msgStr);
            else setError('Failed to send OTP. Please check your details.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (loginMode === 'otp' && otpStep === 'form') {
            handleSendOtp();
            return;
        }
        
        clearErrors();
        if (!validateForm()) return;
        setLoading(true);
        try {
            const resolvedIdentifier = getResolvedIdentifier();
            let res;
            
            if (loginMode === 'password') {
                res = await api.post('/auth/login', { identifier: resolvedIdentifier, password });
            } else {
                res = await api.post('/auth/login-otp', { identifier: resolvedIdentifier, code: otpCode });
            }
            
            login(res.data.access_token, res.data.user);
            toast.success('Logged in successfully!');
            if (onClose) onClose();
        } catch (err: any) {
            const status = err.response?.status;
            const rawMsg = err.response?.data?.message;
            const msgStr = Array.isArray(rawMsg) ? rawMsg.join(', ') : (rawMsg || '');
            const isBanned = msgStr.toLowerCase().includes('suspended') || status === 403;
            if (isBanned) setError('Your account has been suspended. Please contact support.');
            else if (status === 429) setError('Too many login attempts. Please wait and try again.');
            else if (msgStr) setError(msgStr);
            else setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>

            {/* Fixed-width modal — bottom sheet on mobile, centred card on sm+ */}
            <div
                className="relative w-full sm:w-[440px] bg-[#140f0b] rounded-t-3xl sm:rounded-2xl ring-1 ring-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.7)] flex flex-col flex-shrink-0 overflow-hidden sm:min-h-[560px]"
                style={{ maxHeight: '92dvh', transformOrigin: 'center' }}
            >
                {/* Decorative glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-36 bg-[#ff7a1a]/10 blur-[60px] rounded-full pointer-events-none" />

                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
                    aria-label="Close"
                >
                    <X size={16} />
                </button>

                {/* ── Non-scrolling header ── */}
                <div className="relative z-10 flex-shrink-0 px-6 pt-6 pb-0 sm:px-8 sm:pt-8">
                    {/* Mobile drag handle */}
                    <div className="sm:hidden w-10 h-1 bg-white/[0.16] rounded-full mx-auto mb-5" />

                    {/* Logo */}
                    <div className="text-center mb-6">
                        <span className="text-3xl font-extrabold italic tracking-[-0.04em]">
                            <span className="text-brand-gold">ODD</span><span className="text-white">69</span>
                        </span>
                        <p className="text-xs text-white/35 mt-1 font-medium tracking-wide">SPORTS · CASINO · ORIGINALS</p>
                    </div>

                    {/* Heading */}
                    <h2 className="text-xl font-black text-white uppercase tracking-wide mb-0.5">Welcome Back</h2>
                    <p className="text-[13px] text-white/40 mb-4">
                        New here?{' '}
                        <button type="button" onClick={onRegisterClick} className="text-brand-gold font-bold hover:underline">
                            Create an account
                        </button>
                    </p>

                    {/* Tab toggle */}
                    <div className="flex bg-white/[0.04] ring-1 ring-white/[0.06] rounded-xl p-1 mb-0 gap-1">
                        {(["password", "otp"] as const).map(tab => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => handleModeChange(tab)}
                                style={loginMode === tab ? { background: "linear-gradient(135deg,#ff9a3d,#ff6a00)" } : undefined}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-bold rounded-lg transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 ${
                                    loginMode === tab
                                        ? "text-white shadow-[0_8px_24px_-8px_rgba(255,106,0,0.7)]"
                                        : "text-white/40 hover:text-white/70"
                                }`}
                            >
                                {tab === "password" ? <Lock size={13} /> : <Mail size={13} />}
                                {tab === "password" ? "Password" : "OTP"}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Scrollable form body ── */}
                <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-6 pb-2 sm:px-8">
                    <form onSubmit={handleLogin} className="flex flex-col gap-3 pt-4" noValidate>

                        {/* Identifier */}
                        <div className="flex flex-col gap-1">
                            <div className="flex gap-2 h-[50px]">
                                {showCountryCode && (
                                    <div className="flex-shrink-0 h-[50px]">
                                        <CountryCodeSelector
                                            value={selectedCountry}
                                            onChange={setSelectedCountry}
                                        />
                                    </div>
                                )}
                                <div className="relative flex-1 h-[50px]">
                                    {!showCountryCode && <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />}
                                    <input
                                        type="text"
                                        placeholder="Email / Phone Number / Username"
                                        autoComplete="username"
                                        className={`w-full h-[50px] bg-[#0f0c09] border rounded-xl ${showCountryCode ? 'px-4' : 'pl-10 pr-4'} text-white text-[15px] font-medium outline-none transition-all focus:ring-[1.5px] placeholder:text-white/25 ${
                                            fieldErrors.identifier
                                                ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/20'
                                                : 'border-white/[0.08] focus:border-[#ff7a1a]/70 focus:ring-[#ff7a1a]/20'
                                        }`}
                                        value={identifier}
                                        onChange={e => handleIdentifierChange(e.target.value)}
                                        disabled={loginMode === 'otp' && otpStep === 'verify'}
                                    />
                                </div>
                            </div>
                            {fieldErrors.identifier && (
                                <p className="text-danger text-[11px] flex items-center gap-1 ml-1">
                                    <AlertCircle size={10} /> {fieldErrors.identifier}
                                </p>
                            )}
                        </div>

                        {/* Conditional fields based on Mode and Step */}
                        {loginMode === 'password' && (
                            <>
                                {/* Password */}
                                <div className="flex flex-col gap-1">
                                    <div className="relative h-[50px]">
                                        <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Password"
                                            autoComplete="current-password"
                                            className={`w-full h-[50px] bg-[#0f0c09] border rounded-xl pl-10 pr-12 text-white text-[15px] font-medium outline-none transition-all focus:ring-[1.5px] placeholder:text-white/25 ${
                                                fieldErrors.password
                                                    ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/20'
                                                    : 'border-white/[0.08] focus:border-[#ff7a1a]/70 focus:ring-[#ff7a1a]/20'
                                            }`}
                                            value={password}
                                            onChange={e => {
                                                setPassword(e.target.value);
                                                setError('');
                                                setFieldErrors(p => ({ ...p, password: '' }));
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(v => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    {fieldErrors.password && (
                                        <p className="text-danger text-[11px] flex items-center gap-1 ml-1">
                                            <AlertCircle size={10} /> {fieldErrors.password}
                                        </p>
                                    )}
                                </div>

                                {/* Forgot password */}
                                <div className="flex justify-end -mt-0.5">
                                    <button
                                        type="button"
                                        onClick={() => { if (onClose) onClose(); router.push('/forgot-password'); }}
                                        className="text-[12px] text-brand-gold/80 font-semibold hover:text-brand-gold transition-colors"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                            </>
                        )}

                        {loginMode === 'otp' && otpStep === 'verify' && (
                            <div className="flex flex-col gap-1 mt-2">
                                <label className="text-xs text-white/60 mb-1 ml-1">Enter 6-digit OTP Code</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="—— —— ——"
                                    className={`w-full h-[50px] bg-[#0f0c09] border rounded-xl px-4 text-white text-[20px] tracking-[0.5em] text-center font-bold outline-none transition-all focus:ring-[1.5px] placeholder:text-white/20 placeholder:tracking-normal ${
                                        fieldErrors.otpCode
                                            ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/20'
                                            : 'border-white/[0.08] focus:border-[#ff7a1a]/70 focus:ring-[#ff7a1a]/20'
                                    }`}
                                    value={otpCode}
                                    onChange={e => {
                                        const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                                        setOtpCode(digits);
                                        setError('');
                                        setFieldErrors(p => ({ ...p, otpCode: '' }));
                                    }}
                                    autoFocus
                                />
                                {fieldErrors.otpCode && (
                                    <p className="text-danger text-[11px] flex items-center gap-1 ml-1 mt-1">
                                        <AlertCircle size={10} /> {fieldErrors.otpCode}
                                    </p>
                                )}
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-[12px] text-white/40">Didn&apos;t receive the code?</span>
                                    <button
                                        type="button"
                                        onClick={handleSendOtp}
                                        disabled={resendCooldown > 0 || loading}
                                        className={`text-[12px] font-semibold transition-colors ${
                                            resendCooldown > 0 || loading
                                                ? 'text-white/25 cursor-not-allowed'
                                                : 'text-brand-gold hover:text-brand-gold/80'
                                        }`}
                                    >
                                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                                    </button>
                                </div>
                                {otpExpiresIn > 0 ? (
                                    <p className={`text-center text-[11px] mt-1.5 ${otpExpiresIn <= 30 ? 'text-red-400' : 'text-white/35'}`}>
                                        OTP expires in {Math.floor(otpExpiresIn / 60)}:{String(otpExpiresIn % 60).padStart(2, '0')}
                                    </p>
                                ) : otpStep === 'verify' && (
                                    <p className="text-center text-[11px] mt-1.5 text-red-400 font-medium">
                                        OTP expired — please resend
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Global error */}
                        {error && (
                            <div className="flex items-start gap-2.5 bg-danger-alpha-08 border border-danger/25 rounded-xl px-4 py-3 mt-2">
                                <AlertCircle size={14} className="text-danger shrink-0 mt-0.5" />
                                <p className="text-danger text-[12px] font-medium leading-snug">{error}</p>
                            </div>
                        )}
                    </form>
                </div>{/* end scrollable body */}

                {/* ── Sticky footer — Log In always visible ── */}
                <div className="relative z-10 flex-shrink-0 px-6 pb-6 pt-3 sm:px-8 border-t border-white/[0.06] bg-[#140f0b]">
                    <button
                        type="button"
                        onClick={handleLogin}
                        disabled={loading}
                        style={{ background: "linear-gradient(135deg,#ff9a3d,#ff6a00)" }}
                        className="w-full h-[52px] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-[14px] uppercase tracking-widest rounded-xl transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 shadow-[0_8px_24px_-8px_rgba(255,106,0,0.7)] flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <><Loader2 size={16} className="animate-spin" /> Please wait...</>
                        ) : loginMode === 'otp' && otpStep === 'form' ? (
                            'Get OTP Code'
                        ) : (
                            'Log In'
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default LoginModal;
