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
    aspectRatio: '4/5',
    maxHeight: 440,
    borderRadius: 24,
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

    const scrollTo = useCallback((i: number) => {
        const el = rowRef.current;
        const child = el?.children[i] as HTMLElement | undefined;
        if (!el || !child) return;
        el.scrollTo({ left: child.offsetLeft - SIDE, behavior: 'smooth' });
    }, []);

    useEffect(() => {
        if (n < 2) return;
        const t = window.setInterval(() => {
            if (Date.now() < pausedUntil.current || document.visibilityState !== 'visible') return;
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
        <section aria-roledescription="carousel" aria-label="추천 특집" style={{ padding: '16px 0 0' }}>
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
                            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(10,31,46,0.55) 0%,rgba(10,31,46,0) 40%,rgba(10,31,46,0) 55%,rgba(10,31,46,0.7) 100%)' }} />
                            <div style={{ position: 'absolute', inset: 0, padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
                                    {s.eyebrow && (
                                        <span style={{ maxWidth: '100%', boxSizing: 'border-box', fontSize: 11, fontWeight: 700, color: MW.navy, background: '#3FC2A4', padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {s.eyebrow}
                                        </span>
                                    )}
                                    {/* Admin titles carry their own line breaks; longer ones wrap instead of being cut. */}
                                    <h2 style={{ margin: 0, maxWidth: '100%', fontSize: 'clamp(17px,5.2vw,23px)', fontWeight: 900, lineHeight: 1.4, letterSpacing: '-0.01em', whiteSpace: 'pre-line', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '0 2px 12px rgba(10,31,46,0.35)' }}>
                                        {s.title}
                                    </h2>
                                    {s.sub && (
                                        <span style={{ maxWidth: '100%', fontSize: 13, color: '#EAF7F3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sub}</span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                    <span style={{ minWidth: 0, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                                    <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, border: '1px solid rgba(255,255,255,0.6)', padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>자세히 보기 →</span>
                                </div>
                            </div>
                        </a>
                    ))
                )}
            </div>
            {!isLoading && n > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '14px 0 0' }}>
                    {slides.map((s, k) => (
                        <button
                            key={s.key}
                            type="button"
                            aria-label={`슬라이드 ${k + 1}`}
                            aria-current={k === active || undefined}
                            onClick={() => {
                                pausedUntil.current = Date.now() + 4500;
                                scrollTo(k);
                            }}
                            style={{ width: k === active ? 22 : 6, height: 6, padding: 0, border: 0, borderRadius: 999, background: k === active ? MW.mint : MW.line2, cursor: 'pointer', transition: 'width .3s' }}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
