import { useState } from 'react';
import { safeBandLink, type HomeBand } from '../home/homeSettings';
import { SD, SIcon } from '../site-seed/seed';
import { linkTo, useGo } from './homeMobileData';

/** 혜택 안내 띠(휴대폰): 옅은 민트 바탕에 두 줄 제목 + 동그란 사진 하나, 사진 아래에서 넘긴다. 배너는 관리자 ‘홈 화면 관리’에서 만든다. */
export function BenefitBandMobile({ bands }: { bands: HomeBand[] }) {
    const go = useGo();
    const [index, setIndex] = useState(0);
    const n = bands.length;
    if (n === 0) return null;
    const i = index % n;
    const band = bands[i];
    const href = safeBandLink(band.link);
    // 보이는 알약은 24px이고, 누르는 칸은 위아래로 넓혀 44px를 채운다.
    const arrow = { width: 32, height: 44, margin: '-10px 0', border: 'none', background: 'transparent', color: SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' } as const;
    const textBox = { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, textDecoration: 'none' } as const;
    const text = (
        <>
            <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4, color: SD.gray900, whiteSpace: 'pre-line', wordBreak: 'keep-all' }}>{band.titleShort.trim() || band.title}</span>
            {band.tags && <span style={{ fontSize: 12, color: SD.gray700 }}>{band.tags}</span>}
        </>
    );

    return (
        <section aria-roledescription="carousel" aria-label="혜택 안내" style={{ marginTop: 44, background: SD.mint50, padding: '22px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            {href ? <a {...linkTo(go, href)} style={textBox}>{text}</a> : <div style={textBox}>{text}</div>}
            <div style={{ position: 'relative', flex: 'none', minWidth: n > 1 ? 84 : 0, minHeight: 84 }}>
                {band.image && (
                    <img src={band.image} alt={band.alt} loading="lazy" decoding="async"
                        style={{ width: 84, height: 84, borderRadius: 9999, objectFit: 'cover', display: 'block', border: `3px solid ${SD.white}` }} />
                )}
                {n > 1 && (
                    <div style={{ position: 'absolute', right: -10, bottom: -8, display: 'flex', alignItems: 'center', height: 24, borderRadius: 9999, background: 'rgba(33,33,36,0.6)' }}>
                        <button type="button" aria-label="이전 혜택" onClick={() => setIndex((i - 1 + n) % n)} style={arrow}><SIcon name="chevronLeft" size={12} stroke={2.4} /></button>
                        <span style={{ fontSize: 11, fontWeight: 700, color: SD.white, fontVariantNumeric: 'tabular-nums' }}>{i + 1}|{n}</span>
                        <button type="button" aria-label="다음 혜택" onClick={() => setIndex((i + 1) % n)} style={arrow}><SIcon name="chevronRight" size={12} stroke={2.4} /></button>
                    </div>
                )}
            </div>
        </section>
    );
}
