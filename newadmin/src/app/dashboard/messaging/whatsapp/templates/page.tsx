"use client";

import { useState, useEffect } from "react";
import {
    Save, TestTube, CheckCircle, XCircle, Eye, EyeOff,
    Wifi, WifiOff, AlertCircle, MessageSquare
} from "lucide-react";

export default function WhatsAppAccountSetupPage() {
    const [config, setConfig] = useState({
        accessToken: "", appId: "", wabaId: "", phoneNumberId: "", isActive: false,
    });
    const [showToken, setShowToken] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [saveMsg, setSaveMsg] = useState<{ ok: boolean; msg: string } | null>(null);
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/actions/whatsapp-config")
            .then(r => r.json())
            .then(d => {
                if (d.success) setConfig({
                    accessToken: d.accessToken || "",
                    appId: d.appId || "",
                    wabaId: d.wabaId || "",
                    phoneNumberId: d.phoneNumberId || "",
                    isActive: d.isActive || false,
                });
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true); setSaveMsg(null);
        try {
            const res = await fetch("/actions/whatsapp-config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            const d = await res.json();
            setSaveMsg({ ok: d.success, msg: d.success ? "Configuration saved!" : d.error });
        } catch (e: any) { setSaveMsg({ ok: false, msg: e.message }); }
        finally { setSaving(false); }
    };

    const handleTest = async () => {
        setTesting(true); setTestResult(null);
        try {
            const res = await fetch("/actions/whatsapp-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accessToken: config.accessToken, phoneNumberId: config.phoneNumberId }),
            });
            const d = await res.json();
            setTestResult({ ok: d.success, msg: d.success ? `✓ ${d.name} (${d.phoneNumber}) — ${d.status}` : d.error });
        } catch (e: any) { setTestResult({ ok: false, msg: e.message }); }
        finally { setTesting(false); }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" /></div>;

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                    <MessageSquare className="text-green-500" size={20} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">WhatsApp Account Setup</h1>
                    <p className="text-sm text-slate-400">Connect your WhatsApp Business Account via Meta Cloud API</p>
                </div>
                <div className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${config.isActive ? "bg-green-500/10 text-green-400" : "bg-slate-700 text-slate-400"}`}>
                    {config.isActive ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {config.isActive ? "Active" : "Inactive"}
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-5">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">API Credentials</h2>

                {/* Access Token */}
                <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Access Token <span className="text-red-400">*</span></label>
                    <div className="relative">
                        <input
                            type={showToken ? "text" : "password"}
                            value={config.accessToken}
                            onChange={e => setConfig(p => ({ ...p, accessToken: e.target.value }))}
                            placeholder="EAAxxxxxxxxxxxxxxxx..."
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 pr-10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500 transition-colors"
                        />
                        <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                            {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { key: "appId", label: "App ID", placeholder: "123456789012345" },
                        { key: "wabaId", label: "WABA ID", placeholder: "WhatsApp Business Account ID" },
                        { key: "phoneNumberId", label: "Phone Number ID", placeholder: "Phone Number Object ID" },
                    ].map(f => (
                        <div key={f.key}>
                            <label className="block text-sm text-slate-400 mb-1.5">{f.label} <span className="text-red-400">*</span></label>
                            <input
                                type="text"
                                value={(config as any)[f.key]}
                                onChange={e => setConfig(p => ({ ...p, [f.key]: e.target.value }))}
                                placeholder={f.placeholder}
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500 transition-colors"
                            />
                        </div>
                    ))}

                    <div className="flex flex-col justify-center">
                        <label className="text-sm text-slate-400 mb-1.5">Status</label>
                        <button onClick={() => setConfig(p => ({ ...p, isActive: !p.isActive }))}
                            className={`flex items-center gap-2 w-fit px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${config.isActive ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-slate-700 border-slate-600 text-slate-400"}`}>
                            <div className={`w-2 h-2 rounded-full ${config.isActive ? "bg-green-400" : "bg-slate-500"}`} />
                            {config.isActive ? "Enabled" : "Disabled"}
                        </button>
                    </div>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 flex gap-3">
                    <AlertCircle size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-300">
                        Get credentials from <span className="font-bold">Meta for Developers → Your App → WhatsApp → API Setup</span>.
                        The Phone Number ID is different from the actual phone number.
                    </p>
                </div>

                {testResult && (
                    <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${testResult.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                        {testResult.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        <span>{testResult.msg}</span>
                    </div>
                )}
                {saveMsg && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${saveMsg.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                        {saveMsg.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        <span>{saveMsg.msg}</span>
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <button onClick={handleTest} disabled={testing || !config.accessToken || !config.phoneNumberId}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg transition-colors">
                        <TestTube size={15} />
                        {testing ? "Testing..." : "Test Connection"}
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
                        <Save size={15} />
                        {saving ? "Saving..." : "Save Configuration"}
                    </button>
                </div>
            </div>
        </div>
    );
}
