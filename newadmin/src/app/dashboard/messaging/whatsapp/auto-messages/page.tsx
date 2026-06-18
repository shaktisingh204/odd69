"use client";

import { useState, useEffect } from "react";
import {
    Bell, Save, TestTube, CheckCircle, XCircle, ToggleLeft, ToggleRight,
    UserPlus, CreditCard, Banknote, Loader2, Phone
} from "lucide-react";

interface AutoMsgSetting {
    template: string;
    enabled: boolean;
}

interface Settings {
    welcome: AutoMsgSetting;
    deposit: AutoMsgSetting;
    withdrawal: AutoMsgSetting;
}

const AUTO_TYPES = [
    {
        key: "welcome" as const,
        label: "Welcome Message",
        desc: "Sent automatically when a new user registers",
        icon: UserPlus,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
    },
    {
        key: "deposit" as const,
        label: "Deposit Success",
        desc: "Sent when a user's deposit is confirmed",
        icon: CreditCard,
        color: "text-green-400",
        bg: "bg-green-500/10",
    },
    {
        key: "withdrawal" as const,
        label: "Withdrawal Success",
        desc: "Sent when a user's withdrawal is processed",
        icon: Banknote,
        color: "text-purple-400",
        bg: "bg-purple-500/10",
    },
];

export default function WhatsAppAutoMessagesPage() {
    const [settings, setSettings] = useState<Settings>({
        welcome:    { template: "welcome_message", enabled: false },
        deposit:    { template: "deposit_success",  enabled: false },
        withdrawal: { template: "withdrawal_success", enabled: false },
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [testPhone, setTestPhone] = useState("");
    const [testing, setTesting] = useState<string | null>(null);
    const [msgs, setMsgs] = useState<Record<string, { ok: boolean; msg: string }>>({});

    useEffect(() => {
        fetch("/actions/whatsapp-auto-messages")
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    setSettings({
                        welcome:    d.welcome,
                        deposit:    d.deposit,
                        withdrawal: d.withdrawal,
                    });
                }
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async (type: keyof Settings) => {
        setSaving(type);
        setMsgs(p => ({ ...p, [type]: { ok: false, msg: "" } }));
        try {
            const res = await fetch("/actions/whatsapp-auto-messages", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, ...settings[type] }),
            });
            const d = await res.json();
            setMsgs(p => ({ ...p, [type]: { ok: d.success, msg: d.success ? "Saved!" : d.error } }));
        } catch (e: any) {
            setMsgs(p => ({ ...p, [type]: { ok: false, msg: e.message } }));
        } finally {
            setSaving(null);
        }
    };

    const handleTest = async (type: keyof Settings) => {
        if (!testPhone) { alert("Enter a test phone number first"); return; }
        setTesting(type);
        try {
            const res = await fetch("/actions/whatsapp-auto-messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, phone: testPhone }),
            });
            const d = await res.json();
            setMsgs(p => ({ ...p, [`${type}_test`]: { ok: d.success, msg: d.success ? `Test sent! ID: ${d.messageId}` : d.error } }));
        } catch (e: any) {
            setMsgs(p => ({ ...p, [`${type}_test`]: { ok: false, msg: e.message } }));
        } finally {
            setTesting(null);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-green-500" size={28} />
        </div>
    );

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                    <Bell className="text-green-500" size={20} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">Auto WhatsApp Messages</h1>
                    <p className="text-sm text-slate-400">Configure automatic messages for key user events</p>
                </div>
            </div>

            {/* Test Phone */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Phone size={14} /> Test Phone Number
                </h2>
                <div className="flex gap-3">
                    <input
                        type="tel"
                        value={testPhone}
                        onChange={e => setTestPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500 transition-colors"
                    />
                    <p className="text-xs text-slate-500 self-center">Used for "Send Test" on each template below</p>
                </div>
            </div>

            {/* Auto Message Cards */}
            {AUTO_TYPES.map(({ key, label, desc, icon: Icon, color, bg }) => (
                <div key={key} className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}>
                                <Icon className={color} size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white">{label}</h3>
                                <p className="text-xs text-slate-500">{desc}</p>
                            </div>
                        </div>

                        {/* Toggle */}
                        <button
                            onClick={() => setSettings(p => ({ ...p, [key]: { ...p[key], enabled: !p[key].enabled } }))}
                            className="flex-shrink-0"
                        >
                            {settings[key].enabled
                                ? <ToggleRight size={28} className="text-green-500" />
                                : <ToggleLeft size={28} className="text-slate-500" />
                            }
                        </button>
                    </div>

                    {/* Template name */}
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Template Name (from Meta)</label>
                        <input
                            type="text"
                            value={settings[key].template}
                            onChange={e => setSettings(p => ({ ...p, [key]: { ...p[key], template: e.target.value } }))}
                            placeholder={`e.g. ${key}_message`}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500 transition-colors"
                        />
                    </div>

                    {/* Feedback */}
                    {msgs[key] && msgs[key].msg && (
                        <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${msgs[key].ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                            {msgs[key].ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
                            {msgs[key].msg}
                        </div>
                    )}
                    {msgs[`${key}_test`] && msgs[`${key}_test`].msg && (
                        <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${msgs[`${key}_test`].ok ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"}`}>
                            {msgs[`${key}_test`].ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
                            {msgs[`${key}_test`].msg}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleTest(key)}
                            disabled={testing === key}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-xs rounded-lg transition-colors"
                        >
                            {testing === key ? <Loader2 size={13} className="animate-spin" /> : <TestTube size={13} />}
                            Send Test
                        </button>
                        <button
                            onClick={() => handleSave(key)}
                            disabled={saving === key}
                            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                            {saving === key ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            Save
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
