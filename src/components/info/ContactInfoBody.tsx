import { useNavigate } from 'react-router-dom';
import { BRAND, COMPANY_INFO, KAKAO_CHANNEL_URL } from '../../constants/company';
import { MW } from '../desktop-primitives/mwTokens';
import { M_HAIR } from '../mobile/mobileTheme';
import { Ico } from '../mobile/mobileUi';
import { ContactPanel } from '../support-mobile/ContactMobile';

const ARROW = 'M5 12h14M13 6l6 6-6 6';
const SHEET = 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5';

// Only facts that are registered in constants/company.ts (the same ones the footer shows).
const FACTS: Array<[string, string]> = [
    ['상호', `${BRAND.name} · ${COMPANY_INFO.nameLegal}`],
    ['소재지(몽골 본사)', COMPANY_INFO.addressJa],
    ['전화', `${COMPANY_INFO.phoneKR} / ${COMPANY_INFO.phoneSecondary}`],
    ['관광사업 등록번호', COMPANY_INFO.tourRegistrationNumber],
];

/** PC 문의 body (Claude Design: Info "isContact"): the live contact panel, the quote card and company facts. */
export function ContactInfoBody() {
    const navigate = useNavigate();
    const toQuote = () => {
        navigate('/custom-estimate');
        window.scrollTo(0, 0);
    };

    return (
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ContactPanel />

            <button
                type="button"
                onClick={toQuote}
                style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, padding: 26, border: 0, borderRadius: 24,
                    background: `linear-gradient(160deg,${MW.navySoft} 0%,${MW.mintDeep} 100%)`, fontFamily: 'inherit', textAlign: 'left', color: '#FFFFFF', cursor: 'pointer',
                }}
            >
                <span style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ico d={SHEET} size={20} color={MW.mintLight} />
                </span>
                <span style={{ fontSize: 20, fontWeight: 900 }}>견적 요청</span>
                <span style={{ fontSize: 13, lineHeight: 1.7, color: MW.mintTint }}>
                    인원·기간·예산·가고 싶은 곳을 알려 주시면 24시간 이내에 맞춤 견적을 보내 드립니다.
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700 }}>
                    요청하기
                    <Ico d={ARROW} size={16} color="#FFFFFF" width={2} />
                </span>
            </button>

            <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', padding: '8px 28px', border: `1px solid ${MW.line}`, borderRadius: 24 }}>
                {FACTS.map(([k, v]) => (
                    <div key={k} style={{ display: 'grid', gridTemplateColumns: '170px minmax(0,1fr)', gap: 16, padding: '16px 0', borderBottom: `1px solid ${M_HAIR}`, fontSize: 14, lineHeight: 1.7 }}>
                        <dt style={{ fontWeight: 700, color: MW.mute }}>{k}</dt>
                        <dd style={{ margin: 0, color: MW.navy, overflowWrap: 'anywhere' }}>{v}</dd>
                    </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '170px minmax(0,1fr)', gap: 16, padding: '16px 0', borderBottom: `1px solid ${M_HAIR}`, fontSize: 14, lineHeight: 1.7 }}>
                    <dt style={{ fontWeight: 700, color: MW.mute }}>카카오톡 채널</dt>
                    <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>
                        <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ color: MW.mintDeep, fontWeight: 700 }}>{BRAND.name} 카카오톡 채널</a>
                    </dd>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '170px minmax(0,1fr)', gap: 16, padding: '16px 0', fontSize: 14, lineHeight: 1.7 }}>
                    <dt style={{ fontWeight: 700, color: MW.mute }}>이메일</dt>
                    <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>
                        <a href={`mailto:${COMPANY_INFO.email}`} style={{ color: MW.mintDeep, fontWeight: 700 }}>{COMPANY_INFO.email}</a>
                    </dd>
                </div>
            </dl>
        </div>
    );
}
