"use client";

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PromoCard, { PromoCardProps } from './PromoCard';
import api from '@/services/api';

// Default mock to show something if API fails or is empty initially (optional)
const MOCK_CARDS: Partial<PromoCardProps>[] = [
    { _id: '1', title: 'WELCOME BONUS', subtitle: '100% UP TO €500', gradient: 'linear-gradient(to left, #4f46e5, transparent)', tag: 'BONUS' },
    { _id: '2', title: 'WEEKLY CASHBACK', subtitle: 'GET 10% BACK', gradient: 'linear-gradient(to left, #be185d, transparent)', tag: 'PROMO' },
    { _id: '3', title: 'VIP LOUNGE', subtitle: 'EXCLUSIVE ACCESS', gradient: 'linear-gradient(to left, #7C3AED, transparent)', tag: 'VIP' },
];

export default function PromoCarousel() {
    const [cards, setCards] = useState<Partial<PromoCardProps>[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [loading, setLoading] = useState(true);



    useEffect(() => {
        const fetchCards = async () => {
            try {
                const res = await api.get('/promo-cards?active=true');
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    setCards(res.data);
                } else {
                    // Keep mock or empty
                    // setCards(MOCK_CARDS); 
                }
            } catch (error) {
                console.error("Failed to fetch promo cards", error);
                // setCards(MOCK_CARDS);
            } finally {
                setLoading(false);
            }
        };

        fetchCards();
    }, []);

    const itemsPerSlide = 3;
    // Mobile might want 1 per slide, but snippet said "add 3 max PromoCard on each slide".
    // I'll assume responsive behavior: 1 on mobile, 3 on desktop.

    // For simplicity in this logical block, let's treat "slide" as a group of 3 visible items
    // But CSS grid/flex is better for responsive.
    // However, a true "carousel" implies paging.
    // Let's page by 1 item or page by 'group'?
    // "3 max PromoCard on each slide" implies paging by group of 3.

    const totalSlides = Math.ceil(cards.length / itemsPerSlide);

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % totalSlides);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
    };

    // Auto-play
    useEffect(() => {
        if (totalSlides <= 1) return;
        const timer = setInterval(nextSlide, 5000);
        return () => clearInterval(timer);
    }, [totalSlides]);

    if (loading) return <div className="h-[250px] bg-bg-elevated rounded-2xl animate-pulse" />;

    if (cards.length === 0) return null; // Or return default hero?

    // Function to get cards for current slide
    // Actually, to make it responsive (1 on mobile, 3 on desktop), strictly "paging by 3" is tricky if content forces 1.
    // A better approach for "3 max on each slide" is:
    // Always render ALL cards in a scrollable container, OR
    // Render the chunk of 3 cards for the current desktop slide.
    // On mobile, those 3 cards will stack or scroll.

    const currentCards = cards.slice(
        currentSlide * itemsPerSlide,
        (currentSlide + 1) * itemsPerSlide
    );

    // If we don't have enough cards to fill a slide (e.g. only 1 card total), it just shows 1.

    return (
        <div className="relative group">
            <div className="overflow-hidden rounded-2xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 transition-all duration-500 ease-in-out">
                    {currentCards.map((card, index) => (
                        <div key={card._id || index} className="w-full">
                            <PromoCard {...card} />
                        </div>
                    ))}
                    {/* Fill empty slots if last slide has fewer than 3? Optional. */}
                </div>
            </div>

            {/* Navigation Buttons (Only if more than 1 slide) */}
            {totalSlides > 1 && (
                <>
                    <button
                        onClick={prevSlide}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button
                        onClick={nextSlide}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                    >
                        <ChevronRight size={24} />
                    </button>

                    {/* Dots */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {Array.from({ length: totalSlides }).map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentSlide(idx)}
                                className={`w-2 h-2 rounded-full transition-all ${currentSlide === idx ? "bg-white w-4" : "bg-white/40"
                                    }`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
