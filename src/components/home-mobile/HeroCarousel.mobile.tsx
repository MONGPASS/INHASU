import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import { BRAND } from '../../constants/company';
import { isUsableImage } from '../desktop-primitives/mwTokens';
import type { HomeProduct } from '../home-desktop/homeDesktopData';
import { MPhoto } from '../mobile/mobileUi';
import { HeroBannerStatus } from '../common/HeroBannerStatus';
import { SD } from '../site-seed/seed';
import { linkTo, useGo, useHeroSlides } from './homeMobileData';

const GAP = 10;
const SIDE = 14;
/** 다음 장이 오른쪽에 살짝 보이도록 한 장의 너비를 화면보다 좁게 둔다(390px 화면에서 322px). */
const PEEK = 68;

const slideBox = {
    position: 'relative',
    height: 284,
    borderRadius: 16,
    overflow: 'hidden',
    scrollSnapAlign: 'start',
    color: SD.white,
    background: SD.gray100,
} as const;

/** 휴대폰 홈 기획전 배너: 옆으로 밀어 넘기고, 손대기 전까지 스스로 넘어간다. 오른쪽 아래에 정지·재생과 번호. */
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
    const basis = n > 1 ? `calc(100% - ${PEEK}px)` : '100%';
    // 지금 장의 오른쪽 끝: 마지막 장은 화면 오른쪽 여백까지 오고, 그 앞 장들은 다음 장이 보이는 만큼 안쪽이다.
    const cardRight = n > 1 && active < n - 1 ? PEEK - SIDE : SIDE;
    const pill = { height: 32, borderRadius: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center' } as const;

    return (
        <section aria-roledescription="carousel" aria-label="여행 기획전" style={{ position: 'relative', paddingTop: 16 }}>
            <div
                ref={rowRef}
                onScroll={onScroll}
                onTouchStart={() => { pausedUntil.current = Date.now() + 6000; }}
                data-noscroll=""
                style={{ position: 'relative', display: 'flex', gap: GAP, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', padding: `0 ${SIDE}px`, scrollPadding: `0 ${SIDE}px` }}
            >
                {isLoading || isError ? (
                    <div style={{ ...slideBox, flex: '0 0 100%' }}>
                        <HeroBannerStatus error={isError} onRetry={() => { void refetch(); }} />
                    </div>
                ) : (
                    slides.map((s, k) => (
                        <a key={s.key} {...linkTo(go, s.path)} aria-roledescription="slide" aria-label={`${k + 1} / ${n}`}
                            style={{ ...slideBox, flex: `0 0 ${basis}`, textDecoration: 'none' }}>
                            {/* 첫 장은 화면에서 가장 큰 그림이라 먼저 받는다(MPhoto가 보이는 크기로 요청). */}
                            {isUsableImage(s.img) && (
                                <MPhoto src={s.img} alt={`${s.title.replace(/\n/g, ' ')} | ${BRAND.tagline} ${BRAND.name}`} priority={k === 0} sizes="(max-width: 480px) 84vw, 400px" />
                            )}
                            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.6) 100%)' }} />
                            <div style={{ position: 'absolute', left: 18, right: n > 1 ? 120 : 18, bottom: 18, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, minWidth: 0, pointerEvents: 'none' }}>
                                {s.eyebrow && (
                                    <span style={{ maxWidth: '100%', boxSizing: 'border-box', height: 26, padding: '0 10px', display: 'inline-flex', alignItems: 'center', borderRadius: 9999, background: SD.white, color: SD.mint700,
                                        fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {s.eyebrow}
                                    </span>
                                )}
                                {/* 관리자가 적은 줄 바꿈을 그대로 쓰고, 사진 위에는 두 줄까지만 보인다. */}
                                <h2 style={{ margin: 0, maxWidth: '100%', fontSize: 22, fontWeight: 700, lineHeight: 1.3, color: SD.white, whiteSpace: 'pre-line', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {s.title}
                                </h2>
                                {s.sub && <p style={{ margin: 0, maxWidth: '100%', fontSize: 13, color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sub}</p>}
                            </div>
                        </a>
                    ))
                )}
            </div>
            {!isLoading && !isError && n > 1 && (
                <div style={{ position: 'absolute', right: cardRight + 12, bottom: 14, display: 'flex', alignItems: 'center', gap: 6, transition: 'right .3s' }}>
                    <button type="button" aria-label={paused ? '자동 넘김 재생' : '자동 넘김 정지'} aria-pressed={paused} onClick={() => setPaused((v) => !v)}
                        style={{ ...pill, width: 32, padding: 0, border: 0, color: SD.white, justifyContent: 'center', cursor: 'pointer' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            {paused ? <path d="M7 4.5v15l13-7.5z" /> : <path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z" />}
                        </svg>
                    </button>
                    <span aria-live="off" style={{ ...pill, boxSizing: 'border-box', padding: '0 12px', gap: 3, color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                        <strong style={{ color: SD.white }}>{active + 1}</strong>/ {n}
                    </span>
                </div>
            )}
        </section>
    );
}
