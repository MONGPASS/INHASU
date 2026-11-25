import { useCallback, useEffect, useLayoutEffect, useRef, useState, type UIEvent } from 'react';
import { BRAND } from '../../constants/company';
import { isUsableImage } from '../desktop-primitives/mwTokens';
import type { HomeProduct } from '../home-desktop/homeDesktopData';
import { MPhoto } from '../mobile/mobileUi';
import { HeroBannerStatus } from '../common/HeroBannerStatus';
import { SD, SIcon } from '../site-seed/seed';
import { linkTo, useGo, useHeroSlides } from './homeMobileData';

const GAP = 8;
/** 가운데 장 양옆으로 앞·뒤 장이 보이는 폭(390px 화면에서 한 장 334px). */
const SIDE = 28;
const HEIGHT = 176;

const slideBox = {
    position: 'relative',
    height: HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    scrollSnapAlign: 'center',
    color: SD.white,
    background: SD.gray100,
    // 줄의 좌우 여백(SIDE)을 뺀 폭 = 한 장. 그 여백만큼 앞·뒤 장이 보인다.
    flex: '0 0 100%',
} as const;
const shade = 'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.05) 100%)';

/**
 * 휴대폰 홈 기획전 배너(디자인 ‘홈 · 휴대폰’ 2026-11-25 2차): 가운데 장 양옆으로 앞·뒤 장이 보이고 끝없이 돈다.
 * 손으로 밀면 넘어가고, 손대기 전까지는 스스로 넘어간다. 오른쪽 아래 알약에 정지·재생 · 번호 · 전체보기.
 * 끝없이 돌게 하려고 배너를 세 벌 이어 두고 가운데 벌에서 시작하며, 앞·뒤 벌로 넘어가면 가운데 벌의 같은 장으로 조용히 옮긴다.
 */
export function HeroCarouselMobile({ products }: { products: HomeProduct[] }) {
    const go = useGo();
    const { slides, isLoading, isError, refetch } = useHeroSlides(products);
    const n = slides.length;
    const loop = n > 1;
    const items = loop ? [...slides, ...slides, ...slides] : slides;

    const rowRef = useRef<HTMLDivElement>(null);
    const posRef = useRef(loop ? n : 0);
    const pausedUntil = useRef(0);
    const settleTimer = useRef(0);
    const [pos, setPos] = useState(loop ? n : 0);
    const [paused, setPaused] = useState(false);
    const pausedRef = useRef(false);
    pausedRef.current = paused;

    const step = () => {
        const first = rowRef.current?.children[0] as HTMLElement | undefined;
        return first ? first.offsetWidth + GAP : 1;
    };
    const scrollToPos = useCallback((i: number, smooth = true) => {
        const el = rowRef.current;
        if (!el) return;
        el.scrollTo({ left: i * step(), behavior: smooth ? 'smooth' : 'auto' });
    }, []);

    // 처음과 배너 수가 바뀔 때 가운데 벌 첫 장으로
    useLayoutEffect(() => {
        if (!n) return;
        const start = loop ? n : 0;
        posRef.current = start;
        setPos(start);
        scrollToPos(start, false);
    }, [n, loop, scrollToPos]);

    useEffect(() => {
        if (!loop) return;
        const t = window.setInterval(() => {
            if (pausedRef.current || Date.now() < pausedUntil.current || document.visibilityState !== 'visible') return;
            scrollToPos(posRef.current + 1);
        }, 4500);
        return () => window.clearInterval(t);
    }, [loop, scrollToPos]);

    useEffect(() => () => window.clearTimeout(settleTimer.current), []);

    const onScroll = (e: UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollLeft / step())));
        if (i !== posRef.current) {
            posRef.current = i;
            setPos(i);
        }
        if (!loop) return;
        // 멈춘 뒤 앞·뒤 벌에 있으면 가운데 벌의 같은 장으로 옮긴다(보이는 그림은 같다)
        window.clearTimeout(settleTimer.current);
        settleTimer.current = window.setTimeout(() => {
            const at = posRef.current;
            if (at < n || at >= n * 2) {
                const same = (at % n) + n;
                posRef.current = same;
                setPos(same);
                scrollToPos(same, false);
            }
        }, 140);
    };

    const active = n ? pos % n : 0;
    const pill = { position: 'absolute', right: 12, bottom: 12, display: 'flex', alignItems: 'center', height: 30, padding: '0 4px 0 2px', borderRadius: 9999, background: 'rgba(0,0,0,0.45)', color: SD.white } as const;

    return (
        <section aria-roledescription="carousel" aria-label="여행 기획전" style={{ position: 'relative', paddingTop: 14 }}>
            <div
                ref={rowRef}
                onScroll={onScroll}
                onTouchStart={() => { pausedUntil.current = Date.now() + 6000; }}
                data-noscroll=""
                style={{ display: 'flex', gap: GAP, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', padding: `0 ${SIDE}px`, scrollPadding: `0 ${SIDE}px` }}
            >
                {isLoading || isError ? (
                    <div style={{ ...slideBox, flex: '0 0 100%' }}>
                        <HeroBannerStatus error={isError} onRetry={() => { void refetch(); }} />
                    </div>
                ) : (
                    items.map((s, k) => {
                        const current = k === pos;
                        const copy = loop && Math.floor(k / n) !== 1;
                        return (
                            <a key={`${s.key}-${k}`} {...linkTo(go, s.path)}
                                // 옆에 보이는 장을 누르면 그 장으로 넘기고, 가운데 장을 누르면 그 기획전으로 간다
                                onClick={(e) => { e.preventDefault(); if (current) go(s.path); else { pausedUntil.current = Date.now() + 6000; scrollToPos(k); } }}
                                aria-roledescription="slide" aria-label={`${(k % (n || 1)) + 1} / ${n}`} aria-hidden={copy || undefined} tabIndex={copy ? -1 : undefined}
                                style={{ ...slideBox, textDecoration: 'none' }}>
                                {/* 첫 장은 화면에서 가장 큰 그림이라 먼저 받는다(MPhoto가 보이는 크기로 요청). */}
                                {isUsableImage(s.img) && (
                                    <MPhoto src={s.img} alt={copy ? '' : `${s.title.replace(/\n/g, ' ')} | ${BRAND.tagline} ${BRAND.name}`} priority={k === (loop ? n : 0)} sizes="(max-width: 480px) 86vw, 420px" />
                                )}
                                <span style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: shade }} />
                                {s.eyebrow && (
                                    <span style={{ position: 'absolute', right: 16, top: 14, maxWidth: '40%', fontSize: 12, fontWeight: 700, color: SD.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>{s.eyebrow}</span>
                                )}
                                <span style={{ position: 'absolute', left: 20, right: 20, top: 22, display: 'flex', flexDirection: 'column', gap: 8, color: SD.white, pointerEvents: 'none' }}>
                                    {/* 관리자가 적은 줄 바꿈을 그대로 쓰고, 두 줄까지만 보인다. */}
                                    <span role="heading" aria-level={2} style={{ maxWidth: 'calc(100% - 56px)', fontSize: 21, fontWeight: 700, lineHeight: 1.35, whiteSpace: 'pre-line', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {s.title}
                                    </span>
                                    {s.sub && <span style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sub}</span>}
                                </span>
                            </a>
                        );
                    })
                )}
            </div>
            {!isLoading && !isError && n > 0 && (
                <div style={{ ...pill, right: SIDE + 12 }}>
                    {loop && (
                        <button type="button" aria-label={paused ? '자동 넘김 재생' : '자동 넘김 정지'} aria-pressed={paused} onClick={() => setPaused((v) => !v)}
                            style={{ width: 28, height: 28, border: 'none', background: 'transparent', color: SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                {paused ? <path d="M7 4.5v15l13-7.5z" /> : <path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z" />}
                            </svg>
                        </button>
                    )}
                    <span aria-live="off" style={{ fontSize: 12, fontWeight: 700, paddingLeft: loop ? 0 : 8 }}>
                        {active + 1}<span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.7)' }}>/{n}</span>
                    </span>
                    <a {...linkTo(go, '/promotions')} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 28, padding: '0 6px 0 8px', color: SD.white, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                        전체보기<SIcon name="chevronRight" size={12} stroke={2.2} />
                    </a>
                </div>
            )}
        </section>
    );
}
