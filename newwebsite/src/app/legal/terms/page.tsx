import React from 'react';
import Link from 'next/link';
import { Home, FileText, AlertTriangle, ShieldOff, Users, Ban } from 'lucide-react';

export const metadata = {
    title: 'Terms of Service | Zeero',
    description: 'Read the Terms of Service governing the use of the Zeero gaming platform, including the strict single-account policy and all prohibited activities.',
};

const SECTIONS = [
    {
        title: '1. Acceptance of Terms',
        icon: 'FileText',
        content: [
            'By accessing or using Zeero ("the Platform"), you agree to be bound by these Terms of Service in their entirety. If you do not agree to any part of these Terms, you must immediately cease all use of the Platform.',
            'Zeero is operated by BlockDance B.V. (Commercial register of Curaçao no. 158182). These Terms constitute a legally binding agreement between you and BlockDance B.V.',
            'These Terms apply regardless of how you access the Platform — whether via our website, mobile application, or any other interface.',
        ]
    },
    {
        title: '2. Eligibility',
        icon: 'Users',
        content: [
            'You must be at least 18 years of age (or the legal gambling age in your jurisdiction, whichever is higher) to use the Platform.',
            'Residents of jurisdictions where online gambling is prohibited by law are not permitted to use the Platform. It is your sole responsibility to verify that usage is lawful in your territory.',
            'By registering, you confirm that you are not a citizen or resident of any jurisdiction where online gambling is explicitly prohibited, including but not limited to the United States, United Kingdom, France, and any jurisdiction listed on the FATF blacklist.',
        ]
    },
    {
        title: '3. ONE ACCOUNT PER PERSON — Strict Policy',
        icon: 'Ban',
        highlight: true,
        content: [
            '⛔ Each individual person is permitted to hold ONLY ONE (1) registered account on the Platform at any time. This is a strict, non-negotiable policy.',
            'Creating, operating, or attempting to create a second or additional account — whether using the same or different credentials, email address, phone number, payment method, IP address, device, or household — constitutes a material breach of these Terms.',
            'Reasons that do NOT constitute valid grounds for creating a second account include, but are not limited to: forgetting your password, being unable to log in, receiving a different promotional offer on another email, or any other convenience-based rationale.',
            'If two or more accounts are found to belong to the same person, Zeero will: (a) permanently ban all associated accounts without appeal; (b) forfeit all balances, bonuses, pending withdrawals, and winnings across every account; (c) restrict any future registrations linked to the same phone number, device, IP address, or payment method; and (d) report the incident to relevant regulatory and financial authorities where required.',
            'We employ advanced technical systems — including device fingerprinting, IP geo-analysis, behavioural pattern recognition, and payment method matching — to detect multi-accounting. Attempting to circumvent these systems (e.g., using VPNs, proxy servers, or emulators) is itself a violation and will expedite decisive action.',
            'Users who suspect a duplicate account error (e.g., a family member registered on the same network) must proactively notify our Support team. Concealment of shared household accounts may still lead to suspension if patterns indicate coordinated abuse.',
        ]
    },
    {
        title: '4. Account Registration & Security',
        icon: 'ShieldOff',
        content: [
            'You must provide accurate, truthful, and complete information during registration. The submission of false, misleading, or unverifiable information constitutes a breach of these Terms and may lead to immediate account suspension and forfeiture of all funds.',
            'You are solely responsible for maintaining the confidentiality of your username, password, and any account access credentials. All activity conducted through your account will be attributed to you.',
            'You must not share, sell, transfer, or allow access to your account by any third party, including friends, family members, or professional gambling syndicates.',
            'In the event of suspected unauthorised access to your account, you must immediately notify Zeero support. Failure to report promptly may limit our ability to recover lost funds.',
            'Zeero reserves the right to perform identity verification (KYC) at any time, including during withdrawal, after large wins, or if suspicious activity is detected. Accounts that fail or refuse to complete KYC will be suspended and balances held pending investigation.',
            'Phone number verification is mandatory. Each registered phone number may only be associated with one account. Attempting to verify multiple accounts with the same phone number will trigger an automatic rejection and fraud flag.',
        ]
    },
    {
        title: '5. Deposits & Withdrawals',
        icon: 'FileText',
        content: [
            'All deposits must be made from payment methods that belong to and are registered in your own name. Deposits from third-party accounts, anonymous payment methods, or unverified sources may be seized.',
            'Withdrawals are processed only to payment instruments in your own verified name. Withdrawals to third-party accounts are strictly prohibited and may be treated as suspected money laundering.',
            'Withdrawals are subject to full wagering requirements where applicable. Bonus funds and any winnings derived from bonus play cannot be withdrawn until all active wagering conditions are satisfied.',
            'Zeero reserves the right to apply transaction limits, request source-of-funds documentation, and perform enhanced due diligence on large transactions at its sole discretion.',
            'Chargebacks, reversals, or disputed payment instructions initiated through your payment provider after depositing are considered fraudulent acts and will result in immediate account suspension, forfeiture of all balances, and referral to collection agencies and/or law enforcement.',
            'Zeero reserves the right to void and reverse any transaction that is found to be fraudulent, duplicated, or in violation of these Terms, including any winnings accrued as a result of such a transaction.',
        ]
    },
    {
        title: '6. Bonuses, Promotions & Referrals',
        icon: 'FileText',
        content: [
            'All bonuses and promotions are subject to individual terms, including wagering requirements, validity periods, and eligible games. Bonus terms are published on each promotion\'s detail page.',
            'Each bonus offer (including sign-up bonuses, deposit bonuses, free spins, and referral bonuses) is strictly limited to one per person, household, IP address, device, and payment method. Individuals found exploiting bonuses across multiple accounts or identities will have all associated accounts terminated.',
            'Referral bonuses are subject to wagering requirements and are credited to the casino bonus wallet only. Referral bonuses credited to an account found to belong to a fictitious or coordinated referral ring will be forfeited across all accounts involved.',
            'Bonus abuse — including but not limited to: multi-accounting to claim signup bonuses, creating fake referrals, placing bets that exploit bonus conditions (e.g., low-risk arbitrage strategies), or coordinating with others to cycle bonuses — is grounds for immediate and permanent account termination.',
            'Zeero reserves the right to modify, cancel, reclaim, or retroactively adjust any bonus reward if abuse, fraud, or misrepresentation is suspected, without prior notice.',
            'Minimum bet requirements apply to bonus wagering. Bets below $1 (or currency equivalent) do not count towards wagering progress. Wagering on excluded games does not count.',
        ]
    },
    {
        title: '7. Prohibited Activities & Violations',
        icon: 'ShieldOff',
        highlight: true,
        content: [
            '⛔ Multi-Accounting: Creating more than one account is strictly prohibited. See Section 3 for full consequences.',
            '⛔ Identity Fraud: Using false personal information, stolen identities, or impersonating another person to register or operate an account.',
            '⛔ Bonus Farming: Systematic exploitation of bonuses across multiple accounts, identities, or referral structures to extract value without genuine gambling intent.',
            '⛔ Collusion: Coordinating with other players — on the same or opposing sides of a game — to gain an unfair advantage. This includes chip-dumping, match-fixing, or coordinated sports betting syndicates.',
            '⛔ Arbitrage & Hedging Abuse: Exploiting platform promotions, free bets, or odds discrepancies to guarantee a profit regardless of outcome, in a manner inconsistent with recreational gambling.',
            '⛔ Automated Bots & Scripts: Using any software, algorithm, robot, script, artificial intelligence, or automated tool to interact with the Platform, place bets, monitor odds, or conduct any activity that a human user would ordinarily perform manually.',
            '⛔ VPN / Proxy Evasion: Using VPNs, proxies, Tor nodes, or any technical mechanism to circumvent geo-restrictions or mask your identity and location. Dynamic-IP or VPN usage following an account ban is itself a violation.',
            '⛔ Chargeback Fraud: Disputing deposits with your bank or payment provider after receiving services from the Platform.',
            '⛔ Money Laundering: Using the Platform to deposit, move, or withdraw funds derived from illegal activities. All suspicious activities are reported to financial intelligence units in accordance with AML/CFT obligations.',
            '⛔ Hacking & Platform Manipulation: Attempting to reverse-engineer, exploit API endpoints, inject malicious code, interfere with the Platform\'s systems, or gain unauthorised access to other users\' accounts.',
            '⛔ Harassment: Threatening, harassing, or abusing Zeero staff, other players, or support personnel in any form.',
            'Confirmed violations of any category above will result in immediate account suspension, forfeiture of all balances and pending payouts, and may be referred to law enforcement and regulatory authorities.',
        ]
    },
    {
        title: '8. Responsible Gaming',
        icon: 'FileText',
        content: [
            'Zeero is committed to responsible gaming. Tools such as deposit limits, loss limits, session time limits, cooling-off periods, and self-exclusion are available in your account settings.',
            'We urge you not to gamble more than you can afford to lose. Gambling should always be a form of entertainment, not a primary source of income or a way to recover losses.',
            'If you believe you or someone you know may have a gambling problem, please contact support or visit GambleAware (www.gambleaware.org) or BeGambleAware (www.begambleaware.org).',
            'Zeero reserves the right to impose deposit limits, restrict access, or permanently close an account if we identify signs of problem gambling, even without a user request.',
        ]
    },
    {
        title: '9. Account Suspension, Termination & Fund Forfeiture',
        icon: 'Ban',
        content: [
            'Zeero may suspend, restrict, or permanently terminate any account at its sole discretion, including — but not limited to — cases where a violation of these Terms is suspected or confirmed.',
            'Upon termination for cause (i.e., policy violations), all balances, bonuses, pending bets, and winnings may be forfeited in full. Users will not be entitled to any compensation.',
            'Upon voluntary account closure (i.e., no violations), any remaining balance in your account after all wagering obligations are met will be refunded to your registered payment method.',
            'Zeero is not obligated to disclose the specific reason for account action in all circumstances, particularly where disclosure could compromise a fraud investigation.',
            'Appeals of account terminations may be submitted to our compliance team. However, decisions relating to confirmed fraud, multi-accounting, or money laundering are final and non-reversible.',
        ]
    },
    {
        title: '10. Intellectual Property',
        icon: 'FileText',
        content: [
            'All platform content — including but not limited to software, interfaces, graphics, trademarks, logos, text, and game designs — is the exclusive property of BlockDance B.V. or its licensors, protected under applicable intellectual property laws.',
            'You may not copy, reproduce, scrape, redistribute, reverse-engineer, or create derivative works from any platform content without explicit prior written consent.',
        ]
    },
    {
        title: '11. Limitation of Liability',
        icon: 'FileText',
        content: [
            'To the fullest extent permitted by applicable law, Zeero shall not be liable for indirect, incidental, special, consequential, or punitive damages of any kind arising from use of the Platform.',
            'Zeero does not guarantee continuous, uninterrupted, or error-free access to the Platform and accepts no liability for losses arising from technical failures, maintenance windows, third-party outages, or circumstances beyond our reasonable control.',
            'Zeero is not responsible for any tax obligations arising from your gambling activities. It is your responsibility to comply with all tax laws applicable in your jurisdiction.',
        ]
    },
    {
        title: '12. Privacy & Data',
        icon: 'FileText',
        content: [
            'Zeero collects and processes personal data in accordance with our Privacy Policy. By using the Platform, you consent to our data practices as described therein.',
            'Zeero may share user data with regulatory authorities, law enforcement agencies, payment processors, and fraud prevention services where legally required or where there is reasonable suspicion of criminal activity.',
            'Device fingerprinting, IP logging, and behavioural analytics data are retained for fraud detection and regulatory compliance purposes for up to seven (7) years.',
        ]
    },
    {
        title: '13. Amendments',
        icon: 'FileText',
        content: [
            'Zeero reserves the right to amend these Terms at any time, with or without notice. Material changes will be communicated via email or an in-platform notification.',
            'Continued use of the Platform following any amendment constitutes your binding acceptance of the revised Terms. It is your responsibility to review these Terms periodically.',
        ]
    },
    {
        title: '14. Governing Law & Dispute Resolution',
        icon: 'FileText',
        content: [
            'These Terms are governed by the laws of Curaçao. Any dispute arising from or in connection with these Terms shall be submitted exclusively to the jurisdiction of the competent courts of Curaçao.',
            'Before initiating legal proceedings, you agree to first contact Zeero support and attempt to resolve the matter in good faith within thirty (30) days.',
            'Nothing in this clause limits Zeero\'s right to seek urgent relief in any jurisdiction to protect its intellectual property, platform integrity, or to enforce injunctions.',
        ]
    },
];

const VIOLATION_HIGHLIGHTS = [
    { icon: '⛔', label: 'Multiple Accounts', desc: 'One person = one account. No exceptions.' },
    { icon: '⛔', label: 'Fake Referrals', desc: 'Self-referrals or fake accounts to claim referral bonuses.' },
    { icon: '⛔', label: 'Chargeback Fraud', desc: 'Disputing deposits after using the platform.' },
    { icon: '⛔', label: 'Bonus Abuse', desc: 'Exploiting promotions across multiple accounts or identities.' },
    { icon: '⛔', label: 'VPN Evasion', desc: 'Using proxies or VPNs to bypass region bans or detection.' },
    { icon: '⛔', label: 'Identity Fraud', desc: 'Using another person\'s identity to register or withdraw.' },
];

export default function TermsPage() {
    return (
        <div className="min-h-[calc(100vh-64px)] bg-bg-zeero-3 text-white pb-24">

            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-b from-brand-gold/6 via-[#0F1016] to-[#0C0D12] border-b border-white/[0.04]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(139,92,246,0.06),transparent_60%)]" />
                <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-8 text-center">
                    <div className="hidden md:flex absolute top-6 left-4">
                        <Link href="/" className="flex items-center gap-2 text-text-muted hover:text-white transition-colors text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.04] px-4 py-2 rounded-full">
                            <Home size={14} /> Back to Home
                        </Link>
                    </div>
                    <div className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-4 py-1.5 text-brand-gold text-xs font-black uppercase tracking-widest mb-5">
                        <FileText size={13} /> Legal
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
                        Terms of <span className="text-brand-gold">Service</span>
                    </h1>
                    <p className="text-text-muted text-sm">Last updated: April 2026</p>
                    <p className="text-text-muted text-sm mt-2 max-w-xl mx-auto">
                        Please read these Terms carefully. By using the Platform you confirm that you have read, understood, and agree to be legally bound by all of the terms below.
                    </p>
                </div>
            </div>

            {/* ── Single Account Warning Banner ── */}
            <div className="max-w-3xl mx-auto px-4 pt-8">
                <div className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-red-950/30 p-5 mb-3">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(239,68,68,0.06),transparent_70%)]" />
                    <div className="relative flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-danger-alpha-10 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle size={22} className="text-danger" />
                        </div>
                        <div>
                            <p className="text-danger font-black text-base mb-1">⛔ Strict Single-Account Policy</p>
                            <p className="text-danger/70 text-sm leading-relaxed">
                                Each person is permitted to operate <strong className="text-danger">exactly one (1) account</strong> on this Platform. Creating a second account — for any reason — will result in <strong className="text-danger">permanent termination of ALL accounts</strong> and <strong className="text-danger">forfeiture of all balances and winnings</strong>. See Section 3 for full details.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Key violations quick grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                    {VIOLATION_HIGHLIGHTS.map(v => (
                        <div key={v.label} className="rounded-xl border border-white/[0.04] bg-bg-deep px-4 py-3">
                            <p className="text-sm font-bold text-white mb-0.5">{v.icon} {v.label}</p>
                            <p className="text-[11px] text-text-muted leading-relaxed">{v.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 space-y-4">
                {SECTIONS.map(({ title, content, highlight }) => (
                    <div
                        key={title}
                        className={`rounded-2xl border overflow-hidden ${
                            highlight
                                ? 'border-danger/25 bg-red-950/10'
                                : 'border-white/[0.04] bg-bg-deep'
                        }`}
                    >
                        <div className={`px-6 py-4 border-b ${highlight ? 'border-danger/20' : 'border-white/[0.04]'}`}>
                            <h2 className={`font-bold text-base ${highlight ? 'text-danger' : 'text-white'}`}>
                                {title}
                            </h2>
                        </div>
                        <div className="px-6 py-5 space-y-3">
                            {content.map((p, i) => (
                                <p
                                    key={i}
                                    className={`text-sm leading-relaxed ${
                                        p.startsWith('⛔')
                                            ? 'text-danger/80 font-medium'
                                            : 'text-text-muted'
                                    }`}
                                >
                                    {p}
                                </p>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Acknowledgement box */}
                <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 px-6 py-5 mt-2">
                    <p className="text-brand-gold font-bold text-sm mb-2">✅ By using this Platform, you confirm that:</p>
                    <ul className="space-y-1.5 text-text-muted text-sm">
                        <li className="flex gap-2"><span className="text-brand-gold">›</span> You have read and understood all Terms above.</li>
                        <li className="flex gap-2"><span className="text-brand-gold">›</span> You are at least 18 years old (or the legal age in your jurisdiction).</li>
                        <li className="flex gap-2"><span className="text-brand-gold">›</span> You do not hold any other account on this Platform.</li>
                        <li className="flex gap-2"><span className="text-brand-gold">›</span> Online gambling is legal in the territory from which you are accessing the Platform.</li>
                        <li className="flex gap-2"><span className="text-brand-gold">›</span> All funds you use are lawfully obtained and belong to you.</li>
                        <li className="flex gap-2"><span className="text-brand-gold">›</span> You will not attempt to circumvent these Terms using any technical or deceptive means.</li>
                    </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Link href="/legal/privacy-policy" className="flex-1 text-center py-3 rounded-xl border border-white/[0.06] text-text-muted hover:text-white hover:border-brand-gold/30 text-sm font-bold transition-all">
                        Privacy Policy →
                    </Link>
                    <Link href="/legal/rules" className="flex-1 text-center py-3 rounded-xl border border-white/[0.06] text-text-muted hover:text-white hover:border-brand-gold/30 text-sm font-bold transition-all">
                        Betting Rules →
                    </Link>
                </div>
            </div>
        </div>
    );
}
