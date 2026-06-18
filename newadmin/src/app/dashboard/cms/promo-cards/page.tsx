"use client";

import React, { useEffect, useState, useRef } from 'react';
import { getPromoCards, createPromoCard, updatePromoCard, deletePromoCard } from '@/actions/cms';
import { getCasinoGames } from '@/actions/casino';
import { uploadToCloudflare } from '@/actions/upload';
import {
    Plus, Edit2, Trash2, X, Save, Upload, Loader2,
    ToggleLeft, ToggleRight, Star, Tag, Clock, Percent,
    DollarSign, FileText, Gift, Link2, Search, Gamepad2,
    Trophy, BookOpen, Globe, ExternalLink, ChevronRight,
    Eye, EyeOff
} from 'lucide-react';
import Image from 'next/image';

const CATEGORIES = ['ALL', 'CASINO', 'SPORTS', 'LIVE', 'VIP'];

const GRADIENT_PRESETS = [
    { label: 'Gold', value: 'linear-gradient(135deg, rgba(226,140,75,0.6), rgba(180,100,30,0.2))' },
    { label: 'Purple', value: 'linear-gradient(135deg, rgba(139,92,246,0.6), rgba(79,34,152,0.2))' },
    { label: 'Blue', value: 'linear-gradient(135deg, rgba(59,130,246,0.6), rgba(30,64,175,0.2))' },
    { label: 'Green', value: 'linear-gradient(135deg, rgba(16,185,129,0.6), rgba(6,78,59,0.2))' },
    { label: 'Red', value: 'linear-gradient(135deg, rgba(239,68,68,0.6), rgba(127,29,29,0.2))' },
    { label: 'Teal', value: 'linear-gradient(135deg, rgba(20,184,166,0.6), rgba(17,94,89,0.2))' },
];

const SPORTS_LINKS = [
    { name: 'Cricket', url: '/sports/cricket', icon: '🏏' },
    { name: 'Football', url: '/sports/football', icon: '⚽' },
    { name: 'Tennis', url: '/sports/tennis', icon: '🎾' },
    { name: 'Horse Racing', url: '/sports/horse-racing', icon: '🐎' },
    { name: 'Kabaddi', url: '/sports/kabaddi', icon: '🤼' },
    { name: 'Basketball', url: '/sports/basketball', icon: '🏀' },
    { name: 'Volleyball', url: '/sports/volleyball', icon: '🏐' },
];

const PAGE_LINKS = [
    { name: 'Promotions / Bonuses', url: '/promotions', buttonText: 'VIEW BONUSES', category: 'ALL', tag: 'BONUS' },
    { name: 'VIP Club', url: '/vip', buttonText: 'JOIN VIP', category: 'VIP', tag: 'VIP' },
    { name: 'Casino Lobby', url: '/casino', buttonText: 'PLAY NOW', category: 'CASINO', tag: 'CASINO' },
    { name: 'Live Casino', url: '/live-dealers', buttonText: 'GO LIVE', category: 'LIVE', tag: 'LIVE' },
    { name: 'Referral', url: '/referral', buttonText: 'REFER & EARN', category: 'ALL', tag: 'REFERRAL' },
    { name: 'Zeero Games', url: '/zeero-games', buttonText: 'PLAY NOW', category: 'CASINO', tag: 'EXCLUSIVE' },
    { name: 'Sports Lobby', url: '/sports', buttonText: 'BET NOW', category: 'SPORTS', tag: 'SPORTS' },
];

// Link type definition
type LinkType = 'casino' | 'sport' | 'page' | 'custom';

const defaultForm = {
    title: '',
    subtitle: '',
    description: '',
    termsAndConditions: '',
    category: 'ALL',
    tag: 'CASINO',
    promoCode: '',
    minDeposit: 0,
    bonusPercentage: 0,
    expiryDate: '',
    buttonText: 'CLAIM NOW',
    buttonLink: '/',
    bgImage: '',
    charImage: '',
    gradient: GRADIENT_PRESETS[0].value,
    isActive: true,
    isFeatured: false,
    order: 0,
};

export default function PromoCardsPage() {
    const [cards, setCards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<any | null>(null);
    const [formData, setFormData] = useState<any>(defaultForm);
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [showBannerPreview, setShowBannerPreview] = useState(true);

    // Dynamic link builder state
    const [linkType, setLinkType] = useState<LinkType>('page');
    const [selectedGame, setSelectedGame] = useState<any | null>(null);
    const [games, setGames] = useState<any[]>([]);
    const [gamesLoading, setGamesLoading] = useState(false);
    const [gameSearchQuery, setGameSearchQuery] = useState('');
    const [isGameSearchOpen, setIsGameSearchOpen] = useState(false);
    const gameSearchRef = useRef<HTMLDivElement>(null);
    const gameSearchTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => { fetchCards(); }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (gameSearchRef.current && !gameSearchRef.current.contains(event.target as Node)) {
                setIsGameSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchCards = async () => {
        try {
            const res = await getPromoCards();
            if (res.success && res.data) setCards(res.data);
        } catch (error) {
            console.error('Failed to fetch promo cards', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGameSearch = (query: string) => {
        setGameSearchQuery(query);
        setGames([]);
        if (gameSearchTimerRef.current) clearTimeout(gameSearchTimerRef.current);
        if (query.trim().length < 2) return;
        setGamesLoading(true);
        gameSearchTimerRef.current = setTimeout(async () => {
            try {
                const res = await getCasinoGames(1, 20, { search: query });
                if (res.success && res.data) setGames(res.data);
            } catch { /* silent */ }
            finally { setGamesLoading(false); }
        }, 400);
    };

    const applyGameLink = (g: any) => {
        const url = `/casino/play/${g.gameCode}?provider=${encodeURIComponent(g.provider)}&name=${encodeURIComponent(g.name)}`;
        setSelectedGame(g);
        setFormData((prev: any) => ({
            ...prev,
            buttonLink: url,
            buttonText: 'PLAY NOW',
            category: 'CASINO',
            tag: 'CASINO',
        }));
        setIsGameSearchOpen(false);
    };

    const applyPageLink = (page: typeof PAGE_LINKS[0]) => {
        setFormData((prev: any) => ({
            ...prev,
            buttonLink: page.url,
            buttonText: page.buttonText,
            category: page.category,
            tag: page.tag,
        }));
    };

    const applySportLink = (sport: typeof SPORTS_LINKS[0]) => {
        setFormData((prev: any) => ({
            ...prev,
            buttonLink: sport.url,
            buttonText: 'BET NOW',
            category: 'SPORTS',
            tag: 'SPORTS',
        }));
    };

    const detectLinkType = (link: string): LinkType => {
        if (link.includes('/casino/play/')) return 'casino';
        if (link.startsWith('/sports/')) return 'sport';
        if (PAGE_LINKS.some(p => p.url === link)) return 'page';
        return 'custom';
    };

    const handleOpenModal = (card?: any) => {
        if (card) {
            setEditingCard(card);
            const fd = {
                ...defaultForm,
                ...card,
                expiryDate: card.expiryDate ? new Date(card.expiryDate).toISOString().slice(0, 16) : '',
            };
            setFormData(fd);
            setLinkType(detectLinkType(card.buttonLink || ''));
            setSelectedGame(null);
        } else {
            setEditingCard(null);
            setFormData({ ...defaultForm, order: cards.length });
            setLinkType('page');
            setSelectedGame(null);
        }
        setGames([]);
        setGameSearchQuery('');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const payload = {
                ...formData,
                expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : null,
                minDeposit: Number(formData.minDeposit) || 0,
                bonusPercentage: Number(formData.bonusPercentage) || 0,
                order: Number(formData.order) || 0,
            };
            if (editingCard) {
                await updatePromoCard(editingCard._id, payload);
            } else {
                await createPromoCard(payload);
            }
            setIsModalOpen(false);
            fetchCards();
        } catch (error) {
            console.error('Failed to save', error);
            alert('Failed to save. Check console.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this promo card?')) return;
        await deletePromoCard(id);
        fetchCards();
    };

    const handleToggle = async (card: any, field: string) => {
        await updatePromoCard(card._id, { [field]: !card[field] });
        fetchCards();
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'bgImage' | 'charImage') => {
        if (!e.target.files?.[0]) return;
        setUploading(field);
        try {
            const form = new FormData();
            form.append('file', e.target.files[0]);
            form.append('folder', 'promo-images');
            const data = await uploadToCloudflare(form);
            if (data.success) {
                setFormData((prev: any) => ({ ...prev, [field]: data.url }));
            } else {
                alert('Upload failed: ' + data.error);
            }
        } catch (err: any) {
            alert('Upload failed: ' + err.message);
        } finally {
            setUploading(null);
        }
    };

    const filteredCards = filterCategory === 'ALL' ? cards : cards.filter(c => c.category === filterCategory);

    if (loading) return <div className="p-8 text-center text-slate-500">Loading promo cards...</div>;

    // ── Link type button helper
    const LinkTypeBtn = ({ type, icon: Icon, label }: { type: LinkType; icon: any; label: string }) => (
        <button
            type="button"
            onClick={() => {
                setLinkType(type);
                setSelectedGame(null);
                // Reset link when switching types
                if (type === 'custom') setFormData((prev: any) => ({ ...prev, buttonLink: '' }));
            }}
            className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-bold transition-all ${linkType === type
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
        >
            <Icon size={18} />
            {label}
        </button>
    );

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-3xl font-bold text-white">Promo Cards</h1>
                    <p className="text-slate-400 mt-0.5 text-xs sm:text-sm hidden sm:block">Manage promotions displayed on the site. {cards.length} cards total.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 sm:px-4 rounded-lg font-medium transition-colors text-sm shrink-0"
                >
                    <Plus size={16} /> <span className="hidden xs:inline">Add New Promo</span><span className="xs:hidden">New</span>
                </button>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 flex-wrap">
                {['ALL', ...CATEGORIES.filter(c => c !== 'ALL')].map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${filterCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                        {cat} {cat === 'ALL' ? `(${cards.length})` : `(${cards.filter(c => c.category === cat).length})`}
                    </button>
                ))}
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredCards.map(card => {
                    const isExpired = card.expiryDate && new Date(card.expiryDate) < new Date();
                    return (
                        <div key={card._id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
                            {/* Preview Banner */}
                            <div className="h-36 relative overflow-hidden" style={{ background: card.gradient || 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                                {card.bgImage && (
                                    <img src={card.bgImage} alt="bg" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                                )}
                                <div className="absolute inset-0 p-4 flex flex-col justify-end" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 100%)' }}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded font-bold uppercase">{card.category || 'ALL'}</span>
                                        {card.isFeatured && <span className="text-[10px] bg-yellow-500/30 text-yellow-300 px-2 py-0.5 rounded font-bold">⭐ FEATURED</span>}
                                    </div>
                                    {card.bonusPercentage > 0 && (
                                        <div className="text-2xl font-black text-white">+{card.bonusPercentage}%</div>
                                    )}
                                    <div className="text-sm font-bold text-white leading-tight">{card.title}</div>
                                    {card.buttonLink && (
                                        <div className="flex items-center gap-1 mt-1.5">
                                            <Link2 size={10} className="text-indigo-400 shrink-0" />
                                            <span className="text-[10px] text-indigo-300 truncate font-mono">{card.buttonLink}</span>
                                        </div>
                                    )}
                                </div>
                                {card.charImage && (
                                    <img src={card.charImage} alt="char" className="absolute right-0 bottom-0 h-28 object-contain z-10" />
                                )}
                            </div>

                            {/* Card Info */}
                            <div className="p-3 flex-1 space-y-2">
                                <div className="flex flex-wrap gap-1.5 text-xs">
                                    {card.promoCode && (
                                        <span className="bg-slate-700 text-yellow-400 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                                            <Tag size={10} />{card.promoCode}
                                        </span>
                                    )}
                                    {card.minDeposit > 0 && (
                                        <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1">
                                            <DollarSign size={10} />Min ₹{card.minDeposit}
                                        </span>
                                    )}
                                    {card.expiryDate && (
                                        <span className={`px-2 py-0.5 rounded flex items-center gap-1 ${isExpired ? 'bg-red-900/30 text-red-400' : 'bg-slate-700 text-slate-300'}`}>
                                            <Clock size={10} />{isExpired ? 'Expired' : new Date(card.expiryDate).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                {card.description && (
                                    <p className="text-xs text-slate-400 line-clamp-2">{card.description}</p>
                                )}

                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>Order: {card.order}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full ${card.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                            {card.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="px-3 pb-3 flex items-center gap-1.5">
                                <button onClick={() => handleToggle(card, 'isActive')} title={card.isActive ? 'Deactivate' : 'Activate'}
                                    className={`p-2 rounded hover:bg-slate-700 transition-colors ${card.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {card.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                </button>
                                <button onClick={() => handleToggle(card, 'isFeatured')} title={card.isFeatured ? 'Unfeature' : 'Feature'}
                                    className={`p-2 rounded hover:bg-slate-700 transition-colors ${card.isFeatured ? 'text-yellow-400' : 'text-slate-500'}`}>
                                    <Star size={16} />
                                </button>
                                <button onClick={() => handleOpenModal(card)} className="p-2 rounded hover:bg-slate-700 text-blue-400 transition-colors">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => handleDelete(card._id)} className="p-2 rounded hover:bg-slate-700 text-red-400 transition-colors ml-auto">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredCards.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                    <Gift size={40} className="mx-auto mb-3 opacity-30" />
                    <p>No promo cards in this category. Create one!</p>
                </div>
            )}

            {/* ======= MODAL ======= */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-start justify-center z-50 sm:p-4 overflow-y-auto">
                    <div className="bg-slate-800 sm:rounded-2xl rounded-t-2xl border border-slate-700 w-full max-w-3xl sm:my-4 max-h-[96dvh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="px-4 py-3 sm:p-5 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 z-10 rounded-t-2xl">
                            <h2 className="text-base sm:text-xl font-bold text-white">{editingCard ? 'Edit Promo Card' : 'New Promo Card'}</h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowBannerPreview(!showBannerPreview)}
                                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded bg-slate-700/50"
                                >
                                    {showBannerPreview ? <EyeOff size={13} /> : <Eye size={13} />}
                                    <span className="hidden sm:inline">{showBannerPreview ? 'Hide' : 'Show'} Preview</span>
                                </button>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-3 sm:p-5 space-y-5 sm:space-y-6">

                            {/* ── Live Banner Preview ── */}
                            {showBannerPreview && (
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Eye size={14} /> Live Banner Preview
                                    </h3>
                                    <div
                                        className="relative w-full rounded-xl overflow-hidden border border-slate-700"
                                        style={{ aspectRatio: '21/7' }}
                                    >
                                        {/* BG */}
                                        {formData.bgImage ? (
                                            <img src={formData.bgImage} alt="bg" className="absolute inset-0 w-full h-full object-cover" />
                                        ) : (
                                            <div className="absolute inset-0" style={{ background: formData.gradient }} />
                                        )}
                                        {/* Overlay */}
                                        <div className="absolute inset-0 z-10" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.05) 100%)' }} />
                                        {/* Char */}
                                        {formData.charImage && (
                                            <img src={formData.charImage} alt="char" className="absolute right-0 bottom-0 top-0 h-full object-contain object-right z-10" />
                                        )}
                                        {/* Text */}
                                        <div className="absolute inset-0 z-20 flex flex-col justify-center px-8">
                                            {formData.tag && (
                                                <span className="inline-block py-0.5 px-3 rounded-full bg-yellow-500/90 text-black text-[10px] font-black uppercase tracking-widest mb-2 w-fit">
                                                    {formData.tag}
                                                </span>
                                            )}
                                            {formData.subtitle && <p className="text-xs text-gray-300 uppercase tracking-widest font-semibold mb-1">{formData.subtitle}</p>}
                                            <h2 className="text-lg md:text-2xl font-black text-white leading-tight mb-2">{formData.title || 'Banner Title'}</h2>
                                            {formData.description && <p className="text-xs text-gray-300 mb-3 max-w-xs line-clamp-1">{formData.description}</p>}
                                            <span className="inline-flex items-center gap-1.5 bg-yellow-500/90 text-black text-[10px] font-black uppercase px-4 py-2 rounded-lg w-fit">
                                                {formData.buttonText || 'PLAY NOW'} <ChevronRight size={12} strokeWidth={3} />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Basic Info ── */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><FileText size={14} /> Basic Info</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Title *</label>
                                        <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Subtitle</label>
                                        <input type="text" value={formData.subtitle} onChange={e => setFormData({ ...formData, subtitle: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Category</label>
                                        <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none">
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Description</label>
                                        <textarea rows={2} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none resize-none" />
                                    </div>
                                </div>
                            </div>

                            {/* ── Bonus Details ── */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Percent size={14} /> Bonus Details</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <div className="col-span-1">
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Bonus %</label>
                                        <input type="number" min={0} value={formData.bonusPercentage} onChange={e => setFormData({ ...formData, bonusPercentage: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Min Deposit (₹)</label>
                                        <input type="number" min={0} value={formData.minDeposit} onChange={e => setFormData({ ...formData, minDeposit: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Promo Code</label>
                                        <input type="text" value={formData.promoCode} onChange={e => setFormData({ ...formData, promoCode: e.target.value.toUpperCase() })}
                                            placeholder="WELCOME100"
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-yellow-400 font-mono focus:border-indigo-500 outline-none uppercase" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Expiry Date & Time</label>
                                        <input type="datetime-local" value={formData.expiryDate} onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Tag Label</label>
                                        <input type="text" value={formData.tag} onChange={e => setFormData({ ...formData, tag: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Order</label>
                                        <input type="number" value={formData.order} onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                </div>
                            </div>

                            {/* ══════════════════════════════════════════
                                DYNAMIC LINK BUILDER
                                ══════════════════════════════════════════ */}
                            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4">
                                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Link2 size={14} /> Dynamic Link Builder
                                </h3>

                                {/* Link type selector — 2×2 on mobile, 4-col on sm+ */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                                    <LinkTypeBtn type="casino" icon={Gamepad2} label="Casino Game" />
                                    <LinkTypeBtn type="sport" icon={Trophy} label="Sport" />
                                    <LinkTypeBtn type="page" icon={BookOpen} label="Page" />
                                    <LinkTypeBtn type="custom" icon={Globe} label="Custom URL" />
                                </div>

                                {/* ── Casino Game Search ── */}
                                {linkType === 'casino' && (
                                    <div className="space-y-3">
                                        <p className="text-xs text-slate-400">Search for a casino game and link directly to it. The button will launch the game from the banner.</p>
                                        <div className="relative" ref={gameSearchRef}>
                                            <button
                                                type="button"
                                                onClick={() => { setIsGameSearchOpen(!isGameSearchOpen); setGameSearchQuery(''); }}
                                                className="w-full bg-slate-900 border border-slate-600 hover:border-slate-500 rounded-lg p-3 text-sm text-left text-white outline-none flex items-center justify-between"
                                            >
                                                {selectedGame ? (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded overflow-hidden bg-slate-800 shrink-0 relative">
                                                            <Image
                                                                src={`https://imagedelivery.net/l7vrHxYm1V8kfxard9QBnQ/${encodeURIComponent(selectedGame.provider.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim())}/${encodeURIComponent(selectedGame.icon)}/public`}
                                                                alt={selectedGame.name}
                                                                fill sizes="32px"
                                                                className="object-cover"
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-white">{selectedGame.name}</div>
                                                            <div className="text-xs text-slate-400">{selectedGame.provider}</div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-sm">Click to search for a game...</span>
                                                )}
                                                <Search size={16} className="text-slate-500 shrink-0" />
                                            </button>

                                            {isGameSearchOpen && (
                                                <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 flex flex-col max-h-72 overflow-hidden">
                                                    <div className="p-2 border-b border-slate-700">
                                                        <div className="relative">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                            <input
                                                                type="text"
                                                                placeholder="Type 2+ chars to search games..."
                                                                value={gameSearchQuery}
                                                                onChange={(e) => handleGameSearch(e.target.value)}
                                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                                autoFocus
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="overflow-y-auto p-1.5 space-y-0.5">
                                                        {gamesLoading ? (
                                                            <div className="text-sm text-slate-500 text-center py-6 flex items-center justify-center gap-2">
                                                                <Loader2 size={16} className="animate-spin" /> Searching...
                                                            </div>
                                                        ) : gameSearchQuery.length < 2 ? (
                                                            <div className="text-sm text-slate-500 text-center py-6">Type at least 2 characters</div>
                                                        ) : games.length === 0 ? (
                                                            <div className="text-sm text-slate-500 text-center py-6">No games found</div>
                                                        ) : (
                                                            games.map(g => (
                                                                <button
                                                                    key={g._id}
                                                                    type="button"
                                                                    onClick={() => applyGameLink(g)}
                                                                    className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-700/60 rounded-lg text-left transition-colors"
                                                                >
                                                                    <div className="w-10 h-10 rounded-lg bg-slate-900 overflow-hidden shrink-0 relative">
                                                                        <Image
                                                                            src={`https://imagedelivery.net/l7vrHxYm1V8kfxard9QBnQ/${encodeURIComponent(g.provider.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim())}/${encodeURIComponent(g.icon)}/public`}
                                                                            alt={g.name}
                                                                            fill sizes="40px"
                                                                            className="object-cover"
                                                                        />
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="text-sm font-bold text-white truncate">{g.name}</div>
                                                                        <div className="text-xs text-slate-400 truncate">{g.provider}</div>
                                                                    </div>
                                                                    <ChevronRight size={14} className="text-slate-500 shrink-0" />
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ── Sport Selector ── */}
                                {linkType === 'sport' && (
                                    <div className="space-y-3">
                                        <p className="text-xs text-slate-400">Select a sport to link the banner's CTA to that sport's page.</p>
                                        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2">
                                            {SPORTS_LINKS.map(sport => {
                                                const isSelected = formData.buttonLink === sport.url;
                                                return (
                                                    <button
                                                        key={sport.url}
                                                        type="button"
                                                        onClick={() => applySportLink(sport)}
                                                        className={`flex items-center gap-2.5 p-3 rounded-lg border-2 text-sm font-bold transition-all text-left ${isSelected
                                                            ? 'border-indigo-500 bg-indigo-500/10 text-white'
                                                            : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500'
                                                            }`}
                                                    >
                                                        <span className="text-lg">{sport.icon}</span>
                                                        <span>{sport.name}</span>
                                                        {isSelected && <ChevronRight size={14} className="ml-auto text-indigo-400" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* ── Page Selector ── */}
                                {linkType === 'page' && (
                                    <div className="space-y-3">
                                        <p className="text-xs text-slate-400">Link directly to a site page. Button text, category & tag are set automatically.</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {PAGE_LINKS.map(page => {
                                                const isSelected = formData.buttonLink === page.url;
                                                return (
                                                    <button
                                                        key={page.url}
                                                        type="button"
                                                        onClick={() => applyPageLink(page)}
                                                        className={`flex items-center gap-3 p-3 rounded-lg border-2 text-sm transition-all text-left ${isSelected
                                                            ? 'border-indigo-500 bg-indigo-500/10 text-white'
                                                            : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500'
                                                            }`}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold truncate">{page.name}</div>
                                                            <div className="text-xs text-slate-500 font-mono truncate">{page.url}</div>
                                                        </div>
                                                        {isSelected && <ChevronRight size={14} className="text-indigo-400 shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* ── Custom URL ── */}
                                {linkType === 'custom' && (
                                    <div className="space-y-3">
                                        <p className="text-xs text-slate-400">Enter any custom URL — internal path (e.g. <code className="text-indigo-300">/sports/match/12345</code>) or external link.</p>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={formData.buttonLink}
                                                    onChange={e => setFormData({ ...formData, buttonLink: e.target.value })}
                                                    placeholder="https://... or /internal/path"
                                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 pl-9 pr-3 text-sm text-white focus:border-indigo-500 outline-none font-mono"
                                                />
                                            </div>
                                            {formData.buttonLink && (
                                                <a href={formData.buttonLink} target="_blank" rel="noreferrer"
                                                    className="flex items-center px-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors border border-slate-600"
                                                    title="Test this link">
                                                    <ExternalLink size={16} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ── Current resolved URL (always shown) ── */}
                                <div className="mt-4 flex items-start gap-2.5 bg-slate-900/80 border border-slate-700 rounded-lg p-3">
                                    <Link2 size={14} className={`mt-0.5 shrink-0 ${formData.buttonLink ? 'text-indigo-400' : 'text-red-400'}`} />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Resolved Button Link</div>
                                        {formData.buttonLink ? (
                                            <code className="text-xs text-indigo-300 break-all">{formData.buttonLink}</code>
                                        ) : (
                                            <span className="text-xs text-red-400">Not set — select a link type above</span>
                                        )}
                                    </div>
                                </div>

                                {/* Button Text */}
                                <div className="mt-4">
                                    <label className="block text-xs text-slate-400 font-bold mb-1">Button Text</label>
                                    <input
                                        type="text"
                                        value={formData.buttonText}
                                        onChange={e => setFormData({ ...formData, buttonText: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                                    />
                                </div>
                            </div>

                            {/* ── Visuals ── */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Visuals</h3>
                                <div className="mb-4">
                                    <label className="block text-xs text-slate-400 font-bold mb-2">Background Gradient</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {GRADIENT_PRESETS.map(p => (
                                            <button key={p.value} type="button"
                                                onClick={() => setFormData({ ...formData, gradient: p.value })}
                                                className={`w-8 h-8 rounded-full border-2 transition-all ${formData.gradient === p.value ? 'border-white scale-110' : 'border-transparent'}`}
                                                style={{ background: p.value }} title={p.label} />
                                        ))}
                                        <input type="text" value={formData.gradient} onChange={e => setFormData({ ...formData, gradient: e.target.value })}
                                            placeholder="Custom CSS gradient..."
                                            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2.5 text-xs text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Background Image URL</label>
                                        <div className="flex gap-2">
                                            <input type="text" value={formData.bgImage} onChange={e => setFormData({ ...formData, bgImage: e.target.value })}
                                                placeholder="https://... or /path/to/image.jpg"
                                                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none text-xs" />
                                            <label className="flex items-center px-3 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer border border-slate-600 transition-colors">
                                                {uploading === 'bgImage' ? <Loader2 size={16} className="animate-spin text-white" /> : <Upload size={16} className="text-white" />}
                                                <input type="file" accept="image/*" className="hidden" disabled={!!uploading} onChange={e => handleUpload(e, 'bgImage')} />
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Character Image URL (Optional)</label>
                                        <div className="flex gap-2">
                                            <input type="text" value={formData.charImage} onChange={e => setFormData({ ...formData, charImage: e.target.value })}
                                                placeholder="https://... or upload"
                                                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none text-xs" />
                                            <label className="flex items-center px-3 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer border border-slate-600 transition-colors">
                                                {uploading === 'charImage' ? <Loader2 size={16} className="animate-spin text-white" /> : <Upload size={16} className="text-white" />}
                                                <input type="file" accept="image/*" className="hidden" disabled={!!uploading} onChange={e => handleUpload(e, 'charImage')} />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Terms ── */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Terms & Conditions</h3>
                                <textarea rows={3} value={formData.termsAndConditions} onChange={e => setFormData({ ...formData, termsAndConditions: e.target.value })}
                                    placeholder="Enter terms and conditions..."
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:border-indigo-500 outline-none resize-none text-sm" />
                            </div>

                            {/* ── Toggles ── */}
                            <div className="flex items-center gap-6 pt-1">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.isActive ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                                        <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="sr-only" />
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.isActive ? 'left-6' : 'left-1'}`} />
                                    </div>
                                    <span className="text-sm text-slate-300 font-medium">Active</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.isFeatured ? 'bg-yellow-500' : 'bg-slate-600'}`}>
                                        <input type="checkbox" checked={formData.isFeatured} onChange={e => setFormData({ ...formData, isFeatured: e.target.checked })} className="sr-only" />
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.isFeatured ? 'left-6' : 'left-1'}`} />
                                    </div>
                                    <span className="text-sm text-slate-300 font-medium flex items-center gap-1"><Star size={14} className="text-yellow-400" /> Featured</span>
                                </label>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-4 py-3 sm:p-5 border-t border-slate-700 flex justify-end gap-3 bg-slate-800 rounded-b-2xl">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-sm">
                                Cancel
                            </button>
                            <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-sm">
                                <Save size={16} /> Save Promo Card
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
