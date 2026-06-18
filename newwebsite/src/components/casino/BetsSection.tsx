import React, { useEffect, useState } from 'react';
import { casinoService } from '@/services/casino';
import { useAuth } from '@/context/AuthContext';
import { Ghost } from 'lucide-react';

const BetsSection = ({ gameCode }: { gameCode?: string }) => {
    const { user } = useAuth();
    const [bets, setBets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBets = async () => {
            if (!user) {
                setLoading(false);
                return;
            }
            try {
                // Pass gameCode to filter bets
                const data = await casinoService.getMyBets(20, gameCode);
                setBets(data);
            } catch (error) {
                console.error("Failed to fetch bets", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBets();

        // Optional: Poll for new bets every 10s?
        const interval = setInterval(fetchBets, 10000);
        return () => clearInterval(interval);
    }, [user, gameCode]);

    return (
        <div className="w-full bg-bg-deep rounded-xl border border-[#1b2b40] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1b2b40]">
                <h3 className="text-white font-bold text-lg">Latest bet & Race</h3>

                <div className="flex bg-bg-well rounded-lg p-1">
                    {/* User requested ONLY "My bets" essentially. 
                        We can show others as disabled or just show My Bets.
                        "only show my bets" -> implies hiding others or making it the only option.
                    */}
                    <button className="px-4 py-1.5 rounded-md bg-bg-well text-white text-sm font-bold shadow-sm">
                        My bets
                    </button>
                    {/* 
                    <button className="px-4 py-1.5 rounded-md text-gray-400 text-sm font-medium hover:text-white transition-colors">
                        High Roller
                    </button>
                    <button className="px-4 py-1.5 rounded-md text-gray-400 text-sm font-medium hover:text-white transition-colors">
                        Wager Contest
                    </button> 
                    */}
                </div>
            </div>

            {/* Content */}
            <div className="min-h-[200px]">
                {loading ? (
                    <div className="flex items-center justify-center h-[200px] text-gray-500">
                        Loading...
                    </div>
                ) : bets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[300px] gap-4">
                        <div className="w-24 h-24 relative opacity-50">
                            {/* Placeholder Graphic - using Lucide Ghost as placeholder for the dino/mascot */}
                            <Ghost size={80} className="text-gray-600" />
                        </div>
                        <span className="text-gray-400 font-medium">No bets yet</span>
                        {/* "show play 1 bet" - sounds like a CTA button? */}
                        <button className="px-6 py-2 bg-brand-green text-text-inverse font-bold rounded-lg hover:bg-opacity-90 transition-all">
                            Play 1 bet
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-gray-500 font-medium border-b border-[#1b2b40]">
                                <tr>
                                    <th className="px-4 py-3">Bet ID / Game</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3 text-right">Result</th>
                                    <th className="px-4 py-3 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bets.map((bet) => (
                                    <tr key={bet.id} className="border-b border-[#1b2b40]/50 hover:bg-bg-well transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium">{bet.game_code || 'Unknown Game'}</span>
                                                <span className="text-xs text-gray-500">{bet.txn_id}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-white font-bold">
                                                {bet.type === 'debit' ? '-' : '+'}
                                                {parseFloat(bet.amount).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`font-bold ${bet.type === 'credit' ? 'text-brand-green' : 'text-gray-400'}`}>
                                                {bet.type === 'credit' ? 'Win' : 'Bet'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-500">
                                            {new Date(bet.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BetsSection;
