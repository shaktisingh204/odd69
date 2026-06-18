"use client";

import React, { useEffect, useState } from 'react';
import { X, Info, AlertTriangle, CheckCircle, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/services/api';

type AnnouncementType = 'INFO' | 'WARNING' | 'SUCCESS' | 'PROMO';

interface Announcement {
    _id: string;
    title: string;
    message: string;
    type: AnnouncementType;
    isPinned: boolean;
}

const TYPE_STYLES: Record<AnnouncementType, { bar: string; icon: any; text: string; dismiss: string }> = {
    INFO: {
        bar: 'bg-info-soft border-info-primary/40',
        icon: Info,
        text: 'text-brand-gold',
        dismiss: 'hover:bg-info-primary/20 text-brand-gold',
    },
    WARNING: {
        bar: 'bg-warning-soft border-warning/40',
        icon: AlertTriangle,
        text: 'text-warning-bright',
        dismiss: 'hover:bg-warning/20 text-warning',
    },
    SUCCESS: {
        bar: 'bg-success-soft border-success/40',
        icon: CheckCircle,
        text: 'text-success-bright',
        dismiss: 'hover:bg-success/20 text-success-bright',
    },
    PROMO: {
        bar: 'bg-gradient-to-r from-warning-soft to-brown-accent/80 border-warning/40',
        icon: Zap,
        text: 'text-warning-bright',
        dismiss: 'hover:bg-warning/20 text-warning',
    },
};

const SESSION_KEY = 'dismissed_announcements';

function getDismissed(): Set<string> {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

function saveDismissed(ids: Set<string>) {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids]));
    } catch { /* ignore */ }
}

export default function AnnouncementBanner() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        setDismissed(getDismissed());
        api.get('/announcements?active=true')
            .then(res => {
                const data = res.data;
                if (Array.isArray(data)) setAnnouncements(data);
            })
            .catch(() => { /* silently fail */ });
    }, []);

    const visible = announcements.filter(a => !dismissed.has(a._id));

    // Cycle current index when announcements change
    useEffect(() => {
        setCurrentIndex(0);
    }, [visible.length]);

    if (visible.length === 0) return null;

    const current = visible[currentIndex];
    const cfg = TYPE_STYLES[current.type] || TYPE_STYLES.INFO;
    const Icon = cfg.icon;

    const dismissOne = (id: string) => {
        const next = new Set(dismissed).add(id);
        setDismissed(next);
        saveDismissed(next);
        setCurrentIndex(prev => Math.max(0, prev - 1));
    };

    const dismissAll = () => {
        const next = new Set(dismissed);
        visible.forEach(a => next.add(a._id));
        setDismissed(next);
        saveDismissed(next);
    };

    const prev = () => setCurrentIndex(i => (i - 1 + visible.length) % visible.length);
    const next = () => setCurrentIndex(i => (i + 1) % visible.length);

    return (
        <div className={`w-full border-b ${cfg.bar} backdrop-blur-md z-[60] relative flex-shrink-0`}>
            <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center gap-3">
                {/* Icon */}
                <div className="flex-shrink-0">
                    <Icon size={15} className={cfg.text} />
                </div>

                {/* Content */}
                <div className={`flex-1 min-w-0 text-xs ${cfg.text}`}>
                    <span className="font-black mr-2">{current.title}</span>
                    <span className="opacity-90">{current.message}</span>
                </div>

                {/* Multi-banner navigation */}
                {visible.length > 1 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={prev}
                            className={`p-1 rounded transition-colors ${cfg.dismiss}`}
                            title="Previous">
                            <ChevronLeft size={14} />
                        </button>
                        <span className={`text-[10px] font-bold ${cfg.text} opacity-60`}>
                            {currentIndex + 1}/{visible.length}
                        </span>
                        <button onClick={next}
                            className={`p-1 rounded transition-colors ${cfg.dismiss}`}
                            title="Next">
                            <ChevronRight size={14} />
                        </button>
                    </div>
                )}

                {/* Dismiss current */}
                <button
                    onClick={() => visible.length === 1 ? dismissAll() : dismissOne(current._id)}
                    className={`flex-shrink-0 p-1 rounded transition-colors ${cfg.dismiss}`}
                    title="Dismiss">
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}
