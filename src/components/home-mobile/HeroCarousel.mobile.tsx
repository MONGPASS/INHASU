import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import { BRAND } from '../../constants/company';
import { MW, isUsableImage } from '../desktop-primitives/mwTokens';
import type { HomeProduct } from '../home-desktop/homeDesktopData';
import { MPhoto } from '../mobile/mobileUi';
import { HeroBannerStatus } from '../common/HeroBannerStatus';
import { linkTo, useGo, useHeroSlides } from './homeMobileData';

const GAP = 10;
const SIDE = 16;

const slideBox = {
    position: 'relative',
    // 세로로 긴 4:5는 첫 화면을 다 차지해서, 아래 바로가기가 함께 보이도록 가로형으로 둔다.
    aspectRatio: '3/2',
    maxHeight: 290,
    borderRadius: 20,
    overflow: 'hidden',
    scrollSnapAlign: 'center',
    color: '#fff',
    background: MW.navySoft,
} as const;

/** Swipeable hero banners; advances on its own until the visitor touches it. */
export function HeroCarouselMobile({ products }: { products: HomeProduct[] }) {
    const go = useGo();
    const { slides, isLoading, isError, refetch } = useHeroSlides(products);
    const n = slides.length;

    const rowRef = useRef<HTMLDivElement>(null);
    const idxRef = useRef(0);
    const pausedUntil = useRef(0);
    const [idx, setIdx] = useState(0);
    const [paused, setPaused] = useState(false);
    const pausedRef = useRef(false);
    pausedRef.current = paused;

    const scrollTo = useCallback((i: number) => {
        const el = rowRef.current;
        const child = el?.children[i] as HTMLElement | undefined;
        if (!el || !child) return;
        el.scrollTo({ left: child.offsetLeft - SIDE, behavior: 'smooth' });
    }, []);

    useEffect(() => {
        if (n < 2) return;
        const t = window.setInterval(() => {
            if (pausedRef.current || Date.now() < pausedUntil.current || document.visibilityState !== 'visible') return;
            scrollTo((idxRef.current + 1) % n);
        }, 4500);
        return () => window.clearInterval(t);
    }, [n, scrollTo]);

    const onScroll = (e: UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const first = el.children[0] as HTMLElement | undefined;
        const w = first ? first.offsetWidth + GAP : 1;
        const i = Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / w)));
        if (i !== idxRef.current) {
            idxRef.current = i;
            setIdx(i);
        }
    };

    const active = Math.min(idx, n - 1);
    const basis = n > 1 ? 'calc(100% - 20px)' : '100%';

    return (
        <section aria-roledescription="carousel" aria-label="추천 특집" style={{ position: 'relative', padding: '16px 0 0' }}>
            <div
                ref={rowRef}
                onScroll={onScroll}
                onTouchStart={() => { pausedUntil.current = Date.now() + 6000; }}
                data-noscroll=""
                style={{ position: 'relative', display: 'flex', gap: GAP, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', padding: `0 ${SIDE}px`, scrollPadding: `0 ${SIDE}px` }}
            >
                {isLoading || isError ? (
                    <div style={{ ...slideBox, flex: '0 0 100%', background: MW.chip }}>
                        <HeroBannerStatus error={isError} onRetry={() => { void refetch(); }} />
                    </div>
                ) : (
                    slides.map((s, k) => (
                        <a
                            key={s.key}
                            {...linkTo(go, s.path)}
                            aria-roledescription="slide"
                            style={{ ...slideBox, flex: `0 0 ${basis}`, textDecoration: 'none', background: `linear-gradient(135deg, ${MW.navySoft} 0%, ${MW.mintDeep} 100%)` }}
                        >
                            {/* The first slide is the page's largest paint; MPhoto requests it at the shown size. */}
                            {isUsableImage(s.img) && (
                                <MPhoto
                                    src={s.img}
                                    alt={`${s.title.replace(/\n/g, ' ')} | ${BRAND.tagline} ${BRAND.name}`}
                                    priority={k === 0}
                                    sizes="(max-width: 480px) 92vw, 440px"
                                />
                            )}
                            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(10,31,46,0) 30%,rgba(10,31,46,0.38) 62%,rgba(10,31,46,0.82) 100%)' }} />
                            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: n > 1 ? '0 96px 18px 18px' : '0 18px 18px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, minWidth: 0, pointerEvents: 'none' }}>
                                {s.eyebrow && (
                                    <span style={{ maxWidth: '100%', boxSizing: 'border-box', marginBottom: 2, fontSize: 12, fontWeight: 700, color: MW.navy, background: '#FFFFFF', padding: '4px 9px', borderRadius: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {s.eyebrow}
                                    </span>
                                )}
                                {/* Admin titles carry their own line breaks; at most two lines fit over the photo. */}
                                <h2 style={{ margin: 0, maxWidth: '100%', fontSize: 'clamp(19px,5.6vw,22px)', fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.02em', whiteSpace: 'pre-line', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '0 1px 10px rgba(10,31,46,0.35)' }}>
                                    {s.title}
                                </h2>
                                {s.sub && (
                                    <span style={{ maxWidth: '100%', fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 6px rgba(10,31,46,0.5)' }}>{s.sub}</span>
                                )}
                            </div>
                        </a>
                    ))
                )}
            </div>
            {!isLoading && !isError && n > 1 && (
                <div style={{ position: 'absolute', right: active === n - 1 ? SIDE + 12 : SIDE + 20 + 12, bottom: 16, display: 'flex', alignItems: 'center', gap: 6, transition: 'right .3s' }}>
                    <button
                        type="button"
                        aria-label={paused ? '자동 넘김 다시 시작' : '자동 넘김 멈춤'}
                        aria-pressed={paused}
                        onClick={() => setPaused((v) => !v)}
                        style={{ width: 28, height: 28, padding: 0, border: 0, borderRadius: '50%', background: 'rgba(10,31,46,0.55)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(6px)' }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            {paused ? <path d="M7 4.5v15l13-7.5z" /> : <path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z" />}
                        </svg>
                    </button>
                    <span aria-live="off" style={{ height: 28, boxSizing: 'border-box', padding: '0 11px', borderRadius: 999, background: 'rgba(10,31,46,0.55)', color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, backdropFilter: 'blur(6px)' }}>
                        <b style={{ color: '#FFFFFF', fontWeight: 700 }}>{active + 1}</b> / {n}
                    </span>
                </div>
            )}
        </section>
    );
}
