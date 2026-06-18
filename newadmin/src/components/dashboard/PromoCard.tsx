import React from 'react';
import { Play, Coins } from 'lucide-react';
import { PromoCard as PromoCardType } from '@/services/promo-card.service';

const PromoCard: React.FC<Partial<PromoCardType>> = ({
    title = "LUCKY HORSE",
    subtitle = "CASH RAIN",
    tag = "CASINO",
    buttonText = "PLAY NOW",
    buttonLink = "#",
    gradient = "linear-gradient(to left, rgba(227, 125, 50, 0.8), transparent)",
    bgImage,
    charImage
}) => {
    return (
        <div className="relative overflow-hidden rounded-2xl bg-[#1e1e1e] p-8 md:p-12 shadow-2xl group border border-gray-800 h-full min-h-[300px]">
            {/* Background Image / Gradient Placeholder */}
            <div
                className="absolute top-0 right-0 w-2/3 h-full z-0 rounded-r-2xl pointer-events-none"
                style={{ background: gradient }}
            />

            {bgImage && (
                <div
                    className="absolute inset-0 z-[-1] opacity-50 bg-cover bg-center"
                    style={{ backgroundImage: `url(${bgImage})` }}
                />
            )}

            {/* Content Container */}
            <div className="relative z-10 flex flex-col justify-center h-full max-w-lg">
                <div className="inline-flex items-center space-x-2 bg-white text-black px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider w-fit mb-4">
                    <span>{tag}</span>
                </div>

                <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-2 whitespace-pre-line">
                    {title}
                </h2>

                <p className="text-xl md:text-2xl text-gray-400 font-medium mb-8 whitespace-pre-line">
                    {subtitle}
                </p>

                <a href={buttonLink} className="group/btn relative inline-flex items-center justify-center px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-lg transition-all duration-300 backdrop-blur-sm w-fit">
                    <span className="mr-2">{buttonText}</span>
                </a>
            </div>

            {/* Decorative Elements */}
            <div className="absolute right-10 top-1/2 -translate-y-1/2 hidden md:block z-20 pointer-events-none">
                {charImage ? (
                    <img src={charImage} alt="Character" className="h-[250px] object-contain drop-shadow-2xl" />
                ) : (
                    <div className="w-64 h-64 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-full blur-3xl animate-pulse absolute" />
                )}
            </div>

            <div className="absolute right-20 bottom-10 animate-bounce delay-700">
                <Coins className="text-yellow-500 w-12 h-12 rotate-12 drop-shadow-lg opacity-80" />
            </div>
            <div className="absolute right-40 top-20 animate-bounce delay-300">
                <Coins className="text-yellow-400 w-8 h-8 -rotate-12 drop-shadow-md opacity-60" />
            </div>

            {/* Angle Element */}
            <div className="absolute top-0 right-0 h-full w-1/3 bg-white/5 -skew-x-12 origin-bottom-right z-0 mix-blend-overlay" />
        </div>
    );
};

export default PromoCard;
