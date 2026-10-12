import { MW } from '../desktop-primitives/mwTokens';

/** Text stars as drawn in the design (filled + muted remainder). */
export function Stars({ rating, size, spacing, color = MW.star, emptyColor = MW.line2 }: { rating: number; size: number; spacing: number; color?: string; emptyColor?: string }) {
    const n = Math.max(0, Math.min(5, rating));
    return (
        <span role="img" aria-label={`별점 5점 만점에 ${n}점`} style={{ color, fontSize: size, letterSpacing: spacing, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
            {'★'.repeat(n)}
            <span style={{ color: emptyColor }}>{'★'.repeat(5 - n)}</span>
        </span>
    );
}

export function PenIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={MW.navy} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3" />
        </svg>
    );
}

export function ThumbIcon({ color = MW.navy }: { color?: string }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.5 2.5V10H19a2 2 0 012 2.3l-1.2 6A2 2 0 0117.8 20H7" />
        </svg>
    );
}
