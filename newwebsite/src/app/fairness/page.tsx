import React from 'react';
import Link from 'next/link';
import { Shield, CheckCircle, Lock, BarChart2, RefreshCw, Home, ExternalLink } from 'lucide-react';

export const metadata = {
    title: 'Fairness & Provably Fair | ODD69',
    description: 'Learn how ODD69 ensures fair and transparent gaming through provably fair algorithms, certified RNG, and independent audits.',
};

const SECTIONS = [
    {
        icon: Shield,
        color: 'text-brand-gold',
        bg: 'bg-brand-gold/10',
        border: 'border-brand-gold/20',
        title: 'Provably Fair System',
        body: [
            'ODD69 uses a cryptographically provably fair system for all casino games. This means every game result is determined by a verifiable algorithm rather than a centralized server decision.',
            'Before each game round, the server generates a secret seed (hashed) which is shared with  you. After the round, the server reveals the original seed so you can independently verify the result using our open-source verification tool.',
            'This ensures that neither the player nor ODD69 can predict or manipulate the outcome of any game in advance.',
        ]
    },
    {
        icon: RefreshCw,
        color: 'text-teal-400',
        bg: 'bg-teal-400/10',
        border: 'border-teal-400/20',
        title: 'Certified Random Number Generator (RNG)',
        body: [
            'All games powered by ODD69\'s original game engine use a certified RNG that produces statistically random outcomes. Our RNG is audited periodically by an independent third-party testing laboratory.',
            'The RNG meets international standards including ISO/IEC 17020 and is compliant with requirements set by leading iGaming regulatory authorities.',
            'Third-party casino game providers integrated on our platform are required to provide their own RNG certifications, which are reviewed by our compliance team.',
        ]
    },
    {
        icon: BarChart2,
        color: 'text-accent-purple',
        bg: 'bg-purple-400/10',
        border: 'border-purple-400/20',
        title: 'Return to Player (RTP)',
        body: [
            'Each game on ODD69 has a published Return to Player (RTP) percentage. This indicates the theoretical average payout over a statistically significant number of rounds.',
            'For example, a game with a 96% RTP will return $96 for every $100 wagered on average over time. The RTP is a long-term statistical measure, not a guarantee for individual sessions.',
            'RTP values are verified by independent auditors and are displayed on each game\'s information page.',
        ]
    },
    {
        icon: Lock,
        color: 'text-green-400',
        bg: 'bg-green-400/10',
        border: 'border-green-400/20',
        title: 'Data Security & Encryption',
        body: [
            'All data transmitted between your device and ODD69\'s servers is protected using TLS 1.3 encryption, the industry standard for secure data transmission.',
            'Player funds and sensitive data are stored in isolated, encrypted environments. We perform regular security audits and penetration testing to protect against vulnerabilities.',
            'ODD69 will never share your personal data with third parties without your explicit consent, except where required by law. See our Privacy Policy for full details.',
        ]
    },
    {
        icon: CheckCircle,
        color: 'text-brand-gold',
        bg: 'bg-brand-gold/10',
        border: 'border-brand-gold/20',
        title: 'Independent Audits & Compliance',
        body: [
            'ODD69 undergoes regular audits by independent testing agencies to verify fairness, security, and regulatory compliance. Audit certificates are available upon request through our support team.',
            'We are licensed and regulated under the laws of Curaçao (operated by BlockDance B.V., Registration No. 158182). Our license number is available in the footer of every page.',
            'Our compliance team continuously monitors for responsible gaming concerns and fraud. Any player found attempting to manipulate game outcomes will have their account suspended.',
        ]
    },
];

export default function FairnessPage() {
    return (
        <div className="min-h-[calc(100vh-64px)] bg-bg-odd69-3 text-white pb-24">

            {/* Hero */}
            <div className="relative overflow-hidden bg-gradient-to-b from-green-500/8 via-[#0F1016] to-[#0C0D12] border-b border-white/[0.04]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,197,94,0.10),transparent_60%)]" />
                <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-8 text-center">
                    <div className="hidden md:flex absolute top-6 left-4">
                        <Link href="/" className="flex items-center gap-2 text-text-muted hover:text-white transition-colors text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.04] px-4 py-2 rounded-full">
                            <Home size={14} /> Back to Home
                        </Link>
                    </div>
                    <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 text-green-400 text-xs font-black uppercase tracking-widest mb-5">
                        <Shield size={13} /> Provably Fair
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
                        Fairness & <span className="text-brand-gold">Transparency</span>
                    </h1>
                    <p className="text-text-muted text-sm max-w-xl mx-auto">
                        ODD69 is committed to providing a fair, transparent, and secure gaming experience. Learn how we guarantee integrity across every game and transaction.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
                {SECTIONS.map(({ icon: Icon, color, bg, border, title, body }) => (
                    <div key={title} className={`rounded-2xl border ${border} bg-bg-deep overflow-hidden`}>
                        <div className={`px-6 py-4 border-b border-white/[0.04] flex items-center gap-3`}>
                            <div className={`p-2.5 rounded-xl ${bg} ${color}`}>
                                <Icon size={20} />
                            </div>
                            <h2 className="text-white font-black text-lg">{title}</h2>
                        </div>
                        <div className="px-6 py-5 space-y-3">
                            {body.map((paragraph, i) => (
                                <p key={i} className="text-text-muted text-sm leading-relaxed">{paragraph}</p>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Still have questions */}
                <div className="rounded-2xl bg-gradient-to-r from-brand-gold/10 to-transparent border border-brand-gold/20 p-6 flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
                    <div>
                        <p className="text-white font-black text-lg">Have a fairness concern?</p>
                        <p className="text-text-muted text-sm mt-1">Our compliance team is available to address any questions about game integrity.</p>
                    </div>
                    <Link
                        href="/support"
                        className="flex items-center gap-2 bg-brand-gold hover:bg-brand-gold-hover text-text-inverse font-black px-6 py-3 rounded-xl text-sm uppercase transition-all shadow-glow-gold whitespace-nowrap"
                    >
                        <ExternalLink size={16} /> Contact Support
                    </Link>
                </div>
            </div>
        </div>
    );
}
