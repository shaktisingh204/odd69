"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getContactSettings, saveContactSettings } from '@/actions/settings';
import {
    MessageCircle, Mail, Phone, Save, Loader2,
    CheckCircle, AlertCircle, ExternalLink, ArrowUpRight
} from 'lucide-react';

interface ContactSettings {
    whatsappNumber: string;
    whatsappLabel: string;
    whatsappDefaultMessage: string;
    telegramHandle: string;
    telegramLink: string;
    telegramChannelLink: string;
    emailAddress: string;
    whatsappEnabled: boolean;
    telegramEnabled: boolean;
    emailEnabled: boolean;
}

const DEFAULT: ContactSettings = {
    whatsappNumber: '',
    whatsappLabel: 'Support',
    whatsappDefaultMessage: 'Hi, I need help with my account.',
    telegramHandle: '',
    telegramLink: '',
    telegramChannelLink: '',
    emailAddress: '',
    whatsappEnabled: true,
    telegramEnabled: true,
    emailEnabled: true,
};

export default function ContactSettingsPage() {
    const [form, setForm] = useState<ContactSettings>(DEFAULT);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    useEffect(() => {
        getContactSettings()
            .then(res => {
                if (res.success && res.data) setForm(prev => ({ ...DEFAULT, ...res.data }));
                else setToast({ type: 'error', msg: 'Failed to load settings' });
            })
            .finally(() => setLoading(false));
    }, []);

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await saveContactSettings(form);
            if (res.success) showToast('success', 'Contact settings saved!');
            else showToast('error', 'Failed to save settings.');
        } catch {
            showToast('error', 'Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    const set = (key: keyof ContactSettings, val: any) => setForm(p => ({ ...p, [key]: val }));

    const whatsappPreview = form.whatsappNumber
        ? `https://wa.me/${form.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(form.whatsappDefaultMessage)}`
        : null;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={28} className="animate-spin text-indigo-400" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold border ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-400'}`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-black text-white">Contact Settings</h1>
                    <p className="text-slate-400 text-sm mt-1">These details appear on the public /support page.</p>
                </div>
                <a
                    href={`${process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://zeero.bet'}/support`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-2 rounded-xl transition-all whitespace-nowrap flex-shrink-0"
                >
                    <ArrowUpRight size={13} />
                    View Support Page
                </a>
            </div>

            <form onSubmit={handleSave} className="space-y-6">

                {/* WhatsApp Section */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center">
                                <Phone size={18} className="text-green-400" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-sm">WhatsApp</p>
                                <p className="text-slate-500 text-xs">Live chat via WhatsApp</p>
                            </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-xs text-slate-400 font-medium">{form.whatsappEnabled ? 'Enabled' : 'Disabled'}</span>
                            <div
                                onClick={() => set('whatsappEnabled', !form.whatsappEnabled)}
                                className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${form.whatsappEnabled ? 'bg-green-500' : 'bg-slate-600'}`}
                            >
                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.whatsappEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </div>
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">
                                Phone Number (without +)
                            </label>
                            <input
                                type="text"
                                value={form.whatsappNumber}
                                onChange={e => set('whatsappNumber', e.target.value)}
                                placeholder="919876543210"
                                className="w-full bg-slate-900 border border-slate-700 focus:border-green-500/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                            />
                            <p className="text-[9px] text-slate-600 mt-1">Country code + number, no spaces or +</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">
                                Button Label
                            </label>
                            <input
                                type="text"
                                value={form.whatsappLabel}
                                onChange={e => set('whatsappLabel', e.target.value)}
                                placeholder="Support"
                                className="w-full bg-slate-900 border border-slate-700 focus:border-green-500/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">
                            Default Opening Message
                        </label>
                        <input
                            type="text"
                            value={form.whatsappDefaultMessage}
                            onChange={e => set('whatsappDefaultMessage', e.target.value)}
                            placeholder="Hi, I need help with my account."
                            className="w-full bg-slate-900 border border-slate-700 focus:border-green-500/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                        />
                    </div>

                    {whatsappPreview && (
                        <a
                            href={whatsappPreview}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-xs text-green-400 hover:underline"
                        >
                            <ExternalLink size={12} /> Preview WhatsApp link
                        </a>
                    )}
                </div>

                {/* Telegram Section */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-sky-500/15 flex items-center justify-center">
                                <MessageCircle size={18} className="text-sky-400" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-sm">Telegram</p>
                                <p className="text-slate-500 text-xs">Telegram support channel</p>
                            </div>
                        </div>
                        <div
                            onClick={() => set('telegramEnabled', !form.telegramEnabled)}
                            className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${form.telegramEnabled ? 'bg-sky-500' : 'bg-slate-600'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.telegramEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Handle</label>
                            <input
                                type="text"
                                value={form.telegramHandle}
                                onChange={e => set('telegramHandle', e.target.value)}
                                placeholder="@ZeeroSupport"
                                className="w-full bg-slate-900 border border-slate-700 focus:border-sky-500/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Link (t.me/…)</label>
                            <input
                                type="text"
                                value={form.telegramLink}
                                onChange={e => set('telegramLink', e.target.value)}
                                placeholder="https://t.me/ZeeroSupport"
                                className="w-full bg-slate-900 border border-slate-700 focus:border-sky-500/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Channel / Community Link</label>
                        <input
                            type="text"
                            value={form.telegramChannelLink}
                            onChange={e => set('telegramChannelLink', e.target.value)}
                            placeholder="https://t.me/ZeeroCommunity"
                            className="w-full bg-slate-900 border border-slate-700 focus:border-sky-500/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                        />
                        <p className="text-[9px] text-slate-600 mt-1">This link is shown as a &quot;Join Telegram&quot; card on the app home page</p>
                    </div>
                </div>

                {/* Email Section */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
                                <Mail size={18} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-sm">Email Support</p>
                                <p className="text-slate-500 text-xs">Support email address</p>
                            </div>
                        </div>
                        <div
                            onClick={() => set('emailEnabled', !form.emailEnabled)}
                            className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${form.emailEnabled ? 'bg-blue-500' : 'bg-slate-600'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.emailEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Email Address</label>
                        <input
                            type="email"
                            value={form.emailAddress}
                            onChange={e => set('emailAddress', e.target.value)}
                            placeholder="support@zeero.bet"
                            className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Save Button */}
                <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white font-black text-sm uppercase rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Saving...' : 'Save Contact Settings'}
                </button>
            </form>
        </div>
    );
}
