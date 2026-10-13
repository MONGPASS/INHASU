import type { CSSProperties } from 'react';
import { MW, MW_FONT_EN } from './mwTokens';

/**
 * PREMIUM (풀 패키지) / STANDARD (가성비 중시) pill on PC tour cards — the single badge
 * that replaced BEST / 추천 / 최저가 보장. Renders nothing until the admin sets a 여행 타입.
 * `lg` is the tour-list size (no outline, sits on the photo).
 */
export function TypePill({ type, lg = false, style }: { type: 'full' | 'value' | null | undefined; lg?: boolean; style?: CSSProperties }) {
    if (type !== 'full' && type !== 'value') return null;
    const full = type === 'full';
    return (
        <span
            style={{
                display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: MW_FONT_EN, fontWeight: 700, letterSpacing: '0.05em', color: full ? '#FFFFFF' : MW.mintDeep,
                ...(lg
                    ? { height: 24, padding: '0 10px', fontSize: 10, background: full ? MW.mintDeep : 'rgba(255,255,255,0.92)' }
                    : { height: 22, padding: '0 9px', fontSize: 9, background: full ? MW.mintDeep : '#FFFFFF', border: `1px solid ${full ? MW.mintDeep : '#A6E8D4'}` }),
                ...style,
            }}
        >
            {full ? 'PREMIUM' : 'STANDARD'}
        </span>
    );
}
