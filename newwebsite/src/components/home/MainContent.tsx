import { useEffect, useState, useMemo } from 'react';
import { Star, Activity, Trophy, Timer, Gamepad2, X, ChevronRight, Flag } from 'lucide-react';
import { sportsApi, Event } from '@/services/sports';
import MatchRow from './MatchRow';
import { getRegionFlag, getFlagByCode } from '@/config/countries';

interface MainContentProps {
    selectedSportId: string | null;
    matches?: Event[]; // Optional, but expected for LivePage
}

export default function MainContent({ selectedSportId, matches: propMatches }: MainContentProps) {
    const [internalMatches, setInternalMatches] = useState<Event[]>([]);
    const [loading, setLoading] = useState(!propMatches);
    const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null); // To filter by country
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const activeMatches = propMatches || internalMatches;

    // Reset tournament and country when sport changes
    useEffect(() => {
        setSelectedTournament(null);
        setSelectedCountry(null);
        setIsDropdownOpen(false);
    }, [selectedSportId]);

    // Only fetch internally if no prop provided
    useEffect(() => {
        if (propMatches) {
            setLoading(false);
            return;
        }

        const fetchLiveEvents = async () => {
            try {
                const data = await sportsApi.getLiveEvents();
                setInternalMatches(data);
            } catch (error) {
                console.error("Failed to fetch live events", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLiveEvents();
    }, [propMatches]);

    // Derived Data: Available Sports
    const availableSports = useMemo(() => {
        const sports = new Map<string, { id: string, name: string, count: number }>();
        activeMatches.forEach(m => {
            const sName = m.competition?.sport?.sport_name || "Other";
            const sId = m.competition?.sport?.sport_id || "0";
            if (!sports.has(sName)) {
                sports.set(sName, { id: sId, name: sName, count: 0 });
            }
            sports.get(sName)!.count++;
        });
        return Array.from(sports.values()).sort((a, b) => b.count - a.count);
    }, [activeMatches]);

    // Active Sport Name
    const activeSportName = useMemo(() => {
        if (!selectedSportId) return "Popular";
        const found = availableSports.find(s => s.id === selectedSportId);
        return found ? found.name : "Sports";
    }, [selectedSportId, availableSports]);

    // Unique Tournaments (Raw List)
    const uniqueTournaments = useMemo(() => {
        const targetMatches = selectedSportId
            ? activeMatches.filter(m => (m.competition?.sport?.sport_id || "0") === selectedSportId)
            : activeMatches;

        const tournaments = new Map<string, { id: string, name: string, count: number, country_code?: string }>();

        targetMatches.forEach(m => {
            const tName = m.competition_name || m.competition?.competition_name || "Unknown League";
            const tId = m.competition?.competition_id || "0";
            if (!tournaments.has(tName)) {
                tournaments.set(tName, {
                    id: tId,
                    name: tName,
                    count: 0,
                    country_code: m.competition?.country_code
                });
            }
            tournaments.get(tName)!.count++;
        });
        return Array.from(tournaments.values()).sort((a, b) => b.count - a.count);
    }, [activeMatches, selectedSportId]);

    // Group Tournaments by Country for Dropdown
    const countries = useMemo(() => {
        const countryMap = new Map<string, { code: string, name: string, count: number }>();

        activeMatches.forEach(m => {
            if (m.competition?.country_code) {
                const code = m.competition.country_code;
                if (!countryMap.has(code)) {
                    countryMap.set(code, { code, name: code, count: 0 });
                }
                countryMap.get(code)!.count++;
            }
        });
        return Array.from(countryMap.values()).sort((a, b) => b.count - a.count);
    }, [activeMatches]);

    // Filter Rail Tournaments based on selection
    const railTournaments = useMemo(() => {
        if (selectedCountry) {
            // If Country selected, show tournaments for that country
            return uniqueTournaments.filter(t => t.country_code === selectedCountry);
        }

        const international = uniqueTournaments.filter(t =>
            t.name.includes('UEFA') ||
            t.name.includes('FIFA') ||
            t.name.includes('International') ||
            t.country_code === 'INT' ||
            t.country_code === 'EU'
        );
        // If international/top tier found, use them. Else fallback to top 10 general.
        return international.length > 0 ? international : uniqueTournaments.slice(0, 10);
    }, [uniqueTournaments, selectedCountry]);

    // Filter Matches based on selection
    const filteredMatches = useMemo(() => {
        return activeMatches.filter(m => {
            const sId = m.competition?.sport?.sport_id || "0";
            const tName = m.competition_name || m.competition?.competition_name || "Unknown League";
            const cCode = m.competition?.country_code;

            // 1. Filter by Sport
            if (selectedSportId && sId !== selectedSportId) {
                return false;
            }

            // 2. Filter by Country (if selected)
            if (selectedCountry && cCode !== selectedCountry) {
                return false;
            }

            // 3. Filter by Tournament
            if (selectedTournament && tName !== selectedTournament) {
                return false;
            }

            return true;
        });
    }, [activeMatches, selectedSportId, selectedTournament, selectedCountry]);

    // Icon helper
    const getSportIcon = (sportName: string) => {
        const lower = sportName.toLowerCase();
        if (lower.includes('cricket')) return <Activity size={18} />;
        if (lower.includes('soccer') || lower.includes('football')) return <Activity size={18} />;
        if (lower.includes('tennis')) return <Trophy size={18} />;
        if (lower.includes('basket')) return <Timer size={18} />;
        if (lower.includes('game') || lower.includes('esport')) return <Gamepad2 size={18} />;
        return <Activity size={18} />;
    };

    return (
        <main className="flex-1 bg-bg-base pt-[60px] md:pt-[64px] min-h-screen pb-20 xl:mr-[64px] overflow-hidden w-full relative">

            {/* Top Area */}
            <div className="p-4 pb-0">
                <div className="w-full h-[180px] bg-gradient-banner rounded-lg relative overflow-hidden flex items-center px-8 mb-6 shadow-lg shadow-glow-gold/20">
                    <div className="z-10 relative max-w-lg">
                        <span className="bg-bg-base text-brand-gold text-[10px] font-extrabold px-1.5 py-0.5 rounded-[2px] uppercase tracking-wider mb-2 inline-block border border-brand-gold/20">Urgent</span>
                        <h2 className="text-3xl font-extrabold text-white mb-2 leading-tight drop-shadow-sm">
                            Secure Your <br /> Account
                        </h2>
                        <p className="text-[11px] text-text-inverse/80 font-medium mb-1">
                            Never Share Password - 4RABET Won't Ask For It
                        </p>
                    </div>
                    {selectedTournament && (
                        <button
                            className="absolute top-4 right-4 flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-gold text-text-inverse text-[12px] font-bold border border-brand-gold shadow-glow-gold transition-all"
                            onClick={() => setSelectedTournament(null)}
                        >
                            <span className="text-[14px]">
                                {uniqueTournaments.find(t => t.name === selectedTournament)?.country_code
                                    ? getFlagByCode(uniqueTournaments.find(t => t.name === selectedTournament)!.country_code!)
                                    : getRegionFlag(selectedTournament)}
                            </span>
                            {selectedTournament}
                            <X size={14} className="ml-1" />
                        </button>
                    )}
                </div>
            </div>

            {/* Dynamic Header */}
            <div className="px-4 mb-4 flex items-center gap-3">
                <div className="flex items-center gap-2">
                    {getSportIcon(activeSportName)}
                    <h2 className="text-xl font-black text-text-primary uppercase tracking-tight">
                        {activeSportName}
                    </h2>
                </div>
                {selectedSportId && (
                    <span className="text-xs font-bold text-text-muted bg-bg-elevated px-2 py-1 rounded">
                        Lives
                    </span>
                )}
            </div>

            {/* TOURNAMENT RAIL (Horizontal Scroll) */}
            <div className="px-4 mb-6 relative z-20"> {/* Elevated Z-index for dropdown */}
                <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-brand-gold/20 scrollbar-track-transparent snap-x">

                    {/* All / Countries Dropdown Trigger */}
                    {/* All / Countries Dropdown Trigger */}
                    <div className="relative shrink-0 snap-start">
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className={`
                                h-[36px] flex items-center gap-2 px-3 pl-4 rounded-full text-[13px] font-bold tracking-wide transition-all
                                ${isDropdownOpen
                                    ? 'bg-bg-elevated text-text-primary ring-1 ring-white/10'
                                    : 'bg-bg-card hover:bg-bg-elevated text-text-secondary hover:text-text-primary'}
                            `}
                        >
                            All
                            <span className="bg-bg-base/50 text-text-muted px-1.5 py-0.5 rounded-[4px] text-[11px] font-bold min-w-[24px] text-center">
                                {selectedCountry ? activeMatches.filter(m => m.competition?.country_code === selectedCountry).length : activeMatches.length}
                            </span>
                            <ChevronRight size={14} className={`transition-transform duration-200 opacity-60 ${isDropdownOpen ? '-rotate-90' : 'rotate-90'}`} />
                        </button>

                        {/* Dropdown Menu (Screenshot Style) */}
                        {isDropdownOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsDropdownOpen(false)}
                                />
                                <div className="absolute top-full left-0 mt-2 w-[280px] bg-bg-modal border border-white/[0.04] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[400px] overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="py-2 flex flex-col">
                                        {/* International / All Option */}
                                        <button
                                            onClick={() => {
                                                setSelectedCountry(null);
                                                setSelectedTournament(null);
                                                setIsDropdownOpen(false);
                                            }}
                                            className="px-4 py-2.5 flex items-center justify-between hover:bg-white/[0.05] transition-colors group mx-2 rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 flex items-center justify-center">
                                                    <span className="text-xl">🌍</span>
                                                </div>
                                                <span className={`text-[13px] font-bold ${!selectedCountry ? 'text-white' : 'text-text-secondary group-hover:text-white'}`}>
                                                    International
                                                </span>
                                                <span className="bg-white/[0.04] text-text-muted px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold">
                                                    {activeMatches.length}
                                                </span>
                                            </div>
                                            <ChevronRight size={14} className="text-text-disabled opacity-0 group-hover:opacity-100 transition-opacity rotate-90" />
                                        </button>

                                        {/* Country List */}
                                        {countries.map(country => (
                                            <button
                                                key={country.code}
                                                onClick={() => {
                                                    setSelectedCountry(country.code);
                                                    setSelectedTournament(null);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`px-4 py-2.5 flex items-center justify-between hover:bg-white/[0.05] transition-colors group mx-2 rounded-lg ${selectedCountry === country.code ? 'bg-white/[0.04]' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 flex items-center justify-center overflow-hidden rounded-full border border-white/[0.04] bg-bg-base">
                                                        <span className="text-xl leading-none">{getFlagByCode(country.code)}</span>
                                                    </div>
                                                    <span className={`text-[13px] font-bold ${selectedCountry === country.code ? 'text-white' : 'text-text-secondary group-hover:text-white'}`}>
                                                        {country.name === country.code ? (country.name === 'EN' ? 'England' : country.name) : country.name}
                                                    </span>
                                                    <span className="bg-white/[0.04] text-text-muted px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold">
                                                        {country.count}
                                                    </span>
                                                </div>
                                                <ChevronRight size={14} className="text-text-disabled opacity-50 rotate-90" />
                                            </button>
                                        ))}

                                        {countries.length === 0 && (
                                            <div className="px-4 py-8 text-center text-xs text-text-muted">
                                                No locations found
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* POPULAR Pill (Default) */}
                    <button
                        onClick={() => {
                            setSelectedTournament(null);
                            setSelectedCountry(null);
                        }}
                        className={`
                            shrink-0 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all snap-start border flex items-center gap-2
                            ${selectedTournament === null
                                ? 'bg-brand-gold text-white border-[#00E701] shadow-[0_0_10px_rgba(0,231,1,0.4)]'
                                : 'bg-bg-elevated text-text-muted border-divider hover:text-text-primary hover:border-brand-gold/50'}
                        `}
                    >
                        <Star size={12} className={selectedTournament === null ? 'fill-black' : ''} />
                        Popular
                    </button>

                    {/* Rail Tournaments (International / Top) */}
                    {railTournaments.map(tour => (
                        <button
                            key={tour.id}
                            onClick={() => setSelectedTournament(tour.name)}
                            className={`
                                shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all snap-start border flex items-center gap-2 group
                                ${selectedTournament === tour.name
                                    ? 'bg-bg-hover text-brand-gold border-brand-gold shadow-sm'
                                    : 'bg-bg-elevated text-text-secondary border-divider hover:bg-bg-hover hover:text-text-primary hover:border-text-muted'}
                            `}
                        >
                            <span className="text-base group-hover:scale-110 transition-transform">
                                {tour.country_code ? getFlagByCode(tour.country_code) : getRegionFlag(tour.name)}
                            </span>
                            <span className="truncate max-w-[150px]">{tour.name}</span>
                            <span className={`text-[10px] ml-1 px-1.5 py-0.5 rounded ${selectedTournament === tour.name ? 'bg-brand-gold/10 text-brand-gold' : 'bg-bg-base text-text-muted'}`}>
                                {tour.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Matches List */}
            <div className="flex flex-col border-t border-divider bg-bg-base">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-text-muted font-bold tracking-widest uppercase">Loading Events...</span>
                    </div>
                ) : filteredMatches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2 opacity-60">
                        <Trophy size={48} className="text-text-muted mb-2" />
                        <span className="text-sm text-text-muted font-bold">No Live Events Available</span>
                        <p className="text-xs text-text-disabled">Current selection has no active matches.</p>
                    </div>
                ) : (
                    filteredMatches.map((match) => (
                        <MatchRow key={match.event_id} match={match} />
                    ))
                )}
            </div>
        </main>
    );
}
