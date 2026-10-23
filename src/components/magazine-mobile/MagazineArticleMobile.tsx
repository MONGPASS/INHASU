import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MW, MW_FONT_EN, cleanTitle, isUsableImage } from '../desktop-primitives/mwTokens';
import { EDITORIAL, SITE, categoryLabel, formatDate } from '../magazine/magazineShared';
import { useRelatedTourMatches } from '../magazine/relatedTourMatches';
import type { ArticleData } from '../magazine-desktop/MagazineArticleDesktop';
import type { MagazineListItem } from '../magazine-desktop/MagazineListDesktop';
import { useMobileShell } from '../mobile/mobileShellContext';
import { M_GRADIENT, M_HAIR } from '../mobile/mobileTheme';
import { durationLabel } from '../tours-mobile/tourListFilters';
import { StartingPrice } from '../product/StartingPrice';
import { MagazineQuoteCta } from './MagazineQuoteCta';
import { BODY_HEADING_SKIP, buildToc } from './magazineMobile';

interface Props {
    magazine: ArticleData;
    /** Sanitised article body (sliders / location cards already expanded). */
    body: ReactNode;
    faqs: { question: string; answer: string }[];
    more: MagazineListItem[];
    prev?: { id: string; title: string };
    next?: { id: string; title: string };
}

const CLAMP = (lines: number) => ({ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) as const;

/** Mobile 여행 가이드(매거진) article (Claude Design: "M Article"). Same data and behaviour as the PC article page. */
export function MagazineArticleMobile({ magazine, body, faqs, more, prev, next }: Props) {
    const navigate = useNavigate();
    const { stickyTop } = useMobileShell();
    const bodyRef = useRef<HTMLDivElement>(null);
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

    const toc = useMemo(() => buildToc(magazine.content), [magazine.content]);

    /** Scroll to the n-th non-empty heading of the rendered body, clear of the sticky header. */
    const jump = (n: number) => {
        const headings = [...(bodyRef.current?.querySelectorAll('h2, h3') ?? [])].filter(
            (el) => !el.closest(BODY_HEADING_SKIP) && (el.textContent || '').trim(),
        );
        const el = headings[n];
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - stickyTop - 16, behavior: 'smooth' });
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
    const go = (path: string) => {
        navigate(path);
        window.scrollTo(0, 0);
    };

    return (
        <>
            <article style={{ padding: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <header style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {magazine.category && <span style={{ fontSize: 11, fontWeight: 700, color: MW.mintDeep, background: MW.mintTint, padding: '4px 10px', borderRadius: 999 }}>{categoryLabel(magazine.category)}</span>}
                        {date && <time dateTime={magazine.createdAt} style={{ fontFamily: MW_FONT_EN, fontSize: 11, color: MW.mute }}>{date}</time>}
                    </div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, lineHeight: 1.4, textWrap: 'pretty' }}>{title}</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={authorName} image={magazine.authorImage} size={32} fontSize={13} />
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{authorName}</span>
                    </div>
                </header>

                {isUsableImage(magazine.image) && (
                    <div style={{ aspectRatio: '4/3', overflow: 'hidden', background: MW.chip }}>
                        <img src={magazine.image} alt={`${title} | 몽골 여행 가이드`} fetchPriority="high" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                )}

                <div style={{ padding: '4px 16px 0', display: 'flex', flexDirection: 'column', gap: 20, fontSize: 15, lineHeight: 1.95, color: MW.ink2 }}>
                    {/* No separate lead paragraph: article bodies open with their own intro (same as PC). */}
                    {toc.length >= 2 && (
                        <nav aria-label="목차" style={{ border: `1.5px solid ${MW.line}`, borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep, marginBottom: 4 }}>CONTENTS</span>
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
                                            style={{ display: 'flex', gap: 10, alignItems: 'baseline', border: 0, background: 'transparent', padding: h2 ? '6px 0' : '4px 0 4px 26px', textAlign: 'left', fontSize: h2 ? 14 : 13, fontWeight: h2 ? 700 : 400, color: h2 ? MW.navy : MW.mute, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.5 }}
                                        >
                                            {h2 && <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, color: MW.mintDeep, flexShrink: 0 }}>{String(n).padStart(2, '0')}</span>}
                                            {it.text}
                                        </button>
                                    );
                                });
                            })()}
                        </nav>
                    )}

                    <div ref={bodyRef} className="mw-article mw-article-m">
                        {body}
                    </div>

                    <div style={{ marginTop: 12, border: `1.5px solid ${MW.line}`, borderRadius: 18, padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <Avatar name={authorName} image={magazine.authorImage} size={44} fontSize={17} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.65, minWidth: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: MW.mintDeep }}>이 기사의 집필·감수</span>
                            <span style={{ fontSize: 14, fontWeight: 900, color: MW.navy }}>{authorName}</span>
                            <span style={{ fontSize: 12, color: MW.mute }}>몽골 현지 여행 정보와 투어 운영 경험을 바탕으로, 여행 전에 도움이 되는 정보를 확인해 전해 드립니다.</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                        <button type="button" style={shareBtn} onClick={() => share(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`)}>X</button>
                        <button type="button" style={shareBtn} onClick={copyLink}>{copied ? '복사됨' : '링크 복사'}</button>
                    </div>

                    {(prev || next) && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                            {prev && (
                                <a href={`/travel-guide/${prev.id}`} onClick={(e) => { e.preventDefault(); go(`/travel-guide/${prev.id}`); }} style={{ ...pager, gridColumn: 1 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: MW.mintDeep }}>← 이전 기사</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, ...CLAMP(2) }}>{cleanTitle(prev.title)}</span>
                                </a>
                            )}
                            {next && (
                                <a href={`/travel-guide/${next.id}`} onClick={(e) => { e.preventDefault(); go(`/travel-guide/${next.id}`); }} style={{ ...pager, gridColumn: 2, textAlign: 'right' }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: MW.mintDeep }}>다음 기사 →</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, ...CLAMP(2) }}>{cleanTitle(next.title)}</span>
                                </a>
                            )}
                        </div>
                    )}
                </div>

                {tours.length > 0 && (
                    <section style={{ marginTop: 20, paddingTop: 28, borderTop: `1px solid ${MW.line}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={eyebrow}>TOURS</span>
                            <h2 style={h2}>추천 몽골 투어</h2>
                        </div>
                        <div data-noscroll="" style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', padding: '0 16px', scrollPadding: '0 16px' }}>
                            {tours.map((t) => (
                                <a
                                    key={t.id}
                                    href={`/products/${t.id}`}
                                    onClick={(e) => { e.preventDefault(); go(`/products/${t.id}`); }}
                                    style={{ flex: '0 0 58%', minWidth: 0, scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', gap: 6, color: MW.navy, textDecoration: 'none' }}
                                >
                                    <div style={{ aspectRatio: '1/1', borderRadius: 16, overflow: 'hidden', background: MW.chip }}>
                                        {isUsableImage(t.mainImages[0]) && (
                                            <img src={t.mainImages[0]} alt={`${t.name} | ${t.category}`} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        )}
                                    </div>
                                    <span style={{ fontSize: 11, color: MW.mute, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[t.category, durationLabel(t.duration)].filter(Boolean).join(' | ')}</span>
                                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</h3>
                                    <StartingPrice product={t} amountStyle={{ fontSize: 17, fontWeight: 900 }} />
                                </a>
                            ))}
                        </div>
                    </section>
                )}

                {faqs.length > 0 && (
                    <section aria-labelledby="magazine-faq-heading" style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={eyebrow}>FAQ</span>
                            <h2 id="magazine-faq-heading" style={h2}>자주 묻는 질문</h2>
                        </div>
                        <div style={{ borderTop: `1px solid ${M_HAIR}` }}>
                            {faqs.map((f) => (
                                <details key={f.question} className="mw-faq" style={{ borderBottom: `1px solid ${M_HAIR}`, padding: '14px 0' }}>
                                    <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, cursor: 'pointer', listStyle: 'none', fontSize: 14, fontWeight: 700, lineHeight: 1.6, color: MW.navy }}>
                                        <span style={{ display: 'flex', gap: 10, alignItems: 'baseline', minWidth: 0 }}>
                                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, color: MW.mintDeep, flexShrink: 0 }}>Q</span>
                                            {f.question}
                                        </span>
                                        <span aria-hidden="true" className="mw-faq-mark" style={{ color: MW.mintDeep, fontSize: 16, flexShrink: 0 }}>+</span>
                                    </summary>
                                    <p style={{ margin: '10px 0 0 22px', fontSize: 13, lineHeight: 1.85, color: MW.ink2 }}>{f.answer}</p>
                                </details>
                            ))}
                        </div>
                    </section>
                )}

                {more.length > 0 && (
                    <section style={{ padding: '12px 16px 20px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                            <h2 style={h2}>다른 기사</h2>
                            <a href="/travel-guide" onClick={(e) => { e.preventDefault(); go('/travel-guide'); }} style={{ fontSize: 12, fontWeight: 700, color: MW.navy, textDecoration: 'none' }}>전체 →</a>
                        </div>
                        {more.map((m) => {
                            const t = cleanTitle(m.title);
                            return (
                                <a
                                    key={m.id}
                                    href={`/travel-guide/${m.id}`}
                                    onClick={(e) => { e.preventDefault(); go(`/travel-guide/${m.id}`); }}
                                    style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr)', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${M_HAIR}`, color: MW.navy, textDecoration: 'none' }}
                                >
                                    <div style={{ aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', pointerEvents: 'none', background: MW.chip }}>
                                        {isUsableImage(m.image) && (
                                            <img src={m.image} alt={`${t} | 몽골 여행 가이드`} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        )}
                                    </div>
                                    <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.5, ...CLAMP(3) }}>{t}</span>
                                </a>
                            );
                        })}
                    </section>
                )}
            </article>

            <MagazineQuoteCta />
        </>
    );
}

function Avatar({ name, image, size, fontSize }: { name: string; image?: string; size: number; fontSize: number }) {
    if (isUsableImage(image)) {
        return <img src={image} alt={`${name} | 몽골 여행 기사 작성자`} width={size} height={size} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
    }
    return (
        <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: M_GRADIENT, color: MW.navy, fontSize, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {name.slice(0, 1)}
        </span>
    );
}

const eyebrow: CSSProperties = { fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep };
const h2: CSSProperties = { margin: 0, fontSize: 19, fontWeight: 900 };
const shareBtn: CSSProperties = { height: 44, border: `1.5px solid ${MW.line}`, borderRadius: 12, background: '#fff', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer', fontFamily: 'inherit' };
const pager: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, padding: 14, border: `1.5px solid ${MW.line}`, borderRadius: 16, color: MW.navy, minWidth: 0, textDecoration: 'none' };
