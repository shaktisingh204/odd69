'use client';

interface SkeletonGameGridProps {
    count?: number;
}

export default function SkeletonGameGrid({ count = 18 }: SkeletonGameGridProps) {
    return (
        <div className="space-y-3 px-3">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded skeleton-block" />
                    <div className="w-36 h-5 rounded skeleton-block" />
                    <div className="w-8 h-4 rounded-md skeleton-block" />
                </div>
                <div className="flex gap-1.5">
                    <div className="w-8 h-8 rounded-xl skeleton-block" />
                    <div className="w-8 h-8 rounded-xl skeleton-block" />
                    <div className="w-16 h-8 rounded-xl skeleton-block" />
                </div>
            </div>

            {/* 3-col grid matches real GameGrid */}
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="w-full aspect-[3/4] rounded-[10px] skeleton-block" />
                ))}
            </div>
        </div>
    );
}
