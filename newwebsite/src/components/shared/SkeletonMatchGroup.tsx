'use client';

import SkeletonMatchCard from './SkeletonMatchCard';

interface SkeletonMatchGroupProps {
    cards?: number;
}

/**
 * SkeletonMatchGroup — shimmer tournament section header + N match cards.
 * Renders instantly, no props required.
 */
export default function SkeletonMatchGroup({ cards = 3 }: SkeletonMatchGroupProps) {
    return (
        <div className="flex flex-col gap-3 md:gap-4">
            {/* Tournament header */}
            <div className="flex items-center gap-2 px-1 border-b border-white/[0.04] pb-2">
                <div className="w-1 h-5 rounded-full skeleton-block flex-shrink-0" />
                <div className="w-40 h-3 rounded skeleton-block" />
                <div className="ml-auto w-6 h-4 rounded-full skeleton-block" />
            </div>

            {/* Match cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-4">
                {Array.from({ length: cards }).map((_, i) => (
                    <SkeletonMatchCard key={i} />
                ))}
            </div>
        </div>
    );
}
