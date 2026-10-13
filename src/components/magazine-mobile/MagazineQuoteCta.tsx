import { useNavigate } from 'react-router-dom';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { M_GRADIENT } from '../mobile/mobileTheme';

/** "CUSTOM TOUR" card that closes the mobile magazine list and article screens. */
export function MagazineQuoteCta() {
    const navigate = useNavigate();
    return (
        <section style={{ margin: '8px 16px 0', borderRadius: 24, padding: '24px 20px', background: `radial-gradient(260px 180px at 100% 0%,rgba(39,171,143,0.2),rgba(39,171,143,0) 70%),${MW.mintBg}`, border: `1px solid ${MW.mintTint}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>CUSTOM TOUR</span>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, lineHeight: 1.45 }}>나만의 특별한 플랜을 1분 만에 요청하세요</h2>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: MW.mute }}>한국어 스태프가 24시간 이내에 답변드립니다. 견적은 무료입니다.</p>
            <a
                href="/custom-estimate"
                onClick={(e) => { e.preventDefault(); navigate('/custom-estimate'); window.scrollTo(0, 0); }}
                style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 999, background: M_GRADIENT, fontSize: 15, fontWeight: 700, color: MW.navy, textDecoration: 'none' }}
            >
                맞춤 견적
            </a>
        </section>
    );
}
