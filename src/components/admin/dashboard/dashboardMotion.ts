import { useEffect, useState } from 'react';
import type React from 'react';

export interface DashboardTipLine { k: string; v: string }
/** Returns mouse handlers that show the dashboard's ink tooltip with these lines. */
export type DashboardTipFor = (title: string, lines: DashboardTipLine[]) => {
    onMouseMove: (event: React.MouseEvent) => void; onMouseLeave: () => void;
};

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** The design's chart entrance: 0 → 1 over 1.1s (ease-out cubic), replayed per key; off for reduced motion. */
export function useEntrance(key: string): number {
    const [t, setT] = useState(() => typeof window === 'undefined' || reducedMotion() ? 1 : 0);
    useEffect(() => {
        const start = performance.now(), duration = reducedMotion() || document.hidden ? 0 : 1100;
        let frame = 0;
        const step = (now: number) => {
            const progress = duration ? Math.min(1, (now - start) / duration) : 1;
            setT(1 - Math.pow(1 - progress, 3));
            if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
        // Hidden tabs pause animation frames; land on the final values regardless.
        const safety = window.setTimeout(() => { cancelAnimationFrame(frame); setT(1); }, duration + 300);
        return () => { cancelAnimationFrame(frame); clearTimeout(safety); };
    }, [key]);
    return t;
}
