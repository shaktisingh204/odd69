import React from 'react';
import { Coins, ArrowRight } from 'lucide-react';

export interface PromoCardProps {
    _id?: string;
    title: string;
    subtitle?: string;
    tag?: string;
    buttonText: string;
    buttonLink?: string;
    bgImage?: string;
    charImage?: string;
    gradient?: string;
    isActive: boolean;
    order: number;
}

const PromoCard: React.FC<Partial<PromoCardProps>> = ({
    title = "LUCKY HORSE",
    subtitle = "CASH RAIN",
    tag = "CASINO",
    buttonText = "PLAY NOW",
    buttonLink = "#",
    gradient = "linear-gradient(135deg, #ff9a3d, #ff6a00)",
    bgImage,
    charImage
}) => {
    return (
        <div
            className="group relative flex h-full min-h-[250px] flex-col justify-center overflow-hidden rounded-3xl p-6 ring-1 ring-white/[0.06] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 active:scale-[0.99] md:p-8"
            style={{ background: gradient || 'linear-gradient(135deg, #ff9a3d, #ff6a00)' }}
        >
            {/* Background Image Overlay */}
            {bgImage && (
                <div
                    className="absolute inset-0 z-0 bg-cover bg-center opacity-50"
                    style={{ backgroundImage: `url(${bgImage})` }}
                />
            )}

            {/* Warm glow */}
            <div className="pointer-events-none absolute -right-10 top-1/2 z-0 h-44 w-44 -translate-y-1/2 rounded-full bg-white/15 blur-2xl" />

            {/* Content Container */}
            <div className="relative z-20 flex h-full max-w-lg flex-col justify-center">
                <div className="mb-3 inline-flex w-fit items-center rounded-full bg-black/35 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white backdrop-blur-sm">
                    <span>{tag}</span>
                </div>

                <h2 className="mb-1 whitespace-pre-line text-2xl font-extrabold leading-tight tracking-tight text-white md:text-3xl">
                    {title}
                </h2>

                <p className="mb-6 whitespace-pre-line text-sm font-medium text-white/60 md:text-base">
                    {subtitle}
                </p>

                <a
                    href={buttonLink}
                    className="inline-flex w-fit items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_-8px_rgba(255,106,0,0.8)] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 active:scale-[0.97]"
                    style={{ background: "linear-gradient(135deg,#ff9a3d,#ff6a00)" }}
                >
                    <span>{buttonText}</span>
                    <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
                </a>
            </div>

            {/* Decorative Elements */}
            <div className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2">
                {charImage ? (
                    <img
                        src={charImage}
                        alt=""
                        aria-hidden
                        loading="lazy"
                        decoding="async"
                        className="h-[180px] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
                    />
                ) : (
                    <div className="absolute h-32 w-32 rounded-full bg-gradient-to-br from-white/20 to-[#ff6a00]/20 blur-2xl" />
                )}
            </div>

            <div className="absolute bottom-4 right-10 z-10 hidden md:block">
                <Coins className="h-8 w-8 rotate-12 text-white/80 drop-shadow-lg" />
            </div>
        </div>
    );
};

export default PromoCard;
