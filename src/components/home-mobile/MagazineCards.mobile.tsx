import type { HomeData } from '../../hooks/useHomeData';
import { MW, MW_FONT_EN, cleanTitle, isUsableImage } from '../desktop-primitives/mwTokens';
import { MPhoto } from '../mobile/mobileUi';
import { linkTo, useGo } from './homeMobileData';
import { SectionHeadMobile } from './SectionHead.mobile';

const PLANE = 'M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z';

/** "TRAVEL MAGAZINE": swipeable portrait cards for the latest articles. */
export function MagazineCardsMobile({ magazines }: { magazines: HomeData['magazines'] }) {
    const go = useGo();
    const items = magazines.slice(0, 3);
    if (items.length === 0) return null;

    return (
        <section id="magazine" style={{ padding: '48px 0 0' }}>
            <SectionHeadMobile eyebrow="TRAVEL MAGAZINE" title="지금 떠나기 좋은 여행 코스" link="/travel-guide" />

            <div data-noscroll="" style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', padding: '18px 16px 0', scrollPadding: '0 16px' }}>
                {items.map((m) => {
                    const title = cleanTitle(m.title);
                    return (
                        <a
                            key={m.id}
                            {...linkTo(go, `/travel-guide/${m.id}`)}
                            style={{ position: 'relative', flex: '0 0 76%', aspectRatio: '3/4', borderRadius: 22, overflow: 'hidden', scrollSnapAlign: 'start', color: '#fff', background: MW.navySoft, textDecoration: 'none' }}
                        >
                            {isUsableImage(m.image) && <MPhoto src={m.image} alt={title} />}
                            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(10,31,46,0.3) 0%,rgba(10,31,46,0) 30%,rgba(10,31,46,0) 45%,rgba(10,31,46,0.9) 100%)' }} />
                            <div style={{ position: 'absolute', left: 16, right: 16, top: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', background: 'rgba(255,255,255,0.2)', padding: '5px 8px', borderRadius: 6 }}>MAGAZINE</span>
                                <span style={{ width: 36, height: 36, borderRadius: '50%', background: MW.mint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill={MW.navy} aria-hidden="true">
                                        <path d={PLANE} />
                                    </svg>
                                </span>
                            </div>
                            <div style={{ position: 'absolute', left: 18, right: 18, bottom: 18, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
                                {m.category && (
                                    <span style={{ alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, color: MW.navy, background: '#fff', padding: '3px 9px', borderRadius: 999 }}>{m.category}</span>
                                )}
                                <h3 style={{ margin: 0, fontSize: 'clamp(14px,4.2vw,16px)', fontWeight: 900, lineHeight: 1.45, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {title}
                                </h3>
                                {m.description && (
                                    <span style={{ fontSize: 12, lineHeight: 1.6, color: '#D6DEE3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.description}</span>
                                )}
                            </div>
                        </a>
                    );
                })}
            </div>
        </section>
    );
}
