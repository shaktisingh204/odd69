'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Search, HelpCircle, Shield, Zap, BookOpen, Globe,
    ChevronDown, ArrowLeft, Headphones, ChevronRight, Home
} from 'lucide-react';
import ChatwootWidget from '@/components/shared/ChatwootWidget';

import { supportApi } from '@/services/support';

const CATEGORY_DEFINITIONS = [
    {
        id: 'account',
        label: 'Account & Security',
        icon: Shield,
        color: 'text-brand-gold',
        bg: 'bg-brand-gold/10',
        border: 'border-brand-gold/20',
    },
    {
        id: 'payments',
        label: 'Deposits & Withdrawals',
        icon: Zap,
        color: 'text-brand-gold',
        bg: 'bg-brand-gold/10',
        border: 'border-brand-gold/20',
    },
    {
        id: 'bonuses',
        label: 'Bonuses & Promotions',
        icon: BookOpen,
        color: 'text-pink-400',
        bg: 'bg-pink-400/10',
        border: 'border-pink-400/20',
    },
    {
        id: 'sports',
        label: 'Sports Betting',
        icon: Globe,
        color: 'text-teal-400',
        bg: 'bg-teal-400/10',
        border: 'border-teal-400/20',
    },
];

function ArticleItem({ title, body }: { title: string; body: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div
            className={`border border-white/[0.04] rounded-xl overflow-hidden transition-all duration-200 ${open ? 'bg-bg-modal' : 'bg-bg-zeero hover:bg-bg-modal'}`}
        >
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
            >
                <span className="text-white font-semibold text-sm leading-snug">{title}</span>
                <ChevronDown size={18} className={`text-text-muted flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-brand-gold' : ''}`} />
            </button>
            {open && (
                <div className="px-5 pb-4 text-text-muted text-sm leading-relaxed border-t border-white/[0.04] pt-3">
                    {body}
                </div>
            )}
        </div>
    );
}

import { useEffect } from 'react';

export default function HelpCenterPage() {
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [faqs, setFaqs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supportApi.getFaqs()
            .then(res => {
                if (res?.success && res.data) {
                    setFaqs(res.data);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const CATEGORIES = CATEGORY_DEFINITIONS.map(c => ({
        ...c,
        articles: faqs
            .filter(f => f.category === c.id)
            .map(f => ({ title: f.question, body: f.answer }))
    })).filter(c => c.articles.length > 0 || loading); // Show empty categories while loading

    const allArticles = CATEGORIES.flatMap(c => c.articles.map(a => ({ ...a, category: c.label, color: c.color, bg: c.bg })));

    const searchResults = search.trim()
        ? allArticles.filter(a =>
            a.title.toLowerCase().includes(search.toLowerCase()) ||
            a.body.toLowerCase().includes(search.toLowerCase())
        )
        : null;

    const displayCategories = activeCategory
        ? CATEGORIES.filter(c => c.id === activeCategory)
        : CATEGORIES;

    return (
        <div className="min-h-[calc(100vh-64px)] bg-bg-zeero-3 text-white pb-24">

            {/* Hero */}
            <div className="relative overflow-hidden bg-gradient-to-b from-blue-500/8 via-[#0F1016] to-[#0C0D12] border-b border-white/[0.04]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.10),transparent_60%)]" />
                <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-8 text-center">

                    {/* Back links */}
                    <div className="hidden md:flex absolute top-6 left-4 items-center gap-2">
                        <Link href="/" className="flex items-center gap-2 text-text-muted hover:text-white transition-colors text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.04] px-4 py-2 rounded-full">
                            <Home size={14} /> Home
                        </Link>
                        <ChevronRight size={12} className="text-text-disabled" />
                        <Link href="/support" className="flex items-center gap-2 text-text-muted hover:text-white transition-colors text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.04] px-4 py-2 rounded-full">
                            <Headphones size={14} /> Support
                        </Link>
                    </div>

                    <div className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-4 py-1.5 text-brand-gold text-xs font-black uppercase tracking-widest mb-5">
                        <HelpCircle size={13} /> Help Center
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
                        How can we <span className="text-brand-gold">help you?</span>
                    </h1>
                    <p className="text-text-muted text-sm mb-7">
                        Browse our knowledge base or search for answers below.
                    </p>

                    {/* Search */}
                    <div className="relative max-w-lg mx-auto">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search articles..."
                            className="w-full bg-bg-modal border border-white/[0.06] focus:border-brand-gold/50 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-text-disabled outline-none transition-all shadow-lg"
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-10">

                {/* Mobile back to support */}
                <div className="md:hidden flex items-center gap-2 mb-6">
                    <Link href="/support" className="flex items-center gap-2 text-text-muted hover:text-white transition-colors text-sm">
                        <ArrowLeft size={16} /> Back to Support
                    </Link>
                </div>

                {/* Search Results */}
                {searchResults !== null && (
                    <div className="mb-10">
                        <p className="text-xs font-black text-text-muted uppercase tracking-widest mb-4">
                            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;
                        </p>
                        <div className="space-y-2">
                            {searchResults.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-text-muted gap-3">
                                    <HelpCircle size={40} className="opacity-30" />
                                    <p>No articles found. Try a different search or <Link href="/support" className="text-brand-gold hover:underline">open a support ticket</Link>.</p>
                                </div>
                            ) : (
                                searchResults.map(a => <ArticleItem key={a.title} title={a.title} body={a.body} />)
                            )}
                        </div>
                    </div>
                )}

                {/* Category Pills */}
                {!searchResults && (
                    <>
                        <div className="flex gap-2 flex-wrap mb-8">
                            <button
                                onClick={() => setActiveCategory(null)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeCategory === null ? 'bg-brand-gold text-text-inverse' : 'bg-white/[0.04] text-text-muted hover:text-white'}`}
                            >
                                All Topics
                            </button>
                            {CATEGORIES.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setActiveCategory(c.id === activeCategory ? null : c.id)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeCategory === c.id ? 'bg-brand-gold text-text-inverse' : 'bg-white/[0.04] text-text-muted hover:text-white'}`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-10">
                            {loading ? (
                                <div className="text-center py-10 text-slate-500">
                                    <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p>Loading FAQs...</p>
                                </div>
                            ) : (
                                displayCategories.map(cat => {
                                    const CatIcon = cat.icon;
                                    return (
                                        <section key={cat.id}>
                                            <div className={`inline-flex items-center gap-2 ${cat.color} text-xs font-black uppercase tracking-widest mb-4`}>
                                                <div className={`p-1.5 rounded-lg ${cat.bg}`}><CatIcon size={13} /></div>
                                                {cat.label}
                                            </div>
                                            <div className="space-y-2">
                                                {cat.articles.map(a => <ArticleItem key={a.title} title={a.title} body={a.body} />)}
                                            </div>
                                        </section>
                                    );
                                })
                            )}
                        </div>
                    </>
                )}

                {/* Still need help */}
                <div className="mt-14 rounded-2xl bg-gradient-to-r from-brand-gold/10 to-transparent border border-brand-gold/20 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <p className="text-white font-black text-lg">Still need help?</p>
                        <p className="text-text-muted text-sm mt-1">Our support team is available 24/7 via live chat.</p>
                    </div>
                    <Link
                        href="/support"
                        className="flex items-center gap-2 bg-brand-gold hover:bg-brand-gold-hover text-text-inverse font-black px-6 py-3 rounded-xl text-sm uppercase transition-all shadow-glow-gold whitespace-nowrap"
                    >
                        <Headphones size={16} /> Open Support
                    </Link>
                </div>
            </div>
            <ChatwootWidget />
        </div>
    );
}
