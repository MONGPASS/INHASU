import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../contexts/NotificationContext';
import { useHomeData } from '../../hooks/useHomeData';
import { toTourDateKey } from '../../utils/formatDate';
import { TripThumb } from '../mypage-desktop/MyPageHome.desktop';
import { DDAY_COLOR, bookingStage, boxButton, chipStyle, dateRangeText, ddayText, productImageOf, type BookingTab } from '../mypage-desktop/myBookingView';
import { useMe, useMyPageData } from '../mypage-desktop/useMyPageData';
import { MobileShell } from '../mobile/MobileShell';
import { useMobileShell } from '../mobile/mobileShellContext';
import { MLoading } from '../mobile/mobileUi';
import { SD, SIcon } from '../site-seed/seed';
import { DepositHint } from './MyPageMobile';

const TABS: Array<{ key: 'all' | BookingTab; label: string }> = [
    { key: 'all', label: '전체' },
    { key: 'wait', label: '입금 대기' },
    { key: 'conf', label: '예약 확정' },
    { key: 'done', label: '지난 여행' },
];

/**
 * 휴대폰 예약 내역(Claude Design ‘예약 내역 — 모바일’): ‘← 예약 내역 🔔’ 줄 → 붙는 상태 칩(전체·입금 대기·예약 확정·지난 여행) → 예약 줄.
 * 입금 대기 예약 아래에는 예약금·계좌와 ‘입금 완료 알리기’(예약 상세로).
 */
export function MyBookingsMobile() {
    const navigate = useNavigate();
    const { unreadCount } = useNotification();
    const go = (path: string) => {
        if (/\.html(?:[?#]|$)/i.test(path)) { window.location.assign(path); return; }
        navigate(path);
        window.scrollTo(0, 0);
    };
    const bell = (
        <button type="button" aria-label="알림" onClick={() => go('/mypage/notifications')}
            style={{ position: 'relative', width: 44, height: 44, border: 'none', background: 'transparent', color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <SIcon name="bell" size={22} stroke={1.7} />
            {unreadCount > 0 && <span aria-hidden="true" style={{ position: 'absolute', top: 10, right: 10, width: 6, height: 6, borderRadius: 9999, background: SD.mint500 }} />}
        </button>
    );
    return (
        <MobileShell title="예약 내역" onBack={() => go('/mypage')} brandHeader={false} titleAction={bell} footer={false}>
            <BookingsBody go={go} />
        </MobileShell>
    );
}

function BookingsBody({ go }: { go: (path: string) => void }) {
    const { stickyTop } = useMobileShell();
    const { data: me } = useMe();
    const { reservations } = useMyPageData(me);
    const { data: home } = useHomeData();
    const [today] = useState(() => toTourDateKey(new Date()));
    const [tab, setTab] = useState<'all' | BookingTab>('all');
    const productById = useMemo(() => new Map(home.products.map((p) => [p.id, p])), [home.products]);

    // 다가오는·진행 중인 여행이 먼저(가까운 출발 순), 지난 여행은 뒤(최근 순).
    const staged = useMemo(() => {
        const list = (reservations.data ?? []).map((r) => ({ r, stage: bookingStage(r, today) }));
        return list.sort((a, b) => {
            const pa = a.stage.tab === 'done', pb = b.stage.tab === 'done';
            if (pa !== pb) return Number(pa) - Number(pb);
            return pa ? b.r.start.localeCompare(a.r.start) : (a.r.start || '9999').localeCompare(b.r.start || '9999');
        });
    }, [reservations.data, today]);
    const count = (k: 'all' | BookingTab) => (k === 'all' ? staged.length : staged.filter((x) => x.stage.tab === k).length);
    const shown = staged.filter((x) => tab === 'all' || x.stage.tab === tab);
    const loading = !me || reservations.isPending;

    return (
        <div style={{ background: SD.white, color: SD.gray900, minHeight: '60vh' }}>
            <div role="tablist" aria-label="예약 상태" className="my-chip-scroll"
                style={{ position: 'sticky', top: stickyTop, zIndex: 5, background: SD.white, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '12px 20px', borderBottom: `1px solid ${SD.gray100}` }}>
                <style>{'.my-chip-scroll::-webkit-scrollbar{display:none}'}</style>
                {TABS.map((t) => {
                    const on = tab === t.key;
                    return (
                        <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)}
                            style={{ flex: 'none', height: 34, padding: '0 12px', borderRadius: 9999, border: `1px solid ${on ? SD.gray900 : SD.gray200}`, background: on ? SD.gray900 : SD.white,
                                color: on ? SD.white : SD.gray700, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {t.label} {loading ? '' : count(t.key)}
                        </button>
                    );
                })}
            </div>
            <div style={{ padding: '0 20px' }}>
                {loading ? <MLoading pad={48} /> : shown.map(({ r, stage }) => {
                    const dd = ddayText(r, today);
                    return (
                        <article key={`${r.source}:${r.id}`} style={{ padding: '18px 0', borderBottom: `1px solid ${SD.gray100}` }}>
                            <a href={r.href} onClick={(e) => { e.preventDefault(); go(r.href); }} style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: SD.gray900 }}>
                                <TripThumb src={productImageOf(r, productById)} alt={r.productName} size={72} faded={stage.tab === 'done'} />
                                <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={chipStyle(stage.chip, 'sm')}>{stage.label}</span>
                                        {dd && <strong style={{ fontSize: 12, color: stage.tab === 'wait' ? DDAY_COLOR : SD.gray500 }}>{dd}</strong>}
                                    </span>
                                    <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.productName}</span>
                                    <span style={{ fontSize: 12, color: SD.gray600 }}>{[dateRangeText(r.start, r.end, false), r.travelers > 0 ? `성인 ${r.travelers}명` : ''].filter(Boolean).join(' · ')}</span>
                                </span>
                                <span style={{ flex: 'none', color: SD.gray400, display: 'flex' }}><SIcon name="chevronRight" size={16} stroke={2} /></span>
                            </a>
                            {stage.needsDeposit && <DepositHint r={r} onReport={() => go(r.href)} />}
                        </article>
                    );
                })}
                {!loading && shown.length === 0 && (
                    <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: SD.gray600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                        {staged.length === 0 ? '아직 예약한 여행이 없어요.' : '이 상태의 예약이 없어요.'}
                        {staged.length === 0 && <button type="button" onClick={() => go('/products')} style={boxButton('primary', 'medium')}>투어 둘러보기</button>}
                    </div>
                )}
            </div>
        </div>
    );
}
