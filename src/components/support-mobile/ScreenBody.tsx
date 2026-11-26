import type { ReactNode } from 'react';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { M_PAPER } from '../mobile/mobileTheme';

/** 고객센터 휴대폰 화면(FAQ·문의)의 본문 틀: 영문 머리말 + 안내 한 줄 + 내용. */
export function ScreenBody({ eyebrow, lead, label, children }: { eyebrow: string; lead: string; label?: string; children: ReactNode }) {
    return (
        <section aria-label={label} style={{ background: M_PAPER, minHeight: '60vh', padding: '16px 16px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 2px' }}>
                <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>{eyebrow}</span>
                <span style={{ fontSize: 12, lineHeight: 1.7, color: MW.mute }}>{lead}</span>
            </div>
            {children}
        </section>
    );
}
