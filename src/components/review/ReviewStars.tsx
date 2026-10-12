import React from 'react';

interface ReviewStarsProps {
    rating: number;
    size?: number;
    className?: string;
}

// Yellow #facc15 (design system token --star). Uses inline style for color so the
// component works regardless of which Tailwind utilities make it into the build.
const FILL_COLOR = '#facc15';
const EMPTY_COLOR = '#e5e7eb'; // gray-200

export const ReviewStars: React.FC<ReviewStarsProps> = ({ rating, size = 16, className = '' }) => {
    const filled = Math.round(rating);
    return (
        <div className={`flex gap-0.5 ${className}`} aria-label={`${rating}/5`}>
            {[...Array(5)].map((_, i) => {
                const on = i < filled;
                return (
                    <span
                        key={i}
                        className="material-symbols-outlined"
                        style={{
                            fontSize: `${size}px`,
                            color: on ? FILL_COLOR : EMPTY_COLOR,
                            fontVariationSettings: on ? "'FILL' 1" : "'FILL' 0",
                        }}
                        aria-hidden="true"
                    >
                        star
                    </span>
                );
            })}
        </div>
    );
};

// Title and content often hold the same sentence (admin-pasted reviews). Returns whether
// the title should be rendered separately above the content, or if it's a redundant prefix.
export const shouldShowTitle = (title?: string, content?: string): boolean => {
    const t = (title ?? '').trim();
    const c = (content ?? '').trim();
    if (t.length === 0) return false;
    if (c.length === 0) return true;
    return !c.startsWith(t);
};
