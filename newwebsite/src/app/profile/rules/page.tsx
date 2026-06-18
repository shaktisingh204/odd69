'use client';
import { ChevronLeft, Scale, Trophy, Target, Goal, CircleDot, Dribbble, Gamepad2, Gavel, Heart } from 'lucide-react';
import Link from 'next/link';

const sections = [
    {
        icon: Scale,
        color: 'text-brand-gold',
        bg: 'bg-brand-gold/10',
        title: '1. General Rules',
        items: [
            'All transactions (bets, deposits, withdrawals) made on Zeero are final once confirmed, unless otherwise stated in these rules.',
            'Bets placed on incorrect markets or at incorrect odds due to obvious errors may be voided at the discretion of Zeero.',
            'Zeero reserves the right to limit, cancel, or reject any bet at any time without providing a reason.',
            'In cases of discrepancy between the Platform display and official results, the official results from the relevant governing body shall take precedence.',
            'Bets placed after an event has started may be voided unless live betting is explicitly offered for that event.',
        ]
    },
    {
        icon: Trophy,
        color: 'text-brand-gold',
        bg: 'bg-brand-gold/10',
        title: '2. Sports Betting Rules',
        items: [
            'All sports odds are subject to change at any time before a bet is confirmed. The odds displayed at the time of bet confirmation are the final odds used for settlement.',
            'Markets are settled based on the official result at the end of regular time (90 minutes for football, etc.) unless otherwise stated. Extra time, penalties, and overtime results do not apply unless specifically offered.',
            'If a match is postponed by more than 24 hours from its scheduled start time, all bets will be voided and stakes returned.',
            'If a match is abandoned before the minimum required time (in football: 90 minutes; in cricket: the minimum overs required by the relevant governing body), all bets will be voided unless the final result is already determined.',
            'Dead heat rules apply to markets where two or more selections are declared joint winners. Winnings are divided proportionally.',
        ]
    },
    {
        icon: Target,
        color: 'text-warning-bright',
        bg: 'bg-warning-alpha-12',
        title: '3. Cricket Rules',
        items: [
            'For Test matches, all bets apply to the full match, including all 5 days where applicable.',
            'For one-day and T20 matches, if the match is reduced due to weather, the Duckworth-Lewis-Stern (DLS) method is used to determine the result. Bets are settled according to the DLS-adjusted result.',
            'Match odds bets are valid as long as at least one delivery has been bowled. If no play occurs, all bets are voided.',
            'Session bets (fancy bets) require the relevant number of overs to be completed. If not completed, session bets are voided.',
        ]
    },
    {
        icon: Goal,
        color: 'text-brand-gold',
        bg: 'bg-brand-gold/10',
        title: '4. Football (Soccer) Rules',
        items: [
            'All football bets are settled on the result after 90 minutes of play plus injury time, unless explicitly stated otherwise (e.g., "to qualify" or "to advance" bets which include extra time).',
            'If a match starts but does not reach 90 minutes, and the result cannot be determined, all bets will be voided.',
            'Own goals count as goals for the scoring team for match result purposes. For specific player goal scorer markets, own goals are excluded.',
        ]
    },
    {
        icon: CircleDot,
        color: 'text-brand-gold',
        bg: 'bg-brand-gold/10',
        title: '5. Tennis Rules',
        items: [
            'If a player retires or withdraws from a match, bets will be voided unless the result has already been determined.',
            'For set betting, bets on a specific set score will be settled based on the completed sets. Incomplete sets are voided.',
            'Tournament winner bets are settled based on the official tournament result, regardless of walkover.',
        ]
    },
    {
        icon: Dribbble,
        color: 'text-warning',
        bg: 'bg-warning-alpha-08',
        title: '6. Basketball Rules',
        items: [
            'All basketball bets are settled after 4 regulation quarters, including overtime if played, unless specifically stated otherwise.',
            'If a match does not complete at least 3 quarters, bets will be voided.',
            'Point spread and total points (over/under) bets include overtime results.',
        ]
    },
    {
        icon: Gamepad2,
        color: 'text-accent-purple',
        bg: 'bg-purple-500/10',
        title: '7. Casino Game Rules',
        items: [
            'All casino game results are final once the round is concluded. Malfunction voids play and pays.',
            'In the event of a disconnection during a live casino game, the result will be determined by the game outcome at the point of disconnection.',
            'Progressive jackpot wins are subject to verification before payout. Zeero reserves the right to delay payment pending investigation.',
            'Casino bonuses count towards wagering requirements at different rates depending on the game type. Slots: 100%. Table games and live casino: as specified in the bonus terms.',
        ]
    },
    {
        icon: Gavel,
        color: 'text-brand-gold',
        bg: 'bg-brand-gold/10',
        title: '8. Dispute Resolution',
        items: [
            'In the event of a dispute, please contact our Support team within 7 days of the event in question. Claims submitted after this period may not be considered.',
            'All disputes will be investigated and a decision made by our Compliance team. The decision of Zeero is final in all matters relating to game outcomes and bet settlement.',
            'If you are not satisfied with our resolution, you may refer the matter to the relevant regulatory authority based on your jurisdiction.',
        ]
    },
    {
        icon: Heart,
        color: 'text-danger',
        bg: 'bg-danger-alpha-10',
        title: '9. Responsible Gambling',
        items: [
            'Gambling should be an enjoyable activity. Please set deposit, loss, or session time limits through your account settings.',
            'If you feel your gambling is becoming a problem, use the self-exclusion feature in your profile or contact support. We will process self-exclusion requests within 24 hours.',
            'For gambling addiction support, contact the National Centre for Responsible Gambling or visit BeGambleAware.org.',
        ]
    }
];

export default function RulesPage() {
    return (
        <div className="space-y-6">
            {/* Back + Title */}
            <div>
                <Link href="/profile" className="inline-flex items-center gap-1 text-white/30 hover:text-white text-xs font-medium mb-3 transition-colors">
                    <ChevronLeft size={14} /> Back to Profile
                </Link>
                <h1 className="text-xl font-bold text-white">Rules & Regulations</h1>
                <p className="text-xs text-white/30 mt-1">Please read our platform rules carefully for a fair gaming environment.</p>
            </div>

            {/* Sections */}
            <div className="space-y-3">
                {sections.map((section, i) => (
                    <div key={i} className="bg-bg-modal rounded-xl border border-white/[0.06] overflow-hidden">
                        <div className="px-4 py-3 flex items-center gap-3 border-b border-white/[0.04]">
                            <div className={`w-8 h-8 rounded-lg ${section.bg} flex items-center justify-center flex-shrink-0`}>
                                <section.icon size={16} className={section.color} />
                            </div>
                            <h2 className="text-sm font-bold text-white">{section.title}</h2>
                        </div>
                        <div className="px-4 py-3 space-y-2.5">
                            {section.items.map((item, j) => (
                                <div key={j} className="flex gap-2.5 text-[13px] text-white/50 leading-relaxed">
                                    <span className="text-white/15 mt-0.5 flex-shrink-0">•</span>
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-center text-[10px] text-white/15 py-2">
                Last updated: March 2026
            </div>
        </div>
    );
}
