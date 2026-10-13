import React, { useRef, useState } from 'react';
import { getOptimizedImageUrl } from '../../utils/cloudflareImage';

interface SimpleSliderProps {
    images: string[];
    altPrefix?: string;
}

export const SimpleSlider: React.FC<SimpleSliderProps> = ({ images, altPrefix = '몽골 여행 가이드' }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const firstCard = el.querySelector<HTMLDivElement>('[data-slide]');
        if (!firstCard) return;
        const cardWidth = firstCard.offsetWidth;
        const gap = 12;
        const index = Math.round(el.scrollLeft / (cardWidth + gap));
        setActiveIndex(Math.min(Math.max(index, 0), images.length - 1));
    };

    const scrollToIndex = (index: number) => {
        const el = scrollRef.current;
        if (!el) return;
        const firstCard = el.querySelector<HTMLDivElement>('[data-slide]');
        if (!firstCard) return;
        const cardWidth = firstCard.offsetWidth;
        const gap = 12;
        el.scrollTo({ left: index * (cardWidth + gap), behavior: 'smooth' });
    };

    if (!images || images.length === 0) return null;

    return (
        <div className="magazine-slider-container relative w-full -mt-[1.5em] mb-5 select-none">
            <div
                ref={scrollRef}
                className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-3"
                onScroll={handleScroll}
            >
                {images.map((src, index) => {
                    const optimizedUrl = getOptimizedImageUrl(src, 'contentImage');
                    return (
                        <div
                            key={index}
                            data-slide
                            className="flex-shrink-0 w-[88%] aspect-[4/3] snap-center"
                        >
                            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-sm">
                                <img
                                    src={optimizedUrl}
                                    alt={`${altPrefix} 사진 ${index + 1} | 몽골 여행 가이드`}
                                    className="absolute inset-0 w-full h-full object-cover object-center block"
                                    loading="lazy"
                                    decoding="async"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Counter Badge */}
            <div className="absolute top-3 right-[8%] bg-black/55 backdrop-blur-md text-white text-[11px] font-semibold px-2 py-0.5 rounded-full z-10 pointer-events-none">
                {activeIndex + 1} / {images.length}
            </div>

            {/* Dot Indicators */}
            {images.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-1">
                    {images.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => scrollToIndex(i)}
                            aria-label={`Go to slide ${i + 1}`}
                            className={`h-1.5 rounded-full transition-all ${
                                i === activeIndex
                                    ? 'w-5 bg-primary'
                                    : 'w-1.5 bg-slate-300 dark:bg-slate-600'
                            }`}
                        />
                    ))}
                </div>
            )}

            {/* Navigation Arrows for Desktop */}
            <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-2 right-2 justify-between pointer-events-none">
                {activeIndex > 0 && (
                    <button
                        onClick={() => scrollToIndex(activeIndex - 1)}
                        className="w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center pointer-events-auto hover:bg-white text-slate-800"
                        aria-label="Previous slide"
                    >
                        <span className="material-symbols-outlined text-base">chevron_left</span>
                    </button>
                )}
                {activeIndex < images.length - 1 && (
                    <button
                        onClick={() => scrollToIndex(activeIndex + 1)}
                        className="w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center pointer-events-auto hover:bg-white text-slate-800 ml-auto"
                        aria-label="Next slide"
                    >
                        <span className="material-symbols-outlined text-base">chevron_right</span>
                    </button>
                )}
            </div>
        </div>
    );
};
