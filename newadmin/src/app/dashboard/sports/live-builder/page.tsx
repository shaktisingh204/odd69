'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  Activity, AlertCircle, CheckCircle2, Eye, EyeOff,
  GripVertical, LayoutTemplate, Loader2,
  Lock, RotateCcw, Save, Settings, Sparkles, Star, Trophy,
} from 'lucide-react';
import Link from 'next/link';
import {
  getSports,
  getSportPageSections,
  toggleSportVisibility,
  updateSportTabStatus,
  bulkUpdateSportOrder,
  bulkUpdateSectionOrder,
  toggleSectionVisibility,
} from '@/actions/sports';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SportRow {
  sportId: string;
  name: string;
  isActive: boolean;
  isTab: boolean;
  isDefault: boolean;
  sortOrder: number;
}

interface PageSection {
  sectionId: string;
  label: string;
  icon: string;
  isVisible: boolean;
  sortOrder: number;
  isLocked: boolean;
}

// ── Sport meta ────────────────────────────────────────────────────────────────
const SPORT_EMOJI: Record<string, string> = {
  'sr:sport:1':'⚽','sr:sport:21':'🏏','sr:sport:2':'🏀','sr:sport:5':'🎾',
  'sr:sport:16':'🏈','sr:sport:3':'⚾','sr:sport:4':'🏒','sr:sport:117':'🥊',
  'sr:sport:12':'🏉','sr:sport:20':'🏓','sr:sport:31':'🏸','sr:sport:23':'🏐',
  'sr:sport:19':'🎱','sr:sport:22':'🎯','sr:sport:29':'⚽','sr:sport:138':'🤸',
};
const SPORT_COLOR: Record<string, string> = {
  'sr:sport:1':'#10b981','sr:sport:21':'#6366f1','sr:sport:2':'#f97316',
  'sr:sport:5':'#84cc16','sr:sport:16':'#ef4444','sr:sport:3':'#0ea5e9',
  'sr:sport:4':'#06b6d4','sr:sport:117':'#f43f5e','sr:sport:12':'#f59e0b',
  'sr:sport:20':'#22c55e','sr:sport:31':'#a855f7','sr:sport:23':'#3b82f6',
  'sr:sport:19':'#065f46','sr:sport:22':'#dc2626','sr:sport:29':'#059669','sr:sport:138':'#b45309',
};
const em = (id: string) => SPORT_EMOJI[id] ?? '🏟️';
const col = (id: string) => SPORT_COLOR[id] ?? '#e37d32';

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }: { msg: string; type: 'ok' | 'err'; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] font-medium shadow-2xl backdrop-blur-sm border transition-all animate-in slide-in-from-bottom-4 ${
      type === 'ok' ? 'bg-emerald-950/95 border-emerald-500/30 text-emerald-200' : 'bg-rose-950/95 border-rose-500/30 text-rose-200'
    }`}>
      {type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
      {msg}
    </div>
  );
}

// ── Section preview block (how it looks in the visual page mockup) ─────────────
function SectionPreviewBlock({ section, sports }: { section: PageSection; sports: SportRow[] }) {
  const active = sports.filter(s => s.isActive);

  if (!section.isVisible) return null;

  if (section.sectionId === 'hero') return (
    <div className="h-16 rounded-lg bg-gradient-to-r from-amber-900/60 to-amber-700/30 border border-amber-500/20 flex items-center px-3 gap-2">
      <span className="text-lg">{section.icon}</span>
      <div className="flex-1">
        <div className="h-2 w-32 rounded bg-amber-400/40 mb-1"/>
        <div className="h-1.5 w-20 rounded bg-amber-400/20"/>
      </div>
      <div className="flex gap-1">
        <div className="h-4 w-4 rounded bg-amber-400/30"/>
        <div className="h-4 w-4 rounded bg-amber-400/20"/>
      </div>
    </div>
  );

  if (section.sectionId === 'sport_badges') return (
    <div className="space-y-1">
      <div className="text-[9px] text-white/40 flex items-center gap-1 px-0.5">
        <span>{section.icon}</span> All Sports Rail
      </div>
      <div className="flex gap-1.5 overflow-hidden">
        {active.slice(0, 6).map(s => (
          <div key={s.sportId} className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-[10px]"
            style={{ background: `${col(s.sportId)}22`, border: `1px solid ${col(s.sportId)}33` }}>
            <span className="text-[13px]">{em(s.sportId)}</span>
          </div>
        ))}
        <div className="flex h-10 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] text-[9px] text-white/30">+{Math.max(0, active.length - 6)}</div>
      </div>
    </div>
  );

  if (section.sectionId === 'leagues') return (
    <div className="space-y-1">
      <div className="text-[9px] text-white/40 flex items-center gap-1 px-0.5">
        <span>{section.icon}</span> Featured Leagues
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-[68px] w-[80px] shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.03]">
            <div className="h-8 rounded-t-xl bg-gradient-to-b from-white/[0.06] to-transparent"/>
            <div className="px-1.5 py-1 space-y-0.5">
              <div className="h-1.5 w-12 rounded bg-white/10"/>
              <div className="h-1 w-8 rounded bg-white/05"/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (section.sectionId === 'pinned_matches') return (
    <div className="space-y-1">
      <div className="text-[9px] text-amber-400 flex items-center gap-1 px-0.5">
        <Star size={8} className="fill-amber-400"/> Pinned Matches
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[1,2].map(i => (
          <div key={i} className="h-[90px] w-[140px] shrink-0 rounded-xl border border-amber-500/20 bg-amber-900/10">
            <div className="border-b border-amber-500/10 px-2 py-1.5">
              <div className="h-1.5 w-16 rounded bg-amber-400/20 mb-1"/>
              <div className="h-1 w-10 rounded bg-amber-400/10"/>
            </div>
            <div className="px-2 py-1.5 grid grid-cols-3 gap-1">
              {[1,2,3].map(j => <div key={j} className="h-5 rounded-lg bg-white/[0.04]"/>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (section.sectionId === 'top_matches') return (
    <div className="space-y-1">
      <div className="text-[9px] text-white/40 flex items-center gap-1 px-0.5">
        <span>{section.icon}</span> Top Matches
        <div className="ml-auto flex gap-0.5">
          {['All','Live','Soon'].map(f => <span key={f} className="rounded-full bg-white/[0.04] px-1 py-0.5 text-[7px] text-white/20">{f}</span>)}
        </div>
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[1,2,3].map(i => (
          <div key={i} className="h-[90px] w-[140px] shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.03]">
            <div className="border-b border-white/[0.05] px-2 py-1.5">
              <div className="h-1.5 w-16 rounded bg-white/10 mb-1"/>
              <div className="h-1 w-10 rounded bg-white/05"/>
            </div>
            <div className="px-2 py-1.5 grid grid-cols-3 gap-1">
              {[1,2,3].map(j => <div key={j} className="h-5 rounded-lg bg-white/[0.04]"/>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (section.sectionId === 'sport_groups') return (
    <div className="space-y-2">
      {active.slice(0, 3).map(s => (
        <div key={s.sportId} className="space-y-1">
          <div className="text-[9px] flex items-center gap-1 px-0.5" style={{ color: col(s.sportId) + 'cc' }}>
            <span>{em(s.sportId)}</span> {s.name}
            <span className="ml-auto text-white/20 text-[7px]">View all →</span>
          </div>
          <div className="flex gap-2 overflow-hidden">
            {[1,2].map(i => (
              <div key={i} className="h-[80px] w-[130px] shrink-0 rounded-xl border bg-white/[0.02]"
                style={{ borderColor: col(s.sportId) + '22' }}>
                <div className="border-b border-white/[0.05] px-2 py-1">
                  <div className="h-1.5 w-14 rounded mb-0.5" style={{ background: col(s.sportId) + '33' }}/>
                  <div className="h-1 w-8 rounded bg-white/05"/>
                </div>
                <div className="px-2 py-1.5 grid grid-cols-3 gap-1">
                  {[1,2,3].map(j => <div key={j} className="h-4 rounded-lg bg-white/[0.04]"/>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {active.length > 3 && (
        <div className="text-[8px] text-white/20 text-center">+{active.length - 3} more sports below…</div>
      )}
    </div>
  );

  return null;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
type Tab = 'layout' | 'sports';

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SportLiveBuilderPage() {
  const [tab, setTab] = useState<Tab>('layout');
  const [sections, setSections] = useState<PageSection[]>([]);
  const [sports, setSports] = useState<SportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, startSave] = useTransition();
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [sectionUnsaved, setSectionUnsaved] = useState(false);
  const [sportUnsaved, setSportUnsaved] = useState(false);

  // drag state: section list
  const sDragItem = useRef<number | null>(null);
  const [sDragIdx, setSDragIdx] = useState<number | null>(null);
  const [sDragOverIdx, setSDragOverIdx] = useState<number | null>(null);

  // drag state: sport list
  const pDragItem = useRef<number | null>(null);
  const [pDragIdx, setPDragIdx] = useState<number | null>(null);
  const [pDragOverIdx, setPDragOverIdx] = useState<number | null>(null);

  const showToast = (msg: string, type: 'ok' | 'err') => setToast({ msg, type });

  // Load data
  useEffect(() => {
    Promise.all([getSportPageSections(), getSports()]).then(([sectRes, spoRes]) => {
      if (sectRes.success) setSections(sectRes.data as PageSection[]);
      if (spoRes.success) setSports(spoRes.data as SportRow[]);
      setLoading(false);
    });
  }, []);

  // ── Section drag ─────────────────────────────────────────────────────────
  const onSectionDragStart = (idx: number) => {
    if (sections[idx]?.isLocked) return;
    sDragItem.current = idx; setSDragIdx(idx);
  };
  const onSectionDragEnter = (idx: number) => {
    if (sections[idx]?.isLocked || sDragItem.current === null) return;
    setSDragOverIdx(idx);
  };
  const onSectionDragEnd = () => {
    if (sDragItem.current !== null && sDragOverIdx !== null && sDragItem.current !== sDragOverIdx) {
      const next = [...sections];
      const [moved] = next.splice(sDragItem.current, 1);
      // Prevent dropping before locked item
      const targetIdx = sDragOverIdx;
      if (!next[targetIdx - 1]?.isLocked || targetIdx > 0) {
        next.splice(targetIdx, 0, moved);
        setSections(next);
        setSectionUnsaved(true);
      }
    }
    sDragItem.current = null; setSDragIdx(null); setSDragOverIdx(null);
  };

  // ── Sport drag ────────────────────────────────────────────────────────────
  const onSportDragStart = (idx: number) => { pDragItem.current = idx; setPDragIdx(idx); };
  const onSportDragEnter = (idx: number) => setPDragOverIdx(idx);
  const onSportDragEnd = () => {
    if (pDragItem.current !== null && pDragOverIdx !== null && pDragItem.current !== pDragOverIdx) {
      const next = [...sports];
      const [moved] = next.splice(pDragItem.current, 1);
      next.splice(pDragOverIdx, 0, moved);
      setSports(next);
      setSportUnsaved(true);
    }
    pDragItem.current = null; setPDragIdx(null); setPDragOverIdx(null);
  };

  // ── Toggle section visibility ─────────────────────────────────────────────
  const handleToggleSection = useCallback(async (sectionId: string, current: boolean) => {
    setSections(prev => prev.map(s => s.sectionId === sectionId ? { ...s, isVisible: !current } : s));
    const res = await toggleSectionVisibility(sectionId, !current);
    if (!res.success) {
      setSections(prev => prev.map(s => s.sectionId === sectionId ? { ...s, isVisible: current } : s));
      showToast('Failed to update section', 'err');
    } else {
      showToast(`Section ${!current ? 'shown' : 'hidden'} on frontend`, 'ok');
    }
  }, []);

  // ── Toggle sport visibility ───────────────────────────────────────────────
  const handleToggleSport = useCallback(async (sportId: string, current: boolean) => {
    setSports(prev => prev.map(s => s.sportId === sportId ? { ...s, isActive: !current } : s));
    const res = await toggleSportVisibility(sportId, !current);
    if (!res.success) {
      setSports(prev => prev.map(s => s.sportId === sportId ? { ...s, isActive: current } : s));
      showToast('Failed to update sport', 'err');
    } else {
      showToast(`${!current ? 'Shown' : 'Hidden'} on frontend`, 'ok');
    }
  }, []);

  // ── Toggle sport tab ──────────────────────────────────────────────────────
  const handleToggleSportTab = useCallback(async (sportId: string, current: boolean) => {
    setSports(prev => prev.map(s => s.sportId === sportId ? { ...s, isTab: !current } : s));
    await updateSportTabStatus(sportId, !current);
  }, []);

  // ── Save section order ────────────────────────────────────────────────────
  const handleSaveSectionOrder = () => {
    startSave(async () => {
      const order = sections.map((s, i) => ({ sectionId: s.sectionId, sortOrder: i + 1 }));
      const res = await bulkUpdateSectionOrder(order);
      if (res.success) { setSectionUnsaved(false); showToast('Page layout saved!', 'ok'); }
      else showToast('Failed to save layout', 'err');
    });
  };

  // ── Save sport order ──────────────────────────────────────────────────────
  const handleSaveSportOrder = () => {
    startSave(async () => {
      const order = sports.map((s, i) => ({ sportId: s.sportId, sortOrder: i + 1 }));
      const res = await bulkUpdateSportOrder(order);
      if (res.success) { setSportUnsaved(false); showToast('Sport order saved!', 'ok'); }
      else showToast('Failed to save sport order', 'err');
    });
  };

  const visibleSections = sections.filter(s => s.isVisible);

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0b10] text-white">
      {/* ── Page header ── */}
      <div className="border-b border-white/[0.06] bg-[#0f0f16] px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
              <LayoutTemplate size={18} />
            </div>
            <div>
              <h1 className="text-[17px] font-semibold text-white">Sports Page Builder</h1>
              <p className="text-[11px] text-white/40">Drag sections & sports to rearrange the live frontend layout</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/sports"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[12px] text-white/50 hover:text-white/80 transition">
              <Settings size={12}/> Sports Manager
            </Link>
            {(sectionUnsaved || sportUnsaved) && (
              <span className="rounded-full bg-amber-500/15 border border-amber-500/25 px-2.5 py-1 text-[11px] text-amber-400">
                Unsaved changes
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="border-b border-white/[0.06] bg-[#0d0d14] px-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex gap-0">
            {([
              { key: 'layout' as Tab, label: 'Page Section Layout', icon: '🗂️' },
              { key: 'sports' as Tab, label: 'Sport Rows Order', icon: '🏟️' },
            ] as const).map(({ key, label, icon }) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 transition ${
                  tab === key ? 'border-indigo-500 text-white' : 'border-transparent text-white/40 hover:text-white/70'
                }`}>
                <span>{icon}</span> {label}
                {key === 'layout' && sectionUnsaved && <span className="h-1.5 w-1.5 rounded-full bg-amber-400"/>}
                {key === 'sports' && sportUnsaved && <span className="h-1.5 w-1.5 rounded-full bg-amber-400"/>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">

            {/* ── Left: draggable list ── */}
            <div>
              {loading ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="animate-spin text-white/30" size={24}/>
                </div>
              ) : tab === 'layout' ? (
                /* ─ Page section layout ─ */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[12px] text-white/40">
                      <GripVertical size={13}/> Drag to reorder sections on the page
                    </div>
                    <button type="button" onClick={handleSaveSectionOrder} disabled={saving || !sectionUnsaved}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-[12px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition active:scale-95">
                      {saving ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}
                      Save Layout
                    </button>
                  </div>

                  <div className="space-y-2">
                    {sections.map((sec, idx) => {
                      const isDragging = sDragIdx === idx;
                      const isDragOver = sDragOverIdx === idx && sDragIdx !== idx;
                      return (
                        <div key={sec.sectionId}
                          draggable={!sec.isLocked}
                          onDragStart={() => onSectionDragStart(idx)}
                          onDragEnter={() => onSectionDragEnter(idx)}
                          onDragEnd={onSectionDragEnd}
                          onDragOver={e => e.preventDefault()}
                          className={`group relative flex items-center gap-4 rounded-2xl border px-4 py-4 transition-all duration-150 ${
                            sec.isLocked ? 'cursor-default opacity-90' : sec.isVisible ? 'cursor-grab active:cursor-grabbing' : 'cursor-grab opacity-50'
                          } ${
                            isDragging ? 'scale-[0.98] border-indigo-500/50 bg-indigo-900/20 opacity-70'
                            : isDragOver ? 'border-indigo-400/40 bg-indigo-900/10 scale-[1.01]'
                            : 'border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.05]'
                          }`}
                        >
                          {/* Grip */}
                          <div className={`shrink-0 transition ${sec.isLocked ? 'text-white/10' : 'text-white/20 group-hover:text-white/40'}`}>
                            {sec.isLocked ? <Lock size={14}/> : <GripVertical size={16}/>}
                          </div>

                          {/* Index */}
                          <span className="w-5 shrink-0 text-center font-mono text-[11px] text-white/20">{idx + 1}</span>

                          {/* Icon */}
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[22px]">
                            {sec.icon}
                          </div>

                          {/* Label */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-medium text-white/90">{sec.label}</span>
                              {sec.isLocked && (
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] text-white/30">
                                  Locked position
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-white/30 font-mono">{sec.sectionId}</span>
                          </div>

                          {/* Visibility toggle */}
                          <button type="button" onClick={() => handleToggleSection(sec.sectionId, sec.isVisible)}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition active:scale-95 ${
                              sec.isVisible
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/25'
                                : 'bg-white/[0.04] text-white/30 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white/60'
                            }`}>
                            {sec.isVisible ? <Eye size={12}/> : <EyeOff size={12}/>}
                            {sec.isVisible ? 'Visible' : 'Hidden'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* ─ Sport rows order ─ */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[12px] text-white/40">
                      <GripVertical size={13}/> Drag sports to change their display order
                    </div>
                    <button type="button" onClick={handleSaveSportOrder} disabled={saving || !sportUnsaved}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-[12px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition active:scale-95">
                      {saving ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}
                      Save Order
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {sports.map((sport, idx) => {
                      const isDragging = pDragIdx === idx;
                      const isDragOver = pDragOverIdx === idx && pDragIdx !== idx;
                      const color = col(sport.sportId);
                      return (
                        <div key={sport.sportId}
                          draggable
                          onDragStart={() => onSportDragStart(idx)}
                          onDragEnter={() => onSportDragEnter(idx)}
                          onDragEnd={onSportDragEnd}
                          onDragOver={e => e.preventDefault()}
                          className={`group flex cursor-grab items-center gap-3 rounded-2xl border px-4 py-3 transition-all active:cursor-grabbing ${
                            isDragging ? 'scale-[0.98] border-indigo-500/40 bg-indigo-900/20 opacity-70'
                            : isDragOver ? 'border-white/20 bg-white/[0.06] scale-[1.01]'
                            : sport.isActive ? 'border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12]'
                            : 'border-white/[0.04] bg-white/[0.015] opacity-50'
                          }`}>
                          <GripVertical size={15} className="shrink-0 text-white/20 group-hover:text-white/40 transition"/>
                          <span className="w-5 shrink-0 text-center font-mono text-[11px] text-white/20">{idx + 1}</span>
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[18px]"
                            style={{ background: `${color}22` }}>
                            {em(sport.sportId)}
                          </div>
                          <span className="flex-1 text-[13px] font-medium text-white/85">{sport.name}</span>
                          {sport.isTab && sport.isActive && (
                            <span className="rounded-full bg-indigo-500/15 border border-indigo-500/25 px-2 py-0.5 text-[9px] text-indigo-400">Tab</span>
                          )}
                          {/* Tab toggle */}
                          <button type="button" title={sport.isTab ? 'Remove from tabs' : 'Show in top tabs'}
                            onClick={() => handleToggleSportTab(sport.sportId, sport.isTab)}
                            className={`flex h-7 w-7 items-center justify-center rounded-lg transition active:scale-90 ${
                              sport.isTab ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/[0.04] text-white/25 hover:text-indigo-400'
                            }`}>
                            <Trophy size={11}/>
                          </button>
                          {/* Visibility */}
                          <button type="button" onClick={() => handleToggleSport(sport.sportId, sport.isActive)}
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition active:scale-95 ${
                              sport.isActive ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'bg-white/[0.04] text-white/25 hover:bg-white/[0.08] hover:text-white/60'
                            }`}>
                            {sport.isActive ? <Eye size={11}/> : <EyeOff size={11}/>}
                            {sport.isActive ? 'Live' : 'Hidden'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right: Live visual page preview ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Activity size={13}/>
                </div>
                <span className="text-[13px] font-medium text-white/70">Live Page Preview</span>
                <div className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"/>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"/>
                  </span>
                  Live Preview
                </div>
              </div>

              {/* Mini browser window */}
              {!loading && (
                <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d12] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                  {/* Chrome */}
                  <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-[#16161e] px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70"/>
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70"/>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70"/>
                    <div className="ml-2 flex-1 rounded bg-white/[0.04] px-2 py-0.5 text-[9px] text-white/30">zeero.bet/sports</div>
                  </div>

                  {/* Page content */}
                  <div className="space-y-3 p-3 max-h-[600px] overflow-y-auto scrollbar-none">
                    {sections.map(sec => (
                      <SectionPreviewBlock key={sec.sectionId} section={sec} sports={sports}/>
                    ))}
                    {visibleSections.length === 0 && (
                      <div className="py-10 text-center text-[10px] text-white/20">All sections hidden</div>
                    )}
                  </div>
                </div>
              )}

              {/* Stats grid */}
              {!loading && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Page Sections', value: sections.length, sub: `${visibleSections.length} visible` },
                    { label: 'Sports', value: sports.length, sub: `${sports.filter(s=>s.isActive).length} live` },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
                      <div className="text-[22px] font-semibold text-white">{value}</div>
                      <div className="text-[10px] font-medium text-white/60">{label}</div>
                      <div className="text-[9px] text-white/30">{sub}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tip */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-white/40 leading-relaxed">
                <span className="text-white/60 font-medium">💡 Tip: </span>
                Use the <strong className="text-white/60">Page Section Layout</strong> tab to reorder the big blocks on the page (Hero, Sports Rail, Leagues, etc.). Use the <strong className="text-white/60">Sport Rows Order</strong> tab to arrange which sport appears first within the groups section.
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </div>
  );
}
