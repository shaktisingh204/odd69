'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Plus, Edit2, Trash2, X, Save, Loader2, Search,
    Trophy, ShieldCheck, RefreshCw, CheckCircle2,
    AlertTriangle, Wallet, Percent, Hash, ToggleLeft, ToggleRight,
    Palette, Image, Tag, Radio, Calendar, Target,
} from 'lucide-react';
import {
    getSportsPromotions,
    createSportsPromotion,
    updateSportsPromotion,
    deleteSportsPromotion,
    toggleSportsPromotionStatus,
    setSportsPromotionTrigger,
    getEarlySixBetList,
    refundEarlySixPromotion,
} from '@/actions/sports-promotions';
import { getPromoTeamEvents } from '@/actions/sports';
import { uploadToCloudflare } from '@/actions/upload';

const GRADIENT_PRESETS = [
    { label: 'Green', value: 'linear-gradient(135deg, rgba(16,185,129,0.82), rgba(6,78,59,0.45))' },
    { label: 'Blue', value: 'linear-gradient(135deg, rgba(59,130,246,0.82), rgba(30,64,175,0.45))' },
    { label: 'Gold', value: 'linear-gradient(135deg, rgba(245,158,11,0.82), rgba(180,83,9,0.45))' },
    { label: 'Red', value: 'linear-gradient(135deg, rgba(239,68,68,0.82), rgba(127,29,29,0.45))' },
    { label: 'Purple', value: 'linear-gradient(135deg, rgba(139,92,246,0.82), rgba(79,34,152,0.45))' },
    { label: 'Teal', value: 'linear-gradient(135deg, rgba(20,184,166,0.82), rgba(17,94,89,0.45))' },
];

const PERIOD_OPTIONS = [
    { value: 'HALF_TIME', label: 'Half-time' },
    { value: 'END_Q1', label: 'End of 1st quarter' },
    { value: 'END_Q2', label: 'End of 2nd quarter / Half-time' },
    { value: 'END_Q3', label: 'End of 3rd quarter' },
    { value: 'END_P1', label: 'End of 1st period' },
    { value: 'END_P2', label: 'End of 2nd period' },
    { value: 'END_P3', label: 'End of 3rd period' },
    { value: 'END_SET_1', label: 'End of set 1' },
    { value: 'END_SET_2', label: 'End of set 2' },
];

const PROMOTION_TYPES = [
    {
        value: 'MATCH_LOSS_CASHBACK',
        label: 'Match Loss Cashback',
        description: 'Every losing bet on the selected match gets cashback.',
        benefitType: 'REFUND',
        defaultBadge: 'SPORTS PROMO',
    },
    {
        value: 'FIRST_OVER_SIX_CASHBACK',
        label: 'First Overs Six Cashback',
        description: 'If the backed pre-match Match Odds team hits a six in the configured opening overs but still loses, that losing bet gets cashback.',
        benefitType: 'REFUND',
        defaultBadge: 'TRIGGER PROMO',
    },
    {
        value: 'LEAD_MARGIN_PAYOUT',
        label: 'Early Lead Payout',
        description: 'Stake-style payout. If the selected team goes a configured margin ahead but fails to win, the bet is still paid like a winner.',
        benefitType: 'PAYOUT_AS_WIN',
        defaultBadge: 'EARLY PAYOUT',
    },
    {
        value: 'LATE_LEAD_REFUND',
        label: 'Bad Beat Refund',
        description: 'If the selected team is still leading at a configured late minute but does not win, the losing bet gets refunded.',
        benefitType: 'REFUND',
        defaultBadge: 'BAD BEAT',
    },
    {
        value: 'PERIOD_LEAD_PAYOUT',
        label: 'Period Lead Payout',
        description: 'If the selected team leads at half-time or another configured period end but does not win, the bet is still paid like a winner.',
        benefitType: 'PAYOUT_AS_WIN',
        defaultBadge: 'PERIOD PAYOUT',
    },
];

const WALLET_OPTIONS = [
    { value: 'main_wallet', label: 'Main Wallet' },
    { value: 'bonus_wallet', label: 'Bonus Wallet' },
];

type PromotionType =
    | 'MATCH_LOSS_CASHBACK'
    | 'FIRST_OVER_SIX_CASHBACK'
    | 'LEAD_MARGIN_PAYOUT'
    | 'LATE_LEAD_REFUND'
    | 'PERIOD_LEAD_PAYOUT';

type WalletType = 'main_wallet' | 'bonus_wallet';

type PromotionForm = {
    eventId: string;
    eventName: string;
    matchDate: string;
    sportId: string;
    teams: string[];
    promotionType: PromotionType;
    refundPercentage: number;
    walletType: WalletType;
    maxRefundAmount: number | '';
    triggerOversWindow: number;
    triggerLeadThreshold: number;
    triggerMinuteThreshold: number;
    triggerPeriodLabel: string;
    triggerQualifyingSelections: string[];
    triggerScoreSnapshot: string;
    triggerNote: string;
    triggerIsTriggered: boolean;
    cardTitle: string;
    cardDescription: string;
    cardGradient: string;
    cardBgImage: string;
    cardBadge: string;
    showOnPromotionsPage: boolean;
    isActive: boolean;
    order: number;
};

const defaultForm: PromotionForm = {
    eventId: '',
    eventName: '',
    matchDate: '',
    sportId: '',
    teams: [],
    promotionType: 'MATCH_LOSS_CASHBACK',
    refundPercentage: 10,
    walletType: 'main_wallet',
    maxRefundAmount: '',
    triggerOversWindow: 1,
    triggerLeadThreshold: 2,
    triggerMinuteThreshold: 80,
    triggerPeriodLabel: 'HALF_TIME',
    triggerQualifyingSelections: [],
    triggerScoreSnapshot: '',
    triggerNote: '',
    triggerIsTriggered: false,
    cardTitle: '',
    cardDescription: '',
    cardGradient: GRADIENT_PRESETS[0].value,
    cardBgImage: '',
    cardBadge: 'SPORTS PROMO',
    showOnPromotionsPage: true,
    isActive: true,
    order: 0,
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${checked ? 'bg-indigo-600' : 'bg-slate-600'}`}
        >
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${checked ? 'left-6' : 'left-1'}`} />
        </button>
    );
}

function SectionHeader({ icon: Icon, label }: { icon: any; label: string }) {
    return (
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Icon size={10} /> {label}
        </h3>
    );
}

function getPromotionMeta(type: PromotionType) {
    return PROMOTION_TYPES.find((promotion) => promotion.value === type) || PROMOTION_TYPES[0];
}

function isTriggerPromotion(type: PromotionType) {
    return type !== 'MATCH_LOSS_CASHBACK';
}

function isSelectionTriggerPromotion(type: PromotionType) {
    return type === 'FIRST_OVER_SIX_CASHBACK' || type === 'LEAD_MARGIN_PAYOUT' || type === 'LATE_LEAD_REFUND' || type === 'PERIOD_LEAD_PAYOUT';
}

function isPayoutPromotion(type: PromotionType) {
    return getPromotionMeta(type).benefitType === 'PAYOUT_AS_WIN';
}

function formatWalletLabel(walletType?: string) {
    return walletType === 'bonus_wallet' ? 'Bonus wallet' : 'Main wallet';
}

function formatCurrency(value: number) {
    return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDateTime(value?: string | Date | null) {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';

    return date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function toDatetimeInput(value?: string | Date | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60_000));
    return localDate.toISOString().slice(0, 16);
}

function formatPeriodLabel(periodLabel: string) {
    return PERIOD_OPTIONS.find((option) => option.value === periodLabel)?.label || periodLabel;
}

function getRewardFieldLabel(type: PromotionType) {
    return isPayoutPromotion(type) ? 'Winner Credit %' : 'Refund %';
}

function getRewardPillLabel(type: PromotionType, percentage: number) {
    return isPayoutPromotion(type) ? `${percentage}% WINNER CREDIT` : `${percentage}% REFUND`;
}

function getMaxAmountLabel(type: PromotionType) {
    return isPayoutPromotion(type) ? 'Max Payout Amount (Optional)' : 'Max Refund Amount (Optional)';
}

function getTriggerSummary(config: any) {
    const triggerConfig = config?.triggerConfig || config || {};
    const oversWindow = triggerConfig.oversWindow || triggerConfig.triggerOversWindow || 1;
    const leadThreshold = triggerConfig.leadThreshold || triggerConfig.triggerLeadThreshold || 2;
    const minuteThreshold = triggerConfig.minuteThreshold || triggerConfig.triggerMinuteThreshold || 80;
    const periodLabel = triggerConfig.periodLabel || triggerConfig.triggerPeriodLabel || 'HALF_TIME';

    switch (config?.promotionType) {
        case 'FIRST_OVER_SIX_CASHBACK':
            return `Selected pre-match Match Odds team hits a six in first ${oversWindow} over(s)`;
        case 'LEAD_MARGIN_PAYOUT':
            return `Selected team leads by ${leadThreshold}+`;
        case 'LATE_LEAD_REFUND':
            return `Selected team still leading at ${minuteThreshold}'`;
        case 'PERIOD_LEAD_PAYOUT':
            return `Selected team leads at ${formatPeriodLabel(periodLabel)}`;
        default:
            return 'No extra trigger required';
    }
}

function getSuggestedTitle(formData: PromotionForm) {
    const eventName = formData.eventName || 'this match';

    switch (formData.promotionType) {
        case 'FIRST_OVER_SIX_CASHBACK':
            return `${eventName} — ${formData.refundPercentage}% back if your pre-match team hits a 6 in first ${formData.triggerOversWindow} over${formData.triggerOversWindow > 1 ? 's' : ''}`;
        case 'LEAD_MARGIN_PAYOUT':
            return `${eventName} — Paid as winner if your team leads by ${formData.triggerLeadThreshold}+`;
        case 'LATE_LEAD_REFUND':
            return `${eventName} — Refund if your team leads at ${formData.triggerMinuteThreshold}'`;
        case 'PERIOD_LEAD_PAYOUT':
            return `${eventName} — Paid as winner if your team leads at ${formatPeriodLabel(formData.triggerPeriodLabel)}`;
        default:
            return `${eventName} — Get ${formData.refundPercentage}% back on any loss`;
    }
}

function getSuggestedDescription(formData: PromotionForm) {
    const eventName = formData.eventName || 'this match';
    const walletLabel = formatWalletLabel(formData.walletType).toLowerCase();

    switch (formData.promotionType) {
        case 'FIRST_OVER_SIX_CASHBACK':
            return `Place a pre-match Match Odds bet on ${eventName}. If your selected team hits a six in the first ${formData.triggerOversWindow} over${formData.triggerOversWindow > 1 ? 's' : ''} but still loses, get ${formData.refundPercentage}% refunded to the ${walletLabel}.`;
        case 'LEAD_MARGIN_PAYOUT':
            return `Back a team in ${eventName}. If it goes ${formData.triggerLeadThreshold}+ ahead but still fails to win, the bet can still be paid like a winner to the ${walletLabel}.`;
        case 'LATE_LEAD_REFUND':
            return `Back a team in ${eventName}. If it is still leading at ${formData.triggerMinuteThreshold}' but does not win, the losing bet is refunded to the ${walletLabel}.`;
        case 'PERIOD_LEAD_PAYOUT':
            return `Back a team in ${eventName}. If it leads at ${formatPeriodLabel(formData.triggerPeriodLabel)} but still fails to win, the bet can still be paid like a winner to the ${walletLabel}.`;
        default:
            return `Bet on ${eventName}. If the bet loses, ${formData.refundPercentage}% of stake goes back to the ${walletLabel}.`;
    }
}

function getPreviewAmount(formData: PromotionForm) {
    if (isPayoutPromotion(formData.promotionType)) {
        return ((2000 * Number(formData.refundPercentage || 0)) / 100).toFixed(0);
    }

    return ((1000 * Number(formData.refundPercentage || 0)) / 100).toFixed(0);
}

export default function PromoTeamsPage() {
    const [configs, setConfigs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rowActionKey, setRowActionKey] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<any | null>(null);
    const [formData, setFormData] = useState<PromotionForm>(defaultForm);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [success, setSuccess] = useState('');
    const [earlySixListOpen, setEarlySixListOpen] = useState(false);
    const [earlySixListLoading, setEarlySixListLoading] = useState(false);
    const [earlySixRefundLoading, setEarlySixRefundLoading] = useState(false);
    const [selectedEarlySixPromo, setSelectedEarlySixPromo] = useState<any | null>(null);
    const [earlySixBets, setEarlySixBets] = useState<any[]>([]);

    const [allEvents, setAllEvents] = useState<any[]>([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [eventsError, setEventsError] = useState(false);
    const [eventSearch, setEventSearch] = useState('');
    const [eventResults, setEventResults] = useState<any[]>([]);
    const [eventDropdown, setEventDropdown] = useState(false);

    const searchRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        fetchConfigs();
    }, []);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setEventDropdown(false);
            }
        };

        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchConfigs = async () => {
        try {
            setLoading(true);
            const response = await getSportsPromotions();
            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch promotions');
            }
            setConfigs(response.data || []);
        } catch (fetchError) {
            console.error(fetchError);
            setConfigs([]);
        } finally {
            setLoading(false);
        }
    };

    const loadEarlySixBetList = useCallback(async (promotionId: string) => {
        setEarlySixListLoading(true);
        try {
            const response = await getEarlySixBetList(promotionId);
            if (!response.success) {
                throw new Error(response.error || 'Failed to load Early Six bet list');
            }
            setEarlySixBets(response.data || []);
        } catch (loadError: any) {
            setError(loadError.message || 'Failed to load Early Six bet list.');
            setEarlySixBets([]);
        } finally {
            setEarlySixListLoading(false);
        }
    }, []);

    const searchEventsOnServer = useCallback(async (query: string) => {
        if (query.trim().length < 2) {
            setEventResults([]);
            setEventsLoading(false);
            return;
        }
        setEventsLoading(true);
        setEventsError(false);
        try {
            const response = await getPromoTeamEvents(query.trim());
            setEventResults(response.success ? (response.data || []).slice(0, 30) : []);
        } catch {
            setEventsError(true);
            setEventResults([]);
        } finally {
            setEventsLoading(false);
        }
    }, []);

    // Keep loadEvents for the initial "show all live" on focus (no query)
    const loadEvents = useCallback(async () => {
        if (eventsLoading || allEvents.length > 0) return;
        setEventsLoading(true);
        setEventsError(false);
        try {
            const response = await getPromoTeamEvents();
            setAllEvents(response.success ? (response.data || []) : []);
        } catch {
            setEventsError(true);
        } finally {
            setEventsLoading(false);
        }
    }, [allEvents.length, eventsLoading]);

    const handleEventSearch = (query: string) => {
        setEventSearch(query);
        setEventDropdown(true);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (query.trim().length < 2) {
            setEventResults([]);
            return;
        }

        debounceRef.current = setTimeout(() => {
            searchEventsOnServer(query);
        }, 250);
    };

    const reloadEvents = async () => {
        setAllEvents([]);
        setEventResults([]);
        setEventsError(false);
        setEventsLoading(true);
        try {
            const response = await getPromoTeamEvents(eventSearch.trim().length >= 2 ? eventSearch.trim() : '');
            const list = response.success ? (response.data || []) : [];
            if (eventSearch.trim().length >= 2) {
                setEventResults(list.slice(0, 30));
            } else {
                setAllEvents(list);
            }
        } catch {
            setEventsError(true);
        } finally {
            setEventsLoading(false);
        }
    };

    const setField = <K extends keyof PromotionForm>(key: K, value: PromotionForm[K]) => {
        setFormData((previous) => ({ ...previous, [key]: value }));
    };

    const handlePromotionTypeChange = (type: PromotionType) => {
        const meta = getPromotionMeta(type);
        setFormData((previous) => ({
            ...previous,
            promotionType: type,
            refundPercentage: isPayoutPromotion(type) && previous.refundPercentage < 100 ? 100 : previous.refundPercentage,
            cardBadge:
                !previous.cardBadge.trim() ||
                    previous.cardBadge === getPromotionMeta(previous.promotionType).defaultBadge
                    ? meta.defaultBadge
                    : previous.cardBadge,
            triggerQualifyingSelections: isSelectionTriggerPromotion(type) ? previous.triggerQualifyingSelections : [],
        }));
    };

    const toggleQualifyingSelection = (team: string) => {
        setFormData((previous) => {
            const exists = previous.triggerQualifyingSelections.includes(team);
            return {
                ...previous,
                triggerQualifyingSelections: exists
                    ? previous.triggerQualifyingSelections.filter((value) => value !== team)
                    : [...previous.triggerQualifyingSelections, team],
            };
        });
    };

    const selectEvent = (event: any) => {
        const eventName = String(event?.event_name || '');
        const teams = Array.isArray(event?.teams)
            ? event.teams.filter(Boolean)
            : [event?.home_team, event?.away_team].filter(Boolean);

        setFormData((previous) => ({
            ...previous,
            eventId: String(event?.event_id || ''),
            eventName,
            matchDate: event?.open_date || '',
            sportId: String(event?.sport_id || ''),
            teams,
            triggerQualifyingSelections: previous.triggerQualifyingSelections.filter((selection) => teams.includes(selection)),
        }));

        setEventSearch(eventName);
        setEventDropdown(false);
        setEventResults([]);
    };

    const openModal = (config?: any) => {
        setError('');
        setEventResults([]);

        if (config) {
            setEditing(config);
            setFormData({
                eventId: config.eventId || config.matchId || '',
                eventName: config.eventName || '',
                matchDate: toDatetimeInput(config.matchDate),
                sportId: config.sportId || '',
                teams: Array.isArray(config.teams) ? config.teams : [],
                promotionType: config.promotionType || 'MATCH_LOSS_CASHBACK',
                refundPercentage: Number(config.refundPercentage || 0),
                walletType: config.walletType || 'main_wallet',
                maxRefundAmount: typeof config.maxRefundAmount === 'number' ? config.maxRefundAmount : '',
                triggerOversWindow: Number(config.triggerConfig?.oversWindow || 1),
                triggerLeadThreshold: Number(config.triggerConfig?.leadThreshold || 2),
                triggerMinuteThreshold: Number(config.triggerConfig?.minuteThreshold || 80),
                triggerPeriodLabel: config.triggerConfig?.periodLabel || 'HALF_TIME',
                triggerQualifyingSelections: Array.isArray(config.triggerConfig?.qualifyingSelections) ? config.triggerConfig.qualifyingSelections : [],
                triggerScoreSnapshot: config.triggerConfig?.scoreSnapshot || '',
                triggerNote: config.triggerConfig?.triggerNote || '',
                triggerIsTriggered: config.triggerConfig?.isTriggered === true,
                cardTitle: config.cardTitle || '',
                cardDescription: config.cardDescription || '',
                cardGradient: config.cardGradient || GRADIENT_PRESETS[0].value,
                cardBgImage: config.cardBgImage || '',
                cardBadge: config.cardBadge || getPromotionMeta(config.promotionType || 'MATCH_LOSS_CASHBACK').defaultBadge,
                showOnPromotionsPage: config.showOnPromotionsPage !== false,
                isActive: config.isActive !== false,
                order: Number(config.order || 0),
            });
            setEventSearch(config.eventName || '');
        } else {
            setEditing(null);
            setFormData({
                ...defaultForm,
                order: configs.length,
            });
            setEventSearch('');
        }

        setIsModalOpen(true);
        loadEvents();
    };

    const handleSave = async () => {
        if (!formData.eventId.trim()) {
            setError('Please select a match event first.');
            return;
        }

        if (Number(formData.refundPercentage) < 0 || Number(formData.refundPercentage) > 100) {
            setError('Reward percentage must be between 0 and 100.');
            return;
        }

        if (formData.maxRefundAmount !== '' && Number(formData.maxRefundAmount) < 0) {
            setError('Max amount cannot be negative.');
            return;
        }

        if (formData.promotionType === 'FIRST_OVER_SIX_CASHBACK' && Number(formData.triggerOversWindow) < 1) {
            setError('Overs window must be at least 1.');
            return;
        }

        if (formData.promotionType === 'LEAD_MARGIN_PAYOUT' && Number(formData.triggerLeadThreshold) < 1) {
            setError('Lead margin must be at least 1.');
            return;
        }

        if (formData.promotionType === 'LATE_LEAD_REFUND' && Number(formData.triggerMinuteThreshold) < 1) {
            setError('Minute threshold must be at least 1.');
            return;
        }

        if (
            isSelectionTriggerPromotion(formData.promotionType) &&
            formData.triggerIsTriggered &&
            formData.triggerQualifyingSelections.length === 0
        ) {
            setError('Choose the qualifying team before marking this promotion as triggered.');
            return;
        }

        setError('');
        setSaving(true);

        try {
            const payload = {
                ...formData,
                refundPercentage: Number(formData.refundPercentage),
                maxRefundAmount: formData.maxRefundAmount === '' ? undefined : Number(formData.maxRefundAmount),
                order: Number(formData.order || 0),
                triggerOversWindow: Number(formData.triggerOversWindow || 1),
                triggerLeadThreshold: Number(formData.triggerLeadThreshold || 2),
                triggerMinuteThreshold: Number(formData.triggerMinuteThreshold || 80),
                triggerPeriodLabel: formData.triggerPeriodLabel,
                triggerQualifyingSelections: formData.triggerQualifyingSelections,
                triggerScoreSnapshot: formData.triggerScoreSnapshot.trim(),
                triggerNote: formData.triggerNote.trim(),
                cardTitle: formData.cardTitle.trim(),
                cardDescription: formData.cardDescription.trim(),
                cardBgImage: formData.cardBgImage.trim(),
                cardBadge: formData.cardBadge.trim(),
            };

            const response = editing
                ? await updateSportsPromotion(editing._id, payload)
                : await createSportsPromotion(payload);

            if (!response.success) {
                throw new Error(response.error || 'Failed to save promotion');
            }

            setIsModalOpen(false);
            await fetchConfigs();
        } catch (saveError: any) {
            setError(saveError.message || 'Failed to save promotion.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete sports promotion for "${name}"?`)) return;

        setRowActionKey(`delete:${id}`);
        try {
            const response = await deleteSportsPromotion(id);
            if (!response.success) {
                throw new Error(response.error || 'Delete failed');
            }
            await fetchConfigs();
        } catch (deleteError: any) {
            alert(deleteError.message || 'Failed to delete promotion');
        } finally {
            setRowActionKey(null);
        }
    };

    const handleToggle = async (config: any) => {
        setRowActionKey(`status:${config._id}`);
        try {
            const response = await toggleSportsPromotionStatus(config._id, !config.isActive);
            if (!response.success) {
                throw new Error(response.error || 'Failed to change status');
            }
            await fetchConfigs();
        } catch (toggleError: any) {
            alert(toggleError.message || 'Failed to change status');
        } finally {
            setRowActionKey(null);
        }
    };

    const handleTriggerAction = async (config: any, options?: { isTriggered?: boolean; qualifyingSelections?: string[] }) => {
        setRowActionKey(`trigger:${config._id}`);
        try {
            const response = await setSportsPromotionTrigger(config._id, {
                isTriggered: options?.isTriggered ?? !(config.triggerConfig?.isTriggered === true),
                oversWindow: config.triggerConfig?.oversWindow,
                leadThreshold: config.triggerConfig?.leadThreshold,
                minuteThreshold: config.triggerConfig?.minuteThreshold,
                periodLabel: config.triggerConfig?.periodLabel,
                qualifyingSelections: options?.qualifyingSelections ?? config.triggerConfig?.qualifyingSelections ?? [],
                scoreSnapshot: config.triggerConfig?.scoreSnapshot,
                triggerNote: config.triggerConfig?.triggerNote,
            });

            if (!response.success) {
                throw new Error(response.error || 'Failed to update trigger');
            }

            await fetchConfigs();
        } catch (triggerError: any) {
            alert(triggerError.message || 'Failed to update trigger');
        } finally {
            setRowActionKey(null);
        }
    };

    const handleOpenEarlySixList = async (config: any) => {
        setError('');
        setSuccess('');
        setSelectedEarlySixPromo(config);
        setEarlySixListOpen(true);
        await loadEarlySixBetList(config._id);
    };

    const handleRefundEarlySix = async () => {
        if (!selectedEarlySixPromo) return;

        setError('');
        setSuccess('');
        setEarlySixRefundLoading(true);
        try {
            const response = await refundEarlySixPromotion(selectedEarlySixPromo._id, 1);
            if (!response.success) {
                throw new Error(response.error || 'Failed to refund Early Six bets');
            }

            setSuccess(`Refunded ${response.refundedBetCount} bet${response.refundedBetCount === 1 ? '' : 's'} for ${formatCurrency(response.totalRefundAmount || 0)}.`);
            await Promise.all([
                fetchConfigs(),
                loadEarlySixBetList(selectedEarlySixPromo._id),
            ]);
        } catch (refundError: any) {
            setError(refundError.message || 'Failed to refund Early Six bets.');
        } finally {
            setEarlySixRefundLoading(false);
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files?.[0]) return;

        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', event.target.files[0]);
            form.append('folder', 'promo-team-images');
            const uploadResponse = await uploadToCloudflare(form);

            if (!uploadResponse.success) {
                throw new Error(uploadResponse.error || 'Upload failed');
            }

            setFormData((previous) => ({ ...previous, cardBgImage: uploadResponse.url || '' }));
        } catch (uploadError: any) {
            alert(uploadError.message || 'Upload failed');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const suggestedTitle = getSuggestedTitle(formData);
    const suggestedDescription = getSuggestedDescription(formData);
    const promotionMeta = getPromotionMeta(formData.promotionType);

    return (
        <div className="space-y-6">
            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                </div>
            )}

            {success && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                    {success}
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <ShieldCheck size={18} className="text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Stake-Style Sports Promotions</h1>
                        <p className="text-slate-400 text-sm">
                            Create match cashback, early payout, bad beat, and period lead offers. Active promos with website visibility enabled appear on the promotions page as soon as they are created.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors text-sm"
                >
                    <Plus size={16} /> Add Promotion
                </button>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3 text-xs text-blue-300/80 leading-relaxed">
                    <AlertTriangle size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                    <span>
                        <strong className="text-blue-300">Promo engine live: </strong>
                        this panel now supports both match-wide cashback and Stake-style selection promos like early lead payout, bad beat refund, and period lead payout. Selection-based promos are team-aware, and admins can mark which team actually hit the trigger when the match is live.
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-500">
                    <Loader2 size={24} className="animate-spin mr-2" /> Loading promotions...
                </div>
            ) : configs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border border-slate-700 rounded-2xl">
                    <ShieldCheck size={40} className="text-slate-600 mb-3" />
                    <p className="text-slate-400 font-semibold">No sports promotions yet.</p>
                    <p className="text-slate-600 text-sm mt-1">Create one to publish it to the sports promotions feed.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-700">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700 bg-slate-800/60">
                                {['Card', 'Match', 'Promo Type', 'Reward', 'Wallet', 'Trigger', 'Status', 'Stats', 'Actions'].map((heading) => (
                                    <th
                                        key={heading}
                                        className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap"
                                    >
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {configs.map((config) => {
                                const isTriggered = config.triggerConfig?.isTriggered === true;
                                const selectionTrigger = isSelectionTriggerPromotion(config.promotionType);
                                const busy = rowActionKey === `trigger:${config._id}`;

                                return (
                                    <tr key={config._id} className="hover:bg-slate-800/40 transition-colors align-top">
                                        <td className="px-4 py-3">
                                            <div
                                                className="w-32 h-20 rounded-lg overflow-hidden relative flex-shrink-0 border border-white/10"
                                                style={{ background: config.cardGradient || GRADIENT_PRESETS[0].value }}
                                            >
                                                {config.cardBgImage && (
                                                    <img src={config.cardBgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                                                )}
                                                <div className="absolute inset-0 p-2 flex flex-col justify-end bg-gradient-to-t from-black/50 via-transparent to-transparent">
                                                    {config.cardBadge && (
                                                        <span className="text-[8px] bg-white/20 text-white px-1.5 py-0.5 rounded font-bold mb-1 self-start">
                                                            {config.cardBadge}
                                                        </span>
                                                    )}
                                                    <div className="text-[10px] text-white font-bold leading-tight line-clamp-2">
                                                        {config.cardTitle || config.eventName}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 min-w-[220px]">
                                            <div className="font-bold text-white text-sm max-w-[220px] truncate">
                                                {config.eventName || 'Unnamed match'}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                Match ID: {config.eventId}
                                            </div>
                                            <div className="text-[10px] text-slate-500 mt-0.5">
                                                <Calendar size={10} className="inline mr-1" />
                                                {formatDateTime(config.matchDate)}
                                            </div>
                                            {config.teams?.length > 0 && (
                                                <div className="flex gap-1 flex-wrap mt-2">
                                                    {config.teams.map((team: string) => (
                                                        <span key={team} className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                                                            {team}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 min-w-[250px]">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.benefitType === 'PAYOUT_AS_WIN' ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                                                    {getPromotionMeta(config.promotionType).label}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-300 leading-relaxed">
                                                {config.conditionSummary || getTriggerSummary(config)}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 min-w-[160px]">
                                            <div className={`text-2xl font-black leading-none ${config.benefitType === 'PAYOUT_AS_WIN' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                {config.refundPercentage}%
                                            </div>
                                            <div className="text-[10px] text-slate-500 mt-1">
                                                {config.benefitType === 'PAYOUT_AS_WIN' ? 'winner credit' : 'refund of stake'}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">
                                                Cap: {config.maxRefundAmount ? formatCurrency(config.maxRefundAmount) : 'No cap'}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${config.walletType === 'bonus_wallet' ? 'bg-violet-500/10 text-violet-300' : 'bg-sky-500/10 text-sky-300'}`}>
                                                {formatWalletLabel(config.walletType)}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3 min-w-[230px]">
                                            {isTriggerPromotion(config.promotionType) ? (
                                                <div className="space-y-2">
                                                    <div className={`text-xs font-bold ${isTriggered ? 'text-emerald-400' : 'text-amber-300'}`}>
                                                        {isTriggered ? 'Triggered' : 'Waiting for trigger'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        {getTriggerSummary(config)}
                                                    </div>
                                                    {config.triggerConfig?.qualifyingSelections?.length > 0 && (
                                                        <div className="text-[10px] text-sky-300">
                                                            Qualified: {config.triggerConfig.qualifyingSelections.join(', ')}
                                                        </div>
                                                    )}
                                                    {config.triggerConfig?.scoreSnapshot && (
                                                        <div className="text-[10px] text-slate-400">
                                                            Snapshot: {config.triggerConfig.scoreSnapshot}
                                                        </div>
                                                    )}
                                                    {selectionTrigger ? (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {(config.teams || []).map((team: string) => (
                                                                <button
                                                                    key={team}
                                                                    onClick={() => handleTriggerAction(config, { isTriggered: true, qualifyingSelections: [team] })}
                                                                    disabled={busy}
                                                                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-sky-400/30 text-sky-300 hover:bg-sky-400/10 disabled:opacity-50"
                                                                >
                                                                    {busy ? 'Saving...' : `Trigger ${team}`}
                                                                </button>
                                                            ))}
                                                            {isTriggered && (
                                                                <button
                                                                    onClick={() => handleTriggerAction(config, { isTriggered: false, qualifyingSelections: [] })}
                                                                    disabled={busy}
                                                                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-amber-400/30 text-amber-300 hover:bg-amber-400/10 disabled:opacity-50"
                                                                >
                                                                    Reset
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleTriggerAction(config)}
                                                            disabled={busy}
                                                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${isTriggered
                                                                ? 'border-amber-400/30 text-amber-300 hover:bg-amber-400/10'
                                                                : 'border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10'
                                                                } disabled:opacity-50`}
                                                        >
                                                            {busy ? 'Saving...' : isTriggered ? 'Reset Trigger' : 'Mark Trigger Hit'}
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-slate-500">
                                                    No extra trigger. Every losing bet qualifies while active.
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-4 py-3">
                                            <button onClick={() => handleToggle(config)} className="flex items-center gap-1.5">
                                                {config.isActive ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} className="text-slate-500" />}
                                                <span className={`text-xs font-bold ${config.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                    {config.isActive ? 'Active' : 'Off'}
                                                </span>
                                            </button>
                                            <div className="text-[10px] text-slate-500 mt-1">
                                                {config.showOnPromotionsPage ? 'Shown on Promotions page' : 'Hidden from Promotions page'}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 min-w-[160px]">
                                            <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                                                <CheckCircle2 size={12} /> {config.refundedBetCount || 0} credited bets
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">
                                                Total credit: {formatCurrency(config.totalBenefitAmount || config.totalRefundAmount || 0)}
                                            </div>
                                            {config.promotionType === 'FIRST_OVER_SIX_CASHBACK' && (
                                                <button
                                                    onClick={() => handleOpenEarlySixList(config)}
                                                    className="mt-2 text-[10px] font-semibold text-sky-300 hover:text-sky-200"
                                                >
                                                    See Early Six bet list
                                                </button>
                                            )}
                                            <div className="text-[10px] text-slate-500 mt-1">
                                                Created: {formatDateTime(config.createdAt)}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => openModal(config)}
                                                    className="p-1.5 rounded-lg hover:bg-slate-700 text-blue-400"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(config._id, config.eventName || 'this match')}
                                                    disabled={rowActionKey === `delete:${config._id}`}
                                                    className="p-1.5 rounded-lg hover:bg-slate-700 text-red-400 disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                            <div>
                                <h2 className="text-lg font-bold text-white">{editing ? 'Edit Sports Promotion' : 'New Sports Promotion'}</h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Select a match, choose the Stake-style promo rule, and publish it to the site.
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 space-y-6">
                            <div>
                                <SectionHeader icon={Search} label="1 · Select Match" />
                                <div ref={searchRef} className="relative">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={eventSearch}
                                            onChange={(event) => handleEventSearch(event.target.value)}
                                            onFocus={() => {
                                                setEventDropdown(true);
                                                loadEvents();
                                            }}
                                            placeholder='Search live or upcoming matches, for example "India" or "Cricket"'
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-10 py-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                                        />
                                        {eventsLoading && (
                                            <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                                        )}
                                        {!eventsLoading && allEvents.length > 0 && (
                                            <button
                                                onClick={reloadEvents}
                                                title="Refresh events"
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
                                            >
                                                <RefreshCw size={13} />
                                            </button>
                                        )}
                                    </div>

                                    {eventDropdown && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-600 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                                            {eventsLoading ? (
                                                <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                                                    <Loader2 size={13} className="animate-spin" /> Loading live and upcoming matches...
                                                </div>
                                            ) : eventsError ? (
                                                <div className="p-4 text-center text-xs text-red-400">
                                                    Failed to load matches. <button onClick={reloadEvents} className="underline">Retry</button>
                                                </div>
                                            ) : eventResults.length === 0 && eventSearch.trim().length >= 2 ? (
                                                <div className="p-4 text-center text-xs text-slate-500">
                                                    No Sportradar matches found for "{eventSearch}".
                                                </div>
                                            ) : eventResults.length === 0 ? (
                                                <div className="p-3 text-center text-xs text-slate-500">
                                                    Type at least 2 characters to search Sportradar matches.
                                                </div>
                                            ) : (
                                                eventResults.map((event) => (
                                                    <button
                                                        key={event.event_id}
                                                        type="button"
                                                        onClick={() => selectEvent(event)}
                                                        className="w-full text-left px-4 py-3 hover:bg-slate-800 border-b border-slate-800 last:border-0 transition-colors"
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div>
                                                                <div className="text-sm font-semibold text-white">
                                                                    {event.home_team && event.away_team
                                                                        ? `${event.home_team} vs ${event.away_team}`
                                                                        : event.event_name}
                                                                </div>
                                                                <div className="text-[11px] text-slate-400 mt-0.5">
                                                                    {event.competition_name || 'Unknown competition'}
                                                                </div>
                                                                <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                                                                    {event.event_id}
                                                                </div>
                                                            </div>
                                                            <div className="text-right flex-shrink-0">
                                                                <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${event.in_play ? 'bg-red-500/20 text-red-300' : 'bg-slate-700 text-slate-400'}`}>
                                                                    {event.in_play ? '🔴 LIVE' : 'Upcoming'}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 mt-1">{formatDateTime(event.open_date)}</div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                {formData.eventId && (
                                    <div className="mt-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                                        <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                                        <div className="text-xs">
                                            <span className="text-emerald-300 font-bold">{formData.eventName}</span>
                                            <span className="text-slate-500"> · Match ID: {formData.eventId}</span>
                                            {formData.teams.length > 0 && (
                                                <span className="ml-2 text-slate-400">Teams: {formData.teams.join(' vs ')}</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <SectionHeader icon={Radio} label="2 · Promotion Rule" />
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-slate-400 font-bold mb-1.5">Promotion Type</label>
                                            <select
                                                value={formData.promotionType}
                                                onChange={(event) => handlePromotionTypeChange(event.target.value as PromotionType)}
                                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                                            >
                                                {PROMOTION_TYPES.map((type) => (
                                                    <option key={type.value} value={type.value}>
                                                        {type.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-[11px] text-slate-500 mt-2">
                                                {promotionMeta.description}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs text-slate-400 font-bold mb-1.5 flex items-center gap-1">
                                                    <Percent size={11} /> {getRewardFieldLabel(formData.promotionType)}
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        value={formData.refundPercentage}
                                                        onChange={(event) => setField('refundPercentage', Number(event.target.value))}
                                                        className={`w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 pr-8 font-black text-lg outline-none ${isPayoutPromotion(formData.promotionType) ? 'text-amber-400 focus:border-amber-500' : 'text-emerald-400 focus:border-emerald-500'}`}
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs text-slate-400 font-bold mb-1.5 flex items-center gap-1">
                                                    <Wallet size={11} /> Credit Wallet
                                                </label>
                                                <select
                                                    value={formData.walletType}
                                                    onChange={(event) => setField('walletType', event.target.value as WalletType)}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                                                >
                                                    {WALLET_OPTIONS.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-slate-400 font-bold mb-1.5">{getMaxAmountLabel(formData.promotionType)}</label>
                                            <input
                                                type="number"
                                                min={0}
                                                value={formData.maxRefundAmount}
                                                onChange={(event) => {
                                                    const value = event.target.value;
                                                    setField('maxRefundAmount', value === '' ? '' : Number(value));
                                                }}
                                                placeholder="Leave blank for no cap"
                                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                                            />
                                        </div>

                                        {formData.promotionType === 'FIRST_OVER_SIX_CASHBACK' ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs text-slate-400 font-bold mb-1.5">Overs Window</label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={formData.triggerOversWindow}
                                                        onChange={(event) => setField('triggerOversWindow', Number(event.target.value) || 1)}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                                                    />
                                                </div>
                                                <div className="pt-6">
                                                    <label className="flex items-center gap-3 cursor-pointer">
                                                        <Toggle checked={formData.triggerIsTriggered} onChange={(value) => setField('triggerIsTriggered', value)} />
                                                        <span className="text-sm text-slate-300">Trigger already hit</span>
                                                    </label>
                                                </div>
                                            </div>
                                        ) : formData.promotionType === 'LEAD_MARGIN_PAYOUT' ? (
                                            <div>
                                                <label className="block text-xs text-slate-400 font-bold mb-1.5">Lead Margin</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={formData.triggerLeadThreshold}
                                                    onChange={(event) => setField('triggerLeadThreshold', Number(event.target.value) || 2)}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                                                />
                                            </div>
                                        ) : formData.promotionType === 'LATE_LEAD_REFUND' ? (
                                            <div>
                                                <label className="block text-xs text-slate-400 font-bold mb-1.5">Minute Threshold</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={formData.triggerMinuteThreshold}
                                                    onChange={(event) => setField('triggerMinuteThreshold', Number(event.target.value) || 80)}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                                                />
                                            </div>
                                        ) : formData.promotionType === 'PERIOD_LEAD_PAYOUT' ? (
                                            <div>
                                                <label className="block text-xs text-slate-400 font-bold mb-1.5">Trigger Period</label>
                                                <select
                                                    value={formData.triggerPeriodLabel}
                                                    onChange={(event) => setField('triggerPeriodLabel', event.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                                                >
                                                    {PERIOD_OPTIONS.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-3 text-xs text-emerald-300/80">
                                                This promo has no extra trigger. Every losing bet on the selected match qualifies while the promotion remains active.
                                            </div>
                                        )}
                                    </div>

                                    {isTriggerPromotion(formData.promotionType) && (
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="space-y-3">
                                                <label className="flex items-center gap-3 cursor-pointer">
                                                    <Toggle checked={formData.triggerIsTriggered} onChange={(value) => setField('triggerIsTriggered', value)} />
                                                    <span className="text-sm text-slate-300">Trigger already hit</span>
                                                </label>

                                                {isSelectionTriggerPromotion(formData.promotionType) && formData.teams.length > 0 && (
                                                    <div>
                                                        <label className="block text-xs text-slate-400 font-bold mb-2 flex items-center gap-1">
                                                            <Target size={11} /> Qualifying Team
                                                        </label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {formData.teams.map((team) => {
                                                                const active = formData.triggerQualifyingSelections.includes(team);
                                                                return (
                                                                    <button
                                                                        key={team}
                                                                        type="button"
                                                                        onClick={() => toggleQualifyingSelection(team)}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${active
                                                                            ? 'border-sky-400/40 bg-sky-400/10 text-sky-200'
                                                                            : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                                                                            }`}
                                                                    >
                                                                        {team}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-xs text-slate-400 font-bold mb-1.5">Score Snapshot / State (Optional)</label>
                                                    <input
                                                        type="text"
                                                        value={formData.triggerScoreSnapshot}
                                                        onChange={(event) => setField('triggerScoreSnapshot', event.target.value)}
                                                        placeholder="e.g. 2-0 at 81', 74/1 after 0.4 overs"
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-400 font-bold mb-1.5">Internal Trigger Note (Optional)</label>
                                                    <input
                                                        type="text"
                                                        value={formData.triggerNote}
                                                        onChange={(event) => setField('triggerNote', event.target.value)}
                                                        placeholder="Admin note for audit"
                                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className={`rounded-xl p-3 text-xs ${isPayoutPromotion(formData.promotionType) ? 'bg-amber-500/5 border border-amber-500/20 text-amber-200/85' : 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-300/80'}`}>
                                        <span className={`font-bold ${isPayoutPromotion(formData.promotionType) ? 'text-amber-300' : 'text-emerald-300'}`}>Promo preview: </span>
                                        {isPayoutPromotion(formData.promotionType) ? (
                                            <>
                                                On a losing bet whose normal winner return would be <strong className="text-white">₹2,000</strong>, the user still receives{' '}
                                                <strong className="text-amber-400">₹{getPreviewAmount(formData)}</strong>
                                            </>
                                        ) : (
                                            <>
                                                Bet <strong className="text-white">₹1,000</strong> on <strong className="text-white">{formData.eventName || 'this match'}</strong> and lose → user receives{' '}
                                                <strong className="text-emerald-400">₹{getPreviewAmount(formData)}</strong>
                                            </>
                                        )}
                                        {formData.maxRefundAmount !== '' && Number(formData.maxRefundAmount) > 0 ? (
                                            <span> capped at <strong className={isPayoutPromotion(formData.promotionType) ? 'text-amber-400' : 'text-emerald-400'}>{formatCurrency(Number(formData.maxRefundAmount))}</strong></span>
                                        ) : null}
                                        {' '}in the {formatWalletLabel(formData.walletType).toLowerCase()}.
                                        <div className="mt-1 text-slate-500">
                                            {getTriggerSummary({ promotionType: formData.promotionType, triggerConfig: formData })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <SectionHeader icon={Palette} label="3 · Promotion Card Design" />
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <label className="block text-xs text-slate-400 font-bold">Card Title</label>
                                            <button
                                                type="button"
                                                onClick={() => setField('cardTitle', suggestedTitle)}
                                                className="text-[11px] text-indigo-300 hover:text-indigo-200"
                                            >
                                                Use suggested copy
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={formData.cardTitle}
                                            onChange={(event) => setField('cardTitle', event.target.value)}
                                            placeholder={suggestedTitle}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <label className="block text-xs text-slate-400 font-bold">Card Description</label>
                                            <button
                                                type="button"
                                                onClick={() => setField('cardDescription', suggestedDescription)}
                                                className="text-[11px] text-indigo-300 hover:text-indigo-200"
                                            >
                                                Use suggested copy
                                            </button>
                                        </div>
                                        <textarea
                                            rows={2}
                                            value={formData.cardDescription}
                                            onChange={(event) => setField('cardDescription', event.target.value)}
                                            placeholder={suggestedDescription}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:border-indigo-500 outline-none text-sm resize-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-2">Background Gradient</label>
                                        <div className="flex gap-2 flex-wrap items-center">
                                            {GRADIENT_PRESETS.map((preset) => (
                                                <button
                                                    key={preset.value}
                                                    type="button"
                                                    onClick={() => setField('cardGradient', preset.value)}
                                                    className={`w-8 h-8 rounded-full border-2 transition-all ${formData.cardGradient === preset.value ? 'border-white scale-110' : 'border-transparent'}`}
                                                    style={{ background: preset.value }}
                                                    title={preset.label}
                                                />
                                            ))}
                                            <input
                                                type="text"
                                                value={formData.cardGradient}
                                                onChange={(event) => setField('cardGradient', event.target.value)}
                                                placeholder="Custom CSS gradient"
                                                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-slate-400 font-bold mb-1.5 flex items-center gap-1">
                                                <Image size={11} /> Background Image URL
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={formData.cardBgImage}
                                                    onChange={(event) => setField('cardBgImage', event.target.value)}
                                                    placeholder="https://..."
                                                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none text-xs"
                                                />
                                                <label className="flex items-center px-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer border border-slate-600 transition-colors">
                                                    {uploading ? <Loader2 size={14} className="animate-spin text-white" /> : <Plus size={14} className="text-white" />}
                                                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleImageUpload} />
                                                </label>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs text-slate-400 font-bold mb-1.5 flex items-center gap-1">
                                                <Tag size={11} /> Badge Label
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.cardBadge}
                                                onChange={(event) => setField('cardBadge', event.target.value)}
                                                placeholder={promotionMeta.defaultBadge}
                                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-2">Live Preview</label>
                                        <div
                                            className="w-72 h-40 rounded-xl overflow-hidden relative mx-auto border border-white/10"
                                            style={{ background: formData.cardGradient }}
                                        >
                                            {formData.cardBgImage && (
                                                <img src={formData.cardBgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent p-3 flex flex-col justify-end">
                                                {(formData.cardBadge || promotionMeta.defaultBadge) && (
                                                    <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded font-bold mb-1.5 self-start">
                                                        {formData.cardBadge || promotionMeta.defaultBadge}
                                                    </span>
                                                )}
                                                <div className="text-xs font-black text-white leading-tight mb-1">
                                                    {formData.cardTitle || suggestedTitle}
                                                </div>
                                                <div className="text-[10px] text-white/75 leading-tight line-clamp-2">
                                                    {formData.cardDescription || suggestedDescription}
                                                </div>
                                                <div className="mt-2 flex items-center justify-between">
                                                    <span className={`text-[10px] bg-black/30 font-bold px-2 py-0.5 rounded-full ${isPayoutPromotion(formData.promotionType) ? 'text-amber-300' : 'text-emerald-300'}`}>
                                                        {getRewardPillLabel(formData.promotionType, formData.refundPercentage)}
                                                    </span>
                                                    <button type="button" className="text-[9px] bg-white text-black font-black px-2 py-0.5 rounded">
                                                        BET NOW
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <SectionHeader icon={Hash} label="4 · Visibility & Settings" />
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1.5">Display Order</label>
                                        <input
                                            type="number"
                                            value={formData.order}
                                            onChange={(event) => setField('order', Number(event.target.value) || 0)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:border-indigo-500 outline-none text-sm"
                                        />
                                    </div>

                                    <div className="space-y-3 pt-4">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <Toggle checked={formData.isActive} onChange={(value) => setField('isActive', value)} />
                                            <span className="text-sm text-slate-300">Promotion active</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <Toggle checked={formData.showOnPromotionsPage} onChange={(value) => setField('showOnPromotionsPage', value)} />
                                            <span className="text-sm text-slate-300">Show on website promotions page</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
                                    <AlertTriangle size={14} /> {error}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-700 sticky bottom-0 bg-slate-800">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors text-sm"
                            >
                                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                {editing ? 'Save Changes' : 'Create Promotion'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {earlySixListOpen && selectedEarlySixPromo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
                            <div>
                                <h2 className="text-lg font-bold text-white">Early Six Bet List</h2>
                                <p className="mt-1 text-xs text-slate-400">
                                    {selectedEarlySixPromo.eventName || 'Selected match'}
                                    {(selectedEarlySixPromo.triggerConfig?.qualifyingSelections || []).length > 0
                                        ? ` · Qualified: ${selectedEarlySixPromo.triggerConfig.qualifyingSelections.join(', ')}`
                                        : ''}
                                </p>
                            </div>
                            <button
                                onClick={() => setEarlySixListOpen(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 px-5 py-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs text-slate-400">
                                    Only Match Odds bets are shown below. Only the first qualifying pre-match Match Odds bet per user can be refunded.
                                </p>
                                <button
                                    onClick={handleRefundEarlySix}
                                    disabled={earlySixRefundLoading || earlySixBets.every((bet) => !bet.refundable)}
                                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {earlySixRefundLoading ? 'Refunding...' : 'Refund Eligible Bets'}
                                </button>
                            </div>

                            {earlySixListLoading ? (
                                <div className="py-12 text-center text-sm text-slate-400">
                                    Loading Early Six bets...
                                </div>
                            ) : earlySixBets.length === 0 ? (
                                <div className="py-12 text-center text-sm text-slate-400">
                                    No Match Odds bets found for this match yet.
                                </div>
                            ) : (
                                <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-700">
                                    <table className="min-w-full text-sm">
                                        <thead className="sticky top-0 bg-slate-900/95">
                                            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                                                <th className="px-4 py-3">User</th>
                                                <th className="px-4 py-3">Selection</th>
                                                <th className="px-4 py-3">Stake</th>
                                                <th className="px-4 py-3">Refund</th>
                                                <th className="px-4 py-3">Outcome</th>
                                                <th className="px-4 py-3">Eligibility</th>
                                                <th className="px-4 py-3">Placed</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {earlySixBets.map((bet) => (
                                                <tr key={bet.id} className="border-t border-slate-700">
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-white">{bet.username}</div>
                                                        <div className="text-[11px] text-slate-500">
                                                            #{bet.userId}{bet.email ? ` · ${bet.email}` : ''}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-slate-200">{bet.selectionName}</div>
                                                        <div className="text-[11px] text-slate-500">{bet.marketName}</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-slate-200">{formatCurrency(bet.stake)}</td>
                                                    <td className="px-4 py-3 font-mono text-emerald-300">{bet.refundAmount > 0 ? formatCurrency(bet.refundAmount) : '—'}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                                            bet.status === 'WON'
                                                                ? 'bg-emerald-500/10 text-emerald-300'
                                                                : bet.status === 'LOST'
                                                                    ? 'bg-red-500/10 text-red-300'
                                                                    : bet.status === 'VOID'
                                                                        ? 'bg-amber-500/10 text-amber-300'
                                                                        : 'bg-slate-700 text-slate-300'
                                                        }`}>
                                                            {bet.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                                            bet.refunded
                                                                ? 'bg-sky-500/10 text-sky-300'
                                                                : bet.refundable
                                                                    ? 'bg-emerald-500/10 text-emerald-300'
                                                                    : bet.countedForEarlySix
                                                                        ? 'bg-violet-500/10 text-violet-300'
                                                                        : 'bg-slate-700 text-slate-300'
                                                        }`}>
                                                            {bet.eligibilityLabel}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-[11px] text-slate-400">{formatDateTime(bet.createdAt)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
