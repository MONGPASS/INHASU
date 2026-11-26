import type { CSSProperties, ReactNode } from 'react';

/**
 * 고객 사이트 새 디자인(Claude Design ‘홈’ · ‘사이트 하단’, 2026-11-25)의 색·틀·아이콘.
 * 관리자와 같은 당근 Seed 은하수 판 값이다(회색 단계 + 민트 단계). 고객 화면은 인라인 style을 쓰므로 상수로 둔다.
 */
export const SD = {
    white: '#ffffff',
    gray50: '#f7f8fa', gray100: '#f2f3f6', gray200: '#eaebee', gray300: '#dcdee3', gray400: '#d1d3d8',
    gray500: '#adb1ba', gray600: '#868b94', gray700: '#4d5159', gray800: '#393a40', gray900: '#212124',
    mint50: '#ECFDF7', mint100: '#D2F9E9', mint200: '#A8F2D7', mint300: '#70E5C2', mint400: '#36D1A7',
    mint500: '#12B28C', mint600: '#079475', mint700: '#067661', mint800: '#075E4E', mint900: '#074D41', mint950: '#032B25',
    red: '#D93A2B',
    /** 로고 글자 ‘은하수’의 민트(로고 그림과 같은 브랜드 색 #27AB8F). 상단 이름 글자에만 쓴다. */
    brandMint: '#27AB8F',
} as const;

/** 상단 이름 글자(로고 글자): 아주 굵게 · 좁은 자간. 크기는 쓰는 곳에서. */
export const SD_BRAND_TEXT: CSSProperties = { fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.2, whiteSpace: 'nowrap', color: SD.gray900 };

/** 가운데 본문 칸(최대 1120 + 좌우 32). */
export const SD_CONTAINER: CSSProperties = { maxWidth: 1120, margin: '0 auto', paddingLeft: 32, paddingRight: 32, boxSizing: 'border-box' };

/** 디자인의 선 아이콘(24 격자, 선 굵기는 쓰는 곳에서). 이름으로 고른다. */
const ICONS: Record<string, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    chevronUp: <path d="M6 15l6-6 6 6" />,
    chevronLeft: <path d="M15 6l-6 6 6 6" />,
    chevronRight: <path d="M9 6l6 6-6 6" />,
    arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
    heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    calendarCheck: <><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><path d="M9 15l2 2 4-4" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    gift: <><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v8.5h14V12M12 8v12.5" /><path d="M12 8C10 4 6.5 4.5 7.5 7c.4 1 2.5 1 4.5 1zM12 8c2-4 5.5-3.5 4.5-1-.4 1-2.5 1-4.5 1z" /></>,
    headsetHelp: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /><path d="M19 20a3 3 0 0 1-3 2h-3" /></>,
    trophyCup: <><path d="M8 4h8v6a4 4 0 0 1-8 0z" /><path d="M8 6H4.5a.5.5 0 0 0-.5.5C4 9 5.5 10.5 8 10.5M16 6h3.5a.5.5 0 0 1 .5.5c0 2.5-1.5 4-4 4" /><path d="M12 14v3M8.5 20.5h7M10 17h4l.5 3.5h-5z" /></>,
    pushPin: <><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z" /><path d="M12 14v7" /></>,
    reviewStar: <><path d="M4 4.5h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4v-16a1 1 0 0 1 1-1z" /><path d="M12 8l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" /></>,
    bookOpen: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21a2 2 0 0 1 2-2h13v2" /><path d="M9 7h6" /></>,
    tv: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M8 2.5l4 3.5 4-3.5" /></>,
    play: <path d="M8 5.5v13l10.5-6.5z" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    kakao: <path d="M12 4c-4.7 0-8.5 3-8.5 6.7 0 2.4 1.6 4.5 4 5.7L6.8 20l4-2.6c.4 0 .8.1 1.2.1 4.7 0 8.5-3 8.5-6.8S16.7 4 12 4z" />,
    clockBack: <><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3 4v4h4" /><path d="M12 7.5V12l3 2" /></>,
    questionCircle: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.1-2.4 3.6M12 17h.01" /></>,
    mailBox: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 6 8.5-6" /></>,
    instagram: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17 7h.01" /></>,
    share: <><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" /></>,
    pencil: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 7l4 4" /></>,
    youtube: <><rect x="2.5" y="5" width="19" height="14" rx="4" /><path d="M10 9v6l5-3z" /></>,
    flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
    homeRoof: <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
    arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
    mapFold: <><path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6z" /><path d="M9 4v14M15 6v14" /></>,
    // 마이페이지(디자인 ‘마이페이지 개선’)
    gridFour: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
    quoteDoc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
    peopleTwo: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 20a6.5 6.5 0 0 0-2.5-5.1" /></>,
    reviewBubble: <><path d="M4 5h16v11H9l-5 4z" /><path d="M12 8.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" /></>,
    bankHouse: <><path d="M3 9.5L12 4l9 5.5" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></>,
    userPlus: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" /></>,
    calendarPlain: <><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></>,
    copyBox: <><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5" /></>,
    bedStay: <><path d="M3 18V6M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6" /><circle cx="7" cy="11" r="1.6" /></>,
    chatBubble: <path d="M4 5h16v11H9l-5 4z" />,
    mailLine: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6l8.5 7 8.5-7" /></>,
    checkRound: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>,
    checkMark: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    crossMark: <path d="M7 7l10 10M17 7L7 17" />,
    pinPlace: <><path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
    phoneCall: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
    qrSquare: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3" /></>,
    historyBack: <><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3 4v4h4M12 8v4l3 2" /></>,
};

export type SeedIconName = keyof typeof ICONS;

export function SIcon({ name, size = 20, stroke = 1.8, style }: { name: SeedIconName | string; size?: number; stroke?: number; style?: CSSProperties }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true" style={{ flex: 'none', ...style }}>
            {ICONS[name]}
        </svg>
    );
}

/** 채운 별(후기 별점). */
export function SStar({ size = 14 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none' }}>
            <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor" />
        </svg>
    );
}

/** 구역 제목(28px 아이콘 + 제목 + 설명)과 오른쪽 ‘전체 보기’. iconImage를 주면 선 아이콘 대신 그 그림(색 있는 아이콘)을 쓴다. */
export function SSectionHead({ icon, iconImage, title, sub, more, size = 28 }: { icon?: string; iconImage?: string; title: string; sub?: string; more?: ReactNode; size?: number }) {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: size, fontWeight: 700, lineHeight: 1.35, color: SD.gray900 }}>
                    {iconImage
                        ? <img src={iconImage} alt="" width={44} height={44} style={{ width: 44, height: 44, margin: '-4px 0', objectFit: 'contain', flex: 'none' }} />
                        : icon && <SIcon name={icon} size={28} stroke={1.7} />}
                    <span>{title}</span>
                </h2>
                {sub && <p style={{ margin: 0, fontSize: 16, color: SD.gray700 }}>{sub}</p>}
            </div>
            {more}
        </div>
    );
}

/** 동그란 이전·다음 버튼(44px). */
export function SRoundButton({ label, icon, onClick, disabled, size = 44, style }: { label: string; icon: string; onClick: () => void; disabled?: boolean; size?: number; style?: CSSProperties }) {
    return (
        <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
            style={{ width: size, height: size, flex: 'none', border: `1px solid ${SD.gray200}`, borderRadius: 9999, background: SD.white, color: SD.gray900, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', padding: 0, opacity: disabled ? 0.4 : 1, ...style }}>
            <SIcon name={icon} size={20} stroke={2} />
        </button>
    );
}
