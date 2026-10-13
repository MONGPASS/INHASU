import type { CSSProperties, ReactNode } from 'react';
import { KAKAO_CHANNEL_CHAT_URL } from '../../constants/company';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { KAKAO_BUBBLE, KAKAO_INK, KAKAO_YELLOW } from '../mobile/mobileTheme';

/** White section card of the booking body. `pc` switches between the PC and mobile metrics. */
export function BookCard({
    pc, eyebrow, title, sub, gap, children,
}: { pc: boolean; eyebrow?: string; title: string; sub?: string; gap?: number; children: ReactNode }) {
    return (
        <section style={{ background: '#FFFFFF', borderRadius: pc ? 28 : 20, padding: pc ? 28 : 18, display: 'flex', flexDirection: 'column', gap: gap ?? (pc ? 20 : 16), minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {eyebrow && <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintDeep }}>{eyebrow}</span>}
                <h2 style={{ margin: 0, fontSize: pc ? 20 : 17, fontWeight: 900, lineHeight: 1.4, color: MW.navy }}>{title}</h2>
                {sub && <span style={{ fontSize: 13, lineHeight: 1.6, color: MW.mute }}>{sub}</span>}
            </div>
            {children}
        </section>
    );
}

/** Yellow KakaoTalk pill (opens the KakaoTalk channel chat in a new tab). */
export function KakaoLink({ label, height = 40, style }: { label: string; height?: number; style?: CSSProperties }) {
    return (
        <a
            href={KAKAO_CHANNEL_CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height, padding: '0 16px 0 12px', borderRadius: 999, background: KAKAO_YELLOW, fontSize: 13, fontWeight: 700, color: KAKAO_INK, whiteSpace: 'nowrap', textDecoration: 'none', boxSizing: 'border-box', ...style }}
        >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}><path fill={KAKAO_INK} d={KAKAO_BUBBLE} /></svg>
            {label}
        </a>
    );
}
