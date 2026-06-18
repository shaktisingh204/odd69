"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getOriginalsConfig, updateOriginalsConfig, getOriginalsGGR,
  getOriginalsGGRHistory, setPerUserGGR, removePerUserGGR,
} from "@/actions/originals";
import { uploadToCloudflare } from "@/actions/upload";
import {
  Save, ArrowLeft, RefreshCcw, Settings2, TrendingUp,
  Users, AlertTriangle, CheckCircle, Loader2, UserCog, Trash2,
  ImagePlus, Upload, ExternalLink,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import toast from "react-hot-toast";

const ENGAGEMENT_MODES = ["OFF", "SOFT", "AGGRESSIVE"];

function ToggleSwitch({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!value)} disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-all border flex-shrink-0
        ${value ? "bg-indigo-600 border-indigo-600" : "bg-slate-700 border-slate-600"}
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-4 border-b border-slate-700/60 gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{label}</p>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function NumberField({ value, onChange, min, max, step = 1, prefix, suffix }: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; prefix?: string; suffix?: string;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && <span className="absolute left-3 text-slate-400 text-sm">{prefix}</span>}
      <input type="number" value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min} max={max} step={step}
        className="w-32 bg-slate-900 border border-slate-600 focus:border-indigo-500 rounded-lg py-2 text-white text-sm font-bold outline-none transition-all text-right pr-3"
        style={{ paddingLeft: prefix ? "2rem" : "0.75rem" }}
      />
      {suffix && <span className="ml-2 text-slate-400 text-sm">{suffix}</span>}
    </div>
  );
}

export default function GameConfigPage() {
  const params = useParams();
  const router = useRouter();
  const game = params.game as string;
  const launchReady = ["mines", "crash", "dice", "limbo", "plinko"].includes(game);
  const historyReady = ["mines", "plinko"].includes(game);

  const [config, setConfig] = useState<any>(null);
  const [ggr, setGgr] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imgUploading, setImgUploading] = useState(false);

  // Per-user override form
  const [puUserId, setPuUserId] = useState("");
  const [puGgr, setPuGgr] = useState("20");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [c, g, h] = await Promise.all([
      getOriginalsConfig(game),
      getOriginalsGGR(game),
      getOriginalsGGRHistory(game, 72),
    ]);
    if (c.success && c.data) {
      setConfig({ ...c.data });
    } else if (!c.success) {
      // API returned an error — likely DB tables don't exist yet
      setLoadError(c.error || "Backend API error — check server logs");
    }
    if (g.success) setGgr(g.data);
    if (h.success) setHistory(h.data || []);
    setLoading(false);
  }, [game]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const res = await updateOriginalsConfig(game, {
      isActive: config.isActive,
      maintenanceMode: config.maintenanceMode,
      maintenanceMessage: config.maintenanceMessage,
      minBet: config.minBet,
      maxBet: config.maxBet,
      maxWin: config.maxWin,
      houseEdgePercent: config.houseEdgePercent,
      maxMultiplier: config.maxMultiplier,
      targetGgrPercent: config.targetGgrPercent,
      ggrWindowHours: config.ggrWindowHours,
      ggrBiasStrength: config.ggrBiasStrength,
      engagementMode: config.engagementMode,
      nearMissEnabled: config.nearMissEnabled,
      bigWinThreshold: config.bigWinThreshold,
      streakWindow: config.streakWindow,
      displayRtpPercent: config.displayRtpPercent,
      // Home page display
      thumbnailUrl: config.thumbnailUrl,
      gameName: config.gameName,
      gameDescription: config.gameDescription,
      fakePlayerMin: config.fakePlayerMin,
      fakePlayerMax: config.fakePlayerMax,
    });
    setSaving(false);
    if (res.success) toast.success("Config saved!");
    else toast.error(res.error || "Save failed");
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    setImgUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "zeero-originals");
      const json = await uploadToCloudflare(formData);
      if (json.success && json.url) {
        update("thumbnailUrl", json.url);
        toast.success("Image uploaded to Cloudflare ✓");
      } else {
        toast.error(json.error || "Upload failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setImgUploading(false);
    }
  };


  const handleSetPerUser = async () => {
    const uid = parseInt(puUserId);
    const ggrVal = parseFloat(puGgr);
    if (isNaN(uid) || isNaN(ggrVal)) { toast.error("Invalid user ID or GGR%"); return; }
    const r = await setPerUserGGR(game, uid, ggrVal);
    if (r.success) { toast.success(`Set GGR ${ggrVal}% for user #${uid}`); load(); }
    else toast.error(r.error || "Failed");
  };

  const handleRemovePerUser = async (userId: string) => {
    const r = await removePerUserGGR(game, parseInt(userId));
    if (r.success) { toast.success("Override removed"); load(); }
    else toast.error(r.error || "Failed");
  };

  const update = (key: string, val: any) => setConfig((prev: any) => ({ ...prev, [key]: val }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-indigo-500" size={36} />
      </div>
    );
  }

  if (!config) {
    if (loadError) {
      return (
        <div className="space-y-4">
          {/* Red error banner */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold mb-1">Backend API Error</p>
                <p className="text-red-300 text-sm font-mono break-all">{loadError}</p>
              </div>
            </div>
          </div>

          {/* Fix instructions */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-3">
            <p className="text-white font-bold flex items-center gap-2">
              <span className="text-amber-400">⚠️</span> Database tables are missing
            </p>
            <p className="text-slate-400 text-sm">
              Run this on your server to create all required tables:
            </p>
            <div className="bg-[#0d1117] border border-white/10 rounded-lg px-4 py-3 font-mono text-sm text-emerald-400 select-all">
              cd /var/www/adxwin/newbackend &amp;&amp; npx prisma db push --accept-data-loss
            </div>
            <p className="text-slate-500 text-xs">Then restart the backend: <code className="text-slate-300">pm2 restart backend</code></p>
            <button onClick={load} className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-colors">
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
        <AlertTriangle size={36} className="text-amber-400 mx-auto mb-3" />
        <p className="text-white font-bold mb-1">Config not loaded</p>
        <p className="text-slate-400 text-sm mb-4">Could not load game configuration.</p>
        <button onClick={load} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-colors">
          Retry
        </button>
      </div>
    );
  }

  const chartData = history.slice(-24).map((h: any) => ({
    time: new Date(h.snapshotAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    actual: parseFloat(h.ggrPercent?.toFixed(1) || "0"),
    target: config.targetGgrPercent,
  }));

  const overrides = (config.perUserGgrOverrides || {}) as Record<string, number>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/originals" className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-white capitalize">{game} — Settings</h1>
            <p className="text-slate-400 text-xs">Configure GGR, bet limits, and engagement</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <RefreshCcw size={15} className="text-slate-400" />
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Live GGR status bar */}
      {ggr && (
        <div className={`flex items-center gap-4 p-4 rounded-xl border ${ggr.actualGgrPercent >= ggr.targetGgrPercent ? "bg-emerald-500/5 border-emerald-500/30" : "bg-amber-500/5 border-amber-500/30"}`}>
          {ggr.actualGgrPercent >= ggr.targetGgrPercent
            ? <CheckCircle size={20} className="text-emerald-400 flex-shrink-0" />
            : <AlertTriangle size={20} className="text-amber-400 flex-shrink-0" />}
          <div className="flex-1">
            <p className="text-white font-bold text-sm">
              Actual GGR: <span className={ggr.actualGgrPercent >= ggr.targetGgrPercent ? "text-emerald-400" : "text-amber-400"}>{ggr.actualGgrPercent?.toFixed(2)}%</span>
              <span className="text-slate-400 font-normal"> / Target: {ggr.targetGgrPercent}%</span>
            </p>
            <p className="text-slate-400 text-xs">
              ₹{ggr.totalWagered?.toLocaleString()} wagered · ₹{ggr.totalPaidOut?.toLocaleString()} paid out · {ggr.totalGames} games (last {ggr.windowHours}h)
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* LEFT: Settings */}
        <div className="xl:col-span-2 space-y-5">

          {/* Game Status */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2"><Settings2 size={14} /> Game Status</h2>
            <FormRow
              label="Game Active"
              hint={launchReady ? "Allow players to access and bet on this game" : "This title is visible as coming soon only. Keep it inactive until the gameplay client is built."}
            >
              <ToggleSwitch value={config.isActive} onChange={(v) => update("isActive", v)} disabled={!launchReady} />
            </FormRow>
            {!launchReady && (
              <div className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
                The new lobby card is live now, but the playable route for this game has not been shipped yet.
              </div>
            )}
            <FormRow label="Maintenance Mode" hint="Show maintenance banner and block new games">
              <ToggleSwitch value={config.maintenanceMode} onChange={(v) => update("maintenanceMode", v)} />
            </FormRow>
            {config.maintenanceMode && (
              <div className="mt-2">
                <label className="text-xs text-slate-400 mb-1 block">Maintenance Message</label>
                <input type="text" value={config.maintenanceMessage || ""}
                  onChange={(e) => update("maintenanceMessage", e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 focus:border-indigo-500 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  placeholder="e.g. Game under maintenance, back in 30 minutes." />
              </div>
            )}
          </div>

          {/* GGR Control */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-emerald-400" />
              <h2 className="text-sm font-bold text-white">GGR Control</h2>
            </div>
            <p className="text-xs text-slate-500 mb-3">House Revenue %. 70% = house keeps ₹70 per ₹100 bet. Engine auto-adjusts mine placement to hit this target over the rolling window.</p>

            <FormRow label="Target GGR %" hint="House revenue target over rolling window (1–99%)">
              <NumberField value={config.targetGgrPercent} onChange={(v) => update("targetGgrPercent", v)} min={0.1} max={99} step={0.5} suffix="%" />
            </FormRow>
            <FormRow label="GGR Window" hint="Rolling time window for GGR tracking">
              <NumberField value={config.ggrWindowHours} onChange={(v) => update("ggrWindowHours", v)} min={1} max={168} step={1} suffix="hrs" />
            </FormRow>
            <FormRow label="Bias Strength" hint="Max probability nudge applied (0.05–0.50 recommended)">
              <NumberField value={config.ggrBiasStrength} onChange={(v) => update("ggrBiasStrength", v)} min={0.01} max={0.99} step={0.01} />
            </FormRow>
            <FormRow label="Display RTP %" hint="Shown to users as informational (does not affect actual outcome)">
              <NumberField value={config.displayRtpPercent} onChange={(v) => update("displayRtpPercent", v)} min={1} max={99.9} step={0.5} suffix="%" />
            </FormRow>
            <FormRow label="House Edge %" hint="Base multiplier reduction (default 1%)">
              <NumberField value={config.houseEdgePercent} onChange={(v) => update("houseEdgePercent", v)} min={0} max={20} step={0.1} suffix="%" />
            </FormRow>
          </div>

          {/* Bet Limits */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-3">Bet Limits</h2>
            <FormRow label="Minimum Bet" hint="Smallest allowed wager">
              <NumberField value={config.minBet} onChange={(v) => update("minBet", v)} min={1} step={1} prefix="₹" />
            </FormRow>
            <FormRow label="Maximum Bet" hint="Largest allowed wager per game">
              <NumberField value={config.maxBet} onChange={(v) => update("maxBet", v)} min={1} step={500} prefix="₹" />
            </FormRow>
            <FormRow label="Maximum Win" hint="Absolute max payout per game">
              <NumberField value={config.maxWin} onChange={(v) => update("maxWin", v)} min={1} step={10000} prefix="₹" />
            </FormRow>
            <FormRow label="Max Multiplier" hint="Cap on the payout multiplier">
              <NumberField value={config.maxMultiplier} onChange={(v) => update("maxMultiplier", v)} min={1} step={10} suffix="×" />
            </FormRow>
          </div>

          {/* Engagement */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-purple-400" />
              <h2 className="text-sm font-bold text-white">Engagement System</h2>
            </div>
            <FormRow label="Engagement Mode" hint="Controls intensity of near-miss, streaks, and comeback hooks">
              <div className="flex gap-1">
                {ENGAGEMENT_MODES.map((m) => (
                  <button key={m} onClick={() => update("engagementMode", m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                      ${config.engagementMode === m
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-slate-700 text-slate-400 border-slate-600 hover:text-white"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </FormRow>
            <FormRow label="Near-Miss Effect" hint="Highlight adjacent tiles to hit mines (no mine position exposed)">
              <ToggleSwitch value={config.nearMissEnabled} onChange={(v) => update("nearMissEnabled", v)} />
            </FormRow>
            <FormRow label="Big Win Threshold" hint="Payout/bet ratio to trigger big-win broadcast to all users">
              <NumberField value={config.bigWinThreshold} onChange={(v) => update("bigWinThreshold", v)} min={2} step={1} suffix="×" />
            </FormRow>
            <FormRow label="Streak Window" hint="How many consecutive games to detect win/loss streaks">
              <NumberField value={config.streakWindow} onChange={(v) => update("streakWindow", v)} min={2} max={20} step={1} suffix="games" />
            </FormRow>
          </div>
        </div>

        {/* RIGHT: GGR Chart + Per-user overrides */}
        <div className="space-y-5">

          {/* GGR Chart */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">GGR% Last 72 Hours</h3>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any) => [`${v}%`, ""]}
                  />
                  <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} dot={false} name="Actual GGR%" />
                  <Line type="monotone" dataKey="target" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Target" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
                No snapshot data yet. Play some games first.
              </div>
            )}
          </div>

          {/* Per-user GGR Overrides */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <UserCog size={14} className="text-blue-400" />
              <h3 className="text-sm font-bold text-white">Per-User GGR</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">Give specific users custom GGR% (e.g., VIP gets 20% = better odds).</p>

            {/* Add override */}
            <div className="flex gap-2 mb-4">
              <input type="number" placeholder="User ID" value={puUserId}
                onChange={(e) => setPuUserId(e.target.value)}
                className="flex-1 min-w-0 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-indigo-500 placeholder:text-slate-600" />
              <input type="number" placeholder="GGR%" value={puGgr}
                onChange={(e) => setPuGgr(e.target.value)}
                className="w-20 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-white text-xs outline-none focus:border-indigo-500 placeholder:text-slate-600" />
              <button onClick={handleSetPerUser}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors">
                Set
              </button>
            </div>

            {/* Existing overrides */}
            {Object.keys(overrides).length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-3">No overrides set</p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(overrides).map(([uid, ggrVal]) => (
                  <div key={uid} className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-white text-xs font-bold">User #{uid}</span>
                      <span className="text-slate-400 text-xs ml-2">GGR: {ggrVal}%</span>
                    </div>
                    <button onClick={() => handleRemovePerUser(uid)}
                      className="p-1 hover:bg-red-500/10 rounded text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Home Page Display — Image + Fake Players */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <ImagePlus size={14} className="text-pink-400" />
              <h3 className="text-sm font-bold text-white">Home Page Display</h3>
            </div>

            {/* Game name + description */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block font-bold uppercase tracking-wider">Display Name</label>
                <input type="text" value={config.gameName || ""}
                  onChange={(e) => update("gameName", e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 focus:border-indigo-500 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  placeholder={`e.g. Zeero ${game.charAt(0).toUpperCase() + game.slice(1)}`} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block font-bold uppercase tracking-wider">Short Description</label>
                <textarea value={config.gameDescription || ""}
                  onChange={(e) => update("gameDescription", e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 focus:border-indigo-500 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none"
                  placeholder="One-liner shown on home page card" />
              </div>
            </div>

            {/* Thumbnail uploader */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-2 block font-bold uppercase tracking-wider">Game Thumbnail (Cloudflare Images)</label>

              {/* Preview */}
              {config.thumbnailUrl && (
                <div className="relative mb-3">
                  <img src={config.thumbnailUrl} alt="thumbnail"
                    className="w-full h-32 object-cover rounded-lg border border-slate-600" />
                  <a href={config.thumbnailUrl} target="_blank" rel="noreferrer"
                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white/60 hover:text-white">
                    <ExternalLink size={12} />
                  </a>
                  <button onClick={() => update("thumbnailUrl", "")} className="absolute top-2 left-2 p-1.5 bg-black/60 rounded-lg text-red-400 hover:text-red-300 text-[10px] font-bold">
                    ✕ Remove
                  </button>
                </div>
              )}

              {/* Upload area */}
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-lg p-4 cursor-pointer transition-colors group">
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                {imgUploading ? (
                  <><Loader2 size={24} className="animate-spin text-indigo-400 mb-1" />
                  <span className="text-xs text-slate-400">Uploading to Cloudflare…</span></>
                ) : (
                  <><Upload size={20} className="text-slate-500 group-hover:text-indigo-400 mb-1 transition-colors" />
                  <span className="text-xs text-slate-400 group-hover:text-white transition-colors">{config.thumbnailUrl ? "Replace image" : "Upload image"}</span>
                  <span className="text-[10px] text-slate-600 mt-0.5">JPEG · PNG · WebP · GIF · max 5 MB</span></>
                )}
              </label>

              {/* Or paste URL */}
              <div className="mt-2">
                <input type="url" value={config.thumbnailUrl || ""}
                  onChange={(e) => update("thumbnailUrl", e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 focus:border-indigo-500 rounded-lg px-3 py-2 text-white text-xs outline-none"
                  placeholder="Or paste Cloudflare Images URL directly" />
              </div>
            </div>

            {/* Fake player count */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block font-bold uppercase tracking-wider">Fake Player Count Range</label>
              <p className="text-[11px] text-slate-600 mb-3">Home card shows a random number in this range that slowly drifts (refreshes every 3–5s).</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 mb-1 block">Min</label>
                  <input type="number" value={config.fakePlayerMin ?? 200} min={0} max={9999}
                    onChange={(e) => update("fakePlayerMin", parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-600 focus:border-indigo-500 rounded-lg px-3 py-2 text-white text-sm font-bold outline-none" />
                </div>
                <div className="text-slate-600 text-lg mt-4">—</div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 mb-1 block">Max</label>
                  <input type="number" value={config.fakePlayerMax ?? 300} min={0} max={9999}
                    onChange={(e) => update("fakePlayerMax", parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-600 focus:border-indigo-500 rounded-lg px-3 py-2 text-white text-sm font-bold outline-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-white mb-3">Quick Links</h3>
            {historyReady && (
              <Link href={`/dashboard/originals/${game}/history`}
                className="flex items-center justify-between p-2.5 bg-slate-900 hover:bg-slate-700 rounded-lg text-sm text-slate-300 hover:text-white transition-colors">
                Game History <ArrowLeft size={12} className="rotate-180 text-slate-500" />
              </Link>
            )}
            <Link href="/dashboard/originals"
              className="flex items-center justify-between p-2.5 bg-slate-900 hover:bg-slate-700 rounded-lg text-sm text-slate-300 hover:text-white transition-colors">
              All Games Dashboard <ArrowLeft size={12} className="rotate-180 text-slate-500" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
