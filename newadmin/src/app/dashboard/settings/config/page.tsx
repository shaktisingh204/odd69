"use client";

import React, { useEffect, useState, useRef } from 'react';
import { getSystemConfig, updateSystemConfig, sendTestEmail, uploadPublicImage } from '@/actions/settings';
import { Save, Settings, AlertTriangle, BarChart2, Code, Mail, Send, Eye, EyeOff, Upload, X, Link as LinkIcon, Plus, Trash2, ArrowUp, ArrowDown, Navigation, Globe } from 'lucide-react';

type SocialKey = 'whatsapp' | 'telegram' | 'instagram' | 'facebook' | 'x' | 'pinterest' | 'threads';
type FooterSocialEntry = { url: string; imageUrl: string };
type FooterSocials = Record<SocialKey, FooterSocialEntry>;
type HighlightKey = 'provablyFair' | 'fastAssistance' | 'secureWallet' | 'vipBenefits';
type FooterHighlightIcons = Record<HighlightKey, string>;
type FooterSettings = {
    businessEmail: string;
    partnersEmail: string;
    socials: FooterSocials;
    highlightIcons: FooterHighlightIcons;
};

const DEFAULT_FOOTER_SETTINGS: FooterSettings = {
    businessEmail: 'business@zeero.bet',
    partnersEmail: 'partners@zeero.bet',
    socials: {
        whatsapp:  { url: '', imageUrl: '' },
        telegram:  { url: '', imageUrl: '' },
        instagram: { url: '', imageUrl: '' },
        facebook:  { url: '', imageUrl: '' },
        x:         { url: '', imageUrl: '' },
        pinterest: { url: '', imageUrl: '' },
        threads:   { url: '', imageUrl: '' },
    },
    highlightIcons: {
        provablyFair: '',
        fastAssistance: '',
        secureWallet: '',
        vipBenefits: '',
    },
};

const HIGHLIGHT_META: { key: HighlightKey; title: string; description: string; placeholderClass: string; initial: string }[] = [
    { key: 'provablyFair',   title: 'Provably fair',   description: 'See how Zeero keeps outcomes transparent and verifiable.', placeholderClass: 'text-[#74A7FF] bg-[#74A7FF]/20',   initial: '🛡' },
    { key: 'fastAssistance', title: 'Fast assistance', description: 'Browse guides or reach our team without leaving the footer.', placeholderClass: 'text-[#3B78FF] bg-[#3B78FF]/20', initial: '🎧' },
    { key: 'secureWallet',   title: 'Secure wallet',   description: 'Manage deposits, withdrawals, and balances with confidence.', placeholderClass: 'text-amber-400 bg-amber-400/20', initial: '👛' },
    { key: 'vipBenefits',    title: 'VIP benefits',    description: 'Explore elevated rewards, perks, and premium account care.', placeholderClass: 'text-[#C18BFF] bg-[#C18BFF]/20',  initial: '⚡' },
];

const SOCIAL_META: { key: SocialKey; label: string; initial: string; bgClassName: string }[] = [
    { key: 'whatsapp',  label: 'WhatsApp',  initial: 'W', bgClassName: 'bg-[#25D366] text-white' },
    { key: 'telegram',  label: 'Telegram',  initial: 'T', bgClassName: 'bg-[#27A5E7] text-white' },
    { key: 'instagram', label: 'Instagram', initial: 'I', bgClassName: 'bg-[linear-gradient(135deg,#F9CE34_0%,#EE2A7B_52%,#6228D7_100%)] text-white' },
    { key: 'facebook',  label: 'Facebook',  initial: 'F', bgClassName: 'bg-[#1877F2] text-white' },
    { key: 'x',         label: 'X',         initial: 'X', bgClassName: 'bg-white text-[#111214]' },
    { key: 'pinterest', label: 'Pinterest', initial: 'P', bgClassName: 'bg-[#BD081C] text-white' },
    { key: 'threads',   label: 'Threads',   initial: '@', bgClassName: 'bg-white text-[#111214]' },
];

function parseFooterSettings(raw?: string): FooterSettings {
    if (!raw) return DEFAULT_FOOTER_SETTINGS;
    try {
        const parsed = JSON.parse(raw) as Partial<FooterSettings>;
        const socials: FooterSocials = { ...DEFAULT_FOOTER_SETTINGS.socials };
        if (parsed.socials) {
            for (const key of Object.keys(DEFAULT_FOOTER_SETTINGS.socials) as SocialKey[]) {
                const entry = (parsed.socials as Partial<FooterSocials>)[key];
                socials[key] = {
                    url: entry?.url || '',
                    imageUrl: entry?.imageUrl || '',
                };
            }
        }
        const highlightIcons: FooterHighlightIcons = { ...DEFAULT_FOOTER_SETTINGS.highlightIcons };
        if (parsed.highlightIcons) {
            for (const k of Object.keys(DEFAULT_FOOTER_SETTINGS.highlightIcons) as HighlightKey[]) {
                const val = (parsed.highlightIcons as Partial<FooterHighlightIcons>)[k];
                if (typeof val === 'string') highlightIcons[k] = val;
            }
        }
        return {
            businessEmail: parsed.businessEmail || DEFAULT_FOOTER_SETTINGS.businessEmail,
            partnersEmail: parsed.partnersEmail || DEFAULT_FOOTER_SETTINGS.partnersEmail,
            socials,
            highlightIcons,
        };
    } catch {
        return DEFAULT_FOOTER_SETTINGS;
    }
}

// ── Footer certifications bar ────────────────────────────────────────────────
type CertificationItem = {
    id: string;
    imageUrl: string;
    alt: string;
    href: string;
    visible: boolean;
};

type FooterCertifications = {
    enabled: boolean;
    awardsTitle: string;
    partnersTitle: string;
    awards: CertificationItem[];
    partners: CertificationItem[];
};

const DEFAULT_FOOTER_CERTIFICATIONS: FooterCertifications = {
    enabled: false,
    awardsTitle: 'Awards & recognitions',
    partnersTitle: 'Responsible gaming & partners',
    awards: [],
    partners: [],
};

function parseFooterCertifications(raw?: string): FooterCertifications {
    if (!raw) return DEFAULT_FOOTER_CERTIFICATIONS;
    try {
        const parsed = JSON.parse(raw) as Partial<FooterCertifications>;
        const normalize = (arr: unknown): CertificationItem[] => {
            if (!Array.isArray(arr)) return [];
            return arr
                .filter((x: any) => x && typeof x.imageUrl === 'string')
                .map((x: any, i: number) => ({
                    id: String(x.id || `cert-${Date.now()}-${i}`),
                    imageUrl: String(x.imageUrl || ''),
                    alt: String(x.alt || ''),
                    href: String(x.href || ''),
                    visible: x.visible !== false,
                }));
        };
        return {
            enabled: Boolean(parsed.enabled),
            awardsTitle: typeof parsed.awardsTitle === 'string' ? parsed.awardsTitle : DEFAULT_FOOTER_CERTIFICATIONS.awardsTitle,
            partnersTitle: typeof parsed.partnersTitle === 'string' ? parsed.partnersTitle : DEFAULT_FOOTER_CERTIFICATIONS.partnersTitle,
            awards: normalize(parsed.awards),
            partners: normalize(parsed.partners),
        };
    } catch {
        return DEFAULT_FOOTER_CERTIFICATIONS;
    }
}

// ── Header logo ──────────────────────────────────────────────────────────────
type HeaderLogo = {
    imageUrl: string;
    text: string;
    accentText: string;
};

const DEFAULT_HEADER_LOGO: HeaderLogo = {
    imageUrl: '',
    text: 'Zeero',
    accentText: 'Ze',
};

function parseHeaderLogo(raw?: string): HeaderLogo {
    if (!raw) return DEFAULT_HEADER_LOGO;
    try {
        const parsed = JSON.parse(raw);
        return {
            imageUrl: typeof parsed?.imageUrl === 'string' ? parsed.imageUrl : '',
            text: typeof parsed?.text === 'string' && parsed.text ? parsed.text : DEFAULT_HEADER_LOGO.text,
            accentText: typeof parsed?.accentText === 'string' ? parsed.accentText : '',
        };
    } catch {
        return DEFAULT_HEADER_LOGO;
    }
}

// ── Header nav links ─────────────────────────────────────────────────────────
type HeaderNavLink = {
    id: string;
    name: string;
    path: string;
    exact?: boolean;
    isHot?: boolean;
    external?: boolean;
};

const DEFAULT_HEADER_NAV_LINKS: HeaderNavLink[] = [
    { id: 'home',         name: 'Home',         path: '/',             exact: true },
    { id: 'casino',       name: 'Casino',       path: '/casino' },
    { id: 'sports',       name: 'Sports',       path: '/sports' },
    { id: 'live-dealers', name: 'Live Dealers', path: '/live-dealers', isHot: true },
    { id: 'support',      name: 'Support',      path: '/support' },
];

function parseHeaderNavLinks(raw?: string): HeaderNavLink[] {
    if (!raw) return DEFAULT_HEADER_NAV_LINKS;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return DEFAULT_HEADER_NAV_LINKS;
        return parsed
            .filter((x: any) => x && typeof x.name === 'string' && typeof x.path === 'string')
            .map((x: any, i: number) => ({
                id: String(x.id || `link-${i}-${Date.now()}`),
                name: String(x.name),
                path: String(x.path),
                exact: Boolean(x.exact),
                isHot: Boolean(x.isHot),
                external: Boolean(x.external),
            }));
    } catch {
        return DEFAULT_HEADER_NAV_LINKS;
    }
}

// ── SEO / Meta Data ─────────────────────────────────────────────────────────
type SiteMeta = {
    siteTitle: string;
    siteDescription: string;
    metaKeywords: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    twitterCard: 'summary' | 'summary_large_image';
    canonicalUrl: string;
    robots: string;
};

const DEFAULT_SITE_META: SiteMeta = {
    siteTitle: '',
    siteDescription: '',
    metaKeywords: '',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
    twitterCard: 'summary_large_image',
    canonicalUrl: '',
    robots: 'index, follow',
};

function parseSiteMeta(raw?: string): SiteMeta {
    if (!raw) return DEFAULT_SITE_META;
    try {
        const parsed = JSON.parse(raw);
        return {
            siteTitle: typeof parsed.siteTitle === 'string' ? parsed.siteTitle : '',
            siteDescription: typeof parsed.siteDescription === 'string' ? parsed.siteDescription : '',
            metaKeywords: typeof parsed.metaKeywords === 'string' ? parsed.metaKeywords : '',
            ogTitle: typeof parsed.ogTitle === 'string' ? parsed.ogTitle : '',
            ogDescription: typeof parsed.ogDescription === 'string' ? parsed.ogDescription : '',
            ogImage: typeof parsed.ogImage === 'string' ? parsed.ogImage : '',
            twitterCard: parsed.twitterCard === 'summary' ? 'summary' : 'summary_large_image',
            canonicalUrl: typeof parsed.canonicalUrl === 'string' ? parsed.canonicalUrl : '',
            robots: typeof parsed.robots === 'string' ? parsed.robots : 'index, follow',
        };
    } catch {
        return DEFAULT_SITE_META;
    }
}

type MaintenanceScope = 'platform' | 'sports' | 'casino';

type MaintenanceState = Record<MaintenanceScope, { enabled: boolean; message: string }>;

const defaultMaintenanceState: MaintenanceState = {
    platform: { enabled: false, message: '' },
    sports: { enabled: false, message: '' },
    casino: { enabled: false, message: '' },
};

function parseMaintenanceState(configMap: Record<string, string>): MaintenanceState {
    let parsed: Partial<MaintenanceState> = {};

    if (configMap.MAINTENANCE_CONFIG) {
        try {
            parsed = JSON.parse(configMap.MAINTENANCE_CONFIG);
        } catch { }
    }

    const normalize = (scope: MaintenanceScope) => ({
        enabled: Boolean(parsed?.[scope]?.enabled),
        message: String(parsed?.[scope]?.message || '').trim(),
    });

    const nextState: MaintenanceState = {
        platform: normalize('platform'),
        sports: normalize('sports'),
        casino: normalize('casino'),
    };

    if (configMap.MAINTENANCE_MODE === 'true') {
        nextState.platform.enabled = true;
    }
    if (!nextState.platform.message && configMap.MAINTENANCE_MESSAGE) {
        nextState.platform.message = configMap.MAINTENANCE_MESSAGE;
    }

    return nextState;
}

export default function SystemConfigPage() {
    const [config, setConfig] = useState<any>({});
    const [maintenanceState, setMaintenanceState] = useState<MaintenanceState>(defaultMaintenanceState);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSmtpPassword, setShowSmtpPassword] = useState(false);
    const [testEmailTo, setTestEmailTo] = useState('');
    const [testingEmail, setTestingEmail] = useState(false);
    const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);
    const [smtpConfig, setSmtpConfig] = useState({
        host: '', port: '587', user: '', password: '', fromName: '', fromEmail: '', secure: 'false',
    });
    const [uploadingFavicon, setUploadingFavicon] = useState(false);
    const faviconInputRef = useRef<HTMLInputElement>(null);
    const [footerSettings, setFooterSettings] = useState<FooterSettings>(DEFAULT_FOOTER_SETTINGS);
    const [headerNavLinks, setHeaderNavLinks] = useState<HeaderNavLink[]>(DEFAULT_HEADER_NAV_LINKS);
    const [headerLogo, setHeaderLogo] = useState<HeaderLogo>(DEFAULT_HEADER_LOGO);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const headerLogoInputRef = useRef<HTMLInputElement>(null);
    const [uploadingSocial, setUploadingSocial] = useState<SocialKey | null>(null);
    const socialInputRefs = useRef<Record<SocialKey, HTMLInputElement | null>>({
        whatsapp: null, telegram: null, instagram: null, facebook: null, x: null, pinterest: null, threads: null,
    });
    const [uploadingHighlight, setUploadingHighlight] = useState<HighlightKey | null>(null);
    const highlightInputRefs = useRef<Record<HighlightKey, HTMLInputElement | null>>({
        provablyFair: null, fastAssistance: null, secureWallet: null, vipBenefits: null,
    });
    const [footerCertifications, setFooterCertifications] = useState<FooterCertifications>(DEFAULT_FOOTER_CERTIFICATIONS);
    const [uploadingCertId, setUploadingCertId] = useState<string | null>(null);
    const certInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [siteMeta, setSiteMeta] = useState<SiteMeta>(DEFAULT_SITE_META);
    const [uploadingOgImage, setUploadingOgImage] = useState(false);
    const ogImageInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await getSystemConfig();
            if (res.success && res.data) {
                setConfig(res.data);
                setMaintenanceState(parseMaintenanceState(res.data));
                // Load SMTP from SMTP_SETTINGS key if present
                if (res.data.SMTP_SETTINGS) {
                    try {
                        const parsed = JSON.parse(res.data.SMTP_SETTINGS);
                        setSmtpConfig(prev => ({ ...prev, ...parsed }));
                    } catch { }
                }
                // Load footer settings from FOOTER_SETTINGS key
                setFooterSettings(parseFooterSettings(res.data.FOOTER_SETTINGS));
                // Load header nav links + logo
                setHeaderNavLinks(parseHeaderNavLinks(res.data.HEADER_NAV_LINKS));
                setHeaderLogo(parseHeaderLogo(res.data.HEADER_LOGO));
                setFooterCertifications(parseFooterCertifications(res.data.FOOTER_CERTIFICATIONS));
                setSiteMeta(parseSiteMeta(res.data.SITE_META));
            }
        } catch (error) {
            console.error("Failed to fetch config", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...config,
                MAINTENANCE_MODE: String(maintenanceState.platform.enabled),
                MAINTENANCE_MESSAGE: maintenanceState.platform.message || '',
                MAINTENANCE_CONFIG: JSON.stringify(maintenanceState),
                FOOTER_SETTINGS: JSON.stringify(footerSettings),
                HEADER_NAV_LINKS: JSON.stringify(headerNavLinks),
                HEADER_LOGO: JSON.stringify(headerLogo),
                FOOTER_CERTIFICATIONS: JSON.stringify(footerCertifications),
                SITE_META: JSON.stringify(siteMeta),
            };
            const res = await updateSystemConfig(payload);
            if (res.success) {
                alert("Configuration saved successfully");
            } else {
                alert("Failed to save configuration");
            }
        } catch (error) {
            console.error("Failed to save config", error);
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key: string, value: string) => {
        setConfig((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleMaintenanceChange = (
        scope: MaintenanceScope,
        key: 'enabled' | 'message',
        value: boolean | string,
    ) => {
        setMaintenanceState(prev => ({
            ...prev,
            [scope]: {
                ...prev[scope],
                [key]: value,
            },
        }));
    };

    const handleSmtpChange = (key: string, value: string) => {
        setSmtpConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveSmtp = async () => {
        setSaving(true);
        try {
            const res = await updateSystemConfig({ SMTP_SETTINGS: JSON.stringify(smtpConfig) });
            if (res.success) {
                alert('SMTP settings saved successfully!');
            } else {
                alert('Failed to save SMTP settings.');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleFaviconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadingFavicon(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'system-config');

            const res = await uploadPublicImage(formData);
            if (res.success && res.url) {
                handleChange('FAVICON_URL', res.url);
            } else {
                alert(`Upload failed: ${res.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error(error);
            alert('Upload failed due to network error.');
        } finally {
            setUploadingFavicon(false);
            if (faviconInputRef.current) faviconInputRef.current.value = '';
        }
    };

    const handleSocialImageUpload = async (key: SocialKey, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setUploadingSocial(key);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'footer-socials');
            const res = await uploadPublicImage(formData);
            if (res.success && res.url) {
                setFooterSettings(prev => ({
                    ...prev,
                    socials: {
                        ...prev.socials,
                        [key]: { ...prev.socials[key], imageUrl: res.url! },
                    },
                }));
            } else {
                alert(`Upload failed: ${res.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error(error);
            alert('Upload failed due to network error.');
        } finally {
            setUploadingSocial(null);
            const input = socialInputRefs.current[key];
            if (input) input.value = '';
        }
    };

    const handleSocialUrlChange = (key: SocialKey, url: string) => {
        setFooterSettings(prev => ({
            ...prev,
            socials: { ...prev.socials, [key]: { ...prev.socials[key], url } },
        }));
    };

    const handleSocialImageRemove = (key: SocialKey) => {
        setFooterSettings(prev => ({
            ...prev,
            socials: { ...prev.socials, [key]: { ...prev.socials[key], imageUrl: '' } },
        }));
    };

    const handleHighlightIconUpload = async (key: HighlightKey, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setUploadingHighlight(key);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'footer-highlights');
            const res = await uploadPublicImage(formData);
            if (res.success && res.url) {
                setFooterSettings(prev => ({
                    ...prev,
                    highlightIcons: { ...prev.highlightIcons, [key]: res.url! },
                }));
            } else {
                alert(`Upload failed: ${res.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error(error);
            alert('Upload failed due to network error.');
        } finally {
            setUploadingHighlight(null);
            const input = highlightInputRefs.current[key];
            if (input) input.value = '';
        }
    };

    const handleHighlightIconRemove = (key: HighlightKey) => {
        setFooterSettings(prev => ({
            ...prev,
            highlightIcons: { ...prev.highlightIcons, [key]: '' },
        }));
    };

    // ── Footer certifications bar handlers ──────────────────────────────────
    const addCertificationItem = (group: 'awards' | 'partners') => {
        setFooterCertifications(prev => ({
            ...prev,
            [group]: [
                ...prev[group],
                {
                    id: `cert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    imageUrl: '',
                    alt: '',
                    href: '',
                    visible: true,
                },
            ],
        }));
    };

    const updateCertificationItem = (group: 'awards' | 'partners', id: string, patch: Partial<CertificationItem>) => {
        setFooterCertifications(prev => ({
            ...prev,
            [group]: prev[group].map(item => (item.id === id ? { ...item, ...patch } : item)),
        }));
    };

    const removeCertificationItem = (group: 'awards' | 'partners', id: string) => {
        setFooterCertifications(prev => ({
            ...prev,
            [group]: prev[group].filter(item => item.id !== id),
        }));
    };

    const moveCertificationItem = (group: 'awards' | 'partners', id: string, dir: -1 | 1) => {
        setFooterCertifications(prev => {
            const arr = [...prev[group]];
            const idx = arr.findIndex(item => item.id === id);
            if (idx < 0) return prev;
            const target = idx + dir;
            if (target < 0 || target >= arr.length) return prev;
            [arr[idx], arr[target]] = [arr[target], arr[idx]];
            return { ...prev, [group]: arr };
        });
    };

    const handleCertificationImageUpload = async (
        group: 'awards' | 'partners',
        id: string,
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setUploadingCertId(id);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'footer-certifications');
            const res = await uploadPublicImage(formData);
            if (res.success && res.url) {
                updateCertificationItem(group, id, { imageUrl: res.url });
            } else {
                alert(`Upload failed: ${res.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error(error);
            alert('Upload failed due to network error.');
        } finally {
            setUploadingCertId(null);
            const input = certInputRefs.current[id];
            if (input) input.value = '';
        }
    };

    // ── Header logo handlers ────────────────────────────────────────────────
    const handleHeaderLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setUploadingLogo(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'header-logo');
            const res = await uploadPublicImage(formData);
            if (res.success && res.url) {
                setHeaderLogo(prev => ({ ...prev, imageUrl: res.url! }));
            } else {
                alert(`Upload failed: ${res.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error(error);
            alert('Upload failed due to network error.');
        } finally {
            setUploadingLogo(false);
            if (headerLogoInputRef.current) headerLogoInputRef.current.value = '';
        }
    };

    // ── Header nav link handlers ────────────────────────────────────────────
    const addHeaderNavLink = () => {
        setHeaderNavLinks(prev => [
            ...prev,
            { id: `link-${Date.now()}`, name: '', path: '', exact: false, isHot: false, external: false },
        ]);
    };

    const updateHeaderNavLink = (id: string, patch: Partial<HeaderNavLink>) => {
        setHeaderNavLinks(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
    };

    const removeHeaderNavLink = (id: string) => {
        setHeaderNavLinks(prev => prev.filter(l => l.id !== id));
    };

    const moveHeaderNavLink = (id: string, dir: -1 | 1) => {
        setHeaderNavLinks(prev => {
            const idx = prev.findIndex(l => l.id === id);
            if (idx < 0) return prev;
            const target = idx + dir;
            if (target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            [next[idx], next[target]] = [next[target], next[idx]];
            return next;
        });
    };

    // ── OG image upload handler ──────────────────────────────────────────────
    const handleOgImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setUploadingOgImage(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'seo-meta');
            const res = await uploadPublicImage(formData);
            if (res.success && res.url) {
                setSiteMeta(prev => ({ ...prev, ogImage: res.url! }));
            } else {
                alert(`Upload failed: ${res.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error(error);
            alert('Upload failed due to network error.');
        } finally {
            setUploadingOgImage(false);
            if (ogImageInputRef.current) ogImageInputRef.current.value = '';
        }
    };

    const resetHeaderNavLinks = () => {
        if (confirm('Reset header navigation to default links?')) {
            setHeaderNavLinks(DEFAULT_HEADER_NAV_LINKS);
        }
    };

    const handleTestEmail = async () => {
        if (!testEmailTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmailTo)) {
            setTestEmailResult({ success: false, message: 'Enter a valid email address.' });
            return;
        }
        setTestingEmail(true);
        setTestEmailResult(null);
        try {
            // Internal server action — no backend API call needed
            const result = await sendTestEmail(testEmailTo);
            setTestEmailResult({ success: result.success, message: result.message });
        } catch (err: any) {
            setTestEmailResult({ success: false, message: err?.message || 'Failed to send test email.' });
        } finally {
            setTestingEmail(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading configuration...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">System Configuration</h1>
                    <p className="text-slate-400 mt-1">Manage global system settings and feature flags.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                    {saving ? 'Saving...' : <><Save size={20} /> Save Changes</>}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* General Settings */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings size={20} className="text-indigo-400" />
                        General Settings
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Platform Name</label>
                        <input
                            type="text"
                            value={config.PLATFORM_NAME || ''}
                            onChange={e => handleChange('PLATFORM_NAME', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-indigo-500 outline-none"
                            placeholder="100xWins"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Support Email</label>
                        <input
                            type="email"
                            value={config.SUPPORT_EMAIL || ''}
                            onChange={e => handleChange('SUPPORT_EMAIL', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-indigo-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Platform Favicon (All Devices)</label>
                        <div className="flex items-center gap-3">
                            {config.FAVICON_URL ? (
                                <div className="relative group w-12 h-12 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-center p-1">
                                    <img src={config.FAVICON_URL} alt="Favicon" className="max-w-full max-h-full object-contain rounded" />
                                    <button
                                        onClick={() => handleChange('FAVICON_URL', '')}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Remove favicon"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ) : null}
                            <button
                                onClick={() => faviconInputRef.current?.click()}
                                disabled={uploadingFavicon}
                                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
                            >
                                <Upload size={16} />
                                {uploadingFavicon ? 'Uploading...' : 'Upload Favicon'}
                            </button>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={faviconInputRef}
                                onChange={handleFaviconUpload}
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Recommended size: 512x512 PNG. Shown on browser tabs, bookmarks, and mobile home screens.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Maintenance Mode</label>
                        <select
                            value={maintenanceState.platform.enabled ? 'true' : 'false'}
                            onChange={e => handleMaintenanceChange('platform', 'enabled', e.target.value === 'true')}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-indigo-500 outline-none"
                        >
                            <option value="false">Disabled (Site Live)</option>
                            <option value="true">Enabled (Site Offline)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Platform Maintenance Message</label>
                        <textarea
                            value={maintenanceState.platform.message}
                            onChange={e => handleMaintenanceChange('platform', 'message', e.target.value)}
                            rows={3}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-indigo-500 outline-none resize-y"
                            placeholder="Shown when the full platform is offline."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Maintenance Bypass Users</label>
                        <input
                            type="text"
                            value={config.MAINTENANCE_ALLOWED_USERS || ''}
                            onChange={e => handleChange('MAINTENANCE_ALLOWED_USERS', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-indigo-500 outline-none"
                            placeholder="username1, email@example.com"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Comma-separated usernames or emails allowed to bypass platform maintenance.</p>
                    </div>
                </div>

                {/* Financial Settings */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <AlertTriangle size={20} className="text-yellow-400" />
                        Financial Limits
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Min Deposit <span className="text-slate-600 text-xs">(UPI Gateway 1)</span></label>
                        <input
                            type="number"
                            value={config.MIN_DEPOSIT || ''}
                            onChange={e => handleChange('MIN_DEPOSIT', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-indigo-500 outline-none"
                            placeholder="e.g. 100"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Min Deposit <span className="text-slate-600 text-xs">(UPI Gateway 2)</span></label>
                        <input
                            type="number"
                            value={config.MIN_DEPOSIT_UPI2 || ''}
                            onChange={e => handleChange('MIN_DEPOSIT_UPI2', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-indigo-500 outline-none"
                            placeholder="e.g. 200"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Min Deposit <span className="text-slate-600 text-xs">(Crypto, USD)</span></label>
                        <input
                            type="number"
                            value={config.MIN_DEPOSIT_CRYPTO || ''}
                            onChange={e => handleChange('MIN_DEPOSIT_CRYPTO', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-indigo-500 outline-none"
                            placeholder="e.g. 10"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Min Withdrawal</label>
                        <input
                            type="number"
                            value={config.MIN_WITHDRAWAL || ''}
                            onChange={e => handleChange('MIN_WITHDRAWAL', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-indigo-500 outline-none"
                            placeholder="e.g. 500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                            Auto-Withdrawal Limit <span className="text-slate-600 text-xs">(Fiat, INR — above this needs admin dispatch)</span>
                        </label>
                        <input
                            type="number"
                            value={config.AUTO_WITHDRAW_FIAT_LIMIT || ''}
                            onChange={e => handleChange('AUTO_WITHDRAW_FIAT_LIMIT', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-indigo-500 outline-none"
                            placeholder="e.g. 1000"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Max Withdrawal</label>
                        <input
                            type="number"
                            value={config.MAX_WITHDRAWAL || ''}
                            onChange={e => handleChange('MAX_WITHDRAWAL', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-indigo-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Default Currency</label>
                        <input
                            type="text"
                            value={config.DEFAULT_CURRENCY || 'INR'}
                            onChange={e => handleChange('DEFAULT_CURRENCY', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-indigo-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-white">Section Maintenance</h2>
                        <p className="text-sm text-slate-400 mt-1">Pause individual products with a user-facing reason while keeping the rest of the site live.</p>
                    </div>
                    <div className="text-xs text-slate-500 max-w-xs text-right">
                        Sports maintenance blocks bet placement, cash out, webhook settlement, manual settlement, and cron settlement.
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {([
                        {
                            scope: 'sports' as const,
                            title: 'Sports',
                            description: 'Show the maintenance reason on sports pages and stop sports betting and settlement.',
                        },
                        {
                            scope: 'casino' as const,
                            title: 'Casino',
                            description: 'Show the maintenance reason on casino pages and block new game launches.',
                        },
                    ]).map((section) => (
                        <div key={section.scope} className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 space-y-4">
                            <div>
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                                    <select
                                        value={maintenanceState[section.scope].enabled ? 'true' : 'false'}
                                        onChange={(e) => handleMaintenanceChange(section.scope, 'enabled', e.target.value === 'true')}
                                        className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                    >
                                        <option value="false">Live</option>
                                        <option value="true">Maintenance</option>
                                    </select>
                                </div>
                                <p className="text-sm text-slate-400 mt-2">{section.description}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Reason Shown To Users</label>
                                <textarea
                                    value={maintenanceState[section.scope].message}
                                    onChange={(e) => handleMaintenanceChange(section.scope, 'message', e.target.value)}
                                    rows={4}
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-white focus:border-indigo-500 outline-none resize-y"
                                    placeholder={`Explain why ${section.title.toLowerCase()} is unavailable and when it will be back.`}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── UPI Gateway Control ─────────────────────────────────────── */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-5">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Settings size={20} className="text-emerald-400" />
                    UPI Gateway Control
                    <span className="ml-auto text-[11px] font-normal text-slate-500">Changes live-apply to deposit modal</span>
                </h2>

                {/* Gateway cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* UPI 1 */}
                    <div className={`rounded-xl border p-4 space-y-3 transition-all ${config.UPI1_ENABLED === 'false' ? 'border-slate-700 opacity-60' : 'border-emerald-500/30 bg-emerald-500/4'}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-white">UPI Gateway 1</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">NekPay — api.nekpayment.com</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={config.UPI1_ENABLED !== 'false'}
                                    onChange={e => handleChange('UPI1_ENABLED', e.target.checked ? 'true' : 'false')}
                                />
                                <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                            </label>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${config.UPI1_ENABLED !== 'false' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                                {config.UPI1_ENABLED !== 'false' ? '● ACTIVE' : '○ DISABLED'}
                            </span>
                            {config.DEFAULT_UPI_GATEWAY === 'UPI1' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-orange-500/15 text-orange-400">★ DEFAULT</span>
                            )}
                        </div>
                    </div>

                    {/* UPI 2 */}
                    <div className={`rounded-xl border p-4 space-y-3 transition-all ${config.UPI2_ENABLED === 'false' ? 'border-slate-700 opacity-60' : 'border-emerald-500/30 bg-emerald-500/4'}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-white">UPI Gateway 2</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">apiwht.wiki — /api/payIn</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={config.UPI2_ENABLED !== 'false'}
                                    onChange={e => handleChange('UPI2_ENABLED', e.target.checked ? 'true' : 'false')}
                                />
                                <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                            </label>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${config.UPI2_ENABLED !== 'false' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                                {config.UPI2_ENABLED !== 'false' ? '● ACTIVE' : '○ DISABLED'}
                            </span>
                            {config.DEFAULT_UPI_GATEWAY === 'UPI2' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-orange-500/15 text-orange-400">★ DEFAULT</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Default gateway selector */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">
                        Default Gateway <span className="text-slate-600 text-xs">(pre-selected in Deposit Modal)</span>
                    </label>
                    <div className="flex gap-3">
                        {(['UPI1', 'UPI2'] as const).map(gw => (
                            <button
                                key={gw}
                                onClick={() => handleChange('DEFAULT_UPI_GATEWAY', gw)}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all ${config.DEFAULT_UPI_GATEWAY === gw
                                    ? 'border-orange-500/60 bg-orange-500/10 text-orange-400'
                                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white'
                                    }`}
                            >
                                {gw === 'UPI1' ? '★ UPI Gateway 1' : '★ UPI Gateway 2'}
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1.5">
                        If both gateways are enabled the default will be pre-selected. Users can still switch manually.
                    </p>
                </div>
            </div>

            {/* ── Cashfree Gateway Integration ──────────────────────────────────── */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="text-xl">💳</span>
                            Cashfree Gateway Config
                        </h2>
                        <p className="text-[12px] text-slate-500 mt-1">
                            Domain URL for the PHP gateway bridge (e.g. https://anyleson.com/pay).
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                Cashfree Gateway Domain URL
                            </label>
                            <input
                                type="url"
                                value={config.CASHFREE_GATEWAY_URL || ''}
                                onChange={e => handleChange('CASHFREE_GATEWAY_URL', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white text-sm focus:border-indigo-500 outline-none placeholder-slate-600"
                                placeholder="https://anyleson.com/pay"
                            />
                            <p className="text-[10px] text-slate-600 mt-1">
                                Users are redirected to this endpoint to complete the checkout flow.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Manual Payment Gateway ──────────────────────────────────── */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="text-xl">💳</span>
                            Manual Payment Gateway
                        </h2>
                        <p className="text-[12px] text-slate-500 mt-1">
                            Fallback option shown to users when the UPI gateway fails. Users can pay via UPI scan and submit their UTR for admin approval.
                        </p>
                    </div>
                    {/* Enable/disable toggle */}
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={config.MANUAL_PAYMENT_ENABLED !== 'false'}
                            onChange={e => handleChange('MANUAL_PAYMENT_ENABLED', e.target.checked ? 'true' : 'false')}
                        />
                        <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500" />
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Left: fields */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                UPI ID / VPA
                                <span className="ml-1.5 text-slate-600 text-xs font-normal">e.g. payments@yourbank</span>
                            </label>
                            <input
                                type="text"
                                value={config.MANUAL_UPI_ID || ''}
                                onChange={e => handleChange('MANUAL_UPI_ID', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white font-mono text-sm focus:border-orange-500 outline-none placeholder-slate-600"
                                placeholder="yourname@upi"
                            />
                            <p className="text-[10px] text-slate-600 mt-1">
                                This UPI ID is shown as a scannable QR code in the deposit modal.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                QR Image URL
                                <span className="ml-1.5 text-slate-600 text-xs font-normal">optional override</span>
                            </label>
                            <input
                                type="url"
                                value={config.MANUAL_QR_URL || ''}
                                onChange={e => handleChange('MANUAL_QR_URL', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white text-sm focus:border-orange-500 outline-none placeholder-slate-600"
                                placeholder="https://example.com/qr.png"
                            />
                            <p className="text-[10px] text-slate-600 mt-1">
                                If provided, this image is shown instead of the auto-generated QR. Leave blank to auto-generate from UPI ID.
                            </p>
                        </div>

                        <div className={`rounded-lg p-3 border text-xs ${config.MANUAL_PAYMENT_ENABLED !== 'false' ? 'bg-orange-500/8 border-orange-500/25 text-orange-400' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                            {config.MANUAL_PAYMENT_ENABLED !== 'false' ? (
                                <>✅ <strong>Active</strong> — shown to users as a fallback after a failed deposit.</>
                            ) : (
                                <>⭕ <strong>Disabled</strong> — manual payment fallback is hidden from users.</>
                            )}
                        </div>
                    </div>

                    {/* Right: live QR preview */}
                    <div className="flex flex-col items-center justify-center gap-3 bg-slate-900 rounded-xl border border-slate-700 p-5">
                        <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">QR Preview</p>
                        {config.MANUAL_QR_URL ? (
                            <img
                                src={config.MANUAL_QR_URL}
                                alt="QR Preview"
                                className="w-36 h-36 object-contain rounded-lg bg-white p-1"
                                onError={(e: any) => { e.target.style.display = 'none'; }}
                            />
                        ) : config.MANUAL_UPI_ID ? (
                            <div className="p-3 bg-white rounded-xl">
                                {/* Static preview — actual QR is rendered on the user-facing deposit modal */}
                                <div className="w-32 h-32 bg-slate-100 rounded flex items-center justify-center text-center text-xs text-slate-500 leading-relaxed px-2">
                                    QR will be<br />auto-generated<br />from UPI ID<br /><strong className="text-slate-700 font-mono text-[10px] break-all">{config.MANUAL_UPI_ID}</strong>
                                </div>
                            </div>
                        ) : (
                            <div className="w-36 h-36 rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-center text-xs text-slate-600 px-3 leading-relaxed">
                                Set a UPI ID to see QR preview
                            </div>
                        )}
                        <p className="text-[10px] text-slate-600 text-center">
                            Support contacts (WhatsApp / Telegram) are pulled from the Contact Settings page.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── SEO & Meta Data ──────────────────────────────────────── */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-5">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                        <Globe size={20} className="text-emerald-400" />
                        SEO &amp; Meta Data
                    </h2>
                    <p className="text-[12px] text-slate-500">Configure how your website appears in search engines, social media shares, and browser tabs.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-400 mb-1">Site Title</label>
                        <input
                            type="text"
                            value={siteMeta.siteTitle}
                            onChange={e => setSiteMeta(prev => ({ ...prev, siteTitle: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-emerald-500 outline-none placeholder-slate-600"
                            placeholder="Zeero - Premium Sports Betting & Casino"
                        />
                        <p className="text-[10px] text-slate-600 mt-1">Displayed on browser tabs and as the default title in search results.</p>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-400 mb-1">Site Description</label>
                        <textarea
                            rows={3}
                            value={siteMeta.siteDescription}
                            onChange={e => setSiteMeta(prev => ({ ...prev, siteDescription: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-emerald-500 outline-none resize-y placeholder-slate-600"
                            placeholder="Experience the thrill of victory with Zeero. Sports betting, live casino, and more."
                        />
                        <p className="text-[10px] text-slate-600 mt-1">Shown below the title in search engine results. Keep it under 160 characters for best display.</p>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-400 mb-1">Meta Keywords</label>
                        <input
                            type="text"
                            value={siteMeta.metaKeywords}
                            onChange={e => setSiteMeta(prev => ({ ...prev, metaKeywords: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-emerald-500 outline-none placeholder-slate-600"
                            placeholder="sports betting, casino, live dealers, online gaming"
                        />
                        <p className="text-[10px] text-slate-600 mt-1">Comma-separated keywords. Helps with some search engines.</p>
                    </div>
                </div>

                {/* Open Graph */}
                <div className="border-t border-slate-700 pt-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Open Graph (Social Sharing)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">OG Title</label>
                            <input
                                type="text"
                                value={siteMeta.ogTitle}
                                onChange={e => setSiteMeta(prev => ({ ...prev, ogTitle: e.target.value }))}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-emerald-500 outline-none placeholder-slate-600"
                                placeholder="Leave empty to use Site Title"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Twitter Card Type</label>
                            <select
                                value={siteMeta.twitterCard}
                                onChange={e => setSiteMeta(prev => ({ ...prev, twitterCard: e.target.value as SiteMeta['twitterCard'] }))}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-emerald-500 outline-none"
                            >
                                <option value="summary_large_image">Summary with Large Image</option>
                                <option value="summary">Summary</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-400 mb-1">OG Description</label>
                            <textarea
                                rows={2}
                                value={siteMeta.ogDescription}
                                onChange={e => setSiteMeta(prev => ({ ...prev, ogDescription: e.target.value }))}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-emerald-500 outline-none resize-y placeholder-slate-600"
                                placeholder="Leave empty to use Site Description"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-400 mb-1">OG Image</label>
                            <div className="flex items-center gap-3">
                                {siteMeta.ogImage ? (
                                    <div className="relative group w-24 h-14 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-center p-1">
                                        <img src={siteMeta.ogImage} alt="OG Image" className="max-w-full max-h-full object-contain rounded" />
                                        <button
                                            onClick={() => setSiteMeta(prev => ({ ...prev, ogImage: '' }))}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Remove OG image"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : null}
                                <button
                                    onClick={() => ogImageInputRef.current?.click()}
                                    disabled={uploadingOgImage}
                                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
                                >
                                    <Upload size={16} />
                                    {uploadingOgImage ? 'Uploading...' : 'Upload OG Image'}
                                </button>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    ref={ogImageInputRef}
                                    onChange={handleOgImageUpload}
                                />
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1">Recommended size: 1200x630px. Shown when your site is shared on social media.</p>
                        </div>
                    </div>
                </div>

                {/* Advanced SEO */}
                <div className="border-t border-slate-700 pt-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Advanced</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Canonical URL</label>
                            <input
                                type="url"
                                value={siteMeta.canonicalUrl}
                                onChange={e => setSiteMeta(prev => ({ ...prev, canonicalUrl: e.target.value }))}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-emerald-500 outline-none placeholder-slate-600 font-mono text-sm"
                                placeholder="https://zeero.bet"
                            />
                            <p className="text-[10px] text-slate-600 mt-1">The preferred URL for search engines. Prevents duplicate content issues.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Robots Meta Tag</label>
                            <select
                                value={siteMeta.robots}
                                onChange={e => setSiteMeta(prev => ({ ...prev, robots: e.target.value }))}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-emerald-500 outline-none"
                            >
                                <option value="index, follow">Index, Follow (default)</option>
                                <option value="noindex, follow">No Index, Follow</option>
                                <option value="index, nofollow">Index, No Follow</option>
                                <option value="noindex, nofollow">No Index, No Follow</option>
                            </select>
                            <p className="text-[10px] text-slate-600 mt-1">Controls how search engines crawl and index your site.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Tracking & Analytics ─────────────────────────────────── */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-5">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                        <BarChart2 size={20} className="text-pink-400" />
                        Tracking &amp; Analytics
                    </h2>
                    <p className="text-[12px] text-slate-500">Paste measurement IDs or raw script tags. Code is injected into the website <code className="text-pink-400 bg-slate-900 px-1 rounded">&lt;head&gt;</code> on every page load.</p>
                </div>

                {/* Pixel ID helpers */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                            Google Analytics 4 ID
                            <span className="ml-1.5 text-slate-600 text-xs font-normal">e.g. G-XXXXXXXXXX</span>
                        </label>
                        <input
                            type="text"
                            value={config.GA4_MEASUREMENT_ID || ''}
                            onChange={e => handleChange('GA4_MEASUREMENT_ID', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white font-mono text-sm focus:border-pink-500 outline-none placeholder-slate-600"
                            placeholder="G-XXXXXXXXXX"
                        />
                        <p className="text-[10px] text-slate-600 mt-1">Auto-injects the gtag.js snippet.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                            Meta (Facebook) Pixel ID
                            <span className="ml-1.5 text-slate-600 text-xs font-normal">numeric ID</span>
                        </label>
                        <input
                            type="text"
                            value={config.META_PIXEL_ID || ''}
                            onChange={e => handleChange('META_PIXEL_ID', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white font-mono text-sm focus:border-pink-500 outline-none placeholder-slate-600"
                            placeholder="123456789012345"
                        />
                        <p className="text-[10px] text-slate-600 mt-1">Auto-injects the fbq base code.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                            TikTok Pixel ID
                            <span className="ml-1.5 text-slate-600 text-xs font-normal">alphanumeric</span>
                        </label>
                        <input
                            type="text"
                            value={config.TIKTOK_PIXEL_ID || ''}
                            onChange={e => handleChange('TIKTOK_PIXEL_ID', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white font-mono text-sm focus:border-pink-500 outline-none placeholder-slate-600"
                            placeholder="C6XXXXXXXXXXXXXXXX"
                        />
                        <p className="text-[10px] text-slate-600 mt-1">Auto-injects TikTok base pixel.</p>
                    </div>
                </div>

                {/* Raw script blocks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                            <Code size={13} className="text-slate-500" />
                            Custom &lt;head&gt; Scripts
                        </label>
                        <textarea
                            rows={6}
                            value={config.CUSTOM_HEAD_SCRIPTS || ''}
                            onChange={e => handleChange('CUSTOM_HEAD_SCRIPTS', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white font-mono text-xs focus:border-pink-500 outline-none resize-y placeholder-slate-600"
                            placeholder={'<!-- Paste any <script>, <link>, or <meta> tags here -->\n<script>...</script>'}
                            spellCheck={false}
                        />
                        <p className="text-[10px] text-slate-600 mt-1">Injected verbatim inside <code>&lt;head&gt;</code>. Supports any HTML.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                            <Code size={13} className="text-slate-500" />
                            Custom &lt;body&gt; Scripts
                        </label>
                        <textarea
                            rows={6}
                            value={config.CUSTOM_BODY_SCRIPTS || ''}
                            onChange={e => handleChange('CUSTOM_BODY_SCRIPTS', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white font-mono text-xs focus:border-pink-500 outline-none resize-y placeholder-slate-600"
                            placeholder={'<!-- Paste <noscript> tags or body-end scripts here -->\n<noscript>...</noscript>'}
                            spellCheck={false}
                        />
                        <p className="text-[10px] text-slate-600 mt-1">Injected at start of <code>&lt;body&gt;</code>. Ideal for noscript fallback tags.</p>
                    </div>
                </div>
            </div>

            {/* ── SMTP Email Settings ─────────────────────────────────────────── */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-5">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                        <Mail size={20} className="text-blue-400" />
                        SMTP Email Settings
                        <span className="ml-auto text-[11px] font-normal text-slate-500">Used for forgot password &amp; notifications</span>
                    </h2>
                    <p className="text-[12px] text-slate-500">Configure your outgoing mail server. Gmail, SendGrid, Mailgun, Zoho — any SMTP provider works.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                            SMTP Host
                            <span className="ml-1.5 text-slate-600 text-xs font-normal">e.g. smtp.gmail.com</span>
                        </label>
                        <input
                            type="text"
                            value={smtpConfig.host}
                            onChange={e => handleSmtpChange('host', e.target.value)}
                            placeholder="smtp.gmail.com"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-blue-500 outline-none placeholder-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                            SMTP Port
                            <span className="ml-1.5 text-slate-600 text-xs font-normal">587 (TLS) or 465 (SSL)</span>
                        </label>
                        <input
                            type="number"
                            value={smtpConfig.port}
                            onChange={e => handleSmtpChange('port', e.target.value)}
                            placeholder="587"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">SMTP Username / Email</label>
                        <input
                            type="email"
                            value={smtpConfig.user}
                            onChange={e => handleSmtpChange('user', e.target.value)}
                            placeholder="noreply@yourdomain.com"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-blue-500 outline-none placeholder-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">SMTP Password / App Password</label>
                        <div className="relative">
                            <input
                                type={showSmtpPassword ? 'text' : 'password'}
                                value={smtpConfig.password}
                                onChange={e => handleSmtpChange('password', e.target.value)}
                                placeholder="••••••••••••"
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 pr-10 text-white focus:border-blue-500 outline-none placeholder-slate-600"
                            />
                            <button
                                type="button"
                                onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                            >
                                {showSmtpPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">From Name</label>
                        <input
                            type="text"
                            value={smtpConfig.fromName}
                            onChange={e => handleSmtpChange('fromName', e.target.value)}
                            placeholder="ZeeroWin Support"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-blue-500 outline-none placeholder-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">From Email</label>
                        <input
                            type="email"
                            value={smtpConfig.fromEmail}
                            onChange={e => handleSmtpChange('fromEmail', e.target.value)}
                            placeholder="noreply@zeerowin.com"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-blue-500 outline-none placeholder-slate-600"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-slate-400">Use SSL (port 465)</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={smtpConfig.secure === 'true'}
                            onChange={e => handleSmtpChange('secure', e.target.checked ? 'true' : 'false')}
                        />
                        <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500" />
                    </label>
                    <span className="text-[11px] text-slate-500">{smtpConfig.secure === 'true' ? 'SSL enabled (port 465)' : 'STARTTLS (port 587)'}</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-700">
                    <button
                        onClick={handleSaveSmtp}
                        disabled={saving}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
                    >
                        <Save size={16} />{saving ? 'Saving...' : 'Save SMTP Settings'}
                    </button>

                    <div className="flex gap-2 flex-1">
                        <input
                            type="email"
                            value={testEmailTo}
                            onChange={e => setTestEmailTo(e.target.value)}
                            placeholder="test@example.com"
                            className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none placeholder-slate-600"
                        />
                        <button
                            onClick={handleTestEmail}
                            disabled={testingEmail}
                            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
                        >
                            <Send size={14} />{testingEmail ? 'Sending...' : 'Test Email'}
                        </button>
                    </div>
                </div>

                {testEmailResult && (
                    <div className={`text-sm px-4 py-3 rounded-lg border ${testEmailResult.success ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                        {testEmailResult.success ? '✅' : '❌'} {testEmailResult.message}
                    </div>
                )}
            </div>

            {/* ── Header Navigation Links ──────────────────────────────── */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                            <Navigation size={20} className="text-emerald-400" />
                            Header Navigation
                        </h2>
                        <p className="text-[12px] text-slate-500">
                            Manage the links shown in the website header. Add internal pages (e.g. <code className="text-slate-400">/promotions</code>) or external URLs. Reorder, edit, or remove any item.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={resetHeaderNavLinks}
                            className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-2"
                        >
                            Reset to defaults
                        </button>
                        <button
                            onClick={addHeaderNavLink}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium text-xs transition-colors"
                        >
                            <Plus size={14} /> Add Link
                        </button>
                    </div>
                </div>

                {/* Logo editor */}
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">Header Logo</p>
                        <span className="text-[11px] text-slate-500">Upload an image, or fall back to styled text.</span>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="h-16 w-40 rounded-lg border border-slate-700 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
                            {headerLogo.imageUrl ? (
                                <img src={headerLogo.imageUrl} alt="Logo preview" className="max-h-14 max-w-[150px] object-contain" />
                            ) : (
                                <div className="text-xl font-extrabold italic tracking-tighter text-white">
                                    {(() => {
                                        const text = headerLogo.text || 'Zeero';
                                        const accent = headerLogo.accentText || '';
                                        const hasAccent = accent && text.toLowerCase().startsWith(accent.toLowerCase());
                                        return hasAccent ? (
                                            <>
                                                <span className="text-amber-400">{text.slice(0, accent.length)}</span>
                                                {text.slice(accent.length)}
                                            </>
                                        ) : text;
                                    })()}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => headerLogoInputRef.current?.click()}
                                disabled={uploadingLogo}
                                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors disabled:opacity-50"
                            >
                                <Upload size={14} />
                                {uploadingLogo ? 'Uploading…' : headerLogo.imageUrl ? 'Replace Image' : 'Upload Image'}
                            </button>
                            {headerLogo.imageUrl && (
                                <button
                                    onClick={() => setHeaderLogo(prev => ({ ...prev, imageUrl: '' }))}
                                    className="flex items-center gap-1.5 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors"
                                >
                                    <X size={14} /> Remove
                                </button>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={headerLogoInputRef}
                                onChange={handleHeaderLogoUpload}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                Logo Text <span className="text-slate-600 font-normal">(used if no image uploaded)</span>
                            </label>
                            <input
                                type="text"
                                value={headerLogo.text}
                                onChange={e => setHeaderLogo(prev => ({ ...prev, text: e.target.value }))}
                                placeholder="Zeero"
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none placeholder-slate-600"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                Accent Prefix <span className="text-slate-600 font-normal">(highlighted in brand gold, e.g. "Ze")</span>
                            </label>
                            <input
                                type="text"
                                value={headerLogo.accentText}
                                onChange={e => setHeaderLogo(prev => ({ ...prev, accentText: e.target.value }))}
                                placeholder="Ze"
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none placeholder-slate-600"
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-600">
                        Recommended image: transparent PNG/SVG, max height 40px, aspect ratio wider than tall. Accent prefix only applies if it matches the beginning of the logo text.
                    </p>
                </div>

                <div className="space-y-3">
                    {headerNavLinks.length === 0 && (
                        <div className="text-center text-slate-500 text-sm py-6 border border-dashed border-slate-700 rounded-lg">
                            No header links configured. Click "Add Link" to create one.
                        </div>
                    )}
                    {headerNavLinks.map((link, idx) => (
                        <div key={link.id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
                                <div>
                                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Label</label>
                                    <input
                                        type="text"
                                        value={link.name}
                                        onChange={e => updateHeaderNavLink(link.id, { name: e.target.value })}
                                        placeholder="e.g. Promotions"
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none placeholder-slate-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                        URL or Path
                                        <span className="ml-1.5 text-slate-600 font-normal">(internal: /path, external: https://…)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={link.path}
                                        onChange={e => updateHeaderNavLink(link.id, { path: e.target.value })}
                                        placeholder="/promotions  or  https://blog.example.com"
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none placeholder-slate-600"
                                    />
                                </div>
                                <div className="flex items-end gap-1">
                                    <button
                                        onClick={() => moveHeaderNavLink(link.id, -1)}
                                        disabled={idx === 0}
                                        title="Move up"
                                        className="h-9 w-9 flex items-center justify-center rounded border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <ArrowUp size={14} />
                                    </button>
                                    <button
                                        onClick={() => moveHeaderNavLink(link.id, 1)}
                                        disabled={idx === headerNavLinks.length - 1}
                                        title="Move down"
                                        className="h-9 w-9 flex items-center justify-center rounded border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <ArrowDown size={14} />
                                    </button>
                                    <button
                                        onClick={() => removeHeaderNavLink(link.id)}
                                        title="Remove"
                                        className="h-9 w-9 flex items-center justify-center rounded border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-slate-700/60">
                                <label className="flex items-center gap-2 text-[12px] text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!!link.isHot}
                                        onChange={e => updateHeaderNavLink(link.id, { isHot: e.target.checked })}
                                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500"
                                    />
                                    Show <span className="text-amber-400 font-bold">HOT</span> badge
                                </label>
                                <label className="flex items-center gap-2 text-[12px] text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!!link.exact}
                                        onChange={e => updateHeaderNavLink(link.id, { exact: e.target.checked })}
                                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500"
                                    />
                                    Exact match (active only on this exact path)
                                </label>
                                <label className="flex items-center gap-2 text-[12px] text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!!link.external}
                                        onChange={e => updateHeaderNavLink(link.id, { external: e.target.checked })}
                                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500"
                                    />
                                    Open in new tab (external link)
                                </label>
                            </div>
                        </div>
                    ))}
                </div>

                <p className="text-[11px] text-slate-600 pt-1">
                    Click <span className="text-slate-400 font-semibold">Save Changes</span> at the top of the page to apply header changes. Updates may take up to 60 seconds to propagate.
                </p>
            </div>

            {/* ── Footer Certifications Bar ──────────────────────────── */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                            <Settings size={20} className="text-emerald-400" />
                            Footer Certifications Bar
                        </h2>
                        <p className="text-[12px] text-slate-500">
                            The horizontal strip shown just above the footer — awards / recognitions on the top row and responsible-gaming &amp; partner logos on the bottom row. Each logo can be hidden individually.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={footerCertifications.enabled}
                            onChange={e =>
                                setFooterCertifications(prev => ({ ...prev, enabled: e.target.checked }))
                            }
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Awards Row Title</label>
                        <input
                            type="text"
                            value={footerCertifications.awardsTitle}
                            onChange={e => setFooterCertifications(prev => ({ ...prev, awardsTitle: e.target.value }))}
                            placeholder="Awards & recognitions"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-emerald-500 outline-none placeholder-slate-600"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Leave blank to hide the title.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Partners Row Title</label>
                        <input
                            type="text"
                            value={footerCertifications.partnersTitle}
                            onChange={e => setFooterCertifications(prev => ({ ...prev, partnersTitle: e.target.value }))}
                            placeholder="Responsible gaming & partners"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-emerald-500 outline-none placeholder-slate-600"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Leave blank to hide the title.</p>
                    </div>
                </div>

                {(['awards', 'partners'] as const).map(group => {
                    const items = footerCertifications[group];
                    const heading = group === 'awards' ? 'Awards Row' : 'Partners Row';
                    const subHeading =
                        group === 'awards'
                            ? 'Top row — trophy/award badges (SiGMA, etc).'
                            : 'Bottom row — responsible gaming logos, partners, sponsors.';
                    return (
                        <div key={group} className="pt-4 border-t border-slate-700/60 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-white">{heading}</p>
                                    <p className="text-[11px] text-slate-500">{subHeading}</p>
                                </div>
                                <button
                                    onClick={() => addCertificationItem(group)}
                                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                >
                                    <Plus size={14} /> Add Logo
                                </button>
                            </div>

                            {items.length === 0 ? (
                                <p className="text-[12px] text-slate-500 italic">No items. Click “Add Logo” to upload one.</p>
                            ) : (
                                <div className="space-y-3">
                                    {items.map((item, idx) => {
                                        const isUploading = uploadingCertId === item.id;
                                        return (
                                            <div
                                                key={item.id}
                                                className={`rounded-xl border p-3 md:p-4 grid grid-cols-1 md:grid-cols-[88px_1fr_auto] gap-3 items-start ${item.visible ? 'border-slate-700 bg-slate-900/60' : 'border-slate-800 bg-slate-900/30 opacity-60'}`}
                                            >
                                                {/* Preview */}
                                                <div className="h-[72px] w-[88px] rounded-lg border border-slate-700 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
                                                    {item.imageUrl ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={item.imageUrl} alt={item.alt || 'cert'} className="max-w-full max-h-full object-contain" />
                                                    ) : (
                                                        <span className="text-[10px] text-slate-600">No image</span>
                                                    )}
                                                </div>

                                                {/* Fields */}
                                                <div className="space-y-2 min-w-0">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        <input
                                                            type="text"
                                                            value={item.alt}
                                                            onChange={e => updateCertificationItem(group, item.id, { alt: e.target.value })}
                                                            placeholder="Alt text (e.g. SiGMA Europe 2024)"
                                                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs focus:border-emerald-500 outline-none placeholder-slate-600"
                                                        />
                                                        <input
                                                            type="url"
                                                            value={item.href}
                                                            onChange={e => updateCertificationItem(group, item.id, { href: e.target.value })}
                                                            placeholder="Link URL (optional)"
                                                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs focus:border-emerald-500 outline-none placeholder-slate-600"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => certInputRefs.current[item.id]?.click()}
                                                            disabled={isUploading}
                                                            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                                                        >
                                                            <Upload size={12} />
                                                            {isUploading ? 'Uploading…' : item.imageUrl ? 'Replace Image' : 'Upload Image'}
                                                        </button>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            ref={el => { certInputRefs.current[item.id] = el; }}
                                                            onChange={e => handleCertificationImageUpload(group, item.id, e)}
                                                        />
                                                        <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={item.visible}
                                                                onChange={e => updateCertificationItem(group, item.id, { visible: e.target.checked })}
                                                                className="accent-emerald-500"
                                                            />
                                                            Visible
                                                        </label>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex md:flex-col items-center gap-1 justify-end">
                                                    <button
                                                        onClick={() => moveCertificationItem(group, item.id, -1)}
                                                        disabled={idx === 0}
                                                        className="p-1.5 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent"
                                                        title="Move up"
                                                    >
                                                        <ArrowUp size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => moveCertificationItem(group, item.id, 1)}
                                                        disabled={idx === items.length - 1}
                                                        className="p-1.5 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent"
                                                        title="Move down"
                                                    >
                                                        <ArrowDown size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => removeCertificationItem(group, item.id)}
                                                        className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
                                                        title="Remove"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                <p className="text-[11px] text-slate-600 pt-2 border-t border-slate-700/60">
                    Click <span className="text-slate-400 font-semibold">Save Changes</span> at the top of the page to apply. Toggle the switch at the top of this card to hide the entire bar without deleting items.
                </p>
            </div>

            {/* ── Footer Settings ─────────────────────────────────────── */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-6">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                        <LinkIcon size={20} className="text-amber-400" />
                        Footer Settings
                        <span className="ml-auto text-[11px] font-normal text-slate-500">Contact emails &amp; social media</span>
                    </h2>
                    <p className="text-[12px] text-slate-500">Shown in the website footer. Leave a social image blank to use the default icon.</p>
                </div>

                {/* Contact emails */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                            Commercial Offers Email
                            <span className="ml-1.5 text-slate-600 text-xs font-normal">shown in footer</span>
                        </label>
                        <input
                            type="email"
                            value={footerSettings.businessEmail}
                            onChange={e => setFooterSettings(prev => ({ ...prev, businessEmail: e.target.value }))}
                            placeholder="business@zeero.bet"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-amber-500 outline-none placeholder-slate-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                            Partner Program Email
                            <span className="ml-1.5 text-slate-600 text-xs font-normal">shown in footer</span>
                        </label>
                        <input
                            type="email"
                            value={footerSettings.partnersEmail}
                            onChange={e => setFooterSettings(prev => ({ ...prev, partnersEmail: e.target.value }))}
                            placeholder="partners@zeero.bet"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-white focus:border-amber-500 outline-none placeholder-slate-600"
                        />
                    </div>
                </div>

                {/* Social media grid */}
                <div>
                    <p className="text-sm font-medium text-slate-300 mb-3">Social Media Links &amp; Icons</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {SOCIAL_META.map(({ key, label, initial, bgClassName }) => {
                            const entry = footerSettings.socials[key];
                            const isUploading = uploadingSocial === key;
                            return (
                                <div key={key} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
                                    <div className="flex items-center gap-3">
                                        {/* Preview — uploaded image OR default icon */}
                                        {entry.imageUrl ? (
                                            <div className="relative group w-10 h-10 rounded-[12px] overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center shrink-0">
                                                <img src={entry.imageUrl} alt={label} className="max-w-full max-h-full object-contain" />
                                                <button
                                                    onClick={() => handleSocialImageRemove(key)}
                                                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Use default icon"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-[12px] text-base font-black shadow-[0_4px_10px_rgba(0,0,0,0.22)] shrink-0 ${bgClassName}`}>
                                                {initial}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white leading-tight">{label}</p>
                                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                                                {entry.imageUrl ? 'Custom icon' : 'Default icon'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => socialInputRefs.current[key]?.click()}
                                            disabled={isUploading}
                                            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 text-xs shrink-0"
                                        >
                                            <Upload size={12} />
                                            {isUploading ? 'Uploading…' : entry.imageUrl ? 'Replace' : 'Upload'}
                                        </button>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            ref={el => { socialInputRefs.current[key] = el; }}
                                            onChange={e => handleSocialImageUpload(key, e)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">Link URL</label>
                                        <input
                                            type="url"
                                            value={entry.url}
                                            onChange={e => handleSocialUrlChange(key, e.target.value)}
                                            placeholder={`https://…/${key}`}
                                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-amber-500 outline-none placeholder-slate-600"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-slate-600 mt-3">
                        Images are uploaded to Cloudflare Images. If no image is set, the default icon is shown. If no URL is set, the button is not clickable.
                    </p>
                </div>

                {/* Highlight card icons */}
                <div className="pt-2 border-t border-slate-700/60">
                    <p className="text-sm font-medium text-slate-300 mb-1 mt-4">Highlight Card Icons</p>
                    <p className="text-[11px] text-slate-500 mb-3">Icons shown on the 4 footer feature cards. Leave blank to use the default Lucide icon.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {HIGHLIGHT_META.map(({ key, title, description, placeholderClass, initial }) => {
                            const iconUrl = footerSettings.highlightIcons[key];
                            const isUploading = uploadingHighlight === key;
                            return (
                                <div key={key} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
                                    <div className="flex items-center gap-3">
                                        {iconUrl ? (
                                            <div className="relative group w-11 h-11 rounded-[14px] overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center shrink-0">
                                                <img src={iconUrl} alt={title} className="max-w-full max-h-full object-contain" />
                                                <button
                                                    onClick={() => handleHighlightIconRemove(key)}
                                                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Use default icon"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className={`inline-flex h-11 w-11 items-center justify-center rounded-[14px] text-lg shrink-0 ${placeholderClass}`}>
                                                {initial}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white leading-tight">{title}</p>
                                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">{description}</p>
                                        </div>
                                        <button
                                            onClick={() => highlightInputRefs.current[key]?.click()}
                                            disabled={isUploading}
                                            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 text-xs shrink-0"
                                        >
                                            <Upload size={12} />
                                            {isUploading ? 'Uploading…' : iconUrl ? 'Replace' : 'Upload'}
                                        </button>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            ref={el => { highlightInputRefs.current[key] = el; }}
                                            onChange={e => handleHighlightIconUpload(key, e)}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-600">
                                        Status: <span className={iconUrl ? 'text-emerald-400' : 'text-slate-500'}>{iconUrl ? 'Custom icon' : 'Default icon'}</span>
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-lg text-sm text-slate-400 flex items-center gap-3">
                <AlertTriangle size={18} />
                <p>Changes to system configuration may take up to 60 seconds to propagate across all services.</p>
            </div>
        </div>
    );
}
