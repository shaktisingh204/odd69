"use client";

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
    AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
    Eye, EyeOff, GripVertical, Image as ImageIcon,
    Layers, Monitor, Plus, Save, Settings, Smartphone,
    Trash2, X, LayoutDashboard, Gamepad2, Trophy,
    Loader2, ToggleLeft, ToggleRight, Play, Square,
} from "lucide-react";
import {
    getAllPageSliders, upsertPageSlider, toggleSliderActive,
    toggleSlide, deleteSlide,
} from "@/actions/sliders";

// ─── Types ─────────────────────────────────────────────────────────────────────
type PageKey = "HOME" | "CASINO" | "SPORTS";

interface Slide {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    badge: string;
    tag: string;
    imageUrl: string;
    mobileImageUrl: string;
    charImage: string;
    gradient: string;
    overlayOpacity: number;
    overlayGradient: string;
    textColor: string;
    textAlign: "left" | "center" | "right";
    ctaText: string;
    ctaLink: string;
    ctaStyle: string;
    gameCode: string;
    gameProvider: string;
    ctaSecondaryText: string;
    ctaSecondaryLink: string;
    isActive: boolean;
    order: number;
}

interface SliderConfig {
    _id?: string;
    page: PageKey;
    isActive: boolean;
    heightDesktop: number;
    heightMobile: number;
    autoplay: boolean;
    autoplayInterval: number;
    transitionEffect: "fade" | "slide";
    borderRadius: number;
    slides: Slide[];
}

// ─── Default template ──────────────────────────────────────────────────────────
const PAGE_META: Record<PageKey, { label: string; icon: React.ReactNode; color: string; description: string }> = {
    HOME: {
        label: "Home Page",
        icon: <LayoutDashboard size={16} />,
        color: "#e5a100",
        description: "Hero slider shown on the main landing page",
    },
    CASINO: {
        label: "Casino Page",
        icon: <Gamepad2 size={16} />,
        color: "#8b5cf6",
        description: "Hero banner shown at the top of the Casino lobby",
    },
    SPORTS: {
        label: "Sports Page",
        icon: <Trophy size={16} />,
        color: "#10b981",
        description: "Hero slider shown on the Sports betting page",
    },
};

const DEFAULT_SLIDE = (): Slide => ({
    id: `slide_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: "New Slide Title",
    subtitle: "Subtitle text here",
    description: "",
    badge: "",
    tag: "",
    imageUrl: "",
    mobileImageUrl: "",
    charImage: "",
    gradient: "linear-gradient(135deg, #1a0f05 0%, #2d1a0a 100%)",
    overlayOpacity: 40,
    overlayGradient: "",
    textColor: "#ffffff",
    textAlign: "left",
    ctaText: "Play Now",
    ctaLink: "/",
    ctaStyle: "gold",
    gameCode: "",
    gameProvider: "",
    ctaSecondaryText: "",
    ctaSecondaryLink: "",
    isActive: true,
    order: 0,
});

const DEFAULT_CONFIG = (page: PageKey): SliderConfig => ({
    page,
    isActive: true,
    heightDesktop: 460,
    heightMobile: 220,
    autoplay: true,
    autoplayInterval: 5000,
    transitionEffect: "fade",
    borderRadius: 16,
    slides: [],
});

// ─── Mini helper components ────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
    return <label className="block text-xs font-semibold text-[#a89070] mb-1">{children}</label>;
}

function Input({
    value, onChange, placeholder = "", type = "text", min, max, className = "",
}: {
    value: string | number; onChange: (v: string) => void;
    placeholder?: string; type?: string; min?: number; max?: number; className?: string;
}) {
    return (
        <input
            type={type}
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full bg-[#1a1208] border border-[#3a2a10] rounded-lg px-3 py-2 text-sm text-white placeholder-[#6b5535] focus:outline-none focus:border-[#e5a100]/50 transition ${className}`}
        />
    );
}

function Textarea({ value, onChange, placeholder = "", rows = 3 }: {
    value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
    return (
        <textarea
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-[#1a1208] border border-[#3a2a10] rounded-lg px-3 py-2 text-sm text-white placeholder-[#6b5535] focus:outline-none focus:border-[#e5a100]/50 transition resize-none"
        />
    );
}

function Toggle({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id?: string }) {
    return (
        <button
            id={id}
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-[#e5a100]" : "bg-[#2d2010]"}`}
        >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
    );
}

function Select({ value, onChange, options, className = "" }: {
    value: string; onChange: (v: string) => void;
    options: { label: string; value: string }[]; className?: string;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full bg-[#1a1208] border border-[#3a2a10] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#e5a100]/50 transition ${className}`}
        >
            {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    );
}

// ─── Slide Card ────────────────────────────────────────────────────────────────
function SlideCard({
    slide, index, total, pageKey,
    onChange, onDelete, onToggle, onMoveUp, onMoveDown,
}: {
    slide: Slide;
    index: number;
    total: number;
    pageKey: PageKey;
    onChange: (s: Slide) => void;
    onDelete: () => void;
    onToggle: (v: boolean) => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const set = (key: keyof Slide, v: any) => onChange({ ...slide, [key]: v });

    return (
        <div className={`bg-[#0e0a04] border rounded-xl overflow-hidden transition-all ${slide.isActive ? "border-[#3a2a10]" : "border-[#2a1a08] opacity-60"}`}>
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3">
                <GripVertical size={14} className="text-[#6b5535] shrink-0" />
                <span className="text-xs font-semibold text-[#6b5535] w-5">{index + 1}</span>

                {slide.imageUrl ? (
                    <div className="w-10 h-7 rounded bg-[#1a1208] border border-[#3a2a10] overflow-hidden shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as any).style.display = 'none'; }} />
                    </div>
                ) : (
                    <div className="w-10 h-7 rounded bg-[#1a1208] border border-[#3a2a10] flex items-center justify-center shrink-0">
                        <ImageIcon size={12} className="text-[#6b5535]" />
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{slide.title || "Untitled Slide"}</p>
                    <p className="text-[11px] text-[#6b5535] truncate">{slide.subtitle || "—"}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => onMoveUp()} disabled={index === 0} className="p-1 rounded hover:bg-[#1a1208] text-[#6b5535] hover:text-white disabled:opacity-30 transition">
                        <ChevronUp size={14} />
                    </button>
                    <button type="button" onClick={() => onMoveDown()} disabled={index === total - 1} className="p-1 rounded hover:bg-[#1a1208] text-[#6b5535] hover:text-white disabled:opacity-30 transition">
                        <ChevronDown size={14} />
                    </button>
                    <Toggle checked={slide.isActive} onChange={onToggle} />
                    <button type="button" onClick={() => setExpanded((v) => !v)} className="p-1 rounded hover:bg-[#1a1208] text-[#6b5535] hover:text-white transition">
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button type="button" onClick={onDelete} className="p-1 rounded hover:bg-red-500/20 text-[#6b5535] hover:text-red-400 transition">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Expanded editor */}
            {expanded && (
                <div className="border-t border-[#2a1a08] px-4 py-4 space-y-4">

                    {/* ── Row 1: Badge + Tag + Alignment ── */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <Label>Badge Pill (eyebrow)</Label>
                            <Input value={slide.badge} onChange={(v) => set("badge", v)} placeholder="🔥 NEW" />
                        </div>
                        <div>
                            <Label>Tag Pill (gold, above title)</Label>
                            <Input value={(slide as any).tag || ""} onChange={(v) => set("tag" as any, v)} placeholder="WELCOME BONUS" />
                        </div>
                        <div>
                            <Label>Text Alignment</Label>
                            <Select value={slide.textAlign} onChange={(v) => set("textAlign", v as any)}
                                options={[{ label: "Left", value: "left" }, { label: "Center", value: "center" }, { label: "Right", value: "right" }]} />
                        </div>
                    </div>

                    {/* ── Content ── */}
                    <div>
                        <Label>Title</Label>
                        <Input value={slide.title} onChange={(v) => set("title", v)} placeholder="Big Bold Headline" />
                    </div>
                    <div>
                        <Label>Subtitle</Label>
                        <Input value={slide.subtitle} onChange={(v) => set("subtitle", v)} placeholder="Supporting subheadline" />
                    </div>
                    <div>
                        <Label>Description (optional)</Label>
                        <Textarea value={slide.description} onChange={(v) => set("description", v)} placeholder="Short paragraph text..." rows={2} />
                    </div>

                    {/* ── Media ── */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Desktop Image URL</Label>
                            <Input value={slide.imageUrl} onChange={(v) => set("imageUrl", v)} placeholder="https://..." />
                        </div>
                        <div>
                            <Label>Mobile Image URL</Label>
                            <Input value={slide.mobileImageUrl} onChange={(v) => set("mobileImageUrl", v)} placeholder="https://... (optional)" />
                        </div>
                    </div>

                    {/* Character image — displayed on the right side (like PromoCard) */}
                    <div>
                        <Label>Character / Mascot Image URL (right side)</Label>
                        <Input value={(slide as any).charImage || ""} onChange={(v) => set("charImage" as any, v)} placeholder="https://... PNG with transparent bg recommended" />
                        <p className="text-[10px] text-[#6b5535] mt-1">Pinned to the bottom-right corner. Use a PNG with transparent background for best results.</p>
                    </div>

                    {/* ── Style ── */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Base Gradient (CSS)</Label>
                            <Input value={slide.gradient} onChange={(v) => set("gradient", v)} placeholder="linear-gradient(135deg, #000, #333)" />
                        </div>
                        <div>
                            <Label>Text Readability Overlay (optional)</Label>
                            <Input value={(slide as any).overlayGradient || ""} onChange={(v) => set("overlayGradient" as any, v)} placeholder="linear-gradient(90deg, rgba(0,0,0,0.8) 0%, transparent 70%)" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Text Color</Label>
                            <div className="flex gap-2">
                                <input type="color" value={slide.textColor} onChange={(e) => set("textColor", e.target.value)}
                                    className="w-10 h-9 rounded bg-transparent border border-[#3a2a10] cursor-pointer" />
                                <Input value={slide.textColor} onChange={(v) => set("textColor", v)} placeholder="#ffffff" />
                            </div>
                        </div>
                        <div>
                            <Label>Dark Overlay Opacity: {slide.overlayOpacity}%</Label>
                            <input type="range" min={0} max={100} value={slide.overlayOpacity}
                                onChange={(e) => set("overlayOpacity", Number(e.target.value))}
                                className="w-full accent-[#e5a100] mt-2" />
                        </div>
                    </div>

                    {/* ── CTA ── */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Primary CTA Text</Label>
                            <Input value={slide.ctaText} onChange={(v) => set("ctaText", v)} placeholder="Play Now" />
                        </div>
                        <div>
                            <Label>CTA Button Style</Label>
                            <Select value={slide.ctaStyle} onChange={(v) => set("ctaStyle", v)}
                                options={[
                                    { label: "Gold (primary)", value: "gold" },
                                    { label: "White outline", value: "outline" },
                                    { label: "Transparent", value: "ghost" },
                                    { label: "Red/Danger", value: "danger" },
                                    { label: "Green/Success", value: "success" },
                                ]} />
                        </div>
                    </div>

                    {/* Game launch OR regular link */}
                    <div className="p-3 bg-[#1a1208] rounded-xl border border-[#3a2a10] space-y-3">
                        <p className="text-[11px] font-bold text-[#a89070]">🎰 Casino Game Launch (overrides CTA link if set)</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Game Code</Label>
                                <Input value={(slide as any).gameCode || ""} onChange={(v) => set("gameCode" as any, v)} placeholder="e.g. aviator" />
                            </div>
                            <div>
                                <Label>Provider Code</Label>
                                <Input value={(slide as any).gameProvider || ""} onChange={(v) => set("gameProvider" as any, v)} placeholder="e.g. spribe" />
                            </div>
                        </div>
                        <p className="text-[10px] text-[#6b5535]">Leave blank to use the regular CTA link below.</p>
                        <div>
                            <Label>CTA Link (used when no game code)</Label>
                            <Input value={slide.ctaLink} onChange={(v) => set("ctaLink", v)} placeholder="/" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Secondary CTA Text</Label>
                            <Input value={slide.ctaSecondaryText} onChange={(v) => set("ctaSecondaryText", v)} placeholder="Learn More" />
                        </div>
                        <div>
                            <Label>Secondary CTA Link</Label>
                            <Input value={slide.ctaSecondaryLink} onChange={(v) => set("ctaSecondaryLink", v)} placeholder="/promotions" />
                        </div>
                    </div>

                    {/* Live preview */}
                    <div>
                        <Label>Slide Preview</Label>
                        <div
                            className="relative w-full rounded-xl overflow-hidden"
                            style={{
                                height: 140,
                                background: slide.gradient || "#111",
                                borderRadius: 12,
                            }}
                        >
                            {slide.imageUrl && (
                                <img src={slide.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            )}
                            {/* overlay */}
                            {slide.overlayOpacity > 0 && (
                                <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${slide.overlayOpacity / 100})` }} />
                            )}
                            {(slide as any).overlayGradient && (
                                <div className="absolute inset-0" style={{ background: (slide as any).overlayGradient }} />
                            )}
                            {/* char image */}
                            {(slide as any).charImage && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={(slide as any).charImage} alt="" className="absolute right-0 bottom-0 h-full object-contain object-right-bottom" />
                            )}
                            <div className={`relative z-10 px-4 w-full h-full flex flex-col justify-center ${slide.textAlign === "center" ? "text-center items-center" : slide.textAlign === "right" ? "text-right items-end" : "text-left items-start"}`}
                                style={{ color: slide.textColor }}>
                                {(slide as any).tag && <span className="inline-block py-0.5 px-2 rounded-full bg-[#e5a100]/90 text-black text-[8px] font-black uppercase mb-1">{(slide as any).tag}</span>}
                                {slide.badge && <span className="inline-block bg-white/20 text-[8px] font-black px-2 py-0.5 rounded mb-1">{slide.badge}</span>}
                                <p className="font-black text-sm leading-tight">{slide.title || "Title"}</p>
                                <p className="text-[10px] opacity-70 mt-0.5">{slide.subtitle || ""}</p>
                                {slide.ctaText && (
                                    <span className="inline-block mt-1.5 text-[9px] font-black bg-[#e5a100] text-black px-3 py-1 rounded-lg">{slide.ctaText}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


// ─── Slider Settings Panel ─────────────────────────────────────────────────────

function SliderSettingsPanel({ config, onChange }: { config: SliderConfig; onChange: (c: SliderConfig) => void }) {
    const set = (key: keyof SliderConfig, v: any) => onChange({ ...config, [key]: v });

    return (
        <div className="bg-[#0e0a04] border border-[#2a1a08] rounded-xl p-4 space-y-4">
            <h4 className="text-sm font-bold text-[#a89070] flex items-center gap-2">
                <Settings size={14} /> Slider Settings
            </h4>

            {/* Heights */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Desktop Height (px)</Label>
                    <div className="flex items-center gap-2">
                        <Input type="number" value={config.heightDesktop} onChange={(v) => set("heightDesktop", Number(v))} min={100} max={900} className="w-full" />
                        <Monitor size={14} className="text-[#6b5535] shrink-0" />
                    </div>
                    <input type="range" min={100} max={900} step={10} value={config.heightDesktop}
                        onChange={(e) => set("heightDesktop", Number(e.target.value))}
                        className="w-full mt-1 accent-[#e5a100]" />
                    <p className="text-[10px] text-[#6b5535] mt-0.5">{config.heightDesktop}px — desktop</p>
                </div>
                <div>
                    <Label>Mobile Height (px)</Label>
                    <div className="flex items-center gap-2">
                        <Input type="number" value={config.heightMobile} onChange={(v) => set("heightMobile", Number(v))} min={80} max={600} className="w-full" />
                        <Smartphone size={14} className="text-[#6b5535] shrink-0" />
                    </div>
                    <input type="range" min={80} max={600} step={5} value={config.heightMobile}
                        onChange={(e) => set("heightMobile", Number(e.target.value))}
                        className="w-full mt-1 accent-[#e5a100]" />
                    <p className="text-[10px] text-[#6b5535] mt-0.5">{config.heightMobile}px — mobile</p>
                </div>
            </div>

            {/* Border radius */}
            <div>
                <Label>Border Radius (px): {config.borderRadius}px</Label>
                <input type="range" min={0} max={32} value={config.borderRadius}
                    onChange={(e) => set("borderRadius", Number(e.target.value))}
                    className="w-full accent-[#e5a100]" />
            </div>

            {/* Transition & autoplay */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Transition Effect</Label>
                    <Select value={config.transitionEffect} onChange={(v) => set("transitionEffect", v as any)}
                        options={[{ label: "Fade", value: "fade" }, { label: "Slide", value: "slide" }]} />
                </div>
                <div>
                    <Label>Autoplay Interval (ms)</Label>
                    <Input type="number" value={config.autoplayInterval} onChange={(v) => set("autoplayInterval", Number(v))} min={1000} max={15000} />
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Toggle checked={config.autoplay} onChange={(v) => set("autoplay", v)} />
                <span className="text-sm text-white/70">Autoplay enabled</span>
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SliderManagementPage() {
    const [activeTab, setActiveTab] = useState<PageKey>("HOME");
    const [configs, setConfigs] = useState<Record<PageKey, SliderConfig>>({
        HOME: DEFAULT_CONFIG("HOME"),
        CASINO: DEFAULT_CONFIG("CASINO"),
        SPORTS: DEFAULT_CONFIG("SPORTS"),
    });
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    const [previewIdx, setPreviewIdx] = useState(0);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = useCallback((type: "success" | "error", msg: string) => {
        setToast({ type, msg });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 3500);
    }, []);

    // Load all 3 configs on mount
    useEffect(() => {
        getAllPageSliders().then(({ data }) => {
            if (data && data.length > 0) {
                const map: Record<PageKey, SliderConfig> = {
                    HOME: DEFAULT_CONFIG("HOME"),
                    CASINO: DEFAULT_CONFIG("CASINO"),
                    SPORTS: DEFAULT_CONFIG("SPORTS"),
                };
                data.forEach((d: any) => {
                    if (d.page && map[d.page as PageKey]) {
                        map[d.page as PageKey] = { ...DEFAULT_CONFIG(d.page), ...d };
                    }
                });
                setConfigs(map);
            }
            setLoading(false);
        });
    }, []);

    const cfg = configs[activeTab];

    const updateConfig = (newCfg: SliderConfig) => {
        setConfigs((prev) => ({ ...prev, [activeTab]: newCfg }));
    };

    const addSlide = () => {
        const slide = DEFAULT_SLIDE();
        slide.order = cfg.slides.length;
        updateConfig({ ...cfg, slides: [...cfg.slides, slide] });
    };

    const updateSlide = (idx: number, slide: Slide) => {
        const slides = [...cfg.slides];
        slides[idx] = slide;
        updateConfig({ ...cfg, slides });
    };

    const deleteSlideLocal = (idx: number) => {
        const slides = cfg.slides.filter((_, i) => i !== idx);
        updateConfig({ ...cfg, slides });
        // Also persist immediately
        if (cfg.slides[idx]?.id) {
            deleteSlide(activeTab, cfg.slides[idx].id).catch(console.error);
        }
    };

    const toggleSlideLocal = (idx: number, v: boolean) => {
        const slides = [...cfg.slides];
        slides[idx] = { ...slides[idx], isActive: v };
        updateConfig({ ...cfg, slides });
        if (slides[idx]?.id) {
            toggleSlide(activeTab, slides[idx].id, v).catch(console.error);
        }
    };

    const moveSlide = (idx: number, dir: "up" | "down") => {
        const slides = [...cfg.slides];
        const target = dir === "up" ? idx - 1 : idx + 1;
        if (target < 0 || target >= slides.length) return;
        [slides[idx], slides[target]] = [slides[target], slides[idx]];
        updateConfig({ ...cfg, slides });
    };

    const handleSave = () => {
        startTransition(async () => {
            const result = await upsertPageSlider({
                page: cfg.page,
                isActive: cfg.isActive,
                heightDesktop: cfg.heightDesktop,
                heightMobile: cfg.heightMobile,
                autoplay: cfg.autoplay,
                autoplayInterval: cfg.autoplayInterval,
                transitionEffect: cfg.transitionEffect,
                borderRadius: cfg.borderRadius,
                slides: cfg.slides,
            });
            if (result.success) {
                showToast("success", `${PAGE_META[activeTab].label} slider saved!`);
            } else {
                showToast("error", result.error || "Failed to save");
            }
        });
    };

    const handleToggleActive = () => {
        const next = !cfg.isActive;
        updateConfig({ ...cfg, isActive: next });
        startTransition(async () => {
            await toggleSliderActive(activeTab, next);
            showToast("success", `Slider ${next ? "enabled" : "disabled"}`);
        });
    };

    // Preview auto-rotate
    useEffect(() => {
        if (!cfg.autoplay || cfg.slides.length < 2) return;
        const t = setInterval(() => setPreviewIdx((i) => (i + 1) % cfg.slides.filter(s => s.isActive).length), 3000);
        return () => clearInterval(t);
    }, [cfg, activeTab]);

    const activeSlides = cfg.slides.filter((s) => s.isActive);
    const currentPreview = activeSlides[previewIdx % Math.max(1, activeSlides.length)];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 size={28} className="animate-spin text-[#e5a100]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0b0800] p-4 md:p-6 font-[system-ui]">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl border transition-all ${toast.type === "success" ? "bg-emerald-900/90 border-emerald-600/50 text-emerald-200" : "bg-red-900/90 border-red-600/50 text-red-200"}`}>
                    {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {toast.msg}
                    <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-black text-white flex items-center gap-2">
                        <Layers size={20} className="text-[#e5a100]" />
                        Page Slider Manager
                    </h1>
                    <p className="text-sm text-[#6b5535] mt-0.5">Control hero sliders for Home, Casino &amp; Sports pages</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleToggleActive}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition border ${cfg.isActive ? "bg-emerald-900/40 border-emerald-600/30 text-emerald-400 hover:bg-emerald-900/60" : "bg-[#1a1208] border-[#3a2a10] text-[#6b5535] hover:text-white"}`}
                    >
                        {cfg.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                        {cfg.isActive ? "Active" : "Inactive"}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isPending}
                        className="flex items-center gap-2 bg-[#e5a100] hover:bg-[#f5b800] text-black font-black text-sm px-4 py-2 rounded-xl transition disabled:opacity-50"
                    >
                        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Page Tab Selector */}
            <div className="flex gap-2 mb-6 bg-[#0e0a04] border border-[#2a1a08] rounded-xl p-1">
                {(["HOME", "CASINO", "SPORTS"] as PageKey[]).map((p) => {
                    const meta = PAGE_META[p];
                    const isSelected = activeTab === p;
                    return (
                        <button
                            key={p}
                            type="button"
                            onClick={() => { setActiveTab(p); setPreviewIdx(0); }}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition ${isSelected ? "bg-[#1e1408] text-white border border-[#3a2a10]" : "text-[#6b5535] hover:text-white"}`}
                        >
                            <span style={{ color: isSelected ? meta.color : undefined }}>{meta.icon}</span>
                            <span>{meta.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? "bg-[#2a1a08] text-[#a89070]" : "bg-transparent text-[#6b5535]"}`}>
                                {configs[p].slides.length}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
                {/* Left: Editor */}
                <div className="space-y-4">
                    {/* Slider settings */}
                    <SliderSettingsPanel config={cfg} onChange={updateConfig} />

                    {/* Slides list */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <ImageIcon size={14} className="text-[#e5a100]" />
                                Slides ({cfg.slides.length})
                                <span className="text-[10px] text-[#6b5535]">— {activeSlides.length} active</span>
                            </h3>
                            <button
                                type="button"
                                onClick={addSlide}
                                className="flex items-center gap-1.5 bg-[#e5a100]/10 hover:bg-[#e5a100]/20 border border-[#e5a100]/20 text-[#e5a100] text-xs font-bold px-3 py-1.5 rounded-lg transition"
                            >
                                <Plus size={13} /> Add Slide
                            </button>
                        </div>

                        {cfg.slides.length === 0 ? (
                            <div className="flex flex-col items-center justify-center bg-[#0e0a04] border border-dashed border-[#2a1a08] rounded-xl py-12 text-[#6b5535]">
                                <ImageIcon size={28} className="mb-3 opacity-40" />
                                <p className="text-sm font-semibold">No slides yet</p>
                                <p className="text-xs mt-1">Click "Add Slide" to create the first one</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {cfg.slides.map((slide, idx) => (
                                    <SlideCard
                                        key={slide.id}
                                        slide={slide}
                                        index={idx}
                                        total={cfg.slides.length}
                                        pageKey={activeTab}
                                        onChange={(s) => updateSlide(idx, s)}
                                        onDelete={() => deleteSlideLocal(idx)}
                                        onToggle={(v) => toggleSlideLocal(idx, v)}
                                        onMoveUp={() => moveSlide(idx, "up")}
                                        onMoveDown={() => moveSlide(idx, "down")}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Live Preview */}
                <div className="space-y-4">
                    <div className="sticky top-4">
                        <div className="bg-[#0e0a04] border border-[#2a1a08] rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-[#a89070] flex items-center gap-2">
                                    <Monitor size={14} /> Live Preview
                                </h4>
                                <div className="flex items-center gap-1">
                                    {activeSlides.map((_, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setPreviewIdx(i)}
                                            className={`rounded-full transition-all ${i === previewIdx % Math.max(1, activeSlides.length) ? "w-6 h-1.5 bg-[#e5a100]" : "w-1.5 h-1.5 bg-[#3a2a10]"}`}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Desktop preview */}
                            <div className="mb-2">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Monitor size={11} className="text-[#6b5535]" />
                                    <span className="text-[10px] text-[#6b5535]">Desktop — {cfg.heightDesktop}px</span>
                                </div>
                                <div
                                    className="relative w-full overflow-hidden"
                                    style={{
                                        height: Math.min(cfg.heightDesktop * 0.4, 180),
                                        background: currentPreview?.gradient || "#111",
                                        borderRadius: cfg.borderRadius,
                                    }}
                                >
                                    {currentPreview?.imageUrl && (
                                        <div className="absolute inset-0 bg-cover bg-center"
                                            style={{ backgroundImage: `url(${currentPreview.imageUrl})`, opacity: 1 - (currentPreview.overlayOpacity ?? 40) / 100 }} />
                                    )}
                                    <div className={`absolute inset-0 flex items-center px-5 ${currentPreview?.textAlign === "center" ? "justify-center text-center" : currentPreview?.textAlign === "right" ? "justify-end text-right" : "justify-start text-left"}`}
                                        style={{ color: currentPreview?.textColor || "#fff" }}>
                                        <div>
                                            {currentPreview?.badge && <span className="inline-block bg-white/20 text-[8px] font-black px-1.5 py-0.5 rounded mb-1">{currentPreview.badge}</span>}
                                            <p className="font-black text-sm leading-tight">{currentPreview?.title || "Title"}</p>
                                            <p className="text-[10px] opacity-70">{currentPreview?.subtitle || ""}</p>
                                            {currentPreview?.ctaText && (
                                                <span className="inline-block mt-1.5 text-[9px] font-black bg-[#e5a100] text-black px-2 py-0.5 rounded">
                                                    {currentPreview.ctaText}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Slide indicators */}
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                        {activeSlides.map((_, i) => (
                                            <div key={i} className={`h-0.5 rounded-full transition-all ${i === previewIdx % Math.max(1, activeSlides.length) ? "w-5 bg-white" : "w-1.5 bg-white/30"}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Mobile preview */}
                            <div>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Smartphone size={11} className="text-[#6b5535]" />
                                    <span className="text-[10px] text-[#6b5535]">Mobile — {cfg.heightMobile}px</span>
                                </div>
                                <div
                                    className="relative overflow-hidden"
                                    style={{
                                        width: "50%",
                                        height: Math.min(cfg.heightMobile * 0.7, 100),
                                        background: currentPreview?.gradient || "#111",
                                        borderRadius: cfg.borderRadius,
                                    }}
                                >
                                    {(currentPreview?.mobileImageUrl || currentPreview?.imageUrl) && (
                                        <div className="absolute inset-0 bg-cover bg-center"
                                            style={{ backgroundImage: `url(${currentPreview.mobileImageUrl || currentPreview.imageUrl})`, opacity: 1 - (currentPreview.overlayOpacity ?? 40) / 100 }} />
                                    )}
                                    <div className="absolute inset-0 flex items-center px-3" style={{ color: currentPreview?.textColor || "#fff" }}>
                                        <div>
                                            <p className="font-black text-[10px] leading-tight">{currentPreview?.title || "Title"}</p>
                                            {currentPreview?.ctaText && (
                                                <span className="inline-block mt-1 text-[7px] font-black bg-[#e5a100] text-black px-1.5 py-0.5 rounded">
                                                    {currentPreview.ctaText}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="mt-4 grid grid-cols-3 gap-2 pt-4 border-t border-[#2a1a08]">
                                <div className="text-center">
                                    <p className="text-lg font-black text-white">{cfg.slides.length}</p>
                                    <p className="text-[10px] text-[#6b5535]">Total</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-black text-emerald-400">{activeSlides.length}</p>
                                    <p className="text-[10px] text-[#6b5535]">Active</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-black text-[#e5a100]">{cfg.autoplayInterval / 1000}s</p>
                                    <p className="text-[10px] text-[#6b5535]">Interval</p>
                                </div>
                            </div>

                            {/* Page description */}
                            <div className="mt-3 p-3 bg-[#1a1208] rounded-lg border border-[#2a1a08]">
                                <p className="text-[11px] text-[#6b5535]">
                                    <span className="font-bold text-[#a89070]">{PAGE_META[activeTab].label}: </span>
                                    {PAGE_META[activeTab].description}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
