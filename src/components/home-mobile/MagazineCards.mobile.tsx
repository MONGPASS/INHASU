import type { HomeData } from '../../hooks/useHomeData';
import { cleanTitle, isUsableImage } from '../desktop-primitives/mwTokens';
import { MAGAZINE_TINTS } from '../home/homeContent';
import { MPhoto } from '../mobile/mobileUi';
import { SD } from '../site-seed/seed';
import { linkTo, useGo } from './homeMobileData';
import { HSCROLL, SectionHeadMobile } from './SectionHead.mobile';

/** 몽골 여행 매거진(휴대폰): 세로로 긴 사진 카드(아래쪽 색 덮개 + 분류·제목)를 옆으로 넘긴다. */
export function MagazineCardsMobile({ magazines }: { magazines: HomeData['magazines'] }) {
    const go = useGo();
    const items = magazines.slice(0, 8);
    if (items.length === 0) return null;

    return (
        <section id="magazine" aria-label="여행 매거진" style={{ paddingTop: 44, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeadMobile icon="bookOpen" title="몽골 여행 매거진" sub="함께 떠나는 사람에 맞춰 고른 몽골 여행 이야기" link="/travel-guide" />
            <div data-noscroll="" style={{ ...HSCROLL, gap: 12 }}>
                {items.map((m, i) => {
                    const title = cleanTitle(m.title);
                    const tint = MAGAZINE_TINTS[i % MAGAZINE_TINTS.length];
                    return (
                        <a key={m.id} {...linkTo(go, `/travel-guide/${m.id}`)} style={{ position: 'relative', flex: '0 0 240px', height: 320, borderRadius: 10, overflow: 'hidden', display: 'block', textDecoration: 'none', background: `rgb(${tint})` }}>
                            {isUsableImage(m.image) && <MPhoto src={m.image} alt={title} sizes="240px" />}
                            <span style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(${tint},0) 40%, rgba(${tint},0.85) 62%, rgb(${tint}) 76%)` }} />
                            <span style={{ position: 'absolute', left: 20, right: 20, bottom: 24, display: 'flex', flexDirection: 'column', gap: 6, color: SD.white }}>
                                {m.category && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.88)' }}>{m.category}</span>}
                                <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'keep-all' }}>{title}</span>
                            </span>
                        </a>
                    );
                })}
            </div>
        </section>
    );
}
