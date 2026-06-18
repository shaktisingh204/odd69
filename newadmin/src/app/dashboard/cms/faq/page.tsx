"use client";

import React, { useEffect, useState } from 'react';
import { getFaqs, createFaq, updateFaq, deleteFaq } from '@/actions/cms';
import {
    Plus, Edit2, Trash2, X, Save, ToggleLeft, ToggleRight, HelpCircle,
    Image, Video, Youtube, Link2, GripVertical, ChevronDown, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

interface MediaItem {
    type: 'image' | 'video' | 'youtube' | 'link';
    url: string;
    caption?: string;
}

const CATEGORIES = [
    { id: 'account', label: 'Account & Security' },
    { id: 'payments', label: 'Deposits & Withdrawals' },
    { id: 'bonuses', label: 'Bonuses & Promotions' },
    { id: 'sports', label: 'Sports Betting' },
    { id: 'casino', label: 'Casino' },
    { id: 'technical', label: 'Technical' },
    { id: 'general', label: 'General' },
];

const MEDIA_TYPES = [
    { id: 'image' as const, label: 'Image', icon: Image, placeholder: 'https://example.com/image.jpg' },
    { id: 'video' as const, label: 'Video', icon: Video, placeholder: 'https://example.com/video.mp4' },
    { id: 'youtube' as const, label: 'YouTube', icon: Youtube, placeholder: 'https://www.youtube.com/watch?v=...' },
    { id: 'link' as const, label: 'Link', icon: Link2, placeholder: 'https://example.com/article' },
];

// ─── Media Item Editor ──────────────────────────────────────────────────────

function MediaItemEditor({ item, index, onChange, onRemove }: {
    item: MediaItem; index: number;
    onChange: (index: number, item: MediaItem) => void;
    onRemove: (index: number) => void;
}) {
    const meta = MEDIA_TYPES.find(m => m.id === item.type) || MEDIA_TYPES[0];
    const MIcon = meta?.icon || Image;

    // YouTube preview helper
    const getYoutubeId = (url: string) => {
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([^&?\s]+)/);
        return match?.[1] || null;
    };

    return (
        <div className="flex items-start gap-3 bg-slate-900/50 border border-slate-700 rounded-lg p-3">
            <div className="pt-1 text-slate-500 cursor-grab"><GripVertical size={16} /></div>
            <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                        {MEDIA_TYPES.map(mt => {
                            const Icon = mt.icon;
                            return (
                                <button key={mt.id} type="button"
                                    onClick={() => onChange(index, { ...item, type: mt.id })}
                                    className={`p-1.5 rounded transition-colors ${item.type === mt.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                                    title={mt.label}>
                                    <Icon size={14} />
                                </button>
                            );
                        })}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{meta?.label}</span>
                </div>
                <input type="text" value={item.url}
                    onChange={e => onChange(index, { ...item, url: e.target.value })}
                    placeholder={meta?.placeholder}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                <input type="text" value={item.caption || ''}
                    onChange={e => onChange(index, { ...item, caption: e.target.value })}
                    placeholder="Caption (optional)"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none" />

                {/* Live preview */}
                {item.url && (
                    <div className="mt-1 rounded overflow-hidden border border-slate-700">
                        {item.type === 'image' && (
                            <img src={item.url} alt={item.caption || ''} className="max-h-32 object-contain bg-black/30" onError={e => (e.currentTarget.style.display = 'none')} />
                        )}
                        {item.type === 'youtube' && getYoutubeId(item.url) && (
                            <div className="aspect-video max-h-32 bg-black">
                                <iframe src={`https://www.youtube.com/embed/${getYoutubeId(item.url)}`}
                                    className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                            </div>
                        )}
                        {item.type === 'video' && (
                            <video src={item.url} className="max-h-32" controls muted />
                        )}
                        {item.type === 'link' && (
                            <a href={item.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                                <ExternalLink size={12} /> {item.url}
                            </a>
                        )}
                    </div>
                )}
            </div>
            <button type="button" onClick={() => onRemove(index)} className="p-1 text-red-400 hover:text-red-300 transition-colors">
                <Trash2 size={14} />
            </button>
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FAQManagementPage() {
    const [faqs, setFaqs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFaq, setEditingFaq] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);
    const [previewFaq, setPreviewFaq] = useState<any | null>(null);

    const [formData, setFormData] = useState({
        question: '',
        answer: '',
        category: 'account',
        media: [] as MediaItem[],
        order: 0,
        isActive: true,
    });

    useEffect(() => { fetchFaqs(); }, []);

    const fetchFaqs = async () => {
        try {
            const res = await getFaqs();
            if (res.success && res.data) setFaqs(res.data);
        } catch (error) {
            console.error("Failed to fetch FAQs", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (faq?: any) => {
        if (faq) {
            setEditingFaq(faq);
            setFormData({
                question: faq.question,
                answer: faq.answer,
                category: faq.category,
                media: faq.media || [],
                order: faq.order || 0,
                isActive: faq.isActive,
            });
        } else {
            setEditingFaq(null);
            setFormData({
                question: '',
                answer: '',
                category: 'account',
                media: [],
                order: faqs.length,
                isActive: true,
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.question || !formData.answer) {
            toast.error("Question and Answer are required");
            return;
        }
        // Validate media URLs
        const validMedia = formData.media.filter(m => m.url.trim());
        const payload = { ...formData, media: validMedia };

        setSaving(true);
        try {
            let res;
            if (editingFaq) {
                res = await updateFaq(editingFaq._id, payload);
            } else {
                res = await createFaq(payload);
            }
            if (res.success) {
                toast.success(editingFaq ? "FAQ updated" : "FAQ created");
                setIsModalOpen(false);
                fetchFaqs();
            } else {
                toast.error("Failed to save");
            }
        } catch (error) {
            console.error("Failed to save FAQ", error);
            toast.error("Failed to save. Check console.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this FAQ?")) return;
        try {
            await deleteFaq(id);
            toast.success("FAQ deleted");
            fetchFaqs();
        } catch (error) {
            console.error("Failed to delete FAQ", error);
            toast.error("Failed to delete FAQ");
        }
    };

    const handleToggleActive = async (faq: any) => {
        try {
            await updateFaq(faq._id, { isActive: !faq.isActive });
            toast.success(!faq.isActive ? "FAQ Activated" : "FAQ Deactivated");
            fetchFaqs();
        } catch (error) {
            console.error("Failed to toggle status", error);
            toast.error("Failed to toggle status");
        }
    };

    // Media helpers
    const addMedia = () => {
        setFormData(prev => ({ ...prev, media: [...prev.media, { type: 'image', url: '', caption: '' }] }));
    };

    const updateMedia = (index: number, item: MediaItem) => {
        setFormData(prev => {
            const media = [...prev.media];
            media[index] = item;
            return { ...prev, media };
        });
    };

    const removeMedia = (index: number) => {
        setFormData(prev => ({ ...prev, media: prev.media.filter((_, i) => i !== index) }));
    };

    const getCategoryLabel = (catId: string) => CATEGORIES.find(c => c.id === catId)?.label || catId;

    if (loading) return <div className="p-8 text-center text-slate-500">Loading FAQs...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">FAQ Management</h1>
                    <p className="text-slate-400 mt-1">Manage dynamic FAQs with rich media — images, videos, YouTube & links.</p>
                </div>
                <button onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                    <Plus size={20} /> Add New FAQ
                </button>
            </div>

            {/* ── Table ── */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-900/50 text-xs uppercase text-slate-400">
                        <tr>
                            <th className="px-6 py-4 font-bold border-b border-slate-700">Question</th>
                            <th className="px-6 py-4 font-bold border-b border-slate-700">Category</th>
                            <th className="px-6 py-4 font-bold border-b border-slate-700 text-center">Media</th>
                            <th className="px-6 py-4 font-bold border-b border-slate-700 text-center">Order</th>
                            <th className="px-6 py-4 font-bold border-b border-slate-700 text-center">Status</th>
                            <th className="px-6 py-4 font-bold border-b border-slate-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {faqs.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    <HelpCircle size={32} className="mx-auto mb-3 opacity-30" />
                                    No FAQs found. Add one to get started.
                                </td>
                            </tr>
                        ) : (
                            faqs.map(faq => (
                                <tr key={faq._id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white max-w-sm">
                                        <p className="truncate">{faq.question}</p>
                                        <p className="text-xs text-slate-500 truncate mt-0.5">{faq.answer?.slice(0, 80)}{faq.answer?.length > 80 ? '...' : ''}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-slate-700 px-2 py-1 rounded text-xs">{getCategoryLabel(faq.category)}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {faq.media?.length > 0 ? (
                                            <div className="flex items-center justify-center gap-1">
                                                {faq.media.some((m: any) => m.type === 'image') && <Image size={14} className="text-emerald-400" />}
                                                {faq.media.some((m: any) => m.type === 'video') && <Video size={14} className="text-blue-400" />}
                                                {faq.media.some((m: any) => m.type === 'youtube') && <Youtube size={14} className="text-red-400" />}
                                                {faq.media.some((m: any) => m.type === 'link') && <Link2 size={14} className="text-indigo-400" />}
                                                <span className="text-[10px] text-slate-500 ml-1">{faq.media.length}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-600 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center text-slate-400">{faq.order}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button onClick={() => handleToggleActive(faq)}
                                            className={`inline-flex p-1 rounded hover:bg-slate-700 transition-colors ${faq.isActive ? 'text-emerald-400' : 'text-slate-500'}`}
                                            title={faq.isActive ? 'Deactivate' : 'Activate'}>
                                            {faq.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => setPreviewFaq(previewFaq?._id === faq._id ? null : faq)}
                                                className="p-1.5 rounded hover:bg-slate-700 text-slate-400 transition-colors" title="Preview">
                                                <ChevronDown size={16} className={`transition-transform ${previewFaq?._id === faq._id ? 'rotate-180' : ''}`} />
                                            </button>
                                            <button onClick={() => handleOpenModal(faq)}
                                                className="p-1.5 rounded hover:bg-slate-700 text-blue-400 transition-colors">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(faq._id)}
                                                className="p-1.5 rounded hover:bg-slate-700 text-red-400 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Inline Preview ── */}
            {previewFaq && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-white font-bold">Preview: {previewFaq.question}</h3>
                        <button onClick={() => setPreviewFaq(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                    </div>
                    <p className="text-slate-300 text-sm whitespace-pre-wrap">{previewFaq.answer}</p>
                    {previewFaq.media?.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {previewFaq.media.map((m: MediaItem, i: number) => (
                                <FaqMediaPreview key={i} item={m} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Modal ── */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 z-10">
                            <h2 className="text-xl font-bold text-white">{editingFaq ? 'Edit FAQ' : 'New FAQ'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Question */}
                            <div>
                                <label className="block text-xs text-slate-400 uppercase font-bold mb-1">Question</label>
                                <input type="text" value={formData.question}
                                    onChange={e => setFormData({ ...formData, question: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none"
                                    placeholder="e.g., How do I reset my password?" />
                            </div>

                            {/* Category + Order + Active */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase font-bold mb-1">Category</label>
                                    <select value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none">
                                        {CATEGORIES.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 uppercase font-bold mb-1">Order</label>
                                        <input type="number" value={formData.order}
                                            onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div className="pt-2">
                                        <label className="flex items-center gap-2 cursor-pointer text-slate-300 mt-5">
                                            <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.isActive ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                                                <input type="checkbox" checked={formData.isActive}
                                                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                                    className="sr-only" />
                                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.isActive ? 'left-6' : 'left-1'}`} />
                                            </div>
                                            <span className="text-sm font-medium">Active</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Answer */}
                            <div>
                                <label className="block text-xs text-slate-400 uppercase font-bold mb-1">Answer</label>
                                <textarea value={formData.answer}
                                    onChange={e => setFormData({ ...formData, answer: e.target.value })}
                                    rows={6}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none resize-none"
                                    placeholder="Enter the detailed answer... Supports line breaks." />
                            </div>

                            {/* ── Media Section ── */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs text-slate-400 uppercase font-bold flex items-center gap-2">
                                        <Image size={14} /> Media Attachments
                                        {formData.media.length > 0 && (
                                            <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded-full text-[10px]">{formData.media.length}</span>
                                        )}
                                    </label>
                                    <button type="button" onClick={addMedia}
                                        className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-3 py-1.5 rounded-lg">
                                        <Plus size={14} /> Add Media
                                    </button>
                                </div>

                                {formData.media.length === 0 ? (
                                    <div className="text-center py-6 text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
                                        <Image size={24} className="mx-auto mb-2 opacity-30" />
                                        No media added. Click "Add Media" to attach images, videos, YouTube links, or URLs.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {formData.media.map((item, index) => (
                                            <MediaItemEditor key={index} item={item} index={index}
                                                onChange={updateMedia} onRemove={removeMedia} />
                                        ))}
                                    </div>
                                )}

                                {/* Quick-add buttons */}
                                {formData.media.length > 0 && (
                                    <div className="flex gap-2 mt-3">
                                        {MEDIA_TYPES.map(mt => {
                                            const Icon = mt.icon;
                                            return (
                                                <button key={mt.id} type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, media: [...prev.media, { type: mt.id, url: '', caption: '' }] }))}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors">
                                                    <Icon size={12} /> + {mt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-700 flex justify-end gap-3 sticky bottom-0 bg-slate-800">
                            <button onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50">
                                <Save size={18} /> {saving ? 'Saving...' : 'Save FAQ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Media Preview (used in table inline preview) ────────────────────────────

function FaqMediaPreview({ item }: { item: MediaItem }) {
    const getYoutubeId = (url: string) => {
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([^&?\s]+)/);
        return match?.[1] || null;
    };

    switch (item.type) {
        case 'image':
            return (
                <div className="rounded-lg overflow-hidden border border-slate-700">
                    <img src={item.url} alt={item.caption || ''} className="w-full max-h-48 object-cover" />
                    {item.caption && <p className="text-xs text-slate-400 px-3 py-1.5 bg-slate-900">{item.caption}</p>}
                </div>
            );
        case 'youtube': {
            const ytId = getYoutubeId(item.url);
            return ytId ? (
                <div className="rounded-lg overflow-hidden border border-slate-700">
                    <div className="aspect-video">
                        <iframe src={`https://www.youtube.com/embed/${ytId}`}
                            className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    </div>
                    {item.caption && <p className="text-xs text-slate-400 px-3 py-1.5 bg-slate-900">{item.caption}</p>}
                </div>
            ) : <p className="text-xs text-red-400">Invalid YouTube URL</p>;
        }
        case 'video':
            return (
                <div className="rounded-lg overflow-hidden border border-slate-700">
                    <video src={item.url} controls className="w-full max-h-48" />
                    {item.caption && <p className="text-xs text-slate-400 px-3 py-1.5 bg-slate-900">{item.caption}</p>}
                </div>
            );
        case 'link':
            return (
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                    <Link2 size={14} className="flex-shrink-0" />
                    <div className="min-w-0">
                        <p className="truncate">{item.caption || item.url}</p>
                        {item.caption && <p className="text-[10px] text-slate-500 truncate">{item.url}</p>}
                    </div>
                    <ExternalLink size={12} className="flex-shrink-0 ml-auto" />
                </a>
            );
        default:
            return null;
    }
}
