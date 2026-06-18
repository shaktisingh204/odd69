"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    Send, Filter, Clock, CheckCircle2, XCircle, AlertCircle, BarChart2,
    Loader2, RefreshCw, ChevronDown, Users, Zap, Plus, Trash2,
    Phone, SlidersHorizontal, Eye, RotateCcw, ChevronRight, ChevronUp
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Template { name: string; category: string; bodyText?: string; bodyParamCount?: number; hasHeader?: boolean }
interface CampaignLog {
    id: string; campaignName: string; templateName: string; segment: string;
    sentCount: number; failedCount: number; totalUsers: number; status: string;
    speedLimit: number; createdAt: string; failedPhones?: string[];
}

const SEGMENTS = [
    { value: "ALL",     label: "All Users",     desc: "All users with phone" },
    { value: "VIP",     label: "VIP",           desc: "Balance ≥ ₹1,00,000" },
    { value: "NEW",     label: "New Users",     desc: "Registered last 7d" },
    { value: "ACTIVE",  label: "Active",        desc: "Active last 7d" },
    { value: "CHURNED", label: "Churned",       desc: "Inactive 30+ days" },
    { value: "CUSTOM",  label: "Custom Phones", desc: "Manual phone list" },
];

const STATUS_COLOR: Record<string, string> = {
    COMPLETED: "text-green-400 bg-green-500/10",
    PARTIAL:   "text-yellow-400 bg-yellow-500/10",
    RUNNING:   "text-blue-400 bg-blue-500/10",
    PENDING:   "text-slate-400 bg-slate-700",
    FAILED:    "text-red-400 bg-red-500/10",
};

const USER_FIELDS = ["name", "balance", "phoneNumber"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhatsAppBulkCampaignPage() {
    // ── Form state ────────────────────────────────────────────────────────────
    const [campaignName,  setCampaignName]  = useState("");
    const [templateName,  setTemplateName]  = useState("");
    const [segment,       setSegment]       = useState("ALL");
    const [speedLimit,    setSpeedLimit]    = useState("60");
    const [minBalance,    setMinBalance]    = useState("");
    const [maxBalance,    setMaxBalance]    = useState("");
    const [startDate,     setStartDate]     = useState("");
    const [endDate,       setEndDate]       = useState("");
    const [customPhones,  setCustomPhones]  = useState(""); // newline-separated
    const [bodyParams,    setBodyParams]    = useState<string[]>([]);
    const [headerParam,   setHeaderParam]   = useState("");
    const [showAdvanced,  setShowAdvanced]  = useState(false);

    // ── Template sync ─────────────────────────────────────────────────────────
    const [templates,       setTemplates]       = useState<Template[]>([]);
    const [templateSyncing, setTemplateSyncing] = useState(false);
    const [templateSyncErr, setTemplateSyncErr] = useState("");
    const selectedTpl = templates.find(t => t.name === templateName);

    // ── Recipient preview ─────────────────────────────────────────────────────
    const [preview,        setPreview]        = useState<{ count: number; sample: any[] } | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    // ── Send state ────────────────────────────────────────────────────────────
    const [sending,    setSending]    = useState(false);
    const [sendResult, setSendResult] = useState<any>(null);
    const [sendError,  setSendError]  = useState("");
    const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ pct: number; sent: number; failed: number; total: number; status: string } | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── History ───────────────────────────────────────────────────────────────
    const [history,        setHistory]        = useState<CampaignLog[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [histPage,       setHistPage]       = useState(1);
    const [totalPages,     setTotalPages]     = useState(1);
    const [expandedId,     setExpandedId]     = useState<string | null>(null);

    // ─── Template sync ────────────────────────────────────────────────────────
    const syncTemplates = useCallback(async () => {
        setTemplateSyncing(true); setTemplateSyncErr("");
        try {
            const res = await fetch("/actions/whatsapp-templates?status=APPROVED");
            const d = await res.json();
            if (!d.success) { setTemplateSyncErr(d.error || "Sync failed"); return; }
            // Extract param count from body text
            const tpls: Template[] = d.templates.map((t: any) => {
                const bodyComp = t.components?.find((c: any) => c.type === "BODY");
                const headComp = t.components?.find((c: any) => c.type === "HEADER");
                const bodyText = bodyComp?.text || "";
                const matches  = bodyText.match(/\{\{(\d+)\}\}/g) || [];
                const maxIdx   = matches.length > 0
                    ? Math.max(...matches.map((m: string) => Number(m.replace(/\D/g, ""))))
                    : 0;
                return {
                    name:           t.name,
                    category:       t.category,
                    bodyText,
                    bodyParamCount: maxIdx,
                    hasHeader:      headComp?.format === "TEXT",
                };
            });
            setTemplates(tpls);
        } catch (e: any) { setTemplateSyncErr(e.message); }
        finally { setTemplateSyncing(false); }
    }, []);

    // ─── Recipient preview ────────────────────────────────────────────────────
    const loadPreview = useCallback(async () => {
        if (segment === "CUSTOM") { setPreview(null); return; }
        setPreviewLoading(true);
        try {
            const params = new URLSearchParams({ action: "preview", segment });
            if (minBalance) params.set("minBalance", minBalance);
            if (maxBalance) params.set("maxBalance", maxBalance);
            if (startDate)  params.set("startDate",  startDate);
            if (endDate)    params.set("endDate",     endDate);
            const res = await fetch(`/actions/whatsapp-campaigns?${params}`);
            const d = await res.json();
            if (d.success) setPreview({ count: d.count, sample: d.sample });
        } catch {} finally { setPreviewLoading(false); }
    }, [segment, minBalance, maxBalance, startDate, endDate]);

    useEffect(() => { loadPreview(); }, [loadPreview]);

    // ─── Sync body param slots when template changes ──────────────────────────
    useEffect(() => {
        if (!selectedTpl) return;
        const count = selectedTpl.bodyParamCount || 0;
        setBodyParams(prev => {
            const next = Array.from({ length: count }, (_, i) => prev[i] || "");
            return next;
        });
        if (!selectedTpl.hasHeader) setHeaderParam("");
    }, [templateName, selectedTpl]);

    // ─── Progress polling ─────────────────────────────────────────────────────
    const startPolling = useCallback((id: string) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/actions/whatsapp-campaigns?action=progress&id=${id}`);
                const d = await res.json();
                if (d.success) {
                    setProgress({ pct: d.pct, sent: d.sentCount, failed: d.failedCount, total: d.totalUsers, status: d.status });
                    if (["COMPLETED", "FAILED", "PARTIAL"].includes(d.status)) {
                        clearInterval(pollRef.current!);
                        setSending(false);
                        fetchHistory();
                    }
                }
            } catch {}
        }, 2000);
    }, []);

    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

    // ─── History ──────────────────────────────────────────────────────────────
    const fetchHistory = useCallback(async (p = 1) => {
        setHistoryLoading(true);
        try {
            const res = await fetch(`/actions/whatsapp-campaigns?page=${p}&limit=10`);
            const d = await res.json();
            if (d.success) { setHistory(d.records); setTotalPages(d.pagination.totalPages); }
        } finally { setHistoryLoading(false); }
    }, []);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // ─── Send campaign ────────────────────────────────────────────────────────
    const handleSend = async () => {
        setSendError(""); setSendResult(null);
        const speed = Number(speedLimit);
        if (!campaignName) return setSendError("Campaign name is required");
        if (!templateName)  return setSendError("Select a template first");
        if (!speed || speed < 1 || speed > 1000) return setSendError("Speed must be 1–1000 msg/min");
        if (segment === "CUSTOM" && !customPhones.trim()) return setSendError("Enter at least one phone number");

        setSending(true); setProgress(null);

        const phones = customPhones.split(/[\n,]+/).map(p => p.trim()).filter(Boolean);

        const payload: any = {
            campaignName, templateName, segment,
            speedLimit: speed,
            variables: { bodyParams, headerParam: headerParam || "" },
        };
        if (segment === "CUSTOM") payload.customPhones = phones;
        else {
            if (minBalance) payload.minBalance = Number(minBalance);
            if (maxBalance) payload.maxBalance = Number(maxBalance);
            if (startDate)  payload.startDate  = startDate;
            if (endDate)    payload.endDate     = endDate;
        }

        try {
            const res = await fetch("/actions/whatsapp-campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const d = await res.json();
            if (!d.success) { setSendError(d.error); setSending(false); return; }
            setActiveCampaignId(d.campaignId);
            setSendResult(d);
            startPolling(d.campaignId);
        } catch (e: any) { setSendError(e.message); setSending(false); }
    };

    // ─── Retry failed ─────────────────────────────────────────────────────────
    const handleRetry = async (log: CampaignLog) => {
        setSendError(""); setSendResult(null); setSending(true); setProgress(null);
        try {
            const res = await fetch("/actions/whatsapp-campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    campaignName: `${log.campaignName} [RETRY]`,
                    templateName: log.templateName,
                    segment: log.segment,
                    speedLimit:  log.speedLimit || 60,
                    retryLogId:  log.id,
                    variables: { bodyParams: [], headerParam: "" },
                }),
            });
            const d = await res.json();
            if (!d.success) { setSendError(d.error); setSending(false); return; }
            setActiveCampaignId(d.campaignId);
            setSendResult(d);
            startPolling(d.campaignId);
        } catch (e: any) { setSendError(e.message); setSending(false); }
    };

    // ─── Computed ─────────────────────────────────────────────────────────────
    const speedNum   = Number(speedLimit);
    const delayMs    = speedNum > 0 ? Math.ceil(60_000 / speedNum) : 0;
    const delayLabel = delayMs >= 1000 ? `${(delayMs / 1000).toFixed(1)}s` : `${delayMs}ms`;
    const previewStr = segment === "CUSTOM"
        ? `${customPhones.split(/[\n,]+/).filter(p => p.trim()).length} custom numbers`
        : preview
            ? `${preview.count.toLocaleString()} recipients`
            : previewLoading ? "Counting..." : "—";

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                    <Send className="text-green-500" size={20} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">WhatsApp Broadcast</h1>
                    <p className="text-sm text-slate-400">Advanced template broadcasting with live progress & variable mapping</p>
                </div>
                {/* Recipient chip */}
                <div className="ml-auto flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full">
                    {previewLoading ? <Loader2 size={12} className="animate-spin text-green-400" /> : <Users size={12} className="text-green-400" />}
                    <span className="text-xs text-white font-medium">{previewStr}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

                {/* ── Left: Compose ───────────────────────────────────────────────────── */}
                <div className="xl:col-span-2 space-y-4">
                    {/* Campaign name */}
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Filter size={12} /> Campaign Details</h2>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Campaign Name *</label>
                            <input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                                placeholder="e.g. Diwali Offer 2025"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500 transition-colors" />
                        </div>

                        {/* Template picker */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs text-slate-400">Template *</label>
                                <button onClick={syncTemplates} disabled={templateSyncing}
                                    className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 disabled:opacity-50">
                                    <RefreshCw size={10} className={templateSyncing ? "animate-spin" : ""} />
                                    {templateSyncing ? "Syncing…" : "Sync"}
                                </button>
                            </div>
                            <div className="relative">
                                <select value={templateName} onChange={e => setTemplateName(e.target.value)}
                                    disabled={templates.length === 0}
                                    className="w-full appearance-none bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:border-green-500 transition-colors disabled:opacity-40">
                                    <option value="">{templates.length === 0 ? "— sync first —" : "Select template…"}</option>
                                    {templates.map(t => (
                                        <option key={t.name} value={t.name}>{t.name}  [{t.category}]</option>
                                    ))}
                                </select>
                                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                            {templateSyncErr && <p className="text-xs text-red-400 mt-1">{templateSyncErr}</p>}
                            {templates.length > 0 && <p className="text-xs text-slate-500 mt-1">{templates.length} approved templates</p>}
                        </div>

                        {/* Body preview */}
                        {selectedTpl?.bodyText && (
                            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Eye size={9} /> Preview</p>
                                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{selectedTpl.bodyText}</p>
                            </div>
                        )}

                        {/* Template variables */}
                        {selectedTpl && (selectedTpl.bodyParamCount ?? 0) > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs text-slate-400 font-medium">Body Variables</p>
                                <p className="text-[10px] text-slate-500">Use <code className="text-green-400">{"{{name}}"}</code>&nbsp;<code className="text-green-400">{"{{balance}}"}</code>&nbsp;<code className="text-green-400">{"{{phoneNumber}}"}</code> for per-user values, or type static text.</p>
                                {Array.from({ length: selectedTpl.bodyParamCount ?? 0 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 w-8 flex-shrink-0">{`{{${i + 1}}}`}</span>
                                        <input
                                            value={bodyParams[i] || ""}
                                            onChange={e => setBodyParams(p => { const n = [...p]; n[i] = e.target.value; return n; })}
                                            placeholder={`Value for {{${i + 1}}}`}
                                            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500 transition-colors"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        {selectedTpl?.hasHeader && (
                            <div className="space-y-1">
                                <p className="text-xs text-slate-400 font-medium">Header Text</p>
                                <input value={headerParam} onChange={e => setHeaderParam(e.target.value)}
                                    placeholder="Header value or {{name}}"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500 transition-colors" />
                            </div>
                        )}
                    </div>

                    {/* Segment + targeting */}
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Users size={12} /> Target Audience</h2>
                        <div className="grid grid-cols-2 gap-2">
                            {SEGMENTS.map(s => (
                                <button key={s.value} onClick={() => setSegment(s.value)}
                                    className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${segment === s.value ? "border-green-500 bg-green-500/10 text-white" : "border-slate-600 bg-slate-900 text-slate-400 hover:border-slate-500"}`}>
                                    <div className="font-medium">{s.label}</div>
                                    <div className="text-slate-500">{s.desc}</div>
                                </button>
                            ))}
                        </div>

                        {/* Custom phones textarea */}
                        {segment === "CUSTOM" && (
                            <div>
                                <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1"><Phone size={10} /> Phone numbers (one per line, E.164 format)</label>
                                <textarea value={customPhones} onChange={e => setCustomPhones(e.target.value)}
                                    rows={5} placeholder={"+919876543210\n+919876543211"}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500 transition-colors resize-none font-mono" />
                                <p className="text-xs text-slate-500 mt-1">{customPhones.split(/[\n,]+/).filter(p => p.trim()).length} numbers</p>
                            </div>
                        )}

                        {/* Advanced filters toggle */}
                        {segment !== "CUSTOM" && (
                            <>
                                <button onClick={() => setShowAdvanced(!showAdvanced)}
                                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
                                    <SlidersHorizontal size={12} />
                                    Advanced Filters
                                    {showAdvanced ? <ChevronUp size={12} /> : <ChevronRight size={12} />}
                                </button>
                                {showAdvanced && (
                                    <div className="grid grid-cols-2 gap-3 bg-slate-900/40 p-3 rounded-lg border border-slate-700">
                                        {[
                                            { label: "Min Balance (₹)", val: minBalance, set: setMinBalance, ph: "0" },
                                            { label: "Max Balance (₹)", val: maxBalance, set: setMaxBalance, ph: "∞" },
                                        ].map(f => (
                                            <div key={f.label}>
                                                <label className="block text-[10px] text-slate-500 mb-1">{f.label}</label>
                                                <input type="number" value={f.val} onChange={e => f.set(e.target.value)}
                                                    placeholder={f.ph}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500 transition-colors" />
                                            </div>
                                        ))}
                                        {[
                                            { label: "Registered After",  val: startDate, set: setStartDate },
                                            { label: "Registered Before", val: endDate,   set: setEndDate },
                                        ].map(f => (
                                            <div key={f.label}>
                                                <label className="block text-[10px] text-slate-500 mb-1">{f.label}</label>
                                                <input type="date" value={f.val} onChange={e => f.set(e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-green-500 transition-colors" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Sample preview */}
                        {preview && preview.sample.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Sample recipients</p>
                                {preview.sample.map((u: any) => (
                                    <div key={u.id} className="flex items-center justify-between text-xs bg-slate-900 rounded-lg px-3 py-1.5">
                                        <span className="text-slate-300">{u.name || "Unknown"}</span>
                                        <span className="text-slate-500 font-mono">{u.phoneNumber}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Speed */}
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Zap size={12} /> Send Speed</h2>
                        <div>
                            <div className="flex items-center gap-2">
                                <input type="number" min={1} max={1000} value={speedLimit}
                                    onChange={e => setSpeedLimit(e.target.value)}
                                    className="w-24 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 transition-colors" />
                                <span className="text-xs text-slate-400">messages / minute</span>
                            </div>
                            {speedNum > 0 && (
                                <p className="text-xs text-slate-500 mt-1">
                                    1 msg every <span className="text-green-400 font-bold">{delayLabel}</span> · strictly enforced
                                </p>
                            )}
                        </div>

                        {/* Presets */}
                        <div className="flex gap-2 flex-wrap">
                            {[{ l: "Slow (20)", v: "20" }, { l: "Normal (60)", v: "60" }, { l: "Fast (300)", v: "300" }, { l: "Max (1000)", v: "1000" }].map(p => (
                                <button key={p.v} onClick={() => setSpeedLimit(p.v)}
                                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${speedLimit === p.v ? "border-green-500 bg-green-500/10 text-green-400" : "border-slate-600 text-slate-400 hover:border-slate-500"}`}>
                                    {p.l}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Send button + progress */}
                    <div className="space-y-3">
                        {sendError && (
                            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
                                <XCircle size={14} className="flex-shrink-0 mt-0.5" />{sendError}
                            </div>
                        )}

                        {/* Live progress bar */}
                        {progress && (
                            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className={`font-bold ${STATUS_COLOR[progress.status]?.split(" ")[0] || "text-white"}`}>{progress.status}</span>
                                    <span className="text-slate-400">{progress.sent + progress.failed} / {progress.total}</span>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                                    <div className="h-2 bg-green-500 rounded-full transition-all duration-500" style={{ width: `${progress.pct}%` }} />
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-500">
                                    <span className="text-green-400">{progress.sent} sent</span>
                                    <span className="text-slate-400">{progress.pct}%</span>
                                    <span className="text-red-400">{progress.failed} failed</span>
                                </div>
                            </div>
                        )}

                        <button onClick={handleSend} disabled={sending}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors">
                            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            {sending ? "Broadcasting…" : `Broadcast to ${previewStr}`}
                        </button>
                    </div>
                </div>

                {/* ── Right: History ───────────────────────────────────────────────────── */}
                <div className="xl:col-span-3 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2"><BarChart2 size={15} /> Campaign History</h2>
                        <button onClick={() => fetchHistory(histPage)} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                            <RefreshCw size={11} /> Refresh
                        </button>
                    </div>

                    {historyLoading ? (
                        <div className="flex items-center justify-center flex-1 h-48">
                            <Loader2 size={24} className="animate-spin text-green-500" />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-2">
                            <Send size={32} className="opacity-20" />
                            <p className="text-sm">No campaigns yet</p>
                        </div>
                    ) : (
                        <>
                            <div className="divide-y divide-slate-700/50 overflow-y-auto flex-1">
                                {history.map(c => {
                                    const isExpanded = expandedId === c.id;
                                    const successRate = c.totalUsers > 0
                                        ? Math.round((c.sentCount / c.totalUsers) * 100)
                                        : c.sentCount > 0 ? 100 : 0;
                                    const pctSent = (c.sentCount + c.failedCount) > 0
                                        ? Math.round(c.sentCount / (c.sentCount + c.failedCount) * 100)
                                        : 0;

                                    return (
                                        <div key={c.id}>
                                            <div className="p-4 flex items-start gap-3 hover:bg-slate-700/20 transition-colors">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-semibold text-white truncate">{c.campaignName}</p>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status] || "text-slate-400 bg-slate-700"}`}>
                                                            {c.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-0.5 font-mono">{c.templateName}</p>

                                                    {/* Mini progress bar */}
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                                            <div className="h-1.5 bg-green-500 rounded-full" style={{ width: `${pctSent}%` }} />
                                                        </div>
                                                        <span className="text-[10px] text-slate-500 flex-shrink-0">
                                                            {c.sentCount}<span className="text-slate-600">/{c.totalUsers || (c.sentCount + c.failedCount)}</span>
                                                            {c.failedCount > 0 && <span className="text-red-400 ml-1">({c.failedCount}✗)</span>}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                                                        <span>{c.segment}</span>
                                                        {c.speedLimit && <span><Zap size={9} className="inline" /> {c.speedLimit} msg/min</span>}
                                                        <span className="flex items-center gap-1"><Clock size={9} />{new Date(c.createdAt).toLocaleString()}</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-1 flex-shrink-0">
                                                    <button onClick={() => setExpandedId(isExpanded ? null : c.id)}
                                                        className="text-slate-500 hover:text-white text-[10px] flex items-center gap-1">
                                                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                    </button>
                                                    {(c.status === "FAILED" || c.status === "PARTIAL") && c.failedPhones && c.failedPhones.length > 0 && (
                                                        <button onClick={() => handleRetry(c)}
                                                            disabled={sending}
                                                            className="text-[10px] flex items-center gap-1 text-yellow-400 hover:text-yellow-300 disabled:opacity-40">
                                                            <RotateCcw size={11} /> Retry
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="px-4 pb-4 bg-slate-900/30 space-y-2 border-t border-slate-700/50">
                                                    <div className="grid grid-cols-3 gap-3 pt-3">
                                                        <div className="text-center">
                                                            <p className="text-lg font-bold text-green-400">{c.sentCount}</p>
                                                            <p className="text-[10px] text-slate-500">Delivered</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-lg font-bold text-red-400">{c.failedCount}</p>
                                                            <p className="text-[10px] text-slate-500">Failed</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-lg font-bold text-white">{successRate}%</p>
                                                            <p className="text-[10px] text-slate-500">Success Rate</p>
                                                        </div>
                                                    </div>
                                                    {c.failedPhones && c.failedPhones.length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] text-slate-500 mb-1">Failed phones ({c.failedPhones.length})</p>
                                                            <div className="bg-slate-900 rounded-lg p-2 max-h-24 overflow-y-auto">
                                                                {c.failedPhones.slice(0, 20).map(p => (
                                                                    <p key={p} className="text-xs font-mono text-red-400">{p}</p>
                                                                ))}
                                                                {c.failedPhones.length > 20 && <p className="text-xs text-slate-500">…+{c.failedPhones.length - 20} more</p>}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {totalPages > 1 && (
                                <div className="p-3 border-t border-slate-700 flex items-center justify-between">
                                    <button onClick={() => { const p = Math.max(1, histPage - 1); setHistPage(p); fetchHistory(p); }}
                                        disabled={histPage === 1}
                                        className="text-xs text-slate-400 disabled:opacity-40 hover:text-white px-3 py-1 bg-slate-700 rounded-lg">← Prev</button>
                                    <span className="text-xs text-slate-500">{histPage} / {totalPages}</span>
                                    <button onClick={() => { const p = Math.min(totalPages, histPage + 1); setHistPage(p); fetchHistory(p); }}
                                        disabled={histPage === totalPages}
                                        className="text-xs text-slate-400 disabled:opacity-40 hover:text-white px-3 py-1 bg-slate-700 rounded-lg">Next →</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
