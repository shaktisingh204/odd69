import React from 'react';
import Link from 'next/link';
import { Home, BookOpen } from 'lucide-react';

export const metadata = {
    title: 'Betting Rules | Zeero',
    description: 'Official betting and gaming rules for the Zeero platform, covering sports, casino, and general rules.',
};

const SECTIONS = [
    {
        title: '1. General Rules',
        content: [
            'All transactions (bets, deposits, withdrawals) made on Zeero are final once confirmed, unless otherwise stated in these rules.',
            'Bets placed on incorrect markets or at incorrect odds due to obvious errors may be voided at the discretion of Zeero.',
            'Zeero reserves the right to limit, cancel, or reject any bet at any time without providing a reason.',
            'In cases of discrepancy between the Platform display and official results, the official results from the relevant governing body shall take precedence.',
            'Bets placed after an event has started may be voided unless live betting is explicitly offered for that event.',
        ]
    },
    {
        title: '2. Sports Betting Rules',
        content: [
            'All sports odds are subject to change at any time before a bet is confirmed. The odds displayed at the time of bet confirmation are the final odds used for settlement.',
            'Markets are settled based on the official result at the end of regular time (90 minutes for football, etc.) unless otherwise stated. Extra time, penalties, and overtime results do not apply unless specifically offered.',
            'If a match is postponed by more than 24 hours from its scheduled start time, all bets will be voided and stakes returned.',
            'If a match is abandoned before the minimum required time (in football: 90 minutes; in cricket: the minimum overs required by the relevant governing body), all bets will be voided unless the final result is already determined.',
            'Dead heat rules apply to markets where two or more selections are declared joint winners. Winnings are divided proportionally.',
        ]
    },
    {
        title: '3. Cricket Rules',
        content: [
            'For Test matches, all bets apply to the full match, including all 5 days where applicable.',
            'For one-day and T20 matches, if the match is reduced due to weather, the Duckworth-Lewis-Stern (DLS) method is used to determine the result. Bets are settled according to the DLS-adjusted result.',
            'Match odds bets are valid as long as at least one delivery has been bowled. If no play occurs, all bets are voided.',
            'Session bets (fancy bets) require the relevant number of overs to be completed. If not completed, session bets are voided.',
        ]
    },
    {
        title: '4. Football (Soccer) Rules',
        content: [
            'All football bets are settled on the result after 90 minutes of play plus injury time, unless explicitly stated otherwise (e.g., "to qualify" or "to advance" bets which include extra time).',
            'If a match starts but does not reach 90 minutes, and the result cannot be determined, all bets will be voided.',
            'Own goals count as goals for the scoring team for match result purposes. For specific player goal scorer markets, own goals are excluded.',
        ]
    },
    {
        title: '5. Tennis Rules',
        content: [
            'If a player retires or withdraws from a match, bets will be voided unless the result has already been determined.',
            'For set betting, bets on a specific set score will be settled based on the completed sets. Incomplete sets are voided.',
            'Tournament winner bets are settled based on the official tournament result, regardless of walkover.',
        ]
    },
    {
        title: '6. Basketball Rules',
        content: [
            'All basketball bets are settled after 4 regulation quarters, including overtime if played, unless specifically stated otherwise.',
            'If a match does not complete at least 3 quarters, bets will be voided.',
            'Point spread and total points (over/under) bets include overtime results.',
        ]
    },
    {
        title: '7. Casino Game Rules',
        content: [
            'All casino game results are final once the round is concluded. Malfunction voids play and pays.',
            'In the event of a disconnection during a live casino game, the result will be determined by the game outcome at the point of disconnection.',
            'Progressive jackpot wins are subject to verification before payout. Zeero reserves the right to delay payment pending investigation.',
            'Casino bonuses count towards wagering requirements at different rates depending on the game type. Slots: 100%. Table games and live casino: as specified in the bonus terms.',
        ]
    },
    {
        title: '8. Dispute Resolution',
        content: [
            'In the event of a dispute, please contact our Support team within 7 days of the event in question. Claims submitted after this period may not be considered.',
            'All disputes will be investigated and a decision made by our Compliance team. The decision of Zeero is final in all matters relating to game outcomes and bet settlement.',
            'If you are not satisfied with our resolution, you may refer the matter to the relevant regulatory authority based on your jurisdiction.',
        ]
    },
    {
        title: '9. Responsible Gambling',
        content: [
            'Gambling should be an enjoyable activity. Please set deposit, loss, or session time limits through your account settings.',
            'If you feel your gambling is becoming a problem, use the self-exclusion feature in your profile or contact support. We will process self-exclusion requests within 24 hours.',
            'For gambling addiction support, contact the National Centre for Responsible Gambling or visit BeGambleAware.org.',
        ]
    },
];

export default function RulesPage() {
    return (
        <div className="min-h-[calc(100vh-64px)] bg-bg-zeero-3 text-white pb-24">

            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-b from-brand-gold/6 via-[#0F1016] to-[#0C0D12] border-b border-white/[0.04]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,175,55,0.08),transparent_60%)]" />
                <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-8 text-center">
                    <div className="hidden md:flex absolute top-6 left-4">
                        <Link href="/" className="flex items-center gap-2 text-text-muted hover:text-white transition-colors text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.04] px-4 py-2 rounded-full">
                            <Home size={14} /> Back to Home
                        </Link>
                    </div>
                    <div className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-4 py-1.5 text-brand-gold text-xs font-black uppercase tracking-widest mb-5">
                        <BookOpen size={13} /> Rules
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
                        Betting <span className="text-brand-gold">Rules</span>
                    </h1>
                    <p className="text-text-muted text-sm">Last updated: March 2026</p>
                    <p className="text-text-muted text-sm mt-2 max-w-xl mx-auto">
                        Official rules governing sports betting, casino games, and dispute resolution on Zeero.
                    </p>
                </div>
            </div>

            {/* Quick Navigation */}
            <div className="max-w-3xl mx-auto px-4 pt-8">
                <div className="bg-bg-deep border border-white/[0.04] rounded-2xl p-5 mb-8">
                    <p className="text-xs font-black text-text-muted uppercase tracking-widest mb-3">Quick Navigation</p>
                    <div className="flex flex-wrap gap-2">
                        {SECTIONS.map(({ title }) => (
                            <span key={title} className="text-xs text-text-muted bg-white/[0.04] px-3 py-1.5 rounded-full">
                                {title.replace(/^\d+\.\s/, '')}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 pb-12 space-y-6">
                {SECTIONS.map(({ title, content }) => (
                    <div key={title} className="rounded-2xl border border-white/[0.04] bg-bg-deep overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/[0.04]">
                            <h2 className="text-white font-bold text-base">{title}</h2>
                        </div>
                        <div className="px-6 py-5">
                            <ul className="space-y-3">
                                {content.map((p, i) => (
                                    <li key={i} className="flex gap-3 text-sm text-text-muted leading-relaxed">
                                        <span className="text-brand-gold font-black mt-0.5 flex-shrink-0">›</span>
                                        <span>{p}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Link href="/legal/privacy-policy" className="flex-1 text-center py-3 rounded-xl border border-white/[0.06] text-text-muted hover:text-white hover:border-brand-gold/30 text-sm font-bold transition-all">
                        Privacy Policy →
                    </Link>
                    <Link href="/legal/terms" className="flex-1 text-center py-3 rounded-xl border border-white/[0.06] text-text-muted hover:text-white hover:border-brand-gold/30 text-sm font-bold transition-all">
                        Terms of Service →
                    </Link>
                </div>
            </div>
        </div>
    );
}
