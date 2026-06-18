'use client';

/**
 * SkeletonMatchCard — shimmer placeholder matching the MatchRow card dimensions.
 */
export default function SkeletonMatchCard() {
    return (
        <div className="rounded-xl border border-white/[0.04] bg-bg-modal overflow-hidden animate-pulse">
            {/* Header row — league badge + status */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
                <div className="w-3 h-3 rounded-full skeleton-block" />
                <div className="w-28 h-2.5 rounded skeleton-block" />
                <div className="ml-auto w-10 h-4 rounded skeleton-block" />
            </div>

            {/* Teams */}
            <div className="px-3 py-3 flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full skeleton-block flex-shrink-0" />
                    <div className="flex-1 h-2.5 rounded skeleton-block" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full skeleton-block flex-shrink-0" />
                    <div className="flex-1 h-2.5 rounded skeleton-block" style={{ width: '70%' }} />
                </div>
            </div>

            {/* Odds row */}
            <div className="flex gap-1.5 px-3 pb-3">
                <div className="flex-1 h-8 rounded-lg skeleton-block" />
                <div className="flex-1 h-8 rounded-lg skeleton-block" />
                <div className="flex-1 h-8 rounded-lg skeleton-block" />
            </div>
        </div>
    );
}
