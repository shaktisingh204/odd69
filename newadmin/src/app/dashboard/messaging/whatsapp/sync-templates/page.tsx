"use client";

import { useState, useCallback } from "react";
import {
    RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle,
    ChevronDown, ChevronUp, Copy, Filter, Loader2, BookOpen, Wifi
} from "lucide-react";

interface TemplateComponent {
    type: string;
    text?: string;
    format?: string;
    buttons?: any[];
}

interface Template {
    id: string;
    name: string;
    status: "APPROVED" | "REJECTED" | "PENDING" | "PAUSED";
    category: string;
    language: string;
    qualityScore: string;
    rejectedReason: string | null;
    components: TemplateComponent[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    APPROVED: { label: "Approved",  color: "text-green-400 bg-green-500/10 border-green-500/20",  icon: CheckCircle2 },
    REJECTED: { label: "Rejected",  color: "text-red-400 bg-red-500/10 border-red-500/20",        icon: XCircle },
    PENDING:  { label: "Pending",   color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: Clock },
    PAUSED:   { label: "Paused",    color: "text-gray-400 bg-gray-500/10 border-gray-500/20",     icon: AlertTriangle },
};

const QUALITY_COLOR: Record<string, string> = {
    GREEN:   "text-green-400",
    YELLOW:  "text-yellow-400",
    RED:     "text-red-400",
    UNKNOWN: "text-slate-500",
};

const CATEGORY_COLOR: Record<string, string> = {
    MARKETING:       "bg-blue-500/10 text-blue-400",
    UTILITY:         "bg-purple-500/10 text-purple-400",
    AUTHENTICATION:  "bg-orange-500/10 text-orange-400",
};

const STATUS_FILTERS = ["ALL", "APPROVED", "PENDING", "REJECTED", "PAUSED"] as const;

export default function WhatsAppTemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchedAt, setFetchedAt] = useState<string | null>(null);
    const [wabaId, setWabaId] = useState("");
    const [error, setError] = useState("");
    const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>("ALL");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const syncTemplates = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const url = statusFilter !== "ALL"
                ? `/actions/whatsapp-templates?status=${statusFilter}`
                : "/actions/whatsapp-templates";
            const res = await fetch(url);
            const d = await res.json();
            if (!d.success) { setError(d.error || "Failed to sync templates"); return; }
            setTemplates(d.templates);
            setFetchedAt(d.fetchedAt);
            setWabaId(d.wabaId || "");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    const copyName = (name: string) => {
        navigator.clipboard.writeText(name);
        setCopied(name);
        setTimeout(() => setCopied(null), 2000);
    };

    const filtered = statusFilter === "ALL"
        ? templates
        : templates.filter(t => t.status === statusFilter);

    const counts = {
        APPROVED: templates.filter(t => t.status === "APPROVED").length,
        REJECTED: templates.filter(t => t.status === "REJECTED").length,
        PENDING:  templates.filter(t => t.status === "PENDING").length,
        PAUSED:   templates.filter(t => t.status === "PAUSED").length,
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                        <BookOpen className="text-green-500" size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">WhatsApp Templates</h1>
                        <p className="text-sm text-slate-400">Sync & browse your Meta-approved message templates</p>
                    </div>
                </div>
                <button
                    onClick={syncTemplates}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    {loading
                        ? <Loader2 size={16} className="animate-spin" />
                        : <RefreshCw size={16} />
                    }
                    {loading ? "Syncing..." : "Sync from Meta"}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                    <XCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-red-400 font-medium">Sync Failed</p>
                        <p className="text-xs text-red-300/80 mt-0.5">{error}</p>
                        <p className="text-xs text-slate-500 mt-1">Make sure your Access Token and WABA ID are saved in <span className="text-slate-400">WhatsApp Account Setup</span>.</p>
                    </div>
                </div>
            )}

            {/* Stats row */}
            {templates.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(Object.entries(counts) as [string, number][]).map(([status, count]) => {
                        const cfg = STATUS_CONFIG[status];
                        const Icon = cfg.icon;
                        return (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status === statusFilter ? "ALL" : status as any)}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${statusFilter === status ? cfg.color + " border" : "bg-slate-800 border-slate-700 hover:border-slate-600"}`}
                            >
                                <Icon size={16} className={statusFilter === status ? "" : "text-slate-400"} />
                                <div>
                                    <p className={`text-lg font-bold leading-none ${statusFilter === status ? "" : "text-white"}`}>{count}</p>
                                    <p className={`text-xs mt-0.5 ${statusFilter === status ? "opacity-80" : "text-slate-500"}`}>{cfg.label}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Meta info bar */}
            {fetchedAt && (
                <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-800/50 px-4 py-2.5 rounded-lg border border-slate-700">
                    <div className="flex items-center gap-2">
                        <Wifi size={12} className="text-green-400" />
                        <span>WABA: <span className="text-slate-400 font-mono">{wabaId}</span></span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span>Total: <span className="text-white font-medium">{templates.length}</span></span>
                        <span>Last synced: <span className="text-slate-400">{new Date(fetchedAt).toLocaleTimeString()}</span></span>
                    </div>
                </div>
            )}

            {/* Filter pills */}
            {templates.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <Filter size={13} className="text-slate-500" />
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f}
                            onClick={() => setStatusFilter(f)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${statusFilter === f ? "bg-green-600 text-white" : "bg-slate-700 text-slate-400 hover:text-white"}`}
                        >
                            {f === "ALL" ? `All (${templates.length})` : `${f} (${counts[f as keyof typeof counts] ?? 0})`}
                        </button>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {!loading && templates.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-4">
                    <BookOpen size={48} className="opacity-20" />
                    <div className="text-center">
                        <p className="text-base font-medium text-white">No templates loaded</p>
                        <p className="text-sm text-slate-400 mt-1">Click <span className="text-green-400 font-medium">Sync from Meta</span> to fetch your approved templates.</p>
                    </div>
                </div>
            )}

            {/* Template Cards */}
            {filtered.length > 0 && (
                <div className="space-y-3">
                    {filtered.map(t => {
                        const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG["PENDING"];
                        const Icon = cfg.icon;
                        const isExpanded = expandedId === t.id;
                        const body = t.components.find(c => c.type === "BODY");
                        const header = t.components.find(c => c.type === "HEADER");
                        const footer = t.components.find(c => c.type === "FOOTER");
                        const buttons = t.components.find(c => c.type === "BUTTONS");

                        return (
                            <div key={t.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                                {/* Card Header */}
                                <div className="p-4 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                                            <Icon size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-sm font-bold text-white truncate">{t.name}</span>
                                                <button
                                                    onClick={() => copyName(t.name)}
                                                    className="text-slate-500 hover:text-green-400 transition-colors flex-shrink-0"
                                                    title="Copy template name"
                                                >
                                                    {copied === t.name
                                                        ? <CheckCircle2 size={13} className="text-green-400" />
                                                        : <Copy size={13} />
                                                    }
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>{t.status}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${CATEGORY_COLOR[t.category] || "bg-slate-700 text-slate-400"}`}>{t.category}</span>
                                                <span className="text-[10px] text-slate-500">{t.language}</span>
                                                <span className={`text-[10px] font-medium ${QUALITY_COLOR[t.qualityScore]}`}>
                                                    ● {t.qualityScore} quality
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : t.id)}
                                        className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                                    >
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                </div>

                                {/* Body preview (always shown) */}
                                {body?.text && (
                                    <div className="px-4 pb-3">
                                        <p className="text-xs text-slate-400 line-clamp-2">{body.text}</p>
                                    </div>
                                )}

                                {/* Rejected reason */}
                                {t.status === "REJECTED" && t.rejectedReason && (
                                    <div className="mx-4 mb-3 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                                        <p className="text-xs text-red-400 font-medium">Rejected: {t.rejectedReason}</p>
                                    </div>
                                )}

                                {/* Expanded components */}
                                {isExpanded && (
                                    <div className="border-t border-slate-700 p-4 space-y-3 bg-slate-900/40">
                                        {header && (
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Header — {header.format}</p>
                                                {header.text && <p className="text-sm text-white font-medium">{header.text}</p>}
                                                {header.format && header.format !== "TEXT" && (
                                                    <p className="text-xs text-slate-500">[{header.format} media]</p>
                                                )}
                                            </div>
                                        )}
                                        {body?.text && (
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Body</p>
                                                <p className="text-sm text-slate-300 whitespace-pre-wrap">{body.text}</p>
                                            </div>
                                        )}
                                        {footer?.text && (
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Footer</p>
                                                <p className="text-xs text-slate-500 italic">{footer.text}</p>
                                            </div>
                                        )}
                                        {buttons?.buttons && buttons.buttons.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Buttons</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {buttons.buttons.map((b: any, i: number) => (
                                                        <span key={i} className="text-xs px-3 py-1 bg-slate-700 text-slate-300 rounded-lg border border-slate-600">
                                                            {b.text} {b.type === "URL" ? "↗" : b.type === "PHONE_NUMBER" ? "📞" : ""}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Use in campaign — tip */}
                                        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 flex items-center gap-3">
                                            <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
                                            <p className="text-xs text-green-300">
                                                Use <span className="font-mono font-bold">{t.name}</span> as the template name in Bulk Campaigns
                                                {t.status !== "APPROVED" && <span className="text-yellow-400"> (only APPROVED templates can be sent)</span>}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
