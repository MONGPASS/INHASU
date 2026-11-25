import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react';
import { MW_FONT } from '../desktop-primitives/mwTokens';
import { ContactCards } from '../home/ConnectSection';
import { CONTACT_CARDS } from '../home/homeContent';
import { SD, SIcon } from '../site-seed/seed';
import { QUICK_MENU } from './mobileTheme';

/**
 * 휴대폰 전체 메뉴(디자인 ‘전체 메뉴 — 모바일’과 ‘… (로그인 전)’, 2026-11-25). 머리의 ≡ 단추로 연다.
 * 위에서부터 내 계정(로그인 전: 안내 + 로그인 · 회원가입 단추) · 내 여행 3칸 · MENU(홈 바로가기와 같은 QUICK_MENU, 손그림 아이콘)
 * · SUPPORT 목록 · 문의 카드 2장(홈과 같은 ContactCards) · 카카오톡 채널 줄.
 * 휴대폰에서는 화면 전체를 덮고, 480px보다 넓으면 가운데 480px만 덮고 양옆은 어둡게 둔다(눌러서 닫기). Esc로도 닫힌다.
 */
interface MobileMenuSheetProps {
    onClose: () => void;
    /** 메뉴를 닫고 이동한다. */
    go: (path: string) => void;
    logged: boolean;
    name: string;
    avatar?: string;
    unreadCount: number;
    onLogout: () => void;
}

const MY_TRIP: { label: string; path: string; icon: string }[] = [
    { label: '예약 내역', path: '/mypage/reservations', icon: 'calendarCheck' },
    { label: '찜 목록', path: '/mypage/wishlist', icon: 'heart' },
    { label: '최근 본 상품', path: '/mypage/recently-viewed', icon: 'clockBack' },
];

const SUPPORT: { label: string; path: string; icon: string; count?: boolean }[] = [
    { label: '알림', path: '/mypage/notifications', icon: 'bell', count: true },
    { label: '자주 묻는 질문', path: '/faq', icon: 'questionCircle' },
    { label: '문의', path: '/contact', icon: 'mailBox' },
];

const HIDDEN: CSSProperties = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };
const LABEL: CSSProperties = { margin: '0 0 10px', padding: '0 20px', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: SD.gray600 };
const BOX_BUTTON: CSSProperties = { flex: '1 1 0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 8, boxSizing: 'border-box', fontSize: 15, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' };

export function MobileMenuSheet({ onClose, go, logged, name, avatar, unreadCount, onLogout }: MobileMenuSheetProps) {
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        closeRef.current?.focus();
    }, []);

    const link = (path: string) => ({
        href: path,
        onClick: (e: MouseEvent) => {
            e.preventDefault();
            go(path);
        },
    });
    const { kakao } = CONTACT_CARDS;
    const initial = name.trim().charAt(0).toUpperCase() || '고';

    return (
        <div role="dialog" aria-modal="true" aria-label="전체 메뉴" data-mw-overlay=""
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', justifyContent: 'center' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(23,23,26,0.48)' }} />
            <div style={{ position: 'relative', width: '100%', maxWidth: 480, height: '100%', overflowY: 'auto', overscrollBehavior: 'contain', background: SD.white, color: SD.gray900, fontFamily: MW_FONT,
                display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)', boxSizing: 'border-box' }}>
                <header style={{ position: 'sticky', top: 0, zIndex: 1, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, padding: '0 8px 0 20px', background: SD.white, borderBottom: `1px solid ${SD.gray200}` }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: SD.gray900 }}>전체 메뉴</h2>
                    <button ref={closeRef} type="button" onClick={onClose} aria-label="메뉴 닫기"
                        style={{ width: 44, height: 44, border: 0, background: 'transparent', color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' }}>
                        <SIcon name="close" size={24} />
                    </button>
                </header>

                <section aria-label="내 계정" style={{ flex: 'none', padding: '20px 20px 0' }}>
                    {logged ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flex: 'none', background: SD.gray100, color: SD.gray600, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>
                                {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : initial}
                            </span>
                            <a {...link('/mypage')} style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, textDecoration: 'none' }}>
                                <span style={{ fontSize: 17, fontWeight: 700, color: SD.gray900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name} 님</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 13, color: SD.gray600 }}>
                                    마이페이지<SIcon name="chevronRight" size={14} stroke={2} />
                                </span>
                            </a>
                            <button type="button" onClick={onLogout} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: 0, border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: SD.gray600, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                로그아웃
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.4, color: SD.gray900 }}>로그인하고 몽골 여행을 시작해 보세요</p>
                                <p style={{ margin: 0, fontSize: 13, color: SD.gray600 }}>예약 내역과 찜한 투어를 한곳에서 볼 수 있어요</p>
                            </div>
                            {/* 회원가입도 같은 로그인 화면에서 한다(Google 계정으로 바로 가입). */}
                            <div style={{ display: 'flex', gap: 8 }}>
                                <a {...link('/login')} style={{ ...BOX_BUTTON, background: SD.gray900, color: SD.white }}>로그인</a>
                                <a {...link('/login')} style={{ ...BOX_BUTTON, background: SD.white, color: SD.gray900, border: `1px solid ${SD.gray300}` }}>회원가입</a>
                            </div>
                        </div>
                    )}
                    <nav aria-label="내 여행" style={{ marginTop: 16, display: 'flex', borderRadius: 12, background: SD.gray50 }}>
                        {MY_TRIP.map((item) => (
                            <a key={item.path} {...link(item.path)} style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 0', color: SD.gray900, fontSize: 12, textDecoration: 'none' }}>
                                <SIcon name={item.icon} size={22} stroke={1.6} />{item.label}
                            </a>
                        ))}
                    </nav>
                </section>

                <section aria-label="메뉴" style={{ flex: 'none', paddingTop: 28 }}>
                    <p style={LABEL}>MENU</p>
                    <div style={{ margin: '0 20px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, background: SD.gray200, border: `1px solid ${SD.gray200}`, borderRadius: 14, overflow: 'hidden' }}>
                        {QUICK_MENU.map((item) => (
                            <a key={item.key} {...link(item.path)} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 88, minWidth: 0, background: SD.white, color: SD.gray900, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                                <img src={item.icon} alt="" width={32} height={32} style={{ width: 32, height: 32, objectFit: 'contain', display: 'block' }} />
                                <span style={{ maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                                {item.tag && <span style={{ position: 'absolute', right: 8, top: 8, fontSize: 10, fontWeight: 700, color: SD.gray600 }}>{item.tag}</span>}
                                {!item.tag && item.isNew && (
                                    <span style={{ position: 'absolute', right: 12, top: 10, width: 6, height: 6, borderRadius: 9999, background: SD.red }}>
                                        <span style={HIDDEN}>새 소식</span>
                                    </span>
                                )}
                            </a>
                        ))}
                    </div>
                </section>

                <section aria-label="고객 지원" style={{ flex: 'none', paddingTop: 28 }}>
                    <p style={LABEL}>SUPPORT</p>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {SUPPORT.map((item) => (
                            <a key={item.path} {...link(item.path)} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 52, padding: '0 20px', color: SD.gray900, fontSize: 15, textDecoration: 'none' }}>
                                <span style={{ display: 'flex', color: SD.gray700 }}><SIcon name={item.icon} size={22} stroke={1.6} /></span>
                                <span style={{ flex: '1 1 auto' }}>{item.label}</span>
                                {item.count && logged && unreadCount > 0 && (
                                    <span style={{ minWidth: 20, height: 20, padding: '0 6px', boxSizing: 'border-box', borderRadius: 9999, background: SD.gray900, color: SD.white, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {unreadCount > 99 ? '99+' : unreadCount}<span style={HIDDEN}>개 읽지 않음</span>
                                    </span>
                                )}
                                <span style={{ display: 'flex', color: SD.gray500 }}><SIcon name="chevronRight" size={18} /></span>
                            </a>
                        ))}
                    </div>
                </section>

                <section aria-label="문의" style={{ flex: 'none', margin: '24px 20px 0' }}>
                    <ContactCards compact onNavigate={go} />
                </section>

                <a href={kakao.url} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 'none', margin: '16px 20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, color: SD.gray700, fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    <SIcon name="kakao" size={18} />카카오톡 채널 <strong style={{ color: SD.gray900 }}>{kakao.button}</strong> 로 문의하기<SIcon name="chevronRight" size={14} stroke={2} />
                </a>
            </div>
        </div>
    );
}
