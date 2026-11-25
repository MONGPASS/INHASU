import type { CSSProperties, ReactNode } from 'react';

/**
 * 혜택 배너 바탕색(2026-11-25). 홈의 혜택 띠와 관리자 ‘홈 화면 관리’의 미리보기·색 고르기가 함께 쓴다.
 * 관리자 화면 규칙(직접 색·인라인 style 금지)은 관리자 부품의 모양에 대한 것이고, 여기 색은 고객 화면에 그대로 보일 값이라
 * 고객 화면 쪽 폴더에 둔다(관리자 화면은 이 파일의 부품만 끼워 쓴다).
 */
export const BAND_PRESETS: Array<{ id: string; label: string; color: string }> = [
    { id: 'mint', label: '민트', color: '#ECFDF7' },
    { id: 'gray', label: '회색', color: '#F7F8FA' },
    { id: 'yellow', label: '노랑', color: '#FFF7DB' },
    { id: 'peach', label: '살구', color: '#FFF1E8' },
    { id: 'pink', label: '분홍', color: '#FFEFF3' },
    { id: 'sky', label: '하늘', color: '#EAF4FF' },
    { id: 'lavender', label: '보라', color: '#F2EFFF' },
];
export const DEFAULT_BAND_BG = BAND_PRESETS[0].color;

/** #RRGGBB만 받는다(대소문자 무관, 앞뒤 공백 무시). 그 밖은 빈 글자. */
export const normalizeBandColor = (value: string) => {
    const v = (value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : '';
};

/** 바탕이 어두우면 흰 글자, 밝으면 검은 글자(상대 휘도 기준). */
export function bandTextColors(bg: string): { title: string; tags: string } {
    const hex = normalizeBandColor(bg) || DEFAULT_BAND_BG;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    const dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.35;
    return dark ? { title: '#ffffff', tags: 'rgba(255,255,255,0.85)' } : { title: '#212124', tags: '#4d5159' };
}

/** 색 동그라미(관리자 색 고르기 칩 앞에 쓴다). */
export function BandSwatch({ color, size = 16 }: { color: string; size?: number }) {
    return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: 9999, background: color, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }} />;
}

/** 관리자 미리보기: 홈 PC 혜택 띠를 작게 그린 모양(바탕색·글자색이 홈과 같다). */
export function BandPreview({ bg, title, tags, image, image2 }: { bg: string; title: string; tags: string; image: string; image2: string }) {
    const color = normalizeBandColor(bg) || DEFAULT_BAND_BG;
    const text = bandTextColors(color);
    const round = (size: number, extra?: CSSProperties) => ({ width: size, height: size, borderRadius: 9999, objectFit: 'cover', border: '2px solid #ffffff', display: 'block', ...extra }) as CSSProperties;
    const imgs: ReactNode[] = [];
    if (image) imgs.push(<img key="a" src={image} alt="" loading="lazy" style={round(64)} />);
    if (image2) imgs.push(<img key="b" src={image2} alt="" loading="lazy" style={round(40, { marginLeft: image ? -12 : 0 })} />);
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, borderRadius: 10, background: color }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ color: text.title, fontSize: 14, fontWeight: 700, lineHeight: 1.4, whiteSpace: 'pre-line' }}>{title || '제목을 입력하세요'}</span>
                {tags && <span style={{ color: text.tags, fontSize: 12 }}>{tags}</span>}
            </span>
            {imgs.length > 0 && <span style={{ display: 'flex', alignItems: 'flex-end', flex: 'none' }}>{imgs}</span>}
        </div>
    );
}
