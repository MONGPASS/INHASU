import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveProductImage } from '../common/ResponsiveProductImage';
import type { HomeData } from '../../hooks/useHomeData';
import { cleanTitle, isUsableImage } from '../desktop-primitives/mwTokens';
import { SD, SD_CONTAINER, SRoundButton, SSectionHead } from '../site-seed/seed';
import { MAGAZINE_TINTS } from '../home/homeContent';
import { SeeAllLink } from './TourCard.desktop';

interface Props {
    magazines: HomeData['magazines'];
}

const CARD = 340, GAP = 20;

/** 몽골 찐 여행 정보: 세로로 긴 사진 카드(아래쪽 색 덮개 + 분류·제목)를 옆으로 넘긴다. 아래에 번호·진행 선·이전·다음. */
export function MagazineCardsDesktop({ magazines }: Props) {
    const navigate = useNavigate();
    const items = magazines.slice(0, 8);
    const viewport = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);
    const [room, setRoom] = useState(0);

    useEffect(() => {
        const measure = () => {
            const width = viewport.current?.clientWidth || 0;
            setRoom(Math.max(0, items.length * CARD + Math.max(0, items.length - 1) * GAP - width));
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [items.length]);

    if (items.length === 0) return null;

    const n = items.length;
    const shift = n > 1 ? Math.round((room * index) / (n - 1)) : 0;
    const pad = (value: number) => String(value).padStart(2, '0');

    return (
        <section id="magazine" aria-label="여행 매거진" style={{ ...SD_CONTAINER, paddingBottom: 96, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <SSectionHead icon="bookOpen" title="몽골 찐 여행 정보" sub="몽골 떠나기 전에 알고 가면 좋은 꿀팁들" more={<SeeAllLink to="/travel-guide" />} />
            <div ref={viewport} role="region" aria-label="여행 매거진 목록" style={{ overflow: 'hidden', marginRight: -32, paddingRight: 32 }}>
                <div style={{ display: 'flex', gap: GAP, transition: 'transform 400ms ease', transform: `translateX(${-shift}px)` }}>
                    {items.map((m, i) => {
                        const title = cleanTitle(m.title);
                        const tint = MAGAZINE_TINTS[i % MAGAZINE_TINTS.length];
                        const href = `/travel-guide/${m.id}`;
                        return (
                            <a key={m.id} href={href} onClick={(e) => { e.preventDefault(); navigate(href); }}
                                style={{ position: 'relative', flex: `0 0 ${CARD}px`, height: 452, borderRadius: 10, overflow: 'hidden', display: 'block', textDecoration: 'none', background: SD.gray900 }}>
                                {isUsableImage(m.image) && (
                                    <ResponsiveProductImage src={m.image} alt={title} sizes="340px" loading="lazy" decoding="async"
                                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                )}
                                <span style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(${tint},0) 42%, rgba(${tint},0.85) 64%, rgb(${tint}) 76%, rgb(${tint}) 100%)` }} />
                                <span style={{ position: 'absolute', left: 32, right: 32, bottom: 36, display: 'flex', flexDirection: 'column', gap: 10, color: SD.white }}>
                                    {m.category && <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.88)' }}>{m.category}</span>}
                                    <span style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'keep-all' }}>{title}</span>
                                </span>
                            </a>
                        );
                    })}
                </div>
            </div>
            {n > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <span style={{ fontSize: 14, color: SD.gray600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        <strong style={{ fontSize: 18, color: SD.gray900 }}>{pad(index + 1)}</strong> / {pad(n)}
                    </span>
                    <div aria-hidden="true" style={{ flex: '1 1 auto', display: 'flex', gap: 6 }}>
                        {items.map((m, k) => (
                            <span key={m.id} style={{ flex: '1 1 0', height: 2, borderRadius: 9999, background: k <= index ? SD.gray900 : SD.gray300 }} />
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <SRoundButton label="이전 매거진" icon="chevronLeft" disabled={index === 0} onClick={() => setIndex(Math.max(0, index - 1))} style={{ borderColor: SD.gray300 }} />
                        <SRoundButton label="다음 매거진" icon="chevronRight" disabled={index === n - 1} onClick={() => setIndex(Math.min(n - 1, index + 1))} style={{ borderColor: SD.gray300 }} />
                    </div>
                </div>
            )}
        </section>
    );
}
