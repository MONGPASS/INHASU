import { useEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProductCategories } from '../../hooks/useProductCategories';
import { getOptimizedImageUrl } from '../../utils/cloudflareImage';
import { MW, MW_FONT_EN, MW_GRADIENT } from '../desktop-primitives/mwTokens';
import { KAKAO_CHANNEL_CHAT_URL } from '../../constants/company';
import { M_HAIR, M_PAPER } from '../mobile/mobileTheme';
import {
    accentOf, heroSlides, pad2, resolveCardLink, scrollToLineup, visibleHighlights,
    type CategoryLandingContent, type HighlightCard,
} from './categoryContent';
import { useHeroSlider } from './useHeroSlider';

/**
 * Blocks of the category landing page (Claude Design: Category Header / Hero /
 * Experiences / Lineup / CTA). PC and mobile share the markup; `compact` switches
 * to the mobile gutters and hero shape. The tour grid lives in each screen.
 */

const P_ARROW = 'M5 12h14M13 6l6 6-6 6';
const P_PREV = 'M15 5l-7 7 7 7';
const P_NEXT = 'M9 5l7 7-7 7';
const P_CHAT = 'M4 5h16v11H9l-5 4z';

const EYEBROW: CSSProperties = { fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintDeep };
const COVER: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' };

function Svg({ d, size = 17, width = 2, color = MW.navy }: { d: string; size?: number; width?: number; color?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d={d} />
        </svg>
    );
}

interface HoverStyle { background?: string; opacity?: string; borderColor?: string; transform?: string }

/** Inline-style hover: `on` while the pointer is over the element, `off` restores it. */
const hover = (on: HoverStyle, off: HoverStyle) => ({
    onMouseEnter: (e: MouseEvent<HTMLElement>) => { Object.assign(e.currentTarget.style, on); },
    onMouseLeave: (e: MouseEvent<HTMLElement>) => { Object.assign(e.currentTarget.style, off); },
});

interface GoProps {
    to: string;
    children: ReactNode;
    style?: CSSProperties;
    current?: boolean;
    hoverStyle?: [HoverStyle, HoverStyle];
}

/** In-app link: real href for crawlers, client-side navigation on click. */
function Go({ to, children, style, current, hoverStyle }: GoProps) {
    const navigate = useNavigate();
    return (
        <a
            href={to}
            aria-current={current ? 'page' : undefined}
            onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                navigate(to);
                window.scrollTo(0, 0);
            }}
            style={{ textDecoration: 'none', ...style }}
            {...(hoverStyle ? hover(hoverStyle[0], hoverStyle[1]) : null)}
        >
            {children}
        </a>
    );
}

// ─── Header ─────────────────────────────────────────────────

/** Pill switch between the active tour categories. */
function CategoryTabs({ slug }: { slug: string }) {
    const categories = useProductCategories();
    const rail = useRef<HTMLElement>(null);

    // Keep the current category visible when the pills overflow (mobile).
    useEffect(() => {
        const el = rail.current;
        const on = el?.querySelector<HTMLElement>('[aria-current]');
        if (!el || !on) return;
        el.scrollLeft = on.offsetLeft - (el.clientWidth - on.clientWidth) / 2;
    }, [categories, slug]);

    if (categories.length < 2) return null;

    return (
        <nav ref={rail} aria-label="투어 카테고리" data-noscroll="" style={{ position: 'relative', display: 'flex', gap: 6, padding: 5, borderRadius: 999, background: MW.chip, overflowX: 'auto', scrollbarWidth: 'none', maxWidth: '100%' }}>
            {categories.map((c) => {
                const on = c.id === slug;
                return (
                    <Go
                        key={c.id}
                        to={`/category/${c.id}`}
                        current={on}
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', height: 38, padding: '0 16px', borderRadius: 999, background: on ? MW.navy : 'transparent', fontSize: 13, fontWeight: 700, color: on ? '#FFFFFF' : MW.ink3, whiteSpace: 'nowrap' }}
                    >
                        {c.name}
                    </Go>
                );
            })}
        </nav>
    );
}

interface BlockProps {
    content: CategoryLandingContent;
    /** Mobile gutters and shapes. */
    compact?: boolean;
}

export function CategoryHeader({ slug, content, compact = false }: BlockProps & { slug: string }) {
    const crumb: CSSProperties = { color: MW.mute2 };
    return (
        <section style={{ background: `linear-gradient(180deg,${M_PAPER} 0%,#FFFFFF 100%)`, borderBottom: `1px solid ${M_HAIR}` }}>
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: `20px ${compact ? 16 : 24}px 32px`, display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Phones: the shell's back bar replaces the breadcrumb; the design keeps its (empty) row. */}
                {compact ? <div aria-hidden="true" /> : (
                    <nav aria-label="이동 경로" style={{ display: 'flex', gap: 8, fontSize: 12, color: MW.mute2, whiteSpace: 'nowrap', minWidth: 0 }}>
                        <Go to="/" style={crumb}>홈</Go>
                        <span aria-hidden="true">›</span>
                        <Go to="/products" style={crumb}>투어 상품</Go>
                        <span aria-hidden="true">›</span>
                        <span style={{ color: MW.navy, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{content.name}</span>
                    </nav>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px 10px', flexWrap: 'wrap' }}>
                            <span style={EYEBROW}>TOUR CATEGORY</span>
                            {content.heroTagline && (
                                <>
                                    <span aria-hidden="true" style={{ width: 24, height: 1.5, background: MW.mint }} />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: MW.mintDeep }}>{content.heroTagline}</span>
                                </>
                            )}
                        </span>
                        <h1 style={{ margin: 0, fontSize: compact ? 'clamp(28px,8.6vw,32px)' : 'clamp(32px,4vw,46px)', fontWeight: 900, lineHeight: 1.2, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>{content.heroTitle}</h1>
                        {content.heroSubtitle && (
                            <p style={{ margin: 0, maxWidth: 640, fontSize: 15, lineHeight: 1.7, color: MW.mute, whiteSpace: 'pre-line' }}>{content.heroSubtitle}</p>
                        )}
                    </div>
                    <CategoryTabs slug={slug} />
                </div>
            </div>
        </section>
    );
}

// ─── Hero ───────────────────────────────────────────────────

const NAV_BTN: CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, padding: 0, border: 0, borderRadius: '50%',
    background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
const NAV_HOVER = hover({ background: '#FFFFFF' }, { background: 'rgba(255,255,255,0.92)' });

export function CategoryHero({ content, compact = false }: BlockProps) {
    const slides = heroSlides(content);
    const count = slides.length;
    const { idx, shown, goTo, prev, next, setPaused } = useHeroSlider(count);
    const touchX = useRef<number | null>(null);

    return (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: `28px ${compact ? 16 : 24}px 0`, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
                onTouchEnd={(e) => {
                    if (touchX.current === null) return;
                    const dx = e.changedTouches[0].clientX - touchX.current;
                    touchX.current = null;
                    if (dx > 40) prev();
                    else if (dx < -40) next();
                }}
                style={{
                    position: 'relative', overflow: 'hidden', background: MW.navySoft,
                    ...(compact ? { aspectRatio: '4/5', maxHeight: 560, borderRadius: 24 } : { aspectRatio: '16/7', minHeight: 320, borderRadius: 32 }),
                }}
            >
                {slides.map((src, i) => shown.includes(i) && (
                    <img
                        key={src + i}
                        src={getOptimizedImageUrl(src, 'heroBanner')}
                        alt={`${content.heroTitle} | 몽골 투어 사진 ${i + 1}`}
                        loading={i === 0 ? 'eager' : 'lazy'}
                        fetchPriority={i === 0 ? 'high' : 'low'}
                        decoding="async"
                        aria-hidden={i !== idx}
                        style={{ ...COVER, opacity: i === idx ? 1 : 0, transition: 'opacity .7s ease' }}
                    />
                ))}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(10,31,46,0) 55%,rgba(10,31,46,0.55) 100%)' }} />

                {count > 1 && (
                    <>
                        <span style={{ position: 'absolute', left: 28, bottom: 26, fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, color: '#FFFFFF', pointerEvents: 'none' }}>
                            {pad2(idx + 1)} / {pad2(count)}
                        </span>
                        <button type="button" onClick={prev} aria-label="이전" style={{ ...NAV_BTN, left: 20 }} {...NAV_HOVER}>
                            <Svg d={P_PREV} size={20} width={2.2} />
                        </button>
                        <button type="button" onClick={next} aria-label="다음" style={{ ...NAV_BTN, right: 20 }} {...NAV_HOVER}>
                            <Svg d={P_NEXT} size={20} width={2.2} />
                        </button>
                        <div style={{ position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                            {slides.map((src, i) => (
                                <button
                                    key={src + i}
                                    type="button"
                                    onClick={() => goTo(i)}
                                    aria-label={`슬라이드 ${i + 1}`}
                                    aria-current={i === idx}
                                    style={{ width: i === idx ? 24 : 6, height: 6, padding: 0, border: 0, borderRadius: 3, background: i === idx ? '#FFFFFF' : 'rgba(255,255,255,0.55)', cursor: 'pointer', transition: 'width .3s' }}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                    type="button"
                    onClick={scrollToLineup}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 26px', border: 0, borderRadius: 999, background: MW_GRADIENT, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    {...hover({ opacity: '0.92' }, { opacity: '1' })}
                >
                    투어 상품 보기
                    <Svg d={P_ARROW} />
                </button>
                <a
                    href={KAKAO_CHANNEL_CHAT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="카카오톡으로 문의"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 24px', border: `1.5px solid ${MW.navy}`, borderRadius: 999, background: '#FFFFFF', fontSize: 15, fontWeight: 700, color: MW.navy, textDecoration: 'none', whiteSpace: 'nowrap' }}
                    {...hover({ background: M_PAPER }, { background: '#FFFFFF' })}
                >
                    <Svg d={P_CHAT} width={1.8} />
                    문의
                </a>
            </div>
        </section>
    );
}

// ─── Experiences (admin highlight sections) ─────────────────

const CLAMP = (lines: number): CSSProperties => ({ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' });

function ExperienceCard({ card, n, fallbackAlt }: { card: HighlightCard; n: number; fallbackAlt: string }) {
    const navigate = useNavigate();
    const link = resolveCardLink(card.link);
    const tags = (card.tags || []).filter(Boolean);
    const frame: CSSProperties = {
        position: 'relative', display: 'block', aspectRatio: '3/4', borderRadius: 28, overflow: 'hidden', background: MW.navySoft, color: '#FFFFFF',
        textDecoration: 'none', transition: 'transform .2s',
    };

    const body = (
        <>
            {card.image && (
                <img
                    src={getOptimizedImageUrl(card.image, 'contentImage')}
                    alt={`${card.title || fallbackAlt} | 몽골 여행 하이라이트`}
                    loading="lazy"
                    decoding="async"
                    style={COVER}
                />
            )}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(10,31,46,0) 40%,rgba(10,31,46,0.88) 100%)' }} />
            <span style={{ position: 'absolute', left: 20, top: 20, fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, color: MW.navy, background: '#FFFFFF', padding: '5px 10px', borderRadius: 999 }}>{pad2(n)}</span>
            {link && (
                <span aria-hidden="true" style={{ position: 'absolute', right: 18, top: 18, width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Svg d={P_ARROW} size={15} />
                </span>
            )}
            <div style={{ position: 'absolute', left: 22, right: 22, bottom: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tags.length > 0 && (
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {tags.map((tag, i) => (
                            <span key={tag + i} style={{ padding: '3px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700 }}>{tag}</span>
                        ))}
                    </span>
                )}
                {card.title && <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, lineHeight: 1.35, ...CLAMP(3) }}>{card.title}</h3>}
                {card.description && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: '#DDE6EC', whiteSpace: 'pre-line', ...CLAMP(5) }}>{card.description}</p>}
            </div>
        </>
    );

    if (!link) return <div style={frame}>{body}</div>;

    const lift = hover({ transform: 'translateY(-4px)' }, { transform: '' });
    return link.external ? (
        <a href={link.href} target="_blank" rel="noopener noreferrer" style={frame} {...lift}>{body}</a>
    ) : (
        <a
            href={link.href}
            onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                navigate(link.href);
                window.scrollTo(0, 0);
            }}
            style={frame}
            {...lift}
        >
            {body}
        </a>
    );
}

export function CategoryExperiences({ content, compact = false }: BlockProps) {
    const sections = visibleHighlights(content);
    if (sections.length === 0) return null;
    const accent = accentOf(content);

    return (
        <>
            {sections.map((s, i) => {
                const n = s.cards.length;
                // PC: up to four across, fewer cards stay card-sized and centred. Mobile: one column on phones.
                const columns = compact
                    ? 'repeat(auto-fill,minmax(min(100%,240px),1fr))'
                    : `repeat(${Math.min(n, 4)},minmax(0,${n < 4 ? '373px' : '1fr'}))`;
                return (
                    <section key={i} style={{ maxWidth: 1200, margin: '0 auto', padding: `${i === 0 ? 96 : 72}px ${compact ? 16 : 24}px 0`, display: 'flex', flexDirection: 'column', gap: 36 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                            {s.label && <span style={{ ...EYEBROW, color: accent }}>{s.label}</span>}
                            {s.title && <h2 style={{ margin: 0, fontSize: 'clamp(24px,2.8vw,32px)', fontWeight: 900, lineHeight: 1.35, textWrap: 'pretty' }}>{s.title}</h2>}
                            {s.subtitle && <p style={{ margin: 0, maxWidth: 640, fontSize: 14, lineHeight: 1.8, color: MW.mute, whiteSpace: 'pre-line' }}>{s.subtitle}</p>}
                        </div>
                        {n > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: columns, justifyContent: 'center', gap: 16 }}>
                                {s.cards.map((card, j) => (
                                    <ExperienceCard key={j} card={card} n={j + 1} fallbackAlt={s.title || content.heroTitle} />
                                ))}
                            </div>
                        )}
                    </section>
                );
            })}
        </>
    );
}

// ─── Lineup ─────────────────────────────────────────────────

/** Heading of the tour lineup; `count` is omitted while the tours are loading. */
export function CategoryLineupHead({ title, count }: { title: string; count?: number }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <span style={EYEBROW}>TOUR LINEUP</span>
                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{title}</h2>
                {count !== undefined && (
                    <span style={{ fontSize: 13, color: MW.mute }}>
                        <strong style={{ color: MW.navy }}>{count}개</strong>의 투어
                    </span>
                )}
            </div>
            <Go
                to="/products"
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 44, padding: '0 20px', border: `1.5px solid ${MW.line}`, borderRadius: 999, fontSize: 13, fontWeight: 700, color: MW.navy, whiteSpace: 'nowrap' }}
                hoverStyle={[{ borderColor: MW.mint }, { borderColor: MW.line }]}
            >
                전체 투어
                <Svg d={P_ARROW} size={15} />
            </Go>
        </div>
    );
}

/** Shown when the category has no published tour yet. */
export function CategoryLineupEmpty() {
    const btn: CSSProperties = { display: 'flex', alignItems: 'center', height: 46, padding: '0 22px', borderRadius: 999, fontSize: 14, fontWeight: 700, color: MW.navy, whiteSpace: 'nowrap' };
    return (
        <div style={{ padding: '56px 24px', borderRadius: 24, background: M_PAPER, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: MW.mute }}>
                현재 이 카테고리의 투어를 준비하고 있습니다.
                <br />
                다른 투어를 둘러보시거나 맞춤 견적으로 상담해 주세요.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Go to="/products" style={{ ...btn, border: `1.5px solid ${MW.line2}`, background: '#FFFFFF' }}>전체 투어 보기</Go>
                <Go to="/custom-estimate" style={{ ...btn, background: MW_GRADIENT }}>맞춤 견적 요청하기</Go>
            </div>
        </div>
    );
}

// ─── CTA ────────────────────────────────────────────────────

export function CategoryQuoteCta({ content, compact = false }: BlockProps) {
    return (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: compact ? '80px 16px 40px' : '80px 24px 104px' }}>
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 32, background: `linear-gradient(135deg,${MW.navySoft} 0%,${MW.mintDeep} 100%)`, padding: compact ? '28px 22px' : '40px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap', color: '#FFFFFF' }}>
                <span aria-hidden="true" style={{ position: 'absolute', right: -100, top: -120, width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle,rgba(109,219,190,0.35),rgba(109,219,190,0) 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                    <span style={{ ...EYEBROW, color: MW.mintLight }}>CUSTOM TOUR</span>
                    <h2 style={{ margin: 0, fontSize: 'clamp(22px,2.4vw,28px)', fontWeight: 900, lineHeight: 1.4 }}>{content.heroTitle}, 나만의 플랜으로</h2>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: MW.mintTint }}>인원·기간·예산을 알려 주세요. 한국어 담당 직원이 24시간 이내에 견적을 보내 드립니다.</p>
                </div>
                <Go
                    to="/custom-estimate"
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, padding: '0 28px', borderRadius: 999, background: '#FFFFFF', fontSize: 15, fontWeight: 700, color: MW.navy, flexShrink: 0, whiteSpace: 'nowrap' }}
                    hoverStyle={[{ background: MW.mintBg }, { background: '#FFFFFF' }]}
                >
                    1분 만에 요청하기
                    <Svg d={P_ARROW} />
                </Go>
            </div>
        </section>
    );
}
