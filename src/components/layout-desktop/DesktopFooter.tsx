import { useLocation, useNavigate } from 'react-router-dom';
import { KAKAO_CHANNEL_CHAT_URL, KAKAO_CHANNEL_URL } from '../../constants/company';
import { MW, MW_FONT, MW_FONT_EN, MW_GRADIENT } from '../desktop-primitives/mwTokens';

interface FooterLink {
    label: string;
    path?: string;
    href?: string;
}

export function DesktopFooter() {
    const navigate = useNavigate();
    // The quote page is itself the CTA target, so it skips the band.
    const showCta = !useLocation().pathname.startsWith('/custom-estimate');

    const cols: { h: string; items: FooterLink[] }[] = [
        {
            h: '서비스',
            items: [
                { label: '몽골 여행 가이드', path: '/travel-guide' },
                { label: '몽골 투어 상품 목록', path: '/products' },
                { label: '몽골 승마 여행', path: '/category/horse-riding-tour' },
                { label: '고비사막 투어', path: '/category/gobi-desert' },
                { label: '동행 찾기', path: '/travel-mates' },
                { label: '맞춤 견적 요청', path: '/custom-estimate' },
            ],
        },
        {
            h: '이용 안내',
            items: [
                { label: '예약 안내', path: '/booking-flow' },
                { label: '자주 묻는 질문 (FAQ)', path: '/faq' },
                { label: '이용약관', path: '/terms-of-service' },
                { label: '개인정보처리방침', path: '/privacy-policy' },
                { label: '예약 내역 확인', path: '/mypage/reservations' },
            ],
        },
        {
            h: '회사 정보',
            items: [
                { label: '회사 소개', path: '/about' },
                { label: '여행 후기', path: '/reviews' },
                { label: '마이페이지', path: '/mypage' },
                { label: '카카오톡 문의', href: KAKAO_CHANNEL_CHAT_URL },
            ],
        },
    ];

    return (
        <>
            {/* Custom tour CTA */}
            {showCta && (
                <section
                    style={{
                        background:
                            'radial-gradient(600px 320px at 88% 0%,rgba(39,171,143,0.14),rgba(39,171,143,0) 70%),radial-gradient(420px 260px at 0% 100%,rgba(109,219,190,0.10),rgba(109,219,190,0) 70%),#FFFFFF',
                        color: MW.navy,
                        borderTop: `1px solid ${MW.line}`,
                    }}
                >
                    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>CUSTOM TOUR</span>
                            <h2 style={{ margin: 0, fontSize: 30, fontWeight: 900, lineHeight: 1.35 }}>나만의 특별한 여행 플랜, 1분 만에 요청하세요</h2>
                            <p style={{ margin: 0, fontSize: 14, color: MW.mute }}>한국어 담당 직원이 24시간 이내에 답변드립니다. 견적은 무료입니다.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => navigate('/custom-estimate')}
                                style={{ background: MW_GRADIENT, color: MW.navy, fontWeight: 700, fontSize: 15, padding: '15px 30px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 20px rgba(39,171,143,0.3)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'linear-gradient(135deg,#1C8571 0%,#3FC2A4 100%)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = MW_GRADIENT)}
                            >
                                맞춤 견적
                            </button>
                            <a
                                href={KAKAO_CHANNEL_CHAT_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ border: `1.5px solid ${MW.navy}`, background: 'transparent', color: MW.navy, fontWeight: 700, fontSize: 15, padding: '14px 30px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(10,31,46,0.08)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                                카카오톡 상담
                            </a>
                        </div>
                    </div>
                </section>
            )}

            <footer style={{ background: '#FFFFFF', color: MW.ink3, borderTop: `1px solid ${MW.line}` }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px 32px', display: 'flex', flexDirection: 'column', gap: 40 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 40 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <span style={{ fontFamily: MW_FONT, fontWeight: 900, fontSize: 22, letterSpacing: '-0.04em', color: MW.navy }}>
                                몽골리아<span style={{ color: MW.mint }}> 은하수</span>
                            </span>
                            <span style={{ fontSize: 12, color: MW.mute }}>Mongolia Milky Way (SUUN ZAM)</span>
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8 }}>
                                몽골 여행·몽골 투어 전문 현지 여행사입니다. 한국어에 능통한 전문 가이드가 동행하여 안심하고 떠날 수 있는 안전한 여행을 제안합니다.
                            </p>
                        </div>
                        {cols.map((c) => (
                            <div key={c.h} style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: MW.navy, marginBottom: 4 }}>{c.h}</span>
                                {c.items.map((item) => (
                                    <a
                                        key={item.label}
                                        href={item.href ?? item.path}
                                        target={item.href ? '_blank' : undefined}
                                        rel={item.href ? 'noopener noreferrer' : undefined}
                                        onClick={(e) => {
                                            if (item.path && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                                                e.preventDefault();
                                                navigate(item.path);
                                            }
                                        }}
                                        style={{ ...linkBtn, textDecoration: 'none' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = MW.mintDeep)}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = MW.ink3)}
                                    >
                                        {item.label}
                                    </a>
                                ))}
                            </div>
                        ))}
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
                            gap: 32,
                            paddingTop: 32,
                            borderTop: `1px solid ${MW.line}`,
                            fontSize: 12,
                            lineHeight: 1.9,
                            color: MW.mute,
                        }}
                    >
                        <div>
                            <strong style={{ color: MW.navy }}>[몽골본사]</strong>
                            <br />상호명: 몽골리아 은하수(SUUN ZAM) | 대표: Davaasuren Bilguun
                            <br />사업자등록번호: 9011640064 | 관광사업등록번호: 6124313
                            <br />전화번호: +976 9594 5838 | Tel: +976-8010-7766
                            <br />위치: 울란바토르 바양주르흐구 13동 DACO센터 3층 306호
                        </div>
                        <div>
                            <strong style={{ color: MW.navy }}>[한국대리점]</strong>
                            <br />상호명: 헬로볼라 | 대표자: Davaasuren Bolor
                            <br />사업자등록번호: 730-54-00614 | 통신판매업번호: 제2022-서울중랑-1776호
                            <br />이메일: bolor1@hanmail.net
                            <br />문의:{' '}
                            <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ color: MW.mintDeep, fontWeight: 700, textDecoration: 'none' }}>카카오톡 채널</a>
                            {' '}또는 채팅으로 문의해 주세요.
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 16,
                            flexWrap: 'wrap',
                            paddingTop: 24,
                            borderTop: `1px solid ${MW.line}`,
                            fontSize: 12,
                            color: MW.mute,
                        }}
                    >
                        <span>© 2026 Mongolia Milky Way. All rights reserved.</span>
                        <div style={{ display: 'flex', gap: 20 }}>
                            <button type="button" onClick={() => navigate('/about')} style={legalBtn}>회사 소개</button>
                            <button type="button" onClick={() => navigate('/terms-of-service')} style={legalBtn}>이용약관</button>
                            <button type="button" onClick={() => navigate('/privacy-policy')} style={legalBtn}>개인정보처리방침</button>
                        </div>
                    </div>
                </div>
            </footer>
        </>
    );
}

const linkBtn = {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: 13,
    color: MW.ink3,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'color 150ms',
} as const;

const legalBtn = {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: 12,
    color: MW.mute,
    cursor: 'pointer',
    fontFamily: 'inherit',
} as const;
