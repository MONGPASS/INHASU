import { useNavigate } from 'react-router-dom';
import { ResponsiveProductImage } from '../common/ResponsiveProductImage';
import type { HomeData } from '../../hooks/useHomeData';
import { MW, MW_EYEBROW, MW_FONT_EN, MW_SEE_ALL, cleanTitle, isUsableImage } from '../desktop-primitives/mwTokens';

interface Props {
    magazines: HomeData['magazines'];
}

export function MagazineCardsDesktop({ magazines }: Props) {
    const navigate = useNavigate();
    const items = magazines.slice(0, 3);
    if (items.length === 0) return null;

    return (
        <section id="magazine" style={{ maxWidth: 1200, margin: '0 auto', padding: '104px 24px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', marginBottom: 28 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={MW_EYEBROW}>TRAVEL MAGAZINE</span>
                    <h2 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>지금 떠나기 좋은 여행 코스</h2>
                    <p style={{ margin: 0, fontSize: 14, color: MW.mute }}>몽골리아 은하수가 엄선한 최고의 여행지</p>
                </div>
                <a href="/travel-guide" onClick={(e) => { e.preventDefault(); navigate('/travel-guide'); }} style={MW_SEE_ALL}>
                    전체 보기 →
                </a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 20 }}>
                {items.map((m) => {
                    const title = cleanTitle(m.title);
                    return (
                        <a
                            key={m.id}
                            href={`/travel-guide/${m.id}`}
                            onClick={(e) => { e.preventDefault(); navigate(`/travel-guide/${m.id}`); }}
                            style={{ position: 'relative', display: 'block', aspectRatio: '3/4', borderRadius: 24, overflow: 'hidden', color: '#fff', background: MW.navySoft, transition: 'transform .2s', textDecoration: 'none' }}
                            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
                        >
                            {isUsableImage(m.image) && (
                                <ResponsiveProductImage src={m.image} alt={title} sizes="(max-width: 640px) calc(100vw - 48px), 384px" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '30%', pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(10,31,46,0.35) 0%,rgba(10,31,46,0) 100%)' }} />
                            {/* Partial gradient behind the text only — the photo above stays sharp. */}
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    height: '65%',
                                    pointerEvents: 'none',
                                    background: 'linear-gradient(180deg,rgba(10,31,46,0) 0%,rgba(10,31,46,0.18) 25%,rgba(10,31,46,0.5) 50%,rgba(10,31,46,0.78) 75%,rgba(10,31,46,0.92) 100%)',
                                }}
                            />
                            <div style={{ position: 'absolute', left: 18, right: 18, top: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)', padding: '5px 9px', borderRadius: 6 }}>
                                    MAGAZINE
                                </span>
                                <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: '50%', background: MW.mint, color: MW.navy, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    ✈
                                </span>
                            </div>
                            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '22px 22px 24px', display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
                                {m.category && (
                                    <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, color: MW.navy, background: '#fff', padding: '4px 10px', borderRadius: 999 }}>{m.category}</span>
                                )}
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.5, height: '3em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {title}
                                </h3>
                                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, height: '3.4em', color: '#DDE6EC', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {m.description}
                                </p>
                            </div>
                        </a>
                    );
                })}
            </div>
        </section>
    );
}
