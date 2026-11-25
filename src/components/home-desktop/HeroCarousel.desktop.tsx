import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHeroBanners } from '../../hooks/useHeroBanners';
import type { HomeData } from '../../hooks/useHomeData';
import { BRAND } from '../../constants/company';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import { SD, SIcon, SRoundButton } from '../site-seed/seed';
import { ResponsiveProductImage } from '../common/ResponsiveProductImage';
import { HeroBannerStatus } from '../common/HeroBannerStatus';

interface Slide {
    key: string;
    img: string;
    eyebrow: string;
    title: string;
    sub: string;
    label: string;
    path: string;
}

// Strings the admin tooling inserts as placeholders that we should never display.
const DEFAULT_TEXTS = new Set(['New Tag', 'new tag', '새로운 배너 타이틀', '배너 설명을 입력하세요', 'Premium Trip']);
const clean = (v?: string) => {
    const s = (v || '').trim();
    return s && !DEFAULT_TEXTS.has(s) ? s : '';
};

/** Banner links are stored as absolute production URLs; route them in-app. */
const toPath = (link?: string) => {
    const l = (link || '').trim();
    if (!l) return '/products';
    try {
        const u = new URL(l, window.location.origin);
        // 옛 도메인(mongolryokou.com)으로 저장된 배너 링크도 사이트 내부 경로로 처리한다.
        if (u.hostname === window.location.hostname || u.hostname.endsWith(BRAND.domain) || u.hostname.endsWith('mongolryokou.com')) {
            return u.pathname + u.search;
        }
        return l;
    } catch {
        return l.startsWith('/') ? l : '/products';
    }
};

const FALLBACK: Slide = {
    key: 'fallback',
    img: '',
    eyebrow: 'CUSTOM TOUR',
    title: '나만의 특별한 여행 플랜,\n1분 만에 요청하세요',
    sub: '한국어 담당 직원이 24시간 이내에 답변드립니다. 견적은 무료입니다.',
    label: '견적 무료',
    path: '/custom-estimate',
};

const GAP = 12;
const W = 'min(840px, calc(100vw - 112px))';

interface Props {
    products: HomeData['products'];
}

export function HeroCarouselDesktop({ products }: Props) {
    const navigate = useNavigate();

    const { data: banners, isError, refetch } = useHeroBanners();

    const slides: Slide[] = !banners ? [] : banners.length === 0
        ? [FALLBACK]
        : banners.slice(0, 6).map((b, i) => {
            const path = toPath(b.link);
            // Banners that point at a tour pick up its category, length and price.
            const productId = path.match(/^\/products\/([^/?#]+)/)?.[1];
            const product = productId ? products.find((p) => p.id === productId) : undefined;
            const tag = clean(b.pc_tag || b.pcTag) || clean(b.tag);
            const sub = clean(b.pc_subtitle || b.pcSubtitle) || clean(b.subtitle);
            return {
                key: b.id || String(i),
                img: b.pc_image || b.pcImage || b.image || b.image_url || '',
                eyebrow: tag || (product ? [product.category, product.duration].filter(Boolean).join(' · ') : ''),
                title: clean(b.pc_title || b.pcTitle) || clean(b.title) || product?.name || '몽골 여행',
                sub: sub || (product ? `${won(product.price)}~` : ''),
                label: product?.category || '몽골 여행',
                path,
            };
        });

    const n = slides.length;
    const looping = n > 1;
    // Three copies of the slide list; the index lives in the middle copy and
    // silently snaps back there after each transition for an endless loop.
    const [idx, setIdx] = useState(n);
    const [animate, setAnimate] = useState(true);
    const idxRef = useRef(idx);
    useEffect(() => {
        idxRef.current = idx;
    }, [idx]);
    const paused = useRef(false);
    const snapTimer = useRef<number | undefined>(undefined);

    useEffect(() => {
        setIdx(n);
    }, [n]);

    const goTo = useCallback((i: number) => {
        window.clearTimeout(snapTimer.current);
        setAnimate(true);
        setIdx(i);
        snapTimer.current = window.setTimeout(() => {
            if (i >= n && i < 2 * n) return;
            setAnimate(false);
            setIdx(n + (((i - n) % n) + n) % n);
            requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
        }, 620);
    }, [n]);

    useEffect(() => {
        if (!looping) return;
        const t = window.setInterval(() => {
            if (!paused.current && document.visibilityState === 'visible') goTo(idxRef.current + 1);
        }, 5000);
        return () => window.clearInterval(t);
    }, [looping, goTo]);

    useEffect(() => () => window.clearTimeout(snapTimer.current), []);

    const active = looping ? (((idx - n) % n) + n) % n : 0;
    const track = looping ? [0, 1, 2].flatMap((c) => slides.map((s, k) => ({ s, k, pos: c * n + k }))) : slides.map((s, k) => ({ s, k, pos: k }));
    const offset = looping ? idx : 0;

    return (
        <section
            aria-roledescription="carousel"
            aria-label="여행 기획전"
            style={{ padding: '20px 0 0', overflow: 'hidden', background: SD.white }}
            onMouseEnter={() => { paused.current = true; }}
            onMouseLeave={() => { paused.current = false; }}
        >
            {/* 디자인(2026-11-25): 가운데 840×380 카드 + 양옆에 이전·다음 카드가 걸쳐 보인다 */}
            <div style={{ position: 'relative', width: W, maxWidth: '100%', aspectRatio: '840 / 380', margin: '0 auto' }}>
                {!banners ? (
                    <div style={{ width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden' }}>
                        <HeroBannerStatus error={isError} onRetry={() => { void refetch(); }} />
                    </div>
                ) : (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        display: 'flex',
                        gap: GAP,
                        transform: `translateX(calc(${offset} * (${W} + ${GAP}px) * -1))`,
                        transition: animate ? 'transform .6s cubic-bezier(.22,.7,.2,1)' : 'none',
                    }}
                >
                    {track.map(({ s, k, pos }) => {
                        const isCurrent = pos === offset;
                        // Only the middle copy is exposed to crawlers / screen readers.
                        const isPrimary = !looping || (pos >= n && pos < 2 * n);
                        // Loop clones render titles as plain text: one heading per banner.
                        const Heading = isPrimary ? 'h2' : 'div';
                        return (
                            <div
                                key={pos}
                                role="group"
                                aria-roledescription="slide"
                                aria-label={isPrimary ? `${k + 1} / ${n}` : undefined}
                                aria-hidden={!isPrimary || undefined}
                                onClick={() => (isCurrent ? navigate(s.path) : goTo(pos))}
                                style={{
                                    position: 'relative',
                                    flex: `0 0 ${W}`,
                                    width: W,
                                    height: '100%',
                                    borderRadius: 16,
                                    overflow: 'hidden',
                                    color: SD.white,
                                    cursor: 'pointer',
                                    background: `linear-gradient(135deg, ${SD.gray900} 0%, ${SD.mint700} 100%)`,
                                }}
                            >
                                {isUsableImage(s.img) && (
                                    <ResponsiveProductImage
                                        src={s.img}
                                        sizes="(max-width: 952px) calc(100vw - 112px), 840px"
                                        alt={isPrimary ? `${s.title.replace(/\n/g, ' ')} | ${BRAND.tagline} ${BRAND.name}` : ''}
                                        loading={isCurrent || pos === offset + 1 ? 'eager' : 'lazy'}
                                        fetchPriority={isCurrent && k === 0 ? 'high' : 'auto'}
                                        decoding="async"
                                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                )}
                                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0) 65%)' }} />
                                <div style={{ position: 'absolute', left: 'clamp(20px,4vw,44px)', top: 'clamp(20px,4vw,44px)', bottom: 'clamp(16px,3vw,36px)', maxWidth: 440, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, pointerEvents: 'none' }}>
                                    {s.eyebrow && (
                                        <span style={{ minHeight: 26, padding: '0 10px', display: 'inline-flex', alignItems: 'center', borderRadius: 6, background: SD.mint700, color: SD.white, fontSize: 12, fontWeight: 700 }}>
                                            {s.eyebrow}
                                        </span>
                                    )}
                                    {s.sub && <p style={{ margin: '4px 0 0', fontSize: 'clamp(13px,1.3vw,16px)', color: 'rgba(255,255,255,0.9)' }}>{s.sub}</p>}
                                    <Heading
                                        style={{ margin: 0, fontSize: 'clamp(22px,3vw,34px)', lineHeight: 1.3, fontWeight: 700, color: SD.white, whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
                                    >
                                        {s.title}
                                    </Heading>
                                    {isCurrent && (
                                        <span style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, height: 44, padding: '0 18px', borderRadius: 9999, background: SD.white, color: SD.gray900, fontSize: 15, fontWeight: 700 }}>
                                            자세히 보기<SIcon name="arrowRight" size={16} stroke={2} />
                                        </span>
                                    )}
                                </div>
                                {isCurrent && looping && (
                                    <div style={{ position: 'absolute', right: 20, bottom: 20, display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                                        <span style={{ height: 32, padding: '0 12px', display: 'inline-flex', alignItems: 'center', borderRadius: 9999, background: 'rgba(0,0,0,0.5)', color: SD.white, fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                            {active + 1} / {n}
                                        </span>
                                        <SRoundButton label="이전 기획전" icon="chevronLeft" onClick={() => goTo(idx - 1)} style={{ border: 'none' }} />
                                        <SRoundButton label="다음 기획전" icon="chevronRight" onClick={() => goTo(idx + 1)} style={{ border: 'none' }} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '16px 0 40px', minHeight: 20 }}>
                {looping && slides.map((s, k) => (
                    <button
                        key={s.key}
                        type="button"
                        aria-label={`${k + 1}번째 기획전 보기`}
                        aria-current={k === active || undefined}
                        onClick={() => goTo(n + k)}
                        style={{ width: 32, height: 20, border: 'none', background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                        <span style={{ display: 'block', width: k === active ? 24 : 6, height: 6, borderRadius: 9999, background: k === active ? SD.mint500 : SD.gray400, transition: 'width .3s' }} />
                    </button>
                ))}
            </div>
        </section>
    );
}
