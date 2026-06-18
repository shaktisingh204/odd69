"use client";

import React, { useState } from "react";
import { X, Mail, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import api from "@/services/api";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

interface BindEmailModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const BindEmailModal: React.FC<BindEmailModalProps> = ({ onClose, onSuccess }) => {
    const { login } = useAuth();
    
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    type Step = 'form' | 'verify_otp';
    const [step, setStep] = useState<Step>('form');
    const [otpCode, setOtpCode] = useState('');
    const [otpExpiresIn, setOtpExpiresIn] = useState(0);

    React.useEffect(() => {
        if (otpExpiresIn <= 0) return;
        const t = setTimeout(() => setOtpExpiresIn(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [otpExpiresIn]);

    const handleSendOtp = async () => {
        setError('');
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setError('Email address is required');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            setError('Enter a valid email address');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/send-email-otp', {
                email: trimmedEmail,
                purpose: 'BIND_EMAIL',
            });
            setStep('verify_otp');
            setOtpCode('');
            setOtpExpiresIn(600); // email: 10min
            toast.success('OTP sent to your email address');
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(typeof msg === 'string' ? msg : 'Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAndBind = async () => {
        setError('');
        if (otpCode.length !== 6) { 
            setError('Enter the 6-digit OTP.'); 
            return; 
        }

        const trimmedEmail = email.trim();
        
        setLoading(true);
        try {
            await api.post('/auth/bind-email', { 
                email: trimmedEmail, 
                code: otpCode, 
                purpose: 'BIND_EMAIL' 
            });
            
            toast.success('Email bound successfully!');
            // Reload user profile in AuthContext
            try {
                const res = await api.get('/auth/profile');
                if (res.data) {
                    const currentToken = localStorage.getItem('token');
                    if (currentToken) {
                        login(currentToken, res.data);
                    }
                }
            } catch (e) {
                // Ignore profile reload errors
            }
            onSuccess();
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(typeof msg === 'string' ? msg : 'Verification failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md" onClick={onClose} />
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
                <div className="pointer-events-auto relative w-full max-w-md bg-auth-base rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.6)] border border-white/[0.05] overflow-hidden">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-bg-elevated hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary"
                    >
                        <X size={18} />
                    </button>

                    <div className="p-6 sm:p-8">
                        {step === 'verify_otp' ? (
                            <div className="text-center animate-in fade-in duration-300">
                                <div className="w-16 h-16 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                                    <ShieldCheck size={30} className="text-indigo-400" />
                                </div>
                                <h4 className="text-text-primary font-bold text-xl mb-2">Verify Your Email</h4>
                                <p className="text-text-muted text-sm mb-6">
                                    Enter the 6-digit OTP sent to <br />
                                    <strong className="text-text-primary mt-1 inline-block">{email}</strong>
                                </p>
                                
                                <div className="mb-6">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        placeholder="— — — — — —"
                                        value={otpCode}
                                        onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                                        className={`w-full h-[60px] bg-bg-elevated border-2 rounded-xl px-4 text-text-primary text-[28px] font-bold tracking-[0.5em] text-center outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted placeholder:text-2xl placeholder:tracking-[0.3em] ${error ? 'border-red-500' : 'border-divider focus:border-indigo-500 focus:ring-indigo-500/40'}`}
                                    />
                                    {error && <p className="text-danger text-xs mt-2 flex items-center justify-center gap-1"><AlertCircle size={12} />{error}</p>}
                                </div>

                                <button
                                    onClick={handleVerifyAndBind}
                                    disabled={loading || otpCode.length !== 6}
                                    className="w-full h-[50px] bg-auth-action text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? <><Loader2 size={18} className="animate-spin" /> Verifying...</> : 'Verify & Bind'}
                                </button>
                                
                                {otpExpiresIn > 0 ? (
                                    <p className={`text-center text-[11px] mt-3 ${otpExpiresIn <= 30 ? 'text-danger' : 'text-text-muted/50'}`}>
                                        OTP expires in {Math.floor(otpExpiresIn / 60)}:{String(otpExpiresIn % 60).padStart(2, '0')}
                                    </p>
                                ) : step === 'verify_otp' && (
                                    <p className="text-center text-[11px] mt-3 text-danger font-medium">
                                        OTP expired — please resend
                                    </p>
                                )}
                                <p className="text-xs text-text-muted mt-2">
                                    Didn't receive it? <button className="text-indigo-400 font-bold hover:underline" onClick={() => { setStep('form'); setOtpExpiresIn(0); }}>Change email</button>
                                </p>
                            </div>
                        ) : (
                            <div className="animate-in fade-in duration-300">
                                <div className="w-16 h-16 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center mx-auto mb-4">
                                    <Mail size={30} className="text-brand-gold" />
                                </div>
                                <h3 className="text-xl font-bold text-text-primary text-center mb-2">Bind Email Address</h3>
                                <p className="text-sm text-text-muted text-center mb-6">
                                    A verified email address is required to secure your account and recover your password.
                                </p>

                                <div className="mb-2">
                                    <input
                                        type="email"
                                        placeholder="Email Address"
                                        autoFocus
                                        className={`w-full h-[50px] bg-bg-elevated border rounded-xl px-4 text-text-primary outline-none transition-all focus:ring-[1.5px] placeholder:text-text-muted font-medium ${error
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                                            : 'border-divider focus:border-brand-gold focus:ring-brand-gold/40'
                                            }`}
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            setError('');
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp(); }}
                                    />
                                </div>
                                {error && (
                                    <p className="text-danger text-xs mb-4 ml-1 flex items-center gap-1">
                                        <AlertCircle size={11} /> {error}
                                    </p>
                                )}

                                <button
                                    onClick={handleSendOtp}
                                    disabled={loading || !email}
                                    className="w-full h-[50px] mt-4 bg-auth-action text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {loading ? <><Loader2 size={18} className="animate-spin" /> Sending...</> : 'Send OTP'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default BindEmailModal;
