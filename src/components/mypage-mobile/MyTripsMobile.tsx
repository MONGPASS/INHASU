import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toTourDateKey } from '../../utils/formatDate';
import { reservationStatusLabel } from '../../utils/reservationDetail';
import { MW, MW_FONT_EN, won } from '../desktop-primitives/mwTokens';
import { QUOTE_STATUS } from '../mypage-desktop/myPageTheme';
import { useMe, useMyPageData, type MyQuote, type MyReservation } from '../mypage-desktop/useMyPageData';
import { MobileShell } from '../mobile/MobileShell';
import { D, M_HAIR, M_PAPER } from '../mobile/mobileTheme';
import { Ico, MEmpty, MLoading } from '../mobile/mobileUi';
import { QUOTE_NOTE, ddayLabel, softTone, tripPeriod, tripPhase } from './tripFormat';
import { TripsBar } from './TripsBar';

type TripsTab = 'bookings' | 'quote';

const TABS: Array<{ key: TripsTab; label: string; path: string }> = [
    { key: 'bookings', label: '예약 내역', path: '/mypage/reservations' },
    { key: 'quote', label: '견적 요청', path: '/mypage/estimates' },
];

/**
 * 내 여행 (Claude Design: "M My Trips"): reservations and quote requests as two tabs, each
 * on its own route so deep links and the my page shortcuts keep working.
 */
export function MyTripsMobile({ tab }: { tab: TripsTab }) {
    const navigate = useNavigate();
    const { data: me } = useMe();
    const { reservations, quotes } = useMyPageData(me);
    // Captured once so render stays pure.
    const [today] = useState(() => toTourDateKey(new Date()));

    // Upcoming and ongoing trips first (nearest departure on top), finished ones after (latest first).
    const bookings = useMemo(() => {
        const list = (reservations.data ?? []).map((r) => ({ r, past: tripPhase(r, today) === 'past' }));
        return list.sort((a, b) => Number(a.past) - Number(b.past) || (a.past ? b.r.start.localeCompare(a.r.start) : a.r.start.localeCompare(b.r.start)));
    }, [reservations.data, today]);
    const quoteList = quotes.data ?? [];
    const counts: Record<TripsTab, number | undefined> = { bookings: reservations.data?.length, quote: quotes.data?.length };
    const loading = !me || (tab === 'bookings' ? reservations.isPending : quotes.isPending);

    const go = (path: string) => {
        navigate(path);
        window.scrollTo(0, 0);
    };

    return (
        <MobileShell>
            <TripsBar title="내 여행" onBack={() => go('/mypage')}>
                <div role="tablist" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
                    {TABS.map((t) => {
                        const on = t.key === tab;
                        const count = counts[t.key];
                        return (
                            <button
                                key={t.key}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                onClick={() => { if (!on) navigate(t.path, { replace: true }); }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, border: 0, borderBottom: `3px solid ${on ? MW.mint : 'transparent'}`, background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 900 : 700, color: on ? MW.mintDeep : MW.mute2, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                                {t.label}
                                {count !== undefined && (
                                    <span style={{ minWidth: 20, height: 20, padding: '0 6px', boxSizing: 'border-box', borderRadius: 999, background: on ? MW.mintTint : MW.chip, color: on ? MW.mintDeep : MW.mute2, fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </TripsBar>

            <section style={{ background: M_PAPER, minHeight: '60vh', padding: '16px 16px 36px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {loading ? (
                    <MLoading />
                ) : tab === 'bookings' ? (
                    bookings.length > 0 ? (
                        bookings.map(({ r, past }) => <BookingCard key={r.id} r={r} past={past} today={today} onOpen={() => go(`/mypage/reservations/${r.id}`)} />)
                    ) : (
                        <MEmpty text="아직 예약이 없습니다." action={{ label: '투어 찾기', onClick: () => go('/products') }} />
                    )
                ) : quoteList.length > 0 ? (
                    <>
                        {quoteList.map((q) => (
                            // Same target as the PC list: a converted quote lives on as a reservation.
                            <QuoteCard key={q.id} q={q} href={q.status === 'converted' ? '/mypage/reservations' : `/estimate/${q.id}`} go={go} />
                        ))}
                        <button
                            type="button"
                            onClick={() => go('/custom-estimate')}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, marginTop: 4, border: `1.5px dashed ${MW.mint}`, borderRadius: 999, background: MW.mintBg, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.mintDeep, cursor: 'pointer' }}
                        >
                            + 새 견적 요청하기
                        </button>
                    </>
                ) : (
                    <MEmpty text="아직 견적 요청이 없습니다." action={{ label: '견적 요청하기', onClick: () => go('/custom-estimate') }} />
                )}
            </section>
        </MobileShell>
    );
}

const cardStyle = { display: 'flex', flexDirection: 'column', gap: 12, padding: 18, borderRadius: 20, background: '#FFFFFF', border: `1px solid ${MW.line}`, color: MW.navy, textDecoration: 'none' } as const;
const titleStyle = { fontSize: 17, fontWeight: 900, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;

/** Date and head-count line under a card title; either part may be missing. */
function MetaLine({ period, people }: { period: string; people: string }) {
    const part = (d: string, text: ReactNode) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Ico d={d} size={17} color={MW.mute} width={1.7} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
        </span>
    );
    if (!period && !people) return null;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: MW.ink3, whiteSpace: 'nowrap', marginTop: -4, minWidth: 0 }}>
            {period && part(D.calendar, period)}
            {period && people && <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#B8C4C1', flexShrink: 0 }} />}
            {people && part(D.people, people)}
        </div>
    );
}

function BookingCard({ r, past, today, onOpen }: { r: MyReservation; past: boolean; today: string; onOpen: () => void }) {
    const tone = softTone(r.status);
    const dday = ddayLabel(r, today);
    return (
        <a href={`/mypage/reservations/${r.id}`} onClick={(e) => { e.preventDefault(); onOpen(); }} style={{ ...cardStyle, opacity: past ? 0.75 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: tone.fg, background: tone.bg, boxShadow: `inset 0 0 0 1px ${tone.bd}`, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                    {reservationStatusLabel(r.status, r.depositReported, r.status || '준비 중')}
                </span>
                {dday && <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, color: MW.mintDeep }}>{dday}</span>}
            </div>
            <span style={titleStyle}>{r.productName}</span>
            <MetaLine period={tripPeriod(r.start, r.end)} people={r.travelers > 0 ? `${r.travelers}명` : ''} />
            {r.payTotal > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: `1px solid ${M_HAIR}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, color: MW.mute }}>
                        <span>결제 {r.payPercent}%</span>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, color: MW.navy }}>{won(r.payTotal)}</span>
                    </div>
                    <span style={{ height: 6, borderRadius: 999, background: M_HAIR, overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${Math.min(100, r.payPercent)}%`, background: 'linear-gradient(90deg,#27AB8F,#3FC2A4)', borderRadius: 999 }} />
                    </span>
                </div>
            )}
            <span style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, height: 32, fontSize: 13, fontWeight: 700, color: MW.mintDeep }}>
                자세히 보기
                <Ico d={D.chevron} size={14} color={MW.mintDeep} width={2.2} />
            </span>
        </a>
    );
}

function QuoteCard({ q, href, go }: { q: MyQuote; href: string; go: (path: string) => void }) {
    const st = QUOTE_STATUS[q.status] || QUOTE_STATUS.new;
    const next = QUOTE_NOTE[q.status] || QUOTE_NOTE.new;
    return (
        <a href={href} onClick={(e) => { e.preventDefault(); go(href); }} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: st.tone.fg, background: st.tone.bg, border: `1px solid ${st.tone.bd}`, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>{st.label}</span>
                {q.createdAt && <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, color: MW.mute2 }}>{q.createdAt.slice(0, 10).replace(/-/g, '.')}</span>}
            </div>
            <span style={titleStyle}>{q.destination || '맞춤 견적'}</span>
            <MetaLine period={q.period} people={q.headcount} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: next.cta ? MW.mintBg : M_PAPER, fontSize: 12, color: next.cta ? MW.navy : MW.mute }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{next.note}</span>
                {next.cta && <span style={{ flexShrink: 0, fontWeight: 700, color: MW.mintDeep }}>{next.cta} →</span>}
            </div>
        </a>
    );
}
