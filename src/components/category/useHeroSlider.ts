import { useCallback, useEffect, useState } from 'react';

interface SliderState {
    idx: number;
    /** Slides whose <img> is in the DOM (the first one, then each slide shortly before it is needed). */
    shown: number[];
}

const add = (list: number[], i: number) => (list.includes(i) ? list : [...list, i]);

/**
 * Hero photo slider state: cross-fade index with auto-advance.
 * Only the first photo is mounted at load; the next one is mounted a moment
 * before its turn so the first photo is not competing for bandwidth.
 */
export function useHeroSlider(count: number, delay = 5500) {
    const [state, setState] = useState<SliderState>({ idx: 0, shown: [0] });
    const [paused, setPaused] = useState(false);

    const step = useCallback(
        (delta: number) => {
            if (count < 2) return;
            setState((s) => {
                const idx = (((s.idx + delta) % count) + count) % count;
                return { idx, shown: add(s.shown, idx) };
            });
        },
        [count],
    );

    const goTo = useCallback(
        (idx: number) => {
            if (idx < 0 || idx >= count) return;
            setState((s) => ({ idx, shown: add(s.shown, idx) }));
        },
        [count],
    );

    useEffect(() => {
        if (count < 2) return;
        const preload = window.setTimeout(() => {
            setState((s) => ({ ...s, shown: add(s.shown, (s.idx + 1) % count) }));
        }, 2500);
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const advance = paused || reduced ? undefined : window.setTimeout(() => step(1), delay);
        return () => {
            window.clearTimeout(preload);
            if (advance !== undefined) window.clearTimeout(advance);
        };
    }, [state.idx, count, delay, paused, step]);

    return {
        idx: state.idx,
        shown: state.shown,
        goTo,
        prev: () => step(-1),
        next: () => step(1),
        setPaused,
    };
}
