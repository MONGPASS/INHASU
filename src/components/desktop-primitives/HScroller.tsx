import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MatIcon } from './MatIcon';

interface HScrollerProps {
    children: ReactNode;
    gap?: number;
    padX?: number;
    snap?: boolean;
}

export function HScroller({ children, gap = 16, padX = 0, snap = false }: HScrollerProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [hover, setHover] = useState(false);
    const [canLeft, setCanLeft] = useState(false);
    const [canRight, setCanRight] = useState(true);

    const onScroll = () => {
        const el = ref.current;
        if (!el) return;
        setCanLeft(el.scrollLeft > 8);
        setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    };

    useEffect(() => {
        onScroll();
    }, []);

    const nudge = (dir: number) => {
        const el = ref.current;
        if (!el) return;
        el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.7, 320), behavior: 'smooth' });
    };

    return (
        <div style={{ position: 'relative' }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
            <div
                ref={ref}
                onScroll={onScroll}
                className="scrollbar-hide"
                style={{
                    display: 'flex',
                    gap,
                    overflowX: 'auto',
                    scrollSnapType: snap ? 'x mandatory' : 'none',
                    padding: `0 ${padX}px`,
                    margin: `0 -${padX}px`,
                }}
            >
                {children}
            </div>
            {hover && canLeft && (
                <button type="button" onClick={() => nudge(-1)} aria-label="prev" style={navBtn('left')}>
                    <MatIcon name="chevron_left" size={26} color="var(--fg-1)" />
                </button>
            )}
            {hover && canRight && (
                <button type="button" onClick={() => nudge(1)} aria-label="next" style={navBtn('right')}>
                    <MatIcon name="chevron_right" size={26} color="var(--fg-1)" />
                </button>
            )}
        </div>
    );
}

function navBtn(side: 'left' | 'right'): CSSProperties {
    return {
        position: 'absolute',
        top: '50%',
        [side]: -22,
        transform: 'translateY(-50%)',
        width: 48,
        height: 48,
        borderRadius: 999,
        border: '1px solid var(--border-subtle)',
        background: '#fff',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
    };
}
