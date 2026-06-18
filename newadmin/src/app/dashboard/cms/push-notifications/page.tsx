"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../../../../services/api';
import {
    Bell, Send, Loader2, Image, Link2, Users, Clock,
    ChevronDown, Smartphone, X, ExternalLink, Gamepad2,
    Trophy, Gift, User, Zap, UserMinus, UserPlus, Search,
    Home, Star, Shield, HelpCircle, Settings, Ticket
} from 'lucide-react';

interface PushRecord {
    id: number;
    title: string;
    body: string;
    imageUrl?: string;
    deepLink?: string;
    segment?: string;
    sentBy: number;
    sentCount: number;
    onesignalId?: string;
    createdAt: string;
}

interface SearchResult {
    deepLink: string;
    label: string;
    sub?: string;
}

// ── All static deep links ────────────────────────────────────

const STATIC_DEEP_LINKS = [
    { group: 'Pages', items: [
        { value: 'zeero://home', label: 'Home Page', icon: Home },
        { value: 'zeero://sports', label: 'Sports Page', icon: Trophy },
        { value: 'zeero://casino', label: 'Casino Page', icon: Gamepad2 },
        { value: 'zeero://profile', label: 'Profile', icon: User },
        { value: 'zeero://promotions', label: 'Promotions', icon: Gift },
        { value: 'zeero://notifications', label: 'Notifications', icon: Bell },
        { value: 'zeero://vip', label: 'VIP Club', icon: Star },
        { value: 'zeero://support', label: 'Support', icon: HelpCircle },
        { value: 'zeero://live', label: 'Live Dealers', icon: Zap },
        { value: 'zeero://zeero', label: 'Zeero Originals', icon: Gamepad2 },
    ]},
    { group: 'Zeero Games', items: [
        { value: 'zeero://game/mines', label: 'Mines', icon: Gamepad2 },
        { value: 'zeero://game/crash', label: 'Crash', icon: Gamepad2 },
        { value: 'zeero://game/dice', label: 'Dice', icon: Gamepad2 },
        { value: 'zeero://game/limbo', label: 'Limbo', icon: Gamepad2 },
    ]},
    { group: 'Legal', items: [
        { value: 'zeero://fairness', label: 'Fairness', icon: Shield },
        { value: 'zeero://privacyPolicy', label: 'Privacy Policy', icon: Shield },
        { value: 'zeero://termsOfService', label: 'Terms of Service', icon: Shield },
        { value: 'zeero://bettingRules', label: 'Betting Rules', icon: Shield },
    ]},
];

const SEGMENT_OPTIONS = [
    { value: 'ALL', label: 'All Users', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { value: 'VIP', label: 'VIP Players', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { value: 'NEW', label: 'New Users (7d)', icon: UserPlus, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { value: 'ACTIVE', label: 'Active Users', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { value: 'CHURNED', label: 'Churned Users', icon: UserMinus, color: 'text-red-400', bg: 'bg-red-500/10' },
];

export default function PushNotificationsPage() {
    // Form
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [deepLink, setDeepLink] = useState('');
    const [segment, setSegment] = useState('ALL');
    const [sending, setSending] = useState(false);

    // Deep link UI
    const [dlMode, setDlMode] = useState<'none' | 'static' | 'match' | 'casino' | 'custom'>('none');
    const [showDlPanel, setShowDlPanel] = useState(false);

    // Match search
    const [matchQuery, setMatchQuery] = useState('');
    const [matchResults, setMatchResults] = useState<any[]>([]);
    const [matchLoading, setMatchLoading] = useState(false);
    const matchTimer = useRef<any>(null);

    // Casino search
    const [casinoQuery, setCasinoQuery] = useState('');
    const [casinoResults, setCasinoResults] = useState<any[]>([]);
    const [casinoLoading, setCasinoLoading] = useState(false);
    const casinoTimer = useRef<any>(null);

    // History
    const [history, setHistory] = useState<PushRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Config
    const [configAppId, setConfigAppId] = useState('');
    const [configRestApiKey, setConfigRestApiKey] = useState('');
    const [configLoading, setConfigLoading] = useState(true);
    const [configSaving, setConfigSaving] = useState(false);
    const [showConfig, setShowConfig] = useState(false);

    // Confirmation
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => { fetchHistory(); fetchConfig(); }, [page]);

    // ── Config (admin action) ─────────────────────────────────
    const fetchConfig = async () => {
        setConfigLoading(true);
        try {
            const res = await fetch('/actions/onesignal-config');
            const data = await res.json();
            setConfigAppId(data?.appId || '');
            // REST API key is no longer returned by the server for security.
            // Only show whether it is set; admin must re-enter to change it.
            if (data?.restApiKeySet) {
                setConfigRestApiKey('••••••••••••••••');
            } else {
                setConfigRestApiKey('');
            }
        } catch {} finally { setConfigLoading(false); }
    };

    const saveConfig = async () => {
        setConfigSaving(true);
        try {
            const res = await fetch('/actions/onesignal-config', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                // Only send restApiKey if the admin actually typed a new value
                // (not the masked placeholder).
                body: JSON.stringify({
                    appId: configAppId,
                    ...(configRestApiKey && !configRestApiKey.startsWith('••') ? { restApiKey: configRestApiKey } : {}),
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            alert('✅ OneSignal configuration saved!');
        } catch (err: any) {
            alert('❌ Failed to save: ' + (err?.message || 'Unknown error'));
        } finally { setConfigSaving(false); }
    };

    // ── History (admin action) ────────────────────────────────
    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch(`/actions/push-notifications?page=${page}&limit=10`);
            const data = await res.json();
            setHistory(data.records || []);
            setTotalPages(data.pagination?.totalPages || 1);
        } catch {} finally { setHistoryLoading(false); }
    };

    // ── Send (admin action) ──────────────────────────────────
    const handleSend = async () => {
        setSending(true);
        try {
            const res = await fetch('/actions/push-notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, body, imageUrl: imageUrl || undefined, deepLink: deepLink || undefined, segment }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            setTitle(''); setBody(''); setImageUrl(''); setDeepLink(''); setDlMode('none'); setShowConfirm(false);
            setPage(1); fetchHistory();
            alert(`✅ Push sent to ${data.sentCount} users (${data.deliveredToDevices} devices)!`);
        } catch (err: any) {
            alert('❌ Failed: ' + (err?.message || 'Unknown'));
        } finally { setSending(false); }
    };

    // ── Match search with debounce ────────────────────────────
    const searchMatches = useCallback((q: string) => {
        setMatchQuery(q);
        if (matchTimer.current) clearTimeout(matchTimer.current);
        if (!q.trim()) { setMatchResults([]); return; }
        matchTimer.current = setTimeout(async () => {
            setMatchLoading(true);
            try {
                const res = await fetch(`/actions/push-notifications?action=search-matches&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                setMatchResults(data.results || []);
            } catch {} finally { setMatchLoading(false); }
        }, 300);
    }, []);

    // ── Casino search with debounce ───────────────────────────
    const searchCasino = useCallback((q: string) => {
        setCasinoQuery(q);
        if (casinoTimer.current) clearTimeout(casinoTimer.current);
        if (!q.trim()) { setCasinoResults([]); return; }
        casinoTimer.current = setTimeout(async () => {
            setCasinoLoading(true);
            try {
                const res = await fetch(`/actions/push-notifications?action=search-casino&q=${encodeURIComponent(q)}`);
                const data = await res.json();
                setCasinoResults(data.results || []);
            } catch {} finally { setCasinoLoading(false); }
        }, 300);
    }, []);

    const currentTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <div className="p-2 bg-indigo-600/20 rounded-xl"><Bell size={24} className="text-indigo-400" /></div>
                    Push Notifications
                </h1>
                <p className="text-slate-400 mt-1">Compose and send push notifications with deep linking support.</p>
            </div>

            {/* ─── OneSignal Config ─── */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <button onClick={() => setShowConfig(!showConfig)} className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${configAppId && configRestApiKey ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`} />
                        <h3 className="font-bold text-white text-sm">OneSignal API Configuration</h3>
                        <span className="text-[10px] text-slate-500 px-2 py-0.5 bg-slate-900 rounded font-mono">{configAppId ? 'Configured' : 'Not configured'}</span>
                    </div>
                    <ChevronDown size={14} className={`text-slate-500 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
                </button>
                {showConfig && (
                    <div className="px-5 pb-5 space-y-4 border-t border-slate-700/50 pt-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5 font-medium">OneSignal App ID</label>
                            <input type="text" value={configAppId} onChange={e => setConfigAppId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:border-indigo-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5 font-medium">REST API Key</label>
                            <input type="password" value={configRestApiKey} onChange={e => setConfigRestApiKey(e.target.value)} placeholder="••••••••••••••••••••••••" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:border-indigo-500 focus:outline-none" />
                            <p className="text-[10px] text-slate-600 mt-1">Found in OneSignal Dashboard → Settings → Keys & IDs</p>
                        </div>
                        <button onClick={saveConfig} disabled={configSaving || !configAppId || !configRestApiKey} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white py-2 px-4 rounded-lg font-medium text-sm flex items-center gap-2">
                            {configSaving ? <Loader2 className="animate-spin" size={14} /> : null}
                            {configSaving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* ─── Compose Form ─── */}
                <div className="xl:col-span-2 space-y-5">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-5">
                        <h2 className="font-bold text-white text-sm flex items-center gap-2">
                            <Send size={14} className="text-indigo-400" /> Compose Notification
                        </h2>

                        {/* Title */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Title <span className="text-red-400">*</span></label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. 🎉 Exciting Match Tonight!" maxLength={100}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none" />
                            <p className="text-[10px] text-slate-600 mt-1">{title.length}/100</p>
                        </div>

                        {/* Body */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Body <span className="text-red-400">*</span></label>
                            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="e.g. Don't miss the IPL final! Place your bets now 🏏" maxLength={300} rows={3}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:border-indigo-500 focus:outline-none" />
                            <p className="text-[10px] text-slate-600 mt-1">{body.length}/300</p>
                        </div>

                        {/* Image */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5 font-medium"><Image size={12} className="inline mr-1" />Image URL (optional)</label>
                            <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/promo-banner.jpg"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none" />
                            {imageUrl && (
                                <div className="mt-2 relative w-full h-32 rounded-lg overflow-hidden border border-slate-700">
                                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                </div>
                            )}
                        </div>

                        {/* ─── Deep Link Selector ─── */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 font-medium"><Link2 size={12} className="inline mr-1" />Deep Link (optional)</label>

                            {/* Mode Tabs */}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {[
                                    { key: 'none', label: 'None', icon: X },
                                    { key: 'static', label: 'App Page', icon: Home },
                                    { key: 'match', label: 'Match', icon: Trophy },
                                    { key: 'casino', label: 'Casino Game', icon: Gamepad2 },
                                    { key: 'custom', label: 'Custom URL', icon: ExternalLink },
                                ].map(tab => (
                                    <button key={tab.key} onClick={() => { setDlMode(tab.key as any); if (tab.key === 'none') setDeepLink(''); }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${dlMode === tab.key ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                        <tab.icon size={12} />{tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Static deep links */}
                            {dlMode === 'static' && (
                                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 max-h-64 overflow-y-auto space-y-3">
                                    {STATIC_DEEP_LINKS.map(group => (
                                        <div key={group.group}>
                                            <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-1.5">{group.group}</p>
                                            <div className="grid grid-cols-2 gap-1">
                                                {group.items.map(item => {
                                                    const Icon = item.icon;
                                                    return (
                                                        <button key={item.value} onClick={() => setDeepLink(item.value)}
                                                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors ${deepLink === item.value ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:bg-slate-800'}`}>
                                                            <Icon size={11} />{item.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Match search */}
                            {dlMode === 'match' && (
                                <div className="relative">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input type="text" value={matchQuery} onChange={e => searchMatches(e.target.value)} placeholder="Search matches... e.g. India vs Australia"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none" autoFocus />
                                        {matchLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" />}
                                    </div>
                                    {matchResults.length > 0 && (
                                        <div className="mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto z-30">
                                            {matchResults.map((m: any) => (
                                                <button key={m.eventId} onClick={() => { setDeepLink(m.deepLink); setMatchQuery(m.eventName); setMatchResults([]); }}
                                                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700/30 last:border-0 ${deepLink === m.deepLink ? 'bg-indigo-500/5' : ''}`}>
                                                    <div>
                                                        <p className="text-sm text-white font-medium">{m.eventName}</p>
                                                        <p className="text-[10px] text-slate-500 font-mono">{m.deepLink}</p>
                                                    </div>
                                                    {m.matchStatus && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${m.matchStatus === 'In Play' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>{m.matchStatus}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {matchQuery && matchResults.length === 0 && !matchLoading && (
                                        <p className="text-xs text-slate-500 mt-2">No matches found for "{matchQuery}"</p>
                                    )}
                                </div>
                            )}

                            {/* Casino game search */}
                            {dlMode === 'casino' && (
                                <div className="relative">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input type="text" value={casinoQuery} onChange={e => searchCasino(e.target.value)} placeholder="Search casino games... e.g. Sweet Bonanza"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none" autoFocus />
                                        {casinoLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" />}
                                    </div>
                                    {casinoResults.length > 0 && (
                                        <div className="mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto z-30">
                                            {casinoResults.map((g: any) => (
                                                <button key={g.gameCode} onClick={() => { setDeepLink(g.deepLink); setCasinoQuery(g.name); setCasinoResults([]); }}
                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700/30 last:border-0 ${deepLink === g.deepLink ? 'bg-indigo-500/5' : ''}`}>
                                                    {g.icon && <img src={g.icon.startsWith('http') ? g.icon : `https://imagedelivery.net/l7vrHxYm1V8kfxard9QBnQ/${g.icon}/public`} alt="" className="w-8 h-8 rounded object-cover bg-slate-700" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm text-white font-medium truncate">{g.name}</p>
                                                        <p className="text-[10px] text-slate-500">{g.provider}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {casinoQuery && casinoResults.length === 0 && !casinoLoading && (
                                        <p className="text-xs text-slate-500 mt-2">No games found for "{casinoQuery}"</p>
                                    )}
                                </div>
                            )}

                            {/* Custom URL */}
                            {dlMode === 'custom' && (
                                <input type="text" value={deepLink} onChange={e => setDeepLink(e.target.value)} placeholder="zeero://match/123456/4"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:border-indigo-500 focus:outline-none" />
                            )}

                            {/* Current selection display */}
                            {deepLink && (
                                <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
                                    <Link2 size={12} className="text-indigo-400 shrink-0" />
                                    <span className="text-xs text-indigo-300 font-mono truncate flex-1">{deepLink}</span>
                                    <button onClick={() => { setDeepLink(''); setDlMode('none'); }} className="text-slate-500 hover:text-red-400"><X size={12} /></button>
                                </div>
                            )}
                        </div>

                        {/* Segment */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 font-medium"><Users size={12} className="inline mr-1" />Target Audience</label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                {SEGMENT_OPTIONS.map(seg => {
                                    const Icon = seg.icon;
                                    return (
                                        <button key={seg.value} onClick={() => setSegment(seg.value)}
                                            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all ${segment === seg.value ? `${seg.bg} border-current ${seg.color} ring-1 ring-current/20` : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                            <Icon size={16} />{seg.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Send */}
                        <button onClick={() => setShowConfirm(true)} disabled={!title.trim() || !body.trim()}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-600/20">
                            <Send size={16} /> Send Push Notification
                        </button>
                    </div>
                </div>

                {/* ─── Phone Preview ─── */}
                <div className="space-y-5">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                        <h2 className="font-bold text-white text-sm mb-4 flex items-center gap-2"><Smartphone size={14} className="text-indigo-400" />Live Preview</h2>
                        <div className="mx-auto w-[240px]">
                            <div className="bg-[#1a1a2e] rounded-[24px] border-2 border-slate-600 p-2 shadow-2xl">
                                <div className="flex items-center justify-between px-4 pt-2 pb-1">
                                    <span className="text-[9px] text-white/60 font-medium">{currentTime}</span>
                                    <div className="flex items-center gap-1">
                                        <div className="w-3 h-1.5 bg-white/40 rounded-sm" />
                                        <div className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                                    </div>
                                </div>
                                <div className="mx-2 mt-2 mb-3">
                                    <div className="bg-[#2a2a3e] rounded-2xl p-3 border border-white/[0.06] shadow-lg">
                                        <div className="flex items-start gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                                                <span className="text-white text-[10px] font-black">Z</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] text-white/40 font-medium uppercase tracking-wider">Zeero</span>
                                                    <span className="text-[8px] text-white/30">now</span>
                                                </div>
                                                <p className="text-[11px] font-bold text-white mt-0.5 leading-tight truncate">{title || 'Notification Title'}</p>
                                                <p className="text-[9px] text-white/50 mt-0.5 leading-relaxed line-clamp-2">{body || 'Notification body text...'}</p>
                                            </div>
                                        </div>
                                        {imageUrl && (
                                            <div className="mt-2 rounded-lg overflow-hidden h-20">
                                                <img src={imageUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="px-3 space-y-2 pb-4">
                                    <div className="h-2 bg-white/[0.03] rounded-full w-3/4" /><div className="h-2 bg-white/[0.03] rounded-full w-1/2" />
                                </div>
                                <div className="flex justify-center pb-2"><div className="w-16 h-1 bg-white/20 rounded-full" /></div>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2 text-[11px]">
                            {deepLink && <div className="flex items-center gap-2 text-slate-400"><Link2 size={11} className="text-indigo-400" /><span className="font-mono text-[10px] truncate">{deepLink}</span></div>}
                            <div className="flex items-center gap-2 text-slate-400"><Users size={11} className="text-indigo-400" />Target: <span className="text-white font-medium">{SEGMENT_OPTIONS.find(s => s.value === segment)?.label}</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── History ─── */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2"><Clock size={14} className="text-indigo-400" />Sent History</h3>
                    <button onClick={fetchHistory} className="text-xs text-slate-500 hover:text-slate-300">Refresh</button>
                </div>
                {historyLoading ? (
                    <div className="flex items-center justify-center py-12 text-slate-500"><Loader2 className="animate-spin mr-2" size={16} />Loading...</div>
                ) : history.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm">No push notifications sent yet.</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700/50">
                                        <th className="text-left px-4 py-3 font-medium">Title</th>
                                        <th className="text-left px-4 py-3 font-medium">Body</th>
                                        <th className="text-left px-4 py-3 font-medium">Segment</th>
                                        <th className="text-left px-4 py-3 font-medium">Deep Link</th>
                                        <th className="text-right px-4 py-3 font-medium">Sent</th>
                                        <th className="text-right px-4 py-3 font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/30">
                                    {history.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-700/20">
                                            <td className="px-4 py-3 text-white font-medium max-w-[200px] truncate">{r.title}</td>
                                            <td className="px-4 py-3 text-slate-400 max-w-[250px] truncate">{r.body}</td>
                                            <td className="px-4 py-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400">{r.segment || 'ALL'}</span></td>
                                            <td className="px-4 py-3 text-slate-500 font-mono text-[10px] max-w-[150px] truncate">{r.deepLink || '—'}</td>
                                            <td className="px-4 py-3 text-right"><span className="text-emerald-400 font-mono text-xs">{r.sentCount}</span></td>
                                            <td className="px-4 py-3 text-right text-slate-500 text-xs whitespace-nowrap">{new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
                                <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-40">Previous</button>
                                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-40">Next</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ─── Confirmation ─── */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2"><Bell size={18} className="text-amber-400" />Confirm Send</h3>
                        <div className="space-y-2 text-sm">
                            <p className="text-slate-300">Send to <span className="text-white font-semibold">{SEGMENT_OPTIONS.find(s => s.value === segment)?.label}</span>.</p>
                            <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 space-y-1">
                                <p className="text-white font-medium">{title}</p>
                                <p className="text-slate-400 text-xs">{body}</p>
                                {deepLink && <p className="text-indigo-400 font-mono text-[10px] mt-1">{deepLink}</p>}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 border border-slate-600 rounded-xl text-slate-300 hover:bg-slate-700 text-sm font-medium">Cancel</button>
                            <button onClick={handleSend} disabled={sending} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2">
                                {sending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                                {sending ? 'Sending...' : 'Send Now'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
