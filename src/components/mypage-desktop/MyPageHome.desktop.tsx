import { useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { DEPOSIT_ACCOUNT } from '../../constants/company';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import type { HomeProduct } from '../home-desktop/homeDesktopData';
import { SD, SD_CONTAINER, SIcon } from '../site-seed/seed';
import { quoteStage } from './myQuoteView';
import { DDAY_COLOR, MY_MENU_GROUPS, bookingStage, boxButton, chipStyle, dateRangeText, ddayText, nightsDaysText, pickNextTrip, productImageOf, type BookingTab } from './myBookingView';
import type { MeUser, MyQuote, MyReservation } from './useMyPageData';

/**
 * PC 마이페이지 새 디자인(Claude Design ‘마이페이지 — 개요’·‘마이페이지 — 예약 내역’):
 * 흰 프로필 띠(경로 · 사진·이름 · 예약/진행 중/견적/찜 숫자) → 회색 바탕에 왼쪽 메뉴 + 오른쪽 내용.
 */

type Go = (path: string) => void;

export interface MyStats {
    bookings: number;
    active: number;
    quotes: number;
    wish: number;
}

const card: CSSProperties = { background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 16, padding: 24 };
const linkReset: CSSProperties = { textDecoration: 'none', color: 'inherit' };

const onLink = (go: Go, to: string) => ({
    href: to,
    onClick: (e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        go(to);
    },
});

// ───────────────────────── 프로필 띠 ─────────────────────────

export function MyProfileBand({ me, stats, crumb, onLogout, go }: { me: MeUser; stats: MyStats; crumb?: string; onLogout: () => void; go: Go }) {
    const name = me.name || me.email || '고객';
    const photo = me.image || me.avatarUrl;
    const items: Array<{ label: string; value: number; to: string }> = [
        { label: '예약', value: stats.bookings, to: '/mypage/reservations' },
        { label: '진행 중', value: stats.active, to: '/mypage/reservations' },
        { label: '견적', value: stats.quotes, to: '/mypage/estimates' },
        { label: '찜', value: stats.wish, to: '/mypage/wishlist' },
    ];
    return (
        <section aria-label="내 프로필" style={{ background: SD.white, borderBottom: `1px solid ${SD.gray200}` }}>
            <div style={{ ...SD_CONTAINER, paddingTop: 20, paddingBottom: 28 }}>
                <nav aria-label="현재 위치" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: SD.gray600 }}>
                    <a {...onLink(go, '/')} style={{ ...linkReset, color: SD.gray600 }}>홈</a>
                    <span aria-hidden="true">›</span>
                    {crumb ? (
                        <>
                            <a {...onLink(go, '/mypage')} style={{ ...linkReset, color: SD.gray600 }}>마이페이지</a>
                            <span aria-hidden="true">›</span>
                            <span style={{ color: SD.gray900, fontWeight: 700 }}>{crumb}</span>
                        </>
                    ) : <span style={{ color: SD.gray900, fontWeight: 700 }}>마이페이지</span>}
                </nav>
                <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 32 }}>
                    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 16, paddingRight: 32, borderRight: `1px solid ${SD.gray200}`, minWidth: 0, maxWidth: 420 }}>
                        <Avatar src={photo} name={name} size={64} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                            <span style={{ fontSize: 20, fontWeight: 700, color: SD.gray900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name} 님</span>
                            {me.email && <span style={{ fontSize: 13, color: SD.gray600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me.email}</span>}
                            <span style={{ display: 'flex', gap: 10, marginTop: 2, fontSize: 12 }}>
                                <button type="button" onClick={onLogout} style={{ padding: 0, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, color: SD.gray500, textDecoration: 'underline', cursor: 'pointer' }}>로그아웃</button>
                            </span>
                        </div>
                    </div>
                    <div style={{ flex: '1 1 auto', display: 'flex' }}>
                        {items.map((it, i) => (
                            <a key={it.label} {...onLink(go, it.to)}
                                style={{ ...linkReset, flex: '1 1 0', padding: '0 24px', borderLeft: i ? `1px solid ${SD.gray200}` : 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 13, color: SD.gray600 }}>{it.label}</span>
                                <span style={{ fontSize: 24, fontWeight: 700, color: SD.gray900, fontVariantNumeric: 'tabular-nums' }}>
                                    {it.value}<span style={{ fontSize: 14, fontWeight: 500, color: SD.gray600 }}> 건</span>
                                </span>
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

export function Avatar({ src, name, size }: { src?: string; name: string; size: number }) {
    const [broken, setBroken] = useState(false);
    const show = isUsableImage(src) && !broken;
    return (
        <span role="img" aria-label={`${name} 프로필 사진`}
            style={{ flex: 'none', width: size, height: size, borderRadius: 9999, overflow: 'hidden', background: SD.gray100, color: SD.gray500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {show ? <img src={src} alt="" onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <SIcon name="user" size={Math.round(size * 0.5)} stroke={1.6} />}
        </span>
    );
}

// ───────────────────────── 왼쪽 메뉴 ─────────────────────────

export function MyMenuNav({ current, counts, go }: { current: string; counts: Record<string, number | undefined>; go: Go }) {
    return (
        <nav aria-label="마이페이지 메뉴" style={{ flex: '0 0 220px', position: 'sticky', top: 24 + 58, display: 'flex', flexDirection: 'column', gap: 22 }}>
            {MY_MENU_GROUPS.map((g) => (
                <div key={g.title} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <p style={{ margin: '0 0 6px', padding: '0 12px', fontSize: 12, color: SD.gray500 }}>{g.title}</p>
                    {g.items.map((m) => {
                        const on = m.key === current;
                        const n = counts[m.key] ?? 0;
                        return (
                            <a key={m.key} {...onLink(go, m.path)} aria-current={on ? 'page' : undefined}
                                style={{ ...linkReset, height: 42, padding: '0 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: on ? 700 : 500,
                                    color: on ? SD.gray900 : SD.gray700, background: on ? SD.gray100 : 'transparent' }}>
                                <SIcon name={m.icon} size={20} stroke={1.7} />
                                {m.label}
                                {n > 0 && <CountPill n={n} />}
                            </a>
                        );
                    })}
                </div>
            ))}
        </nav>
    );
}

export function CountPill({ n }: { n: number }) {
    return (
        <span style={{ marginLeft: 'auto', minWidth: 20, height: 20, padding: '0 6px', boxSizing: 'border-box', borderRadius: 9999, background: SD.gray100, color: SD.gray700,
            fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {n}
        </span>
    );
}

// ───────────────────────── 공용 조각 ─────────────────────────

function PanelHead({ title, more, go }: { title: string; more?: string; go: Go }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: SD.gray900 }}>{title}</h2>
            {more && (
                <a {...onLink(go, more)} style={{ ...linkReset, display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 13, color: SD.gray600 }}>
                    전체 보기<SIcon name="chevronRight" size={14} stroke={2} />
                </a>
            )}
        </div>
    );
}

export function TripThumb({ src, alt, size, faded, icon = 'mapFold' }: { src: string; alt: string; size: number; faded?: boolean; icon?: string }) {
    const [broken, setBroken] = useState(false);
    if (!src || broken) {
        return (
            <span aria-hidden="true" style={{ flex: 'none', width: size, height: size, borderRadius: size >= 88 ? 12 : 10, background: SD.gray100, color: SD.gray400, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: faded ? 0.6 : 1 }}>
                <SIcon name={icon} size={Math.round(size * 0.32)} stroke={1.5} />
            </span>
        );
    }
    return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setBroken(true)}
        style={{ flex: 'none', width: size, height: size, borderRadius: size >= 88 ? 12 : 10, objectFit: 'cover', display: 'block', opacity: faded ? 0.6 : 1 }} />;
}

/** 입금 대기 예약 아래 회색 안내: 예약금 · 입금 계좌 · ‘입금 완료 알리기’(예약 상세로 가서 입금자명을 적는다). */
function DepositNotice({ r, go, style }: { r: MyReservation; go: Go; style?: CSSProperties }) {
    return (
        <div style={{ padding: '14px 16px', borderRadius: 12, background: SD.gray50, display: 'flex', alignItems: 'center', gap: 12, ...style }}>
            <span style={{ flex: 'none', color: SD.gray700, display: 'flex' }}><SIcon name="bankHouse" size={20} stroke={1.7} /></span>
            <span style={{ flex: '1 1 auto', fontSize: 13, lineHeight: 1.6, color: SD.gray700 }}>
                예약금{r.deposit > 0 && <> <strong style={{ color: SD.gray900 }}>{won(r.deposit)}</strong>을</> } 입금하고 ‘입금 완료’를 알려 주세요.{' '}
                <span style={{ color: SD.gray500 }}>{DEPOSIT_ACCOUNT.bank} {DEPOSIT_ACCOUNT.number}</span>
            </span>
            <button type="button" onClick={() => go(r.href)} style={boxButton('primary', 'small')}>입금 완료 알리기</button>
        </div>
    );
}

// ───────────────────────── 개요 ─────────────────────────

const QUICK: Array<{ title: string; sub: string; icon: string; to: string }> = [
    { title: '견적 요청', sub: '1분이면 요청할 수 있어요', icon: 'pencil', to: '/custom-estimate' },
    { title: '동행 찾기', sub: '여행 경비를 함께 나눠요', icon: 'userPlus', to: '/travel-mates' },
    { title: '후기 쓰기', sub: '다녀온 여행을 들려주세요', icon: 'reviewBubble', to: '/mypage/reviews' },
];

export function OverviewPanel({ bookings, quotes, productById, today, loading, go }: {
    bookings: MyReservation[]; quotes: MyQuote[]; productById: Map<string, HomeProduct>; today: string; loading: boolean; go: Go;
}) {
    const next = useMemo(() => pickNextTrip(bookings, today), [bookings, today]);
    const recentQuotes = quotes.slice(0, 3);
    return (
        <>
            <section style={card}>
                <PanelHead title="다음 여행" more={bookings.length > 0 ? '/mypage/reservations' : undefined} go={go} />
                {loading ? <Muted>불러오는 중…</Muted> : next ? <NextTrip r={next} productById={productById} today={today} go={go} /> : (
                    <EmptyBox icon="calendarPlain" title="아직 예정된 여행이 없어요" sub="몽골 투어를 둘러보고 첫 여행을 계획해 보세요."
                        action={<button type="button" onClick={() => go('/products')} style={boxButton('primary', 'small')}>투어 둘러보기</button>} />
                )}
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {QUICK.map((q) => (
                    <a key={q.title} {...onLink(go, q.to)}
                        style={{ ...linkReset, display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 14 }}>
                        <span style={{ flex: 'none', width: 40, height: 40, borderRadius: 12, background: SD.gray50, color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <SIcon name={q.icon} size={20} stroke={1.7} />
                        </span>
                        <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: SD.gray900 }}>{q.title}</span>
                            <span style={{ fontSize: 12, color: SD.gray600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.sub}</span>
                        </span>
                        <span style={{ color: SD.gray400, display: 'flex' }}><SIcon name="chevronRight" size={16} stroke={2} /></span>
                    </a>
                ))}
            </div>

            <section style={card}>
                <PanelHead title="최근 견적 요청" more={quotes.length > 0 ? '/mypage/estimates' : undefined} go={go} />
                {loading ? <Muted>불러오는 중…</Muted> : recentQuotes.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {recentQuotes.map((q, i) => <QuoteLine key={q.id} q={q} first={i === 0} go={go} />)}
                    </div>
                ) : (
                    <EmptyBox icon="quoteDoc" title="아직 요청한 견적이 없어요" sub="원하는 일정과 인원을 알려주시면 맞춤 견적을 보내드려요." 
                        action={<button type="button" onClick={() => go('/custom-estimate')} style={boxButton('tertiary', 'small')}>견적 요청하기</button>} />
                )}
            </section>
        </>
    );
}

function NextTrip({ r, productById, today, go }: { r: MyReservation; productById: Map<string, HomeProduct>; today: string; go: Go }) {
    const stage = bookingStage(r, today);
    const dd = ddayText(r, today);
    const length = nightsDaysText(r.start, r.end);
    return (
        <>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                <a {...onLink(go, r.href)} style={{ ...linkReset, display: 'flex' }}><TripThumb src={productImageOf(r, productById)} alt={r.productName} size={96} /></a>
                <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={chipStyle(stage.chip)}>{stage.label}</span>
                        {r.number && <span style={{ fontSize: 12, color: SD.gray600 }}>예약 번호 {r.number}</span>}
                    </span>
                    <a {...onLink(go, r.href)} style={{ ...linkReset, fontSize: 17, fontWeight: 700, color: SD.gray900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.productName}</a>
                    <span style={{ fontSize: 13, color: SD.gray600 }}>{[dateRangeText(r.start, r.end), length, r.travelers > 0 ? `성인 ${r.travelers}명` : ''].filter(Boolean).join(' · ')}</span>
                </div>
                {dd && (
                    <div style={{ flex: 'none', textAlign: 'right', paddingLeft: 20, borderLeft: `1px solid ${SD.gray100}` }}>
                        <span style={{ display: 'block', fontSize: 12, color: SD.gray600 }}>{dd === '여행 중' ? '지금' : '출발까지'}</span>
                        <strong style={{ display: 'block', marginTop: 2, fontSize: 26, color: DDAY_COLOR, fontVariantNumeric: 'tabular-nums' }}>{dd}</strong>
                    </div>
                )}
            </div>
            {stage.needsDeposit && <DepositNotice r={r} go={go} style={{ marginTop: 18 }} />}
        </>
    );
}

function QuoteLine({ q, first, go }: { q: MyQuote; first: boolean; go: Go }) {
    const st = quoteStage(q);
    return (
        <a {...onLink(go, q.href)} style={{ ...linkReset, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: first ? 'none' : `1px solid ${SD.gray100}` }}>
            <span style={{ flex: 'none', width: 40, height: 40, borderRadius: 12, background: SD.gray50, color: SD.gray700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SIcon name="quoteDoc" size={20} stroke={1.7} />
            </span>
            <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: SD.gray900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.destination ? `맞춤 견적 (${q.destination})` : '맞춤 견적'}</span>
                <span style={{ fontSize: 12, color: SD.gray600 }}>{[q.period, q.headcount, q.createdAt ? `요청일 ${q.createdAt.slice(0, 10)}` : ''].filter(Boolean).join(' · ')}</span>
            </span>
            <span style={chipStyle(st.chip)}>{st.label}</span>
            <span style={{ color: SD.gray400, display: 'flex' }}><SIcon name="chevronRight" size={16} stroke={2} /></span>
        </a>
    );
}

function EmptyBox({ icon, title, sub, action }: { icon: string; title: string; sub: string; action?: ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 12, border: `1px dashed ${SD.gray200}` }}>
            <span style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, background: SD.gray50, color: SD.gray600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SIcon name={icon} size={22} stroke={1.7} />
            </span>
            <span style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: SD.gray900 }}>{title}</span>
                <span style={{ fontSize: 13, color: SD.gray600 }}>{sub}</span>
            </span>
            {action && <div style={{ flex: 'none' }}>{action}</div>}
        </div>
    );
}

function Muted({ children }: { children: ReactNode }) {
    return <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 14, color: SD.gray600 }}>{children}</div>;
}

// ───────────────────────── 예약 내역 ─────────────────────────

const TABS: Array<{ key: 'all' | BookingTab; label: string }> = [
    { key: 'all', label: '전체' },
    { key: 'wait', label: '입금 대기' },
    { key: 'conf', label: '예약 확정' },
    { key: 'done', label: '지난 여행' },
];

export function BookingListPanel({ bookings, productById, today, loading, go }: {
    bookings: MyReservation[]; productById: Map<string, HomeProduct>; today: string; loading: boolean; go: Go;
}) {
    const [tab, setTab] = useState<'all' | BookingTab>('all');
    const staged = useMemo(() => bookings.map((r) => ({ r, stage: bookingStage(r, today) })), [bookings, today]);
    const count = (k: 'all' | BookingTab) => (k === 'all' ? staged.length : staged.filter((x) => x.stage.tab === k).length);
    const shown = staged.filter((x) => tab === 'all' || x.stage.tab === tab);

    return (
        <section style={card}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: SD.gray900 }}>예약 내역 <span style={{ color: SD.gray500 }}>{staged.length}</span></h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: SD.gray600 }}>예약 상태·결제·여행 서류는 각 예약의 상세 화면에서 확인할 수 있어요.</p>
            <div role="tablist" aria-label="예약 상태" style={{ marginTop: 18, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TABS.map((t) => {
                    const on = tab === t.key;
                    return (
                        <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)}
                            style={{ height: 36, padding: '0 14px', borderRadius: 9999, border: `1px solid ${on ? SD.gray900 : SD.gray200}`, background: on ? SD.gray900 : SD.white, color: on ? SD.white : SD.gray700,
                                fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            {t.label} <span style={{ fontWeight: 500, opacity: 0.7 }}>{count(t.key)}</span>
                        </button>
                    );
                })}
            </div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column' }}>
                {loading ? <div style={{ borderTop: `1px solid ${SD.gray100}` }}><Muted>불러오는 중…</Muted></div> : shown.map(({ r, stage }) => {
                    const dd = ddayText(r, today);
                    const past = stage.tab === 'done';
                    return (
                        <article key={`${r.source}:${r.id}`} style={{ padding: '20px 0', borderTop: `1px solid ${SD.gray100}` }}>
                            <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                                <a {...onLink(go, r.href)} style={{ ...linkReset, display: 'flex' }} tabIndex={-1} aria-hidden="true">
                                    <TripThumb src={productImageOf(r, productById)} alt="" size={88} faded={past} />
                                </a>
                                <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={chipStyle(stage.chip)}>{stage.label}</span>
                                        {r.number && <span style={{ fontSize: 12, color: SD.gray500 }}>예약 번호 {r.number}</span>}
                                    </span>
                                    <a {...onLink(go, r.href)} style={{ ...linkReset, fontSize: 16, fontWeight: 700, color: SD.gray900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.productName}</a>
                                    <span style={{ fontSize: 13, color: SD.gray600 }}>{[dateRangeText(r.start, r.end), r.travelers > 0 ? `성인 ${r.travelers}명` : ''].filter(Boolean).join(' · ')}</span>
                                </div>
                                <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <span style={{ textAlign: 'right' }}>
                                        {dd && <span style={{ display: 'block', fontSize: 11, color: SD.gray600 }}>{dd === '여행 중' ? '지금' : '출발까지'}</span>}
                                        <strong style={{ display: 'block', fontSize: 18, color: dd && stage.tab === 'wait' ? DDAY_COLOR : SD.gray500, fontVariantNumeric: 'tabular-nums' }}>{dd || stage.label}</strong>
                                    </span>
                                    <a {...onLink(go, r.href)} aria-label={`${r.productName} 예약 상세`}
                                        style={{ ...linkReset, width: 36, height: 36, borderRadius: 9999, border: `1px solid ${SD.gray200}`, color: SD.gray700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <SIcon name="chevronRight" size={16} stroke={2} />
                                    </a>
                                </div>
                            </div>
                            {stage.needsDeposit && <DepositNotice r={r} go={go} style={{ margin: '14px 0 0 106px', padding: '12px 14px' }} />}
                        </article>
                    );
                })}
                {!loading && shown.length === 0 && (
                    <div style={{ padding: '40px 20px', borderTop: `1px solid ${SD.gray100}`, textAlign: 'center', fontSize: 14, color: SD.gray600 }}>
                        {staged.length === 0 ? '아직 예약한 여행이 없어요.' : '이 상태의 예약이 없어요.'}
                    </div>
                )}
            </div>
        </section>
    );
}
