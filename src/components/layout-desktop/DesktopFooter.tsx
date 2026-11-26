import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { KAKAO_CHANNEL_CHAT_URL, KAKAO_CHANNEL_URL } from '../../constants/company';
import { SD, SD_CONTAINER, SIcon } from '../site-seed/seed';

interface FooterLink {
    label: string;
    path?: string;
    href?: string;
}

/** 바닥 링크 3묶음. 견적 고객 페이지의 바닥(public/site-chrome.js)도 같은 목록을 쓴다 — 함께 고친다(tests/site-chrome.test.mjs). */
const COLUMNS: { h: string; items: FooterLink[] }[] = [
    {
        h: '여행 상품',
        items: [
            { label: '몽골 여행 가이드', path: '/travel-guide' },
            { label: '투어 상품 목록', path: '/products' },
            { label: '승마 여행', path: '/category/horse-riding-tour' },
            { label: '고비사막 투어', path: '/category/gobi-desert' },
        ],
    },
    {
        h: '예약·이용',
        items: [
            { label: '맞춤 견적 요청', path: '/custom-estimate' },
            { label: '동행 찾기', path: '/travel-mates' },
            { label: '예약 안내', path: '/booking-flow' },
            { label: '예약 내역 확인', path: '/mypage/reservations' },
            { label: '자주 묻는 질문', path: '/faq' },
        ],
    },
    {
        h: '회사',
        items: [
            { label: '회사 소개', path: '/about' },
            { label: '여행 후기', path: '/reviews' },
            { label: '마이페이지', path: '/mypage' },
            { label: '카카오톡 문의', href: KAKAO_CHANNEL_CHAT_URL },
        ],
    },
];

/** 회사 정보(이름 · 값). 견적 고객 페이지의 바닥과 같은 값이어야 한다. */
const HEAD_OFFICE: Array<[string, string]> = [
    ['상호', '몽골리아 은하수 (SUUN ZAM)'],
    ['대표', 'Davaasuren Bilguun'],
    ['사업자등록번호', '9011640064'],
    ['관광사업등록번호', '6124313'],
    ['전화', '+976 9594 5838 · +976 8010 7766'],
    ['주소', '울란바토르 바양주르흐구 13동 DACO센터 3층 306호'],
];
const KOREA_AGENCY: Array<[string, string]> = [
    ['상호', '헬로볼라'],
    ['대표', 'Davaasuren Bolor'],
    ['사업자등록번호', '730-54-00614'],
    ['통신판매업신고', '제2022-서울중랑-1776호'],
    ['이메일', 'bolor1@hanmail.net'],
];

const MongoliaFlag = ({ height = 16 }: { height?: number }) => (
    <svg width={height * 2} height={height} viewBox="0 0 48 24" role="img" aria-label="몽골 국기" style={{ flex: 'none', borderRadius: 2 }}>
        <rect width="48" height="24" fill="#C4272F" /><rect x="16" width="16" height="24" fill="#015197" />
        <g fill="#F9CF02">
            <path d="M8 2.2l0.9 1.8h-1.8z" /><path d="M6.6 3.6l0.7 1.4h-1.4zM9.4 3.6l0.7 1.4h-1.4z" /><circle cx="8" cy="6.8" r="1.3" />
            <path d="M5.8 8.2a2.2 2.2 0 0 0 4.4 0a2.2 1.4 0 0 1 -4.4 0z" /><path d="M6 10.6h4l-2 1.6z" /><rect x="6" y="12.6" width="4" height="0.8" />
            <circle cx="8" cy="16" r="2" /><rect x="6" y="18.6" width="4" height="0.8" /><path d="M6 20h4l-2 1.6z" />
            <rect x="3.6" y="10.6" width="1.2" height="11" /><rect x="11.2" y="10.6" width="1.2" height="11" />
        </g>
        <path d="M8 14a1 1 0 0 1 0 2a1 1 0 0 0 0 2a2 2 0 0 1 0-4z" fill="#C4272F" />
    </svg>
);
const bars = (x: number, y: number, rotate: number, rows: Array<'full' | 'split'>) => (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
        {rows.map((row, i) => row === 'full'
            ? <rect key={i} x="-3.6" y={-3.1 + i * 2.4} width="7.2" height="1.4" />
            : <g key={i}><rect x="-3.6" y={-3.1 + i * 2.4} width="3.1" height="1.4" /><rect x="0.5" y={-3.1 + i * 2.4} width="3.1" height="1.4" /></g>)}
    </g>
);
const KoreaFlag = ({ height = 16 }: { height?: number }) => (
    <svg width={height * 1.5} height={height} viewBox="0 0 36 24" role="img" aria-label="대한민국 국기" style={{ flex: 'none', borderRadius: 2, boxShadow: `0 0 0 1px ${SD.gray300}` }}>
        <rect width="36" height="24" fill="#ffffff" />
        <g transform="rotate(33.69 18 12)"><circle cx="18" cy="12" r="6" fill="#0047A0" /><path d="M12 12A6 6 0 0 1 24 12A3 3 0 0 1 18 12A3 3 0 0 0 12 12Z" fill="#CD2E3A" /></g>
        <g fill="#000000">
            {bars(7.85, 5.23, 303.69, ['full', 'full', 'full'])}
            {bars(28.15, 5.23, 56.31, ['split', 'full', 'split'])}
            {bars(7.85, 18.77, 236.31, ['full', 'split', 'full'])}
            {bars(28.15, 18.77, 123.69, ['split', 'split', 'split'])}
        </g>
    </svg>
);

function CompanyBlock({ flag, title, rows, extra }: { flag: ReactNode; title: string; rows: Array<[string, string]>; extra?: ReactNode }) {
    return (
        <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: SD.gray900 }}>{flag}<span>{title}</span></h3>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '104px minmax(0, 1fr)', columnGap: 12, rowGap: 6, fontSize: 13, lineHeight: 1.5 }}>
                {rows.map(([label, value]) => [
                    <dt key={`${label}-k`} style={{ color: SD.gray600 }}>{label}</dt>,
                    <dd key={`${label}-v`} style={{ margin: 0, color: SD.gray700 }}>{value}</dd>,
                ])}
                {extra}
            </dl>
        </div>
    );
}

/** 휴대폰 바닥의 링크 한 줄(디자인 ‘사이트 하단’ 2차 compact). */
const COMPACT_LINKS: FooterLink[] = [
    { label: '회사 소개', path: '/about' },
    { label: '여행 후기', path: '/reviews' },
    { label: '자주 묻는 질문', path: '/faq' },
    { label: '카카오톡 문의', href: KAKAO_CHANNEL_CHAT_URL },
    { label: '예약 내역 확인', path: '/mypage/reservations' },
];
const pick = (rows: Array<[string, string]>, label: string) => rows.find(([k]) => k === label)?.[1] || '';

/**
 * 휴대폰 바닥(디자인 ‘사이트 하단’ 2026-11-25 2차 compact): 이름 · 소개 한 줄 · 링크 한 줄 → 접힌 ‘사업자 정보’(몽골 본사·한국 대리점)
 * → 저작권·약관. 회사 정보 값은 PC 바닥과 같은 HEAD_OFFICE·KOREA_AGENCY에서 읽는다.
 */
function CompactFooter() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const go = (path: string) => (e: React.MouseEvent) => { e.preventDefault(); navigate(path); };
    const linkStyle = { display: 'inline-flex', alignItems: 'center', minHeight: 36, color: SD.gray700, fontSize: 13, textDecoration: 'none' } as const;
    const head = { margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: SD.gray900 } as const;
    const line = { margin: 0 } as const;
    const h = (label: string) => pick(HEAD_OFFICE, label), k = (label: string) => pick(KOREA_AGENCY, label);
    return (
        <footer style={{ width: '100%', boxSizing: 'border-box', background: SD.gray50, color: SD.gray900, padding: '28px 20px 24px' }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: SD.gray900 }}>몽골리아 은하수</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: SD.gray600 }}>한국어 가이드와 함께하는 몽골 여행 전문 여행사</p>
            <nav aria-label="하단 링크" style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', columnGap: 16 }}>
                {COMPACT_LINKS.map((it) => it.path
                    ? <a key={it.label} href={it.path} onClick={go(it.path)} style={linkStyle}>{it.label}</a>
                    : <a key={it.label} href={it.href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{it.label}</a>)}
            </nav>
            <div style={{ marginTop: 12, borderTop: `1px solid ${SD.gray200}` }}>
                <button type="button" aria-expanded={open} aria-controls="footer-business-info" onClick={() => setOpen(!open)}
                    style={{ width: '100%', minHeight: 44, padding: 0, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: SD.gray700, fontFamily: 'inherit',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    사업자 정보<SIcon name={open ? 'chevronUp' : 'chevronDown'} size={14} stroke={2} />
                </button>
                {open && (
                    <div id="footer-business-info" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 8px', fontSize: 11, lineHeight: 1.7, color: SD.gray600 }}>
                        <div>
                            <p style={head}><MongoliaFlag height={10} />몽골 본사</p>
                            <p style={line}>{h('상호')} · 대표 {h('대표')}</p>
                            <p style={line}>사업자등록번호 {h('사업자등록번호')} · 관광사업등록번호 {h('관광사업등록번호')}</p>
                            <p style={line}>전화 {h('전화')}</p>
                            <p style={line}>{h('주소')}</p>
                        </div>
                        <div>
                            <p style={head}><KoreaFlag height={10} />한국 대리점</p>
                            <p style={line}>{k('상호')} · 대표 {k('대표')}</p>
                            <p style={line}>사업자등록번호 {k('사업자등록번호')}</p>
                            <p style={line}>통신판매업신고 {k('통신판매업신고')}</p>
                            <p style={line}>이메일 {k('이메일')}</p>
                            <p style={line}>문의 <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ color: SD.gray900, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>카카오톡 채널</a></p>
                        </div>
                    </div>
                )}
            </div>
            <div style={{ paddingTop: 12, borderTop: `1px solid ${SD.gray200}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 11, color: SD.gray600 }}>© 2026 Mongolia Milky Way.</p>
                <nav aria-label="약관" style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                    <a href="/terms-of-service" onClick={go('/terms-of-service')} style={{ color: SD.gray700, textDecoration: 'none' }}>이용약관</a>
                    <a href="/privacy-policy" onClick={go('/privacy-policy')} style={{ color: SD.gray900, fontWeight: 700, textDecoration: 'none' }}>개인정보처리방침</a>
                </nav>
            </div>
        </footer>
    );
}

/**
 * 사이트 하단(Claude Design ‘사이트 하단’, 2026-11-25): 링크 3묶음 → 몽골 본사·한국 대리점 → 저작권·약관.
 * 휴대폰(MobileShell)은 `compact`로 짧은 바닥(CompactFooter)을 쓴다.
 */
export function DesktopFooter({ compact = false }: { compact?: boolean } = {}) {
    if (compact) return <CompactFooter />;
    return <WideFooter />;
}

function WideFooter() {
    const navigate = useNavigate();
    const linkStyle = { color: SD.gray700, textDecoration: 'none', fontSize: 14 } as const;

    return (
        <footer style={{ width: '100%', boxSizing: 'border-box', background: SD.white, color: SD.gray900, borderTop: `1px solid ${SD.gray200}` }}>
            <div style={SD_CONTAINER}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, padding: '56px 0 40px' }}>
                    <div style={{ flex: '2 1 280px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 340 }}>
                        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: SD.gray900 }}>몽골리아 은하수</p>
                        <p style={{ margin: 0, fontSize: 13, color: SD.gray600 }}>Mongolia Milky Way (SUUN ZAM)</p>
                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: SD.gray700 }}>한국어에 능통한 현지 가이드가 함께하는 몽골 여행·투어 전문 여행사예요.</p>
                    </div>
                    {COLUMNS.map((col) => (
                        <div key={col.h} style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: SD.gray900 }}>{col.h}</h3>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {col.items.map((it) => (
                                    <li key={it.label}>
                                        {it.path
                                            ? <a href={it.path} onClick={(e) => { e.preventDefault(); navigate(it.path!); }} style={linkStyle}>{it.label}</a>
                                            : <a href={it.href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{it.label}</a>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px 48px', padding: '32px 0', borderTop: `1px solid ${SD.gray200}` }}>
                    <CompanyBlock flag={<MongoliaFlag />} title="몽골 본사" rows={HEAD_OFFICE} />
                    <CompanyBlock flag={<KoreaFlag />} title="한국 대리점" rows={KOREA_AGENCY} extra={<>
                        <dt style={{ color: SD.gray600 }}>문의</dt>
                        <dd style={{ margin: 0 }}>
                            <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ color: SD.gray900, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>카카오톡 채널</a>
                        </dd>
                    </>} />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 0 32px', borderTop: `1px solid ${SD.gray200}` }}>
                    <p style={{ margin: 0, fontSize: 13, color: SD.gray600 }}>© 2026 Mongolia Milky Way. All rights reserved.</p>
                    <nav aria-label="약관" style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                        <a href="/terms-of-service" onClick={(e) => { e.preventDefault(); navigate('/terms-of-service'); }} style={{ color: SD.gray700, textDecoration: 'none' }}>이용약관</a>
                        <a href="/privacy-policy" onClick={(e) => { e.preventDefault(); navigate('/privacy-policy'); }} style={{ color: SD.gray900, fontWeight: 700, textDecoration: 'none' }}>개인정보처리방침</a>
                    </nav>
                </div>
            </div>
        </footer>
    );
}
