import React from 'react';
import { Coins } from 'lucide-react';

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
    gradient = "linear-gradient(to left, rgba(6, 78, 59, 0.8), transparent)",
    bgImage,
    charImage
}) => {
    return (
        <div 
            className="relative overflow-hidden rounded-2xl p-6 md:p-8 shadow-xl group border border-gray-800 h-full min-h-[250px] flex flex-col justify-center transition-all hover:scale-[1.02]"
            style={{ background: gradient || '#1e1e1e' }}
        >
            {/* Background Image Overlay */}

            {bgImage && (
                <div
                    className="absolute inset-0 z-[-1] opacity-50 bg-cover bg-center"
                    style={{ backgroundImage: `url(${bgImage})` }}
                />
            )}

            {/* Content Container */}
            <div className="relative z-10 flex flex-col justify-center h-full max-w-lg">
                <div className="inline-flex items-center space-x-2 bg-white text-text-inverse px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider w-fit mb-3">
                    <span>{tag}</span>
                </div>

                <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-1 whitespace-pre-line">
                    {title}
                </h2>

                <p className="text-sm md:text-base text-gray-400 font-medium mb-6 whitespace-pre-line">
                    {subtitle}
                </p>

                <a href={buttonLink} className="group/btn relative inline-flex items-center justify-center px-6 py-2 bg-white/[0.08] hover:bg-white/[0.16] border border-white/[0.12] text-white text-sm font-bold rounded-lg transition-all duration-300 backdrop-blur-md w-fit">
                    <span className="mr-2">{buttonText}</span>
                </a>
            </div>

            {/* Decorative Elements */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
                {charImage ? (
                    <img
                        src={charImage}
                        alt=""
                        aria-hidden
                        loading="lazy"
                        decoding="async"
                        className="h-[180px] object-contain drop-shadow-xl"
                    />
                ) : (
                    <div className="w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-full blur-2xl animate-pulse absolute" />
                )}
            </div>

            <div className="absolute right-10 bottom-4 animate-bounce delay-700 hidden md:block">
                <Coins className="text-yellow-500 w-8 h-8 rotate-12 drop-shadow-lg opacity-80" />
            </div>

            {/* Angle Element */}
            <div className="absolute top-0 right-0 h-full w-1/3 bg-white/[0.04] -skew-x-12 origin-bottom-right z-0 mix-blend-overlay" />
        </div>
    );
};

export default PromoCard;
