"use client";

import React from 'react';
import { Play, Users } from 'lucide-react';
import { cfImage, cfImageSrcSet } from '@/utils/cfImages';

interface GameCardProps {
    name: string;
    image: string;
    provider: string;
    tag?: string;
    layout?: 'grid' | 'row';
    onClick?: () => void;
    onError?: () => void;
}

const GameCard: React.FC<GameCardProps> = ({ name, image, provider, tag, layout = 'row', onClick, onError }) => {
    const CF_BASE = 'https://imagedelivery.net/l7vrHxYm1V8kfxard9QBnQ';
    const FALLBACK_IMG = 'https://images.unsplash.com/photo-1605218427306-022ba8c15661?q=80&w=600&auto=format&fit=crop';

    const resolveUrl = React.useCallback((src: string) => {
        if (!src) return FALLBACK_IMG;
        if (src.startsWith('http')) return src;
        const iconNoExt = src.replace(/\.[^.]+$/, '');
        const iconPath = iconNoExt.includes('/')
            ? iconNoExt.split('/').map(encodeURIComponent).join('/')
            : `${encodeURIComponent(provider)}/${encodeURIComponent(iconNoExt)}`;
        return `${CF_BASE}/${iconPath}/public`;
    }, [provider]);

    const [imgSrc, setImgSrc] = React.useState(() => resolveUrl(image));
    const [hasError, setHasError] = React.useState(false);
    const playerCount = React.useMemo(() => {
        const seed = `${name}-${provider}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        return (seed % 190) + 12;
    }, [name, provider]);

    React.useEffect(() => {
        setImgSrc(resolveUrl(image));
        setHasError(false);
    }, [image, resolveUrl]);

    const handleError = () => {
        if (!hasError) { setHasError(true); setImgSrc(FALLBACK_IMG); }
        onError?.();
    };

    // Row: show 3 full cards + 10% peek of 4th on mobile
    const sizeClasses = layout === 'grid'
        ? 'w-full flex-shrink-0'
        : 'flex-shrink-0 w-[calc((100vw-40px)/3.1)] md:w-[155px]';

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={`Play ${name}`}
            className={`group relative block cursor-pointer text-left outline-none ${sizeClasses}`}
        >
            <div
                className="relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-white/[0.06] transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-y-1.5 group-active:scale-[0.97] motion-reduce:transform-none"
                style={{ background: "linear-gradient(160deg,#3a2566,#160c2c)" }}
            >
                <img
                    src={cfImage(imgSrc, { width: 400 })}
                    srcSet={cfImageSrcSet(imgSrc, [200, 400, 600])}
                    sizes="(max-width: 768px) 33vw, 155px"
                    alt={name}
                    onError={handleError}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                />

                {/* orange ring on hover AND keyboard focus */}
                <div
                    className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
                    style={{ boxShadow: "inset 0 0 0 2px rgba(255,122,26,0.85)" }}
                />

                {tag && (
                    <span
                        className="absolute left-2 top-2 z-10 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[#160c2c] shadow"
                        style={{ background: "linear-gradient(135deg,#ff9a3d,#ff6a00)" }}
                    >
                        {tag}
                    </span>
                )}

                {/* Player count pill — bottom right, always visible */}
                <span className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-md">
                    <Users size={9} />
                    {playerCount}
                </span>

                {/* label scrim */}
                <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2.5 pr-10">
                    <p className="truncate text-sm font-extrabold uppercase leading-tight text-white drop-shadow">{name}</p>
                    {provider && <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-white/55">{provider}</p>}
                </div>

                {/* hover / focus play */}
                <div className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span className="grid h-12 w-12 place-items-center rounded-full text-white shadow-lg" style={{ background: "linear-gradient(135deg,#ff9a3d,#ff6a00)" }}>
                        <Play className="h-5 w-5" fill="currentColor" strokeWidth={0} />
                    </span>
                </div>
            </div>
        </button>
    );
};

export default GameCard;
