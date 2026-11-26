import type { CSSProperties } from 'react';
import type { HomeProduct } from '../home-desktop/homeDesktopData';
import { SD, SStar } from '../site-seed/seed';

const SIZES = {
    sm: { height: 22, padding: '0 6px', radius: 6, font: 11, star: 10 },
    md: { height: 24, padding: '0 8px', radius: 6, font: 12, star: 11 },
    lg: { height: 30, padding: '0 12px', radius: 8, font: 14, star: 12 },
} as const;

/**
 * 투어 사진 위 상품 구분 꼬리표(PC·휴대폰 투어 목록): 풀패키지는 민트 바탕 + 별, 실속형은 흰 바탕.
 * 자리(left/top/bottom)는 쓰는 쪽이 style로 준다.
 */
export function TourTypeBadge({ type, size = 'lg', style }: { type: HomeProduct['packageType']; size?: keyof typeof SIZES; style: CSSProperties }) {
    if (!type) return null;
    const full = type === 'full';
    const s = SIZES[size];
    return (
        <span style={{ position: 'absolute', height: s.height, padding: s.padding, display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: s.radius, background: full ? SD.mint600 : SD.white,
            color: full ? SD.white : SD.gray900, fontSize: s.font, fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.12)', pointerEvents: 'none', whiteSpace: 'nowrap', ...style }}>
            {full && <SStar size={s.star} />}
            {full ? '풀패키지' : '실속형'}
        </span>
    );
}
