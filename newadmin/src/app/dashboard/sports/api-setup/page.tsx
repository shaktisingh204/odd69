"use client";

import React, { useEffect, useState, useTransition } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Radio, Save } from 'lucide-react';
import { getSportsApiType, type SportsApiType, updateSportsApiType } from '@/actions/settings';

const OPTIONS: Array<{
    value: SportsApiType;
    label: string;
    description: string;
    badge?: string;
}> = [
    {
        value: 'SPORTSRADAR',
        label: 'Sportradar',
        description: 'Primary sports data provider powering all live odds, events, and settlement.',
        badge: 'Active'
    }
];

export default function SportsApiSetupPage() {
    const [selectedApiType, setSelectedApiType] = useState<SportsApiType>('SPORTSRADAR');
    const [initialApiType, setInitialApiType] = useState<SportsApiType>('SPORTSRADAR');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        const loadSportsApiType = async () => {
            try {
                const result = await getSportsApiType();
                if (result.success && result.data) {
                    setSelectedApiType(result.data);
                    setInitialApiType(result.data);
                } else {
                    setMessage({ type: 'error', text: result.error || 'Failed to load sports API type.' });
                }
            } catch (error) {
                setMessage({ type: 'error', text: 'Failed to load sports API type.' });
            } finally {
                setLoading(false);
            }
        };

        loadSportsApiType();
    }, []);

    const hasChanges = selectedApiType !== initialApiType;

    const handleSave = () => {
        setMessage(null);
        startTransition(async () => {
            const result = await updateSportsApiType(selectedApiType);
            if (result.success) {
                setInitialApiType(selectedApiType);
                setMessage({ type: 'success', text: 'Sports API type updated successfully.' });
            } else {
                setMessage({ type: 'error', text: result.error || 'Failed to update sports API type.' });
            }
        });
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading sports API setup...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Sports API Setup</h1>
                    <p className="mt-1 text-slate-400">
                        Choose which provider the sportsbook should use for sports feed configuration.
                    </p>
                </div>

                <button
                    onClick={handleSave}
                    disabled={!hasChanges || isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {isPending ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
                <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-lg bg-indigo-500/15 p-2 text-indigo-400">
                        <Radio size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-white">Provider Selection</h2>
                        <p className="text-sm text-slate-400">
                            Sportradar is the active provider. Configuration is saved under <span className="font-mono">SPORTS_API_TYPE</span>.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    {OPTIONS.map((option) => {
                        const active = selectedApiType === option.value;
                        return (
                            <label
                                key={option.value}
                                className={`block cursor-pointer rounded-xl border p-4 transition-colors ${active
                                    ? 'border-indigo-500 bg-indigo-500/10'
                                    : 'border-slate-700 bg-slate-900/40 hover:border-slate-500'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <input
                                        type="radio"
                                        name="sports-api-type"
                                        value={option.value}
                                        checked={active}
                                        onChange={() => setSelectedApiType(option.value)}
                                        className="mt-1 h-4 w-4 border-slate-500 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                                    />
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-lg font-semibold text-white">{option.label}</span>
                                            {option.badge ? (
                                                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                                                    {option.badge}
                                                </span>
                                            ) : null}
                                        </div>
                                        <p className="mt-1 text-sm text-slate-400">{option.description}</p>
                                    </div>
                                </div>
                            </label>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-300" />
                    <p>
                        All sports data is powered by Sportradar. Events, odds, and settlement use the SR feed exclusively.
                    </p>
                </div>
            </div>

            {message ? (
                <div
                    className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${message.type === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-red-500/30 bg-red-500/10 text-red-300'
                        }`}
                >
                    <CheckCircle2 size={16} className={message.type === 'success' ? 'block' : 'hidden'} />
                    <AlertCircle size={16} className={message.type === 'error' ? 'block' : 'hidden'} />
                    <span>{message.text}</span>
                </div>
            ) : null}
        </div>
    );
}
