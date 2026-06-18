'use client';

/**
 * SkeletonGameCard — shimmer placeholder matching the 3:4 GameCardBC layout
 * Used in horizontal scroll rows on the home page.
 */
export default function SkeletonGameCard() {
    return (
        <div className="relative flex-shrink-0 w-[123px] h-[163px] md:w-[167px] md:h-[208px]">
            {/* Card */}
            <div className="relative w-full h-full rounded-xl overflow-hidden skeleton-block" />
        </div>
    );
}

