"use client";

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, Loader2 } from 'lucide-react';
import { promoApi, PromoCard } from '@/services/promo';
import Link from 'next/link';
import { casinoService } from '@/services/casino';
import { useAuth } from '@/context/AuthContext';
import { useModal } from '@/context/ModalContext';
import { useWallet } from '@/context/WalletContext';
import { getCasinoWalletModeFromSubWallet } from '@/utils/casinoWalletMode';
import { cfImage, cfImageSrcSet } from '@/utils/cfImages';

interface PromoCardSliderProps {
    onGameLaunch?: (game: { id: string; name: string; provider: string; url: string }) => void;
}

export default function PromoCardSlider({ onGameLaunch }: PromoCardSliderProps) {
    const { user } = useAuth();
    const { openLogin } = useModal();
    const { selectedSubWallet } = useWallet();
    const [promoCards, setPromoCards] = useState<PromoCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [launchingId, setLaunchingId] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const fetchPromoCards = async () => {
            try {
                const data = await promoApi.getActivePromoCards();
                setPromoCards(data);
            } catch (error) {
                console.error("Failed to fetch promo cards", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPromoCards();
    }, []);

    const goTo = (index: number) => {
        if (isTransitioning || index === activeIndex) return;
        setIsTransitioning(true);
        setActiveIndex(index);
        setTimeout(() => setIsTransitioning(false), 600);
    };

    const goNext = () => goTo((activeIndex + 1) % promoCards.length);
    const goPrev = () => goTo((activeIndex - 1 + promoCards.length) % promoCards.length);

    // Autoplay
    useEffect(() => {
        if (promoCards.length <= 1) return;
        autoplayRef.current = setInterval(goNext, 5000);
        return () => { if (autoplayRef.current) clearInterval(autoplayRef.current); };
    }, [promoCards.length, activeIndex]);

    const resetAutoplay = () => {
        if (autoplayRef.current) clearInterval(autoplayRef.current);
        if (promoCards.length > 1) {
            autoplayRef.current = setInterval(goNext, 5000);
        }
    };

    const handleNav = (fn: () => void) => {
        fn();
        resetAutoplay();
    };

    const handlePromoClick = async (card: PromoCard, e: React.MouseEvent) => {
        const link = card.buttonLink || '';
        const match = link.match(/\/casino\/play\/([^?]+)(?:\?.*?provider=([^&]+))?(?:.*?name=([^&]+))?/);
        if (!match) return;

        e.preventDefault();

        if (!user) {
            openLogin();
            return;
        }

        const gameCode = match[1];
        const provider = match[2] ? decodeURIComponent(match[2]) : '';
        const gameName = match[3] ? decodeURIComponent(match[3]) : card.title;

        setLaunchingId(card._id || null);
        try {
            const res = await casinoService.launchGame({
                username: user.username,
                provider,
                gameId: gameCode,
                isLobby: false,
                walletMode: getCasinoWalletModeFromSubWallet(selectedSubWallet),
            });
            if (res?.url) {
                onGameLaunch?.({ id: gameCode, name: gameName, provider, url: res.url });
            }
        } catch (err) {
            console.error('Failed to launch game from promo card', err);
        } finally {
            setLaunchingId(null);
        }
    };

    const isCasinoGame = (link?: string) => !!link?.match(/\/casino\/play\/[^?]+/);

    if (loading) {
        return (
            <div className="w-full h-[220px] md:h-[340px] bg-bg-card rounded-xl animate-pulse border border-white/[0.04] mb-6" />
        );
    }

    if (promoCards.length === 0) return null;

    const card = promoCards[activeIndex];
    const isCasino = isCasinoGame(card.buttonLink);
    const isLaunching = launchingId === card._id;

    // Build gradient backdrop
    const gradientStyle = card.gradient
        ? card.gradient
        : 'linear-gradient(120deg, #0f2027, #203a43, #2c5364)';

    return (
        <div className="relative w-full mb-6 rounded-xl overflow-hidden group promo-banner-wrap aspect-video sm:aspect-[21/7]">

            {/* ── Slides ── */}
            {promoCards.map((c, i) => {
                const isActive = i === activeIndex;
                return (
                    <div
                        key={c._id || i}
                        className="absolute inset-0 transition-opacity duration-700"
                        style={{ opacity: isActive ? 1 : 0, zIndex: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none' }}
                    >
                        {/* Background Image
                            Plain <img> with Cloudflare Images flexible
                            variants — cfImage/cfImageSrcSet emit w=XXX URLs
                            that CF serves at the right size (huge mobile
                            bandwidth saving). srcset lets the browser pick
                            the smallest sufficient size per device.
                            First slide is eager + high priority for LCP. */}
                        {c.bgImage ? (
                            <img
                                src={cfImage(c.bgImage, { width: 1200 })}
                                srcSet={cfImageSrcSet(c.bgImage, [480, 800, 1200, 1600])}
                                sizes="100vw"
                                alt={c.title}
                                loading={i === 0 ? 'eager' : 'lazy'}
                                {...(i === 0 ? { fetchPriority: 'high' as const } : {})}
                                decoding="async"
                                className="absolute inset-0 w-full h-full object-cover object-center"
                            />
                        ) : (
                            <div className="absolute inset-0" style={{ background: c.gradient || gradientStyle }} />
                        )}

                        {/* Dark gradient overlay – left heavy so text is readable */}
                        <div className="absolute inset-0 z-10"
                            style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.05) 100%)' }}
                        />

                        {/* Character image (right side) — ~50vw wide, so
                            smaller srcset targets. */}
                        {c.charImage && (
                            <div className="absolute right-0 bottom-0 top-0 w-1/2 z-10">
                                <img
                                    src={cfImage(c.charImage, { width: 600, fit: 'contain' })}
                                    srcSet={cfImageSrcSet(c.charImage, [300, 600, 900], { fit: 'contain' })}
                                    sizes="50vw"
                                    alt=""
                                    aria-hidden
                                    loading={i === 0 ? 'eager' : 'lazy'}
                                    {...(i === 0 ? { fetchPriority: 'high' as const } : {})}
                                    decoding="async"
                                    className="absolute inset-0 h-full w-full object-contain object-right-bottom"
                                />
                            </div>
                        )}

                        {/* Content */}
                        <div className="absolute inset-0 z-20 flex flex-col justify-center px-6 md:px-14">
                            {c.tag && (
                                <span className="inline-block py-0.5 px-3 rounded-full bg-brand-gold/90 text-bg-base text-[10px] md:text-xs font-black uppercase tracking-widest mb-3 w-fit shadow-glow-gold">
                                    {c.tag}
                                </span>
                            )}

                            {c.subtitle && (
                                <p className="text-xs md:text-sm text-gray-300 uppercase tracking-widest font-semibold mb-1 drop-shadow">
                                    {c.subtitle}
                                </p>
                            )}

                            <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-white leading-tight mb-3 drop-shadow-xl" style={{ textShadow: '0 2px 24px rgba(0,0,0,0.7)' }}>
                                {c.title}
                            </h2>

                            {c.description && (
                                <p className="text-xs md:text-sm text-gray-300 mb-5 max-w-md line-clamp-2 drop-shadow">
                                    {c.description}
                                </p>
                            )}

                            {isCasinoGame(c.buttonLink) ? (
                                <button
                                    onClick={(e) => handlePromoClick(c, e)}
                                    disabled={isLaunching && launchingId === c._id}
                                    className="inline-flex items-center gap-2 bg-brand-gold hover:bg-white text-bg-base text-xs md:text-sm font-black uppercase px-6 py-3 rounded-lg transition-all transform hover:scale-105 shadow-glow-gold w-fit disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    {isLaunching && launchingId === c._id
                                        ? <><Loader2 size={15} className="animate-spin" /> Launching...</>
                                        : <>{c.buttonText || 'Play Now'} <ArrowRight size={15} strokeWidth={3} /></>
                                    }
                                </button>
                            ) : (
                                <Link
                                    href={c.buttonLink || '/'}
                                    className="inline-flex items-center gap-2 bg-brand-gold hover:bg-white text-bg-base text-xs md:text-sm font-black uppercase px-6 py-3 rounded-lg transition-all transform hover:scale-105 shadow-glow-gold w-fit"
                                >
                                    {c.buttonText || 'Play Now'} <ArrowRight size={15} strokeWidth={3} />
                                </Link>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* ── Navigation Arrows ── */}
            {promoCards.length > 1 && (
                <>
                    <button
                        onClick={() => handleNav(goPrev)}
                        aria-label="Previous"
                        className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-30 size-9 md:size-11 bg-black/50 hover:bg-black/80 border border-white/[0.06] text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={() => handleNav(goNext)}
                        aria-label="Next"
                        className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 z-30 size-9 md:size-11 bg-black/50 hover:bg-black/80 border border-white/[0.06] text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                    >
                        <ChevronRight size={20} />
                    </button>
                </>
            )}

            {/* ── Dot Indicators ── */}
            {promoCards.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
                    {promoCards.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => { handleNav(() => goTo(i)); }}
                            aria-label={`Go to slide ${i + 1}`}
                            className={`rounded-full transition-all duration-300 ${i === activeIndex
                                ? 'bg-brand-gold w-7 h-2'
                                : 'bg-white/30 hover:bg-white/60 w-2 h-2'
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
