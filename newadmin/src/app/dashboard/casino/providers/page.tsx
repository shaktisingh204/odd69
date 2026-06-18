"use client";

import React, { useEffect, useState } from 'react';
import { getCasinoProviders, updateCasinoProvider } from '@/actions/casino';
import { uploadToCloudflare } from '@/actions/upload';
import { Search, Loader2, ToggleLeft, ToggleRight, Upload } from 'lucide-react';

interface AdminCasinoProvider {
    _id: string;
    name: string;
    code: string;
    isActive: boolean;
    image?: string;
}

export default function ProvidersPage() {
    const [providers, setProviders] = useState<AdminCasinoProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        try {
            setErrorMessage(null);
            const res = await getCasinoProviders();
            if (res.success && res.data) {
                setProviders(res.data as AdminCasinoProvider[]);
            }
        } catch (error) {
            console.error("Failed to fetch providers", error);
            setErrorMessage('Failed to fetch providers');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (provider: AdminCasinoProvider) => {
        try {
            setErrorMessage(null);
            const updatedProviders = providers.map(p => p._id === provider._id ? { ...p, isActive: !p.isActive } : p);
            setProviders(updatedProviders);
            const result = await updateCasinoProvider(provider._id, { isActive: !provider.isActive });
            if (!result.success) {
                throw new Error(result.error || 'Update failed');
            }
        } catch (error) {
            console.error("Update failed", error);
            setErrorMessage('Failed to update provider status');
            fetchProviders();
        }
    };

    const handleImageUpload = async (provider: AdminCasinoProvider, file: File) => {
        try {
            setErrorMessage(null);
            setUploadingId(provider._id);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'casino-providers');

            const uploadResult = await uploadToCloudflare(formData);
            if (!uploadResult.success || !uploadResult.url) {
                throw new Error(uploadResult.error || 'Cloudflare upload failed');
            }

            setProviders((currentProviders) =>
                currentProviders.map((item) =>
                    item._id === provider._id ? { ...item, image: uploadResult.url } : item,
                ),
            );

            const updateResult = await updateCasinoProvider(provider._id, { image: uploadResult.url });
            if (!updateResult.success) {
                throw new Error(updateResult.error || 'Failed to save provider image');
            }
        } catch (error) {
            console.error('Provider image upload failed', error);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to upload provider image');
            await fetchProviders();
        } finally {
            setUploadingId(null);
        }
    };

    const getProviderInitials = (name: string) =>
        name
            .split(/\s+/)
            .map((part) => part[0] || '')
            .join('')
            .slice(0, 2)
            .toUpperCase() || 'PR';

    const filteredProviders = providers.filter(p =>
        String(p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        String(p.code || '').toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center text-slate-500">Loading providers...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Provider Management</h1>
                    <p className="text-slate-400 mt-1">Enable or disable specific game providers.</p>
                </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search providers..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {errorMessage && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {errorMessage}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProviders.map(provider => (
                    <div key={provider._id} className="group relative bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-2xl bg-slate-900 flex items-center justify-center mb-3 border border-slate-700 overflow-hidden">
                            {provider.image ? (
                                <img
                                    src={provider.image}
                                    alt={provider.name}
                                    className="w-full h-full object-contain p-3"
                                />
                            ) : (
                                <span className="text-slate-500 font-bold text-xl">
                                    {getProviderInitials(provider.name)}
                                </span>
                            )}
                        </div>

                        <label className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors mb-4 ${uploadingId === provider._id
                            ? 'bg-slate-700 text-slate-300 cursor-wait'
                            : 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 cursor-pointer'
                            }`}>
                            {uploadingId === provider._id ? (
                                <Loader2 size={12} className="animate-spin" />
                            ) : (
                                <Upload size={12} />
                            )}
                            {provider.image ? 'Change Logo' : 'Upload Logo'}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingId === provider._id}
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) {
                                        handleImageUpload(provider, file);
                                    }
                                    event.target.value = '';
                                }}
                            />
                        </label>

                        <h3 className="text-lg font-bold text-white mb-1">{provider.name}</h3>
                        <p className="text-xs text-slate-500 mb-4 font-mono">{provider.code}</p>

                        <div className="flex items-center gap-2 mt-auto">
                            <button
                                onClick={() => handleToggleStatus(provider)}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors w-full justify-center ${provider.isActive
                                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                    }`}
                            >
                                {provider.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                {provider.isActive ? 'Active' : 'Disabled'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
