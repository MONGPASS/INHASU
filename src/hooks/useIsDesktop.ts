import { useEffect, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * Returns true when the viewport is ≥1024px (Tailwind `lg`).
 * SSR-safe: initial render returns false; subscribes to media query changes after mount.
 */
export function useIsDesktop(): boolean {
    const [isDesktop, setIsDesktop] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(DESKTOP_QUERY).matches;
    });

    useEffect(() => {
        const mq = window.matchMedia(DESKTOP_QUERY);
        const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
        // Subscribe to viewport changes. The initial value was already read in
        // the useState initializer, so we don't need a synchronous setIsDesktop here.
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return isDesktop;
}
