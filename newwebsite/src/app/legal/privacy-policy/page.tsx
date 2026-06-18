import React from 'react';
import Link from 'next/link';
import { Home, Lock } from 'lucide-react';

export const metadata = {
    title: 'Privacy Policy | Zeero',
    description: 'Read how Zeero collects, uses, and protects your personal data.',
};

const SECTIONS = [
    {
        title: '1. Information We Collect',
        content: [
            'When you register an account, we collect personal information including your name, email address, date of birth, phone number, and government-issued ID for verification purposes.',
            'We automatically collect usage data such as IP addresses, browser type, device information, and pages visited through cookies and similar tracking technologies.',
            'Financial information such as payment method details and transaction history is collected to process deposits and withdrawals. We do not store full card numbers; all payment data is handled by PCI-DSS compliant payment processors.',
        ]
    },
    {
        title: '2. How We Use Your Information',
        content: [
            'To create and manage your account, process transactions, and provide our gaming services.',
            'To verify your identity and comply with Know Your Customer (KYC) and Anti-Money Laundering (AML) regulations.',
            'To send you account-related communications, promotional offers (if you have opted in), and important service updates.',
            'To detect, prevent, and investigate fraud, money laundering, or other illegal activities.',
            'To improve our platform, analyse usage patterns, and personalise your experience.',
        ]
    },
    {
        title: '3. Sharing of Your Information',
        content: [
            'We do not sell your personal data to third parties. We may share your data with trusted service providers who assist us in operating our platform, subject to strict confidentiality agreements.',
            'We may disclose personal information to regulatory authorities, law enforcement, or legal entities when required by law or to protect the rights, property, or safety of Zeero, our users, or the public.',
            'In the event of a merger, acquisition, or sale of assets, your data may be transferred to the acquiring entity subject to equivalent privacy protections.',
        ]
    },
    {
        title: '4. Cookies & Tracking Technologies',
        content: [
            'We use essential cookies to enable core platform functionality such as authentication and session management. These cannot be disabled without affecting platform operation.',
            'We use analytics cookies to understand how users interact with our platform and improve our services. You may opt out of non-essential cookies through your browser settings.',
            'Third-party game providers integrated on our platform may set their own cookies, subject to their respective privacy policies.',
        ]
    },
    {
        title: '5. Data Retention',
        content: [
            'We retain your personal information for as long as your account is active and for a period thereafter as required by applicable law (typically 5–7 years for financial records).',
            'You may request deletion of your account and personal data at any time by contacting our support team. Note that certain data may be retained to comply with legal obligations.',
        ]
    },
    {
        title: '6. Your Rights',
        content: [
            'You have the right to access, correct, or delete your personal data held by Zeero.',
            'You have the right to object to or restrict the processing of your data in certain circumstances.',
            'You have the right to data portability — to receive a copy of your data in a machine-readable format.',
            'To exercise any of these rights, please contact our support team at the details provided on our Support page.',
        ]
    },
    {
        title: '7. Security Measures',
        content: [
            'We employ industry-standard security measures including TLS encryption, secure data storage, access controls, and regular security audits to protect your personal information.',
            'While we take all reasonable precautions, no system is completely immune to security threats. We encourage you to use a strong, unique password and enable two-factor authentication.',
        ]
    },
    {
        title: '8. Changes to This Policy',
        content: [
            'We reserve the right to update this Privacy Policy at any time. We will notify you of material changes via email or a prominent notice on our platform.',
            'Continued use of our services after changes take effect constitutes acceptance of the updated policy. The "Last Updated" date at the top of this page indicates when the policy was last revised.',
        ]
    },
    {
        title: '9. Fraud Detection & Multi-Account Prevention',
        content: [
            'To enforce our single-account policy and detect fraudulent activity, we collect and process a broad range of technical signals, including: IP addresses, device fingerprints, browser characteristics, login timestamps, GPS/location data (where permitted), and payment instrument metadata.',
            'These signals are matched against our existing user database to identify accounts that may belong to the same individual or coordinated group. This processing is conducted in the legitimate interest of maintaining a fair and secure platform.',
            'Data collected for fraud detection purposes is retained for up to seven (7) years to enable historical cross-referencing and regulatory reporting.',
            'Attempting to circumvent fraud detection systems — for example, by using VPNs, device emulators, or multiple payment methods — is a Terms of Service violation and does not constitute grounds for objection to this processing.',
            'If you believe you have been incorrectly flagged, please contact our compliance team with supporting documentation. We will review all credible appeals on a case-by-case basis.',
        ]
    },
    {
        title: '10. Contact Us',
        content: [
            'For privacy-related enquiries or to exercise your data rights, please contact us through our Support page or email our Data Protection Officer at privacy@zeero.bet.',
        ]
    },
];

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-[calc(100vh-64px)] bg-bg-zeero-3 text-white pb-24">

            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-b from-purple-500/6 via-[#0F1016] to-[#0C0D12] border-b border-white/[0.04]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(168,85,247,0.08),transparent_60%)]" />
                <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-8 text-center">
                    <div className="hidden md:flex absolute top-6 left-4">
                        <Link href="/" className="flex items-center gap-2 text-text-muted hover:text-white transition-colors text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.04] px-4 py-2 rounded-full">
                            <Home size={14} /> Back to Home
                        </Link>
                    </div>
                    <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 text-accent-purple text-xs font-black uppercase tracking-widest mb-5">
                        <Lock size={13} /> Legal
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
                        Privacy <span className="text-brand-gold">Policy</span>
                    </h1>
                    <p className="text-text-muted text-sm">Last updated: April 2026</p>
                    <p className="text-text-muted text-sm mt-2 max-w-xl mx-auto">
                        This policy explains how Zeero (operated by BlockDance B.V.) collects, uses, and protects your personal information.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
                {SECTIONS.map(({ title, content }) => (
                    <div key={title} className="rounded-2xl border border-white/[0.04] bg-bg-deep overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/[0.04]">
                            <h2 className="text-white font-bold text-base">{title}</h2>
                        </div>
                        <div className="px-6 py-5 space-y-3">
                            {content.map((p, i) => (
                                <p key={i} className="text-text-muted text-sm leading-relaxed">{p}</p>
                            ))}
                        </div>
                    </div>
                ))}

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Link href="/legal/terms" className="flex-1 text-center py-3 rounded-xl border border-white/[0.06] text-text-muted hover:text-white hover:border-brand-gold/30 text-sm font-bold transition-all">
                        Terms of Service →
                    </Link>
                    <Link href="/legal/rules" className="flex-1 text-center py-3 rounded-xl border border-white/[0.06] text-text-muted hover:text-white hover:border-brand-gold/30 text-sm font-bold transition-all">
                        Betting Rules →
                    </Link>
                </div>
            </div>
        </div>
    );
}
