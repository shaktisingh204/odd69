
import { useEffect, useState } from 'react';
import { Star, Monitor, Activity, TrendingUp, Lock, Shield, Trophy, Timer, Gamepad2 } from 'lucide-react';
import { sportsApi, Event } from '@/services/sports';
import MatchRow from './MatchRow';

export default function MainContent() {
    const [matches, setMatches] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLiveEvents = async () => {
            try {
                const data = await sportsApi.getLiveEvents();
                // console.log("Live Events:", data);
                setMatches(data);
            } catch (error) {
                console.error("Failed to fetch live events", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLiveEvents();
        const interval = setInterval(fetchLiveEvents, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    return (
        <main className="flex-1 bg-[#0a111a] pt-[60px] md:pt-[64px] min-h-screen pb-20 md:ml-[240px] xl:mr-[64px] overflow-hidden">
            {/* Top Area */}
            <div className="p-4 pb-0">
                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                    <button className="flex items-center gap-2 px-4 py-2 bg-[#1b2b40] text-white rounded-[4px] text-[11px] font-bold uppercase hover:bg-[#233347] transition-colors border-l-4 border-yellow-400">
                        <Star size={14} className="text-yellow-400 fill-current" /> HIGHLIGHTS
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-[#1b2b40] text-gray-400 hover:text-white rounded-[4px] text-[11px] font-bold uppercase transition-colors">
                        <Monitor size={14} /> EVENT BUILDER
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-[#1b2b40] text-gray-400 hover:text-white rounded-[4px] text-[11px] font-bold uppercase transition-colors">
                        <TrendingUp size={14} /> BETS FEED
                    </button>
                </div>

                {/* Banner */}
                <div className="w-full h-[180px] bg-gradient-to-r from-[#0048b3] to-[#0099ff] rounded-lg relative overflow-hidden flex items-center px-8 mb-6 shadow-lg shadow-blue-900/20">
                    <div className="z-10 relative max-w-lg">
                        <span className="bg-yellow-400 text-black text-[10px] font-extrabold px-1.5 py-0.5 rounded-[2px] uppercase tracking-wider mb-2 inline-block">Urgent</span>
                        <h2 className="text-3xl font-extrabold text-white mb-2 leading-tight drop-shadow-sm">
                            Secure Your <br /> Account
                        </h2>
                        <p className="text-[11px] text-blue-100 font-medium mb-1">
                            Never Share Password - 4RABET Won't Ask For It
                        </p>
                        <p className="text-[11px] text-blue-100 font-medium underline cursor-pointer hover:text-white transition-colors">
                            Our Official Support - support@4rabet.com
                        </p>
                    </div>
                    {/* Decorative Icons */}
                    <div className="absolute right-20 top-1/2 -translate-y-1/2 opacity-20 rotate-12">
                        <Shield size={140} className="text-white fill-current" />
                    </div>
                    <div className="absolute right-40 bottom-4 text-yellow-400 opacity-80 animate-bounce">
                        <Lock size={40} className="fill-current" />
                    </div>
                </div>
            </div>

            {/* Popular Header */}
            <div className="px-4 mb-2 flex items-center gap-2">
                <span className="text-yellow-500">
                    <Star size={18} fill="currentColor" />
                </span>
                <h2 className="text-lg font-bold text-white">Popular table</h2>
            </div>

            {/* Popular Sports Bar */}
            <div className="px-4 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                <div className="flex gap-2 min-w-max">
                    <button className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-blue text-white text-[12px] font-bold border border-brand-blue shadow-lg shadow-blue-500/20 transition-all">
                        <Activity size={14} /> Cricket
                    </button>
                    <button className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-transparent border border-[#233347] text-gray-400 hover:text-white hover:border-gray-500 text-[12px] font-bold transition-all">
                        <Activity size={14} /> Soccer
                    </button>
                    <button className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-transparent border border-[#233347] text-gray-400 hover:text-white hover:border-gray-500 text-[12px] font-bold transition-all">
                        <Gamepad2 size={14} /> eCricket
                    </button>
                    <button className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-transparent border border-[#233347] text-gray-400 hover:text-white hover:border-gray-500 text-[12px] font-bold transition-all">
                        <Trophy size={14} /> Tennis
                    </button>
                    <button className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-transparent border border-[#233347] text-gray-400 hover:text-white hover:border-gray-500 text-[12px] font-bold transition-all">
                        <Timer size={14} /> Basketball
                    </button>
                </div>
            </div>

            {/* Matches List */}
            <div className="flex flex-col border-t border-[#1b2b40]">
                {loading ? (
                    <div className="text-center text-gray-400 p-10">Loading events...</div>
                ) : matches.length === 0 ? (
                    <div className="text-center text-gray-400 p-10">No live events available</div>
                ) : (
                    matches.map((match) => (
                        <MatchRow key={match.event_id} match={match} />
                    ))
                )}
            </div>
        </main>
    );
}
