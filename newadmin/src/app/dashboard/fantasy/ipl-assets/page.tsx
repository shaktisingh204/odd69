'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Zap, CheckCircle2, AlertCircle, Image as ImageIcon, Users, Trophy, X, Trash2 } from 'lucide-react';
import {
    scrapeAllIPLAssets,
    scrapeSingleIPLTeam,
    listIPLAssets,
    getIPLScrapeJobStatus,
    listIPLScrapeJobs,
    cancelIPLScrapeJob,
    deleteIPLScrapeJob,
    type TeamScrapeResult,
    type IPLScrapeJobStatus,
} from '@/actions/ipl-asset-scraper';

type JobSummary = Awaited<ReturnType<typeof listIPLScrapeJobs>>['jobs'][number];

interface Assets {
    teams: Array<{ code: string; name: string; slug: string; logoUrl?: string }>;
    playersByTeam: Record<string, Array<{ name: string; cfUrl: string; iplImageId: string }>>;
    totalPlayers: number;
}

export default function IPLAssetsPage() {
    const [assets, setAssets] = useState<Assets | null>(null);
    const [loading, setLoading] = useState(true);
    const [job, setJob] = useState<IPLScrapeJobStatus | null>(null);
    const [runningTeam, setRunningTeam] = useState<string | null>(null);
    const [results, setResults] = useState<TeamScrapeResult[] | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [recentJobs, setRecentJobs] = useState<JobSummary[]>([]);
    const [cancelling, setCancelling] = useState(false);
    const [clearing, setClearing] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const running = job?.status === 'pending' || job?.status === 'running';

    const loadJobs = useCallback(async () => {
        try {
            const res = await listIPLScrapeJobs(10);
            setRecentJobs(res.jobs);
        } catch (e: any) {
            setErr(e.message);
        }
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const data = await listIPLAssets();
            setAssets(data);
        } catch (e: any) {
            setErr(e.message);
        }
        setLoading(false);
        await loadJobs();
    };

    useEffect(() => { load(); }, []);

    // Stop any poll on unmount
    useEffect(() => () => {
        if (pollRef.current) clearInterval(pollRef.current);
    }, []);

    const pollJob = (jobId: string) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const res = await getIPLScrapeJobStatus(jobId);
                if (!res.success || !res.job) return;
                setJob(res.job);
                if (res.job.status === 'completed' || res.job.status === 'failed') {
                    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                    setResults(res.job.teams);
                    if (res.job.status === 'failed' && res.job.error) setErr(res.job.error);
                    await load();
                } else {
                    loadJobs();
                }
            } catch (e: any) {
                setErr(e.message);
                if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            }
        }, 2000);
    };

    const runAll = async () => {
        if (running) return;
        setErr(null);
        setResults(null);
        try {
            const res = await scrapeAllIPLAssets();
            if (!res.success || !res.jobId) {
                setErr(res.error || 'Failed to start scrape');
                return;
            }
            setJob({
                id: res.jobId,
                status: 'pending',
                totalTeams: 10,
                completedTeams: 0,
                teams: [],
                stats: { teamsLogoUploaded: 0, teamsLogoExisting: 0, playersUploaded: 0, playersExisting: 0, playersFailed: 0 },
                startedAt: new Date().toISOString(),
            });
            pollJob(res.jobId);
        } catch (e: any) {
            setErr(e.message);
        }
    };

    const cancelCurrent = async () => {
        if (!job || cancelling) return;
        setCancelling(true);
        try {
            const res = await cancelIPLScrapeJob(job.id);
            if (!res.success) setErr(res.error || 'Failed to cancel');
            // Let the poller pick up the status flip; it will stop itself.
        } catch (e: any) {
            setErr(e.message);
        }
        setCancelling(false);
    };

    const deleteJob = async (jobId: string) => {
        try {
            const res = await deleteIPLScrapeJob(jobId);
            if (!res.success) { setErr(res.error || 'Failed to delete'); return; }
            if (job?.id === jobId) setJob(null);
            await loadJobs();
        } catch (e: any) {
            setErr(e.message);
        }
    };

    const clearFinishedJobs = async () => {
        if (clearing) return;
        setClearing(true);
        try {
            const res = await deleteIPLScrapeJob();
            if (!res.success) setErr(res.error || 'Failed to clear');
            await loadJobs();
        } catch (e: any) {
            setErr(e.message);
        }
        setClearing(false);
    };

    const runOne = async (code: string) => {
        if (runningTeam) return;
        setRunningTeam(code);
        setErr(null);
        try {
            const res = await scrapeSingleIPLTeam(code);
            if (res.success && res.team) {
                setResults([res.team]);
                setJob(null);
            } else {
                setErr(res.error || 'Failed');
            }
            await load();
        } catch (e: any) {
            setErr(e.message);
        }
        setRunningTeam(null);
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-5">
            <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2">
                    <Trophy size={18} className="text-brand-gold" /> IPL Team &amp; Player Assets
                </h1>
                <p className="text-sm text-white/40 mt-0.5">
                    Scrapes all 10 IPL team pages on iplt20.com and uploads team logos + player
                    headshots to Cloudflare Images. Fantasy API uses these for squad display.
                </p>
            </div>

            <div className="bg-[#13151a] border border-violet-500/10 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-white/70">Bulk scrape all IPL teams</h2>
                        <p className="text-xs text-white/40 mt-1">
                            Fetches 10 team pages, uploads logo + ~25 player images per team.
                            Skips anything already in Cloudflare. Takes ~1–2 minutes.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {running && (
                            <button
                                onClick={cancelCurrent}
                                disabled={cancelling}
                                className="flex items-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs px-3 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                            >
                                {cancelling ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                                Cancel
                            </button>
                        )}
                        <button
                            onClick={runAll}
                            disabled={running}
                            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/40 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
                        >
                            {running ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                            {running
                                ? `Scraping ${job?.currentTeam ?? '…'} (${job?.completedTeams ?? 0}/${job?.totalTeams ?? 10})`
                                : 'Scrape all 10 teams'}
                        </button>
                    </div>
                </div>

                {job && (
                    <div className="mt-4 space-y-3">
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all ${job.status === 'failed' ? 'bg-rose-500' : 'bg-violet-500'}`}
                                style={{ width: `${Math.round((job.completedTeams / Math.max(1, job.totalTeams)) * 100)}%` }}
                            />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                            <Stat label="Logos uploaded" value={job.stats.teamsLogoUploaded} tone="ok" />
                            <Stat label="Logos existing" value={job.stats.teamsLogoExisting} tone="dim" />
                            <Stat label="Players uploaded" value={job.stats.playersUploaded} tone="ok" />
                            <Stat label="Players existing" value={job.stats.playersExisting} tone="dim" />
                            <Stat label="Players failed" value={job.stats.playersFailed} tone={job.stats.playersFailed > 0 ? 'err' : 'dim'} />
                        </div>
                        {job.status === 'completed' && (
                            <div className="text-[11px] text-emerald-400/80 flex items-center gap-1">
                                <CheckCircle2 size={12} /> Done. {job.completedTeams}/{job.totalTeams} teams processed.
                            </div>
                        )}
                    </div>
                )}

                {err && (
                    <div className="mt-4 flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-300">
                        <AlertCircle size={14} /> {err}
                    </div>
                )}
            </div>

            {/* Recent jobs */}
            {recentJobs.length > 0 && (
                <div className="bg-[#13151a] border border-white/6 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-white/60 uppercase tracking-wide">Recent jobs</h3>
                        <button
                            onClick={clearFinishedJobs}
                            disabled={clearing || recentJobs.every(j => j.status === 'running' || j.status === 'pending')}
                            className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-rose-300 disabled:opacity-30 disabled:hover:text-white/50 transition-colors"
                        >
                            {clearing ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                            Clear finished
                        </button>
                    </div>
                    <div className="space-y-1.5">
                        {recentJobs.map(j => {
                            const isActive = j.status === 'pending' || j.status === 'running';
                            const statusColor =
                                j.status === 'completed' ? 'text-emerald-400' :
                                j.status === 'failed'    ? 'text-rose-400' :
                                                           'text-violet-300';
                            const when = new Date(j.startedAt).toLocaleString();
                            return (
                                <div key={j.id} className="flex items-center gap-3 text-[11px] bg-white/3 border border-white/5 rounded-lg px-3 py-2">
                                    <span className={`font-bold uppercase tracking-wide ${statusColor} min-w-[70px]`}>{j.status}</span>
                                    <span className="text-white/40 min-w-[150px]">{when}</span>
                                    <span className="text-white/60">{j.completedTeams}/{j.totalTeams} teams</span>
                                    <span className="text-white/40 flex-1 truncate">
                                        ↑{j.stats.playersUploaded} =
                                        {j.stats.playersExisting} ✕{j.stats.playersFailed}
                                        {j.error && <span className="text-rose-300 ml-2">· {j.error}</span>}
                                    </span>
                                    {isActive && j.id === job?.id && (
                                        <button
                                            onClick={cancelCurrent}
                                            disabled={cancelling}
                                            className="text-rose-300 hover:text-rose-200 disabled:opacity-40"
                                            title="Cancel this job"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => deleteJob(j.id)}
                                        disabled={isActive}
                                        className="text-white/40 hover:text-rose-300 disabled:opacity-20 disabled:cursor-not-allowed"
                                        title={isActive ? 'Cancel the job first' : 'Delete this job record'}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Per-team listing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {loading && (
                    <div className="col-span-full flex items-center justify-center py-10 text-white/40">
                        <Loader2 className="animate-spin" size={18} />
                    </div>
                )}
                {!loading && assets?.teams.map(team => {
                    const players = assets.playersByTeam[team.code] || [];
                    const lastResult = results?.find(r => r.code === team.code);
                    return (
                        <div key={team.code} className="bg-[#13151a] border border-white/6 rounded-2xl p-3 space-y-2">
                            <div className="flex items-center gap-2">
                                {team.logoUrl ? (
                                    <img src={team.logoUrl} alt={team.code} className="w-10 h-10 object-contain" />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                                        <ImageIcon size={14} className="text-white/20" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-white/80 truncate">{team.code}</div>
                                    <div className="text-[10px] text-white/40 truncate">{team.name}</div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-white/40">
                                <span className="flex items-center gap-1"><Users size={10} /> {players.length} players</span>
                                {team.logoUrl && <span className="text-emerald-400/70 flex items-center gap-0.5"><CheckCircle2 size={10} /> logo</span>}
                            </div>

                            {lastResult && (
                                <div className="text-[10px] text-white/40 border-t border-white/5 pt-2">
                                    {lastResult.status === 'error' ? (
                                        <span className="text-rose-400">{lastResult.error}</span>
                                    ) : (
                                        <span>
                                            +{lastResult.players.filter(p => p.status === 'ok').length} new,
                                            {' '}{lastResult.players.filter(p => p.status === 'exists').length} existing
                                            {lastResult.players.filter(p => p.status === 'error').length > 0 && (
                                                <span className="text-rose-400">
                                                    , {lastResult.players.filter(p => p.status === 'error').length} failed
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={() => runOne(team.code)}
                                disabled={running || runningTeam === team.code}
                                className="w-full text-[10px] bg-white/5 hover:bg-violet-600/30 disabled:opacity-40 border border-white/10 rounded-md py-1.5 text-white/70 transition-colors flex items-center justify-center gap-1"
                            >
                                {runningTeam === team.code ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                                Re-scrape
                            </button>

                            {/* Player thumbnails */}
                            {players.length > 0 && (
                                <div className="grid grid-cols-5 gap-1">
                                    {players.slice(0, 15).map(p => (
                                        <div key={p.iplImageId} className="aspect-square rounded overflow-hidden bg-white/5" title={p.name}>
                                            <img src={p.cfUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {assets && (
                <div className="text-xs text-white/30 text-center">
                    Total player images in Cloudflare: <span className="text-white/60 font-bold">{assets.totalPlayers}</span>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'err' | 'dim' }) {
    const color = tone === 'ok' ? 'text-emerald-400' : tone === 'err' ? 'text-rose-400' : 'text-white/60';
    return (
        <div className="bg-white/5 rounded-lg p-2">
            <div className={`text-lg font-black ${color}`}>{value}</div>
            <div className="text-[10px] text-white/40 uppercase tracking-wide">{label}</div>
        </div>
    );
}
