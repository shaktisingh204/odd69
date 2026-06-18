"use client";

import React, { useEffect, useState } from 'react';
import { getSports, updateSportLimits } from '@/actions/sports';
import { Search, Save, AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';

export default function BetLimitsPage() {
    const [sports, setSports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Local state for editing to avoid constant re-renders or strict tie to fetched data
    const [edits, setEdits] = useState<Record<string, { minBet: number; maxBet: number }>>({});

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await getSports();
            if (res.success && res.data) {
                const data = res.data;
                setSports(data);
                // Initialize edits
                const initialEdits: Record<string, { minBet: number; maxBet: number }> = {};
                data.forEach((s: any) => {
                    initialEdits[s.sportId] = {
                        minBet: s.minBet || 100,
                        maxBet: s.maxBet || 100000
                    };
                });
                setEdits(initialEdits);
            }
        } catch (error) {
            console.error("Failed to fetch sports", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (sportId: string, field: 'minBet' | 'maxBet', value: string) => {
        const numValue = parseInt(value) || 0;
        setEdits(prev => ({
            ...prev,
            [sportId]: {
                ...prev[sportId],
                [field]: numValue
            }
        }));
    };

    const handleSave = async (sportId: string) => {
        setSaving(sportId);
        setMessage(null);
        try {
            const { minBet, maxBet } = edits[sportId];
            if (minBet < 0 || maxBet < minBet) {
                setMessage({ type: 'error', text: 'Invalid limits. Min bet must be non-negative and less than Max bet.' });
                setSaving(null);
                return;
            }

            await updateSportLimits(sportId, minBet, maxBet);

            // Update local sports data to reflect save
            setSports(sports.map(s => s.sportId === sportId ? { ...s, minBet, maxBet } : s));

            setMessage({ type: 'success', text: 'Limits updated successfully.' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error("Failed to update limits", error);
            setMessage({ type: 'error', text: 'Failed to save limits.' });
        } finally {
            setSaving(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading sports...</div>;

    const filteredSports = sports.filter(s => (s.name || '').toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Bet Limits Management</h1>
                <p className="text-slate-400 mt-1">Configure minimum and maximum bet amounts per sport to manage risk.</p>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search sports..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                    {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <p>{message.text}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSports.map(sport => {
                    const editValues = edits[sport.sportId] || { minBet: 100, maxBet: 100000 };

                    return (
                        <div key={sport.sportId} className="bg-slate-800 rounded-lg border border-slate-700 p-5 space-y-4 hover:border-slate-600 transition-colors">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-white text-lg">{sport.name}</h3>
                                <ShieldAlert size={18} className="text-slate-500" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-500 uppercase font-medium mb-1">Min Bet</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
                                            value={editValues.minBet}
                                            onChange={(e) => handleInputChange(sport.sport_id, 'minBet', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 uppercase font-medium mb-1">Max Bet</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
                                            value={editValues.maxBet}
                                            onChange={(e) => handleInputChange(sport.sport_id, 'maxBet', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleSave(sport.sportId)}
                                disabled={saving === sport.sportId}
                                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving === sport.sportId ? 'Saving...' : (
                                    <>
                                        <Save size={16} /> Save Limits
                                    </>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
