import { useState } from 'react';
import { safeBandLink, type HomeBand } from '../home/homeSettings';
import { linkTo, useGo } from '../home-mobile/homeMobileData';
import { SD, SD_CONTAINER, SIcon } from '../site-seed/seed';

/** 혜택 안내 띠: 옅은 민트 바탕에 두 줄 제목 + 동그란 사진 둘, 오른쪽 아래에서 넘긴다. 배너는 관리자 ‘홈 화면 관리’에서 만든다. */
export function BenefitBandDesktop({ bands }: { bands: HomeBand[] }) {
    const go = useGo();
    const [index, setIndex] = useState(0);
    const n = bands.length;
    if (n === 0) return null;
    const i = index % n;
    const band = bands[i];
    const href = safeBandLink(band.link);
    const arrow = { width: 32, height: 32, border: 'none', background: 'transparent', color: SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 } as const;
    const textBox = { flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: 10, padding: '28px 0', textDecoration: 'none' } as const;
    const text = (
        <>
            <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.4, color: SD.gray900, whiteSpace: 'pre-line' }}>{band.title}</span>
            {band.tags && <span style={{ fontSize: 15, color: SD.gray700 }}>{band.tags}</span>}
        </>
    );

    return (
        <section aria-roledescription="carousel" aria-label="혜택 안내" style={{ marginTop: 96, background: SD.mint50 }}>
            <div style={{ ...SD_CONTAINER, minHeight: 180, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
                {href ? <a {...linkTo(go, href)} style={textBox}>{text}</a> : <div style={textBox}>{text}</div>}
                <div style={{ position: 'relative', flex: 'none', display: 'flex', alignItems: 'center', minHeight: 150, margin: '16px 0' }}>
                    {band.image && (
                        <img src={band.image} alt={band.alt} loading="lazy" decoding="async"
                            style={{ width: 150, height: 150, borderRadius: 9999, objectFit: 'cover', display: 'block', border: `4px solid ${SD.white}` }} />
                    )}
                    {band.image2 && (
                        <img src={band.image2} alt="" loading="lazy" decoding="async"
                            style={{ width: 96, height: 96, borderRadius: 9999, objectFit: 'cover', display: 'block', border: `4px solid ${SD.white}`, marginLeft: band.image ? -28 : 0, marginTop: 54 }} />
                    )}
                    {n > 1 && (
                        <div style={{ position: 'absolute', right: -8, bottom: -6, display: 'flex', alignItems: 'center', height: 32, padding: '0 2px', borderRadius: 9999, background: 'rgba(33,33,36,0.6)' }}>
                            <button type="button" aria-label="이전 혜택" onClick={() => setIndex((i - 1 + n) % n)} style={arrow}><SIcon name="chevronLeft" size={14} stroke={2.2} /></button>
                            <span style={{ fontSize: 12, fontWeight: 700, color: SD.white, padding: '0 2px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{i + 1} | {n}</span>
                            <button type="button" aria-label="다음 혜택" onClick={() => setIndex((i + 1) % n)} style={arrow}><SIcon name="chevronRight" size={14} stroke={2.2} /></button>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
