import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRelatedTourMatches } from '../magazine/relatedTourMatches';
import { MW, MW_FONT_EN, MW_GRADIENT, MW_SEE_ALL, MW_STICKY_TOP, cleanTitle, isUsableImage, won } from '../desktop-primitives/mwTokens';
import { EDITORIAL, SITE, categoryLabel, formatDate } from '../magazine/magazineShared';
import { durationLabel } from '../tours-mobile/tourListFilters';
import { ArticleCard, type MagazineListItem } from './MagazineListDesktop';

export interface ArticleData {
    id: string;
    title: string;
    description: string;
    content: string;
    category: string;
    image: string;
    tag?: string;
    author?: string;
    authorImage?: string;
    createdAt: string;
}

interface Props {
    magazine: ArticleData;
    /** Sanitised article body (sliders / location cards already expanded). */
    body: ReactNode;
    faqs: { question: string; answer: string }[];
    more: MagazineListItem[];
    prev?: { id: string; title: string };
    next?: { id: string; title: string };
}

interface TocItem {
    text: string;
    level: 2 | 3;
}

export function MagazineArticleDesktop({ magazine, body, faqs, more, prev, next }: Props) {
    const navigate = useNavigate();
    const bodyRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);

    const title = cleanTitle(magazine.title);
    const authorName = magazine.author?.trim() || EDITORIAL;
    const date = formatDate(magazine.createdAt);
    const url = `${SITE}/travel-guide/${magazine.id}`;

    const tours = useRelatedTourMatches({
        category: magazine.category,
        tag: magazine.tag,
        title: magazine.title,
        description: `${magazine.description} ${magazine.content.replace(/<[^>]+>/g, ' ').slice(0, 500)}`,
    });

    // Reading progress bar.
    useEffect(() => {
        const onScroll = () => {
            const h = document.documentElement.scrollHeight - window.innerHeight;
            if (barRef.current) barRef.current.style.width = `${h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0}%`;
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Table of contents from the article's own h2/h3 headings.
    const toc = useMemo<TocItem[]>(() => {
        const doc = new DOMParser().parseFromString(magazine.content || '', 'text/html');
        return [...doc.querySelectorAll('h2, h3')]
            .map((el) => ({ text: (el.textContent || '').trim(), level: (el.tagName === 'H2' ? 2 : 3) as 2 | 3 }))
            .filter((it) => it.text);
    }, [magazine.content]);

    /** Scroll to the n-th non-empty heading of the rendered body. */
    const jump = (n: number) => {
        const headings = [...(bodyRef.current?.querySelectorAll('h2, h3') ?? [])].filter((el) => (el.textContent || '').trim());
        const el = headings[n];
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - MW_STICKY_TOP - 32, behavior: 'smooth' });
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            /* clipboard blocked — nothing to do */
        }
    };

    const share = (href: string) => window.open(href, '_blank', 'noopener,noreferrer');
    const go = (path: string) => navigate(path);

    return (
        <>
            <div aria-hidden="true" style={{ position: 'fixed', left: 0, top: 0, height: 3, width: '100%', zIndex: 60, pointerEvents: 'none' }}>
                <div ref={barRef} style={{ height: '100%', width: 0, background: MW_GRADIENT, borderRadius: '0 3px 3px 0' }} />
            </div>

            <article style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 0' }}>
                <nav aria-label="현재 위치" style={{ display: 'flex', gap: 8, fontSize: 13, color: MW.mute, flexWrap: 'wrap', minWidth: 0 }}>
                    <a href="/" onClick={(e) => { e.preventDefault(); go('/'); }} style={crumb}>홈</a>
                    <span>›</span>
                    <a href="/travel-guide" onClick={(e) => { e.preventDefault(); go('/travel-guide'); }} style={crumb}>여행 가이드</a>
                    <span>›</span>
                    <span style={{ color: MW.navy, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>{title}</span>
                </nav>

                <header style={{ maxWidth: 880, margin: '40px 0 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        {magazine.category && <span style={{ fontSize: 12, fontWeight: 700, color: MW.mintDeep, background: MW.mintTint, padding: '5px 12px', borderRadius: 999 }}>{categoryLabel(magazine.category)}</span>}
                        {date && <time dateTime={magazine.createdAt} style={{ fontFamily: MW_FONT_EN, fontSize: 12, color: MW.mute }}>{date}</time>}
                    </div>
                    <h1 style={{ margin: 0, fontSize: 'clamp(28px,3.8vw,46px)', fontWeight: 900, lineHeight: 1.35 }}>{title}</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar name={authorName} image={magazine.authorImage} size={36} />
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{authorName}</span>
                    </div>
                </header>

                {isUsableImage(magazine.image) && (
                    <div style={{ marginTop: 36, aspectRatio: '21/9', borderRadius: 32, overflow: 'hidden', background: MW.mintTint }}>
                        <img src={magazine.image} alt={`${title} | 몽골 여행 가이드`} fetchPriority="high" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 64, alignItems: 'flex-start', paddingTop: 56 }}>
                    <div style={{ flex: '1 1 600px', minWidth: 0, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 26 }}>
                        {/* No separate lead paragraph: article bodies open with their own intro,
                            and the owner asked not to repeat it (same as the mobile page). */}
                        <div ref={bodyRef} className="mw-article">
                            {body}
                        </div>

                        <div style={{ marginTop: 32, border: `1.5px solid ${MW.line}`, borderRadius: 24, padding: 26, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                            <Avatar name={authorName} image={magazine.authorImage} size={56} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.7 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: MW.mintDeep }}>이 기사의 집필·감수</span>
                                <span style={{ fontSize: 16, fontWeight: 900, color: MW.navy }}>{authorName}</span>
                                <span style={{ fontSize: 13, color: MW.mute }}>몽골 현지 여행 정보와 투어 운영 경험을 바탕으로, 여행 전에 도움이 되는 정보를 확인해 전해 드립니다.</span>
                            </div>
                        </div>

                        {(prev || next) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                                {prev && <PagerLink label="← 이전 기사" title={prev.title} align="left" onClick={() => go(`/travel-guide/${prev.id}`)} href={`/travel-guide/${prev.id}`} />}
                                {next && <PagerLink label="다음 기사 →" title={next.title} align="right" onClick={() => go(`/travel-guide/${next.id}`)} href={`/travel-guide/${next.id}`} />}
                            </div>
                        )}
                    </div>

                    <aside style={{ flex: '0 1 300px', minWidth: 260, position: 'sticky', top: MW_STICKY_TOP + 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {toc.length >= 2 && (
                            <nav aria-label="목차" style={{ ...box, gap: 6, maxHeight: '45vh', overflowY: 'auto' }}>
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep, marginBottom: 6 }}>CONTENTS</span>
                                {(() => {
                                    let n = 0;
                                    return toc.map((it, i) => {
                                        const h2 = it.level === 2;
                                        if (h2) n += 1;
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => jump(i)}
                                                style={{ display: 'flex', gap: 10, alignItems: 'baseline', border: 0, background: 'transparent', padding: h2 ? '6px 0' : '4px 0 4px 26px', textAlign: 'left', fontSize: h2 ? 14 : 13, fontWeight: h2 ? 700 : 500, color: h2 ? MW.navy : MW.mute, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.5 }}
                                                onMouseEnter={(e) => (e.currentTarget.style.color = MW.mintDeep)}
                                                onMouseLeave={(e) => (e.currentTarget.style.color = h2 ? MW.navy : MW.mute)}
                                            >
                                                {h2 && <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, color: MW.mintDeep }}>{String(n).padStart(2, '0')}</span>}
                                                {it.text}
                                            </button>
                                        );
                                    });
                                })()}
                            </nav>
                        )}
                        <div style={{ ...box, gap: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: MW.navy }}>이 기사 공유하기</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <ShareButton onClick={() => share(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`)}>X</ShareButton>
                                <ShareButton onClick={copyLink}>{copied ? '복사됨' : '링크 복사'}</ShareButton>
                            </div>
                        </div>
                        <div style={{ borderRadius: 22, padding: 24, background: 'radial-gradient(260px 180px at 100% 0%,rgba(39,171,143,0.18),rgba(39,171,143,0) 70%),#FFFFFF', border: `1.5px solid ${MW.mintTint}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>CUSTOM TOUR</span>
                            <span style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.5 }}>나만의 특별한 플랜을 1분 만에 요청하세요</span>
                            <span style={{ fontSize: 13, lineHeight: 1.7, color: MW.mute }}>한국어 스태프가 24시간 이내에 답변드립니다. 견적은 무료입니다.</span>
                            <a
                                href="/custom-estimate"
                                onClick={(e) => { e.preventDefault(); go('/custom-estimate'); }}
                                style={{ marginTop: 4, textAlign: 'center', background: MW_GRADIENT, color: MW.navy, fontWeight: 700, fontSize: 14, padding: '13px 20px', borderRadius: 999, boxShadow: '0 8px 20px rgba(39,171,143,0.28)', textDecoration: 'none' }}
                            >
                                맞춤 견적
                            </a>
                        </div>
                    </aside>
                </div>

                {tours.length > 0 && (
                    <section style={{ marginTop: 96, paddingTop: 56, borderTop: `1px solid ${MW.line}`, display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <SectionTitle en="TOURS" title="추천 몽골 투어" />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,240px),1fr))', gap: 24 }}>
                            {tours.map((t) => (
                                <a
                                    key={t.id}
                                    href={`/products/${t.id}`}
                                    onClick={(e) => { e.preventDefault(); go(`/products/${t.id}`); }}
                                    style={{ display: 'flex', flexDirection: 'column', gap: 10, color: MW.navy, transition: 'transform .2s', textDecoration: 'none' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
                                >
                                    <div style={{ aspectRatio: '1/1', borderRadius: 22, overflow: 'hidden', background: MW.mintTint }}>
                                        {isUsableImage(t.mainImages[0]) && (
                                            <img src={t.mainImages[0]} alt={`${t.name} | ${t.category}`} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        )}
                                    </div>
                                    <span style={{ fontSize: 12, color: MW.mute, marginTop: 4 }}>{[t.category, durationLabel(t.duration)].filter(Boolean).join(' | ')}</span>
                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</h3>
                                    {t.price > 0 && (
                                        <span style={{ fontSize: 19, fontWeight: 900 }}>
                                            {won(t.price)}<span style={{ fontSize: 13 }}>~</span>
                                        </span>
                                    )}
                                </a>
                            ))}
                        </div>
                    </section>
                )}

                {faqs.length > 0 && (
                    <section aria-labelledby="magazine-faq-heading" style={{ marginTop: 88, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 880 }}>
                        <SectionTitle en="FAQ" title="자주 묻는 질문" id="magazine-faq-heading" />
                        <div style={{ borderTop: `1px solid ${MW.line}` }}>
                            {faqs.map((f) => (
                                <details key={f.question} className="mw-faq" style={{ borderBottom: `1px solid ${MW.line}`, padding: '18px 4px' }}>
                                    <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, cursor: 'pointer', listStyle: 'none', fontSize: 16, fontWeight: 700, color: MW.navy }}>
                                        <span style={{ display: 'flex', gap: 12 }}>
                                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 14, color: MW.mintDeep }}>Q</span>
                                            {f.question}
                                        </span>
                                        <span aria-hidden="true" className="mw-faq-mark" style={{ color: MW.mintDeep, fontSize: 18, flexShrink: 0 }}>+</span>
                                    </summary>
                                    <p style={{ margin: '12px 0 0 26px', fontSize: 14, lineHeight: 1.9, color: MW.ink2 }}>{f.answer}</p>
                                </details>
                            ))}
                        </div>
                    </section>
                )}

                {more.length > 0 && (
                    <section style={{ margin: '88px 0 104px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
                            <SectionTitle en="MORE STORIES" title="다른 기사" />
                            <a href="/travel-guide" onClick={(e) => { e.preventDefault(); go('/travel-guide'); }} style={MW_SEE_ALL}>전체 보기 →</a>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))', gap: '40px 24px' }}>
                            {more.map((m) => (
                                <ArticleCard key={m.id} m={m} onOpen={() => go(`/travel-guide/${m.id}`)} />
                            ))}
                        </div>
                    </section>
                )}
                {more.length === 0 && <div style={{ height: 104 }} />}
            </article>
        </>
    );
}

function Avatar({ name, image, size }: { name: string; image?: string; size: number }) {
    if (isUsableImage(image)) {
        return <img src={image} alt={`${name} | 몽골 여행 기사 작성자`} width={size} height={size} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
    }
    return (
        <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: MW_GRADIENT, color: MW.navy, fontSize: size * 0.38, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {name.slice(0, 1)}
        </span>
    );
}

function PagerLink({ label, title, align, href, onClick }: { label: string; title: string; align: 'left' | 'right'; href: string; onClick: () => void }) {
    return (
        <a
            href={href}
            onClick={(e) => { e.preventDefault(); onClick(); }}
            style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, padding: '20px 22px', border: `1.5px solid ${MW.line}`, borderRadius: 20, color: MW.navy, textAlign: align, textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = MW.mint)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = MW.line)}
        >
            <span style={{ fontSize: 12, fontWeight: 700, color: MW.mintDeep }}>{label}</span>
            <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{cleanTitle(title)}</span>
        </a>
    );
}

function ShareButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{ flex: 1, height: 44, border: `1.5px solid ${MW.line}`, borderRadius: 12, background: '#fff', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer', fontFamily: 'inherit' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = MW.mint)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = MW.line)}
        >
            {children}
        </button>
    );
}

function SectionTitle({ en, title, id }: { en: string; title: string; id?: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>{en}</span>
            <h2 id={id} style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>{title}</h2>
        </div>
    );
}

const crumb: CSSProperties = { color: MW.mute, textDecoration: 'none' };
const box: CSSProperties = { border: `1.5px solid ${MW.line}`, borderRadius: 22, padding: 22, display: 'flex', flexDirection: 'column' };
