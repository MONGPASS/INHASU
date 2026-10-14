import { useState, type CSSProperties, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { openKakaoConsultation } from '../../lib/consultation';
import { useNotification, type Notification } from '../../contexts/NotificationContext';
import { useToast } from '../ui/Toast';
import { formatRelativeTime } from '../../utils/formatDate';
import { reservationStatusLabel } from '../../utils/reservationDetail';
import type { HomeProduct, ReviewStat } from '../home-desktop/homeDesktopData';
import { MW, MW_FONT_EN, MW_GRADIENT, cleanTitle, isUsableImage, won } from '../desktop-primitives/mwTokens';
import { EmptyBox, FilterPills, Ico, Loading, PanelHead } from './myPageUi';
import { HAIR, ICON, NOTICE_TYPES, PAPER, QUOTE_STATUS, TONE, cardBox, ghostBtn, ghostHover, hover, mintBtn, mintHover, reservationTone, smallPill, type BadgeTone } from './myPageTheme';
import { daysUntil, parseDbTime, type MeUser, type MyMatePost, type MyQuote, type MyReservation, type MyReview, type RecentItem } from './useMyPageData';

type Go = (path: string) => void;

/* ---------- shared rows ---------- */

const dateRange = (start: string, end: string) => [start, end].filter(Boolean).join(' ~ ');

const reservationMeta = (r: MyReservation) => [dateRange(r.start, r.end), r.travelers > 0 ? `${r.travelers}명` : ''].filter(Boolean).join(' · ');

function Badge({ label, tone, style }: { label: string; tone: BadgeTone; style?: CSSProperties }) {
    return (
        <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 999, background: tone.bg, color: tone.fg, border: `1px solid ${tone.bd}`, whiteSpace: 'nowrap', ...style }}>
            {label}
        </span>
    );
}

function ListRow({ title, meta, badge, onClick, extra }: { title: string; meta: string; badge: ReactNode; onClick: () => void; extra?: ReactNode }) {
    return (
        <a
            href="#"
            onClick={(e) => { e.preventDefault(); onClick(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 14, background: PAPER, color: MW.navy, textDecoration: 'none' }}
            {...hover({ background: MW.mintBg }, { background: PAPER })}
        >
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                {meta && <span style={{ fontSize: 13, color: MW.mute }}>{meta}</span>}
            </div>
            {extra}
            {badge}
        </a>
    );
}

function Thumb({ src, size, radius = 12 }: { src?: string; size: number; radius?: number }) {
    return (
        <span style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', flexShrink: 0, background: MW.mintTint, display: 'block' }}>
            {isUsableImage(src) && <img src={src} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
        </span>
    );
}

function QuoteRows({ quotes, go }: { quotes: MyQuote[]; go: Go }) {
    return (
        <>
            {quotes.map((q) => {
                const st = QUOTE_STATUS[q.status] || QUOTE_STATUS.new;
                const requested = q.createdAt ? `요청일 ${q.createdAt.slice(0, 10)}` : '';
                return (
                    <ListRow
                        key={q.id}
                        title={q.destination ? `맞춤 견적 (${q.destination})` : '맞춤 견적'}
                        meta={[q.period, q.headcount, requested].filter(Boolean).join(' · ')}
                        badge={<Badge label={st.label} tone={st.tone} />}
                        onClick={() => go(q.status === 'converted' ? '/mypage/reservations' : `/estimate/${q.id}`)}
                    />
                );
            })}
        </>
    );
}

function ReservationRows({ reservations, today, go }: { reservations: MyReservation[]; today: string; go: Go }) {
    return (
        <>
            {reservations.map((r) => {
                const d = r.start && r.status !== 'cancelled' ? daysUntil(r.start, today) : -1;
                return (
                    <ListRow
                        key={r.id}
                        title={r.productName}
                        meta={reservationMeta(r)}
                        extra={d >= 0 && d <= 90 ? <DayChip days={d} /> : undefined}
                        badge={<Badge label={reservationStatusLabel(r.status, r.depositReported, r.status || '준비 중')} tone={reservationTone(r.status)} />}
                        onClick={() => go(`/mypage/reservations/${r.id}`)}
                    />
                );
            })}
        </>
    );
}

function DayChip({ days }: { days: number }) {
    return (
        <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, color: MW.mintDeep, background: MW.mintTint, padding: '6px 10px', borderRadius: 999, flexShrink: 0 }}>
            {days === 0 ? 'D-DAY' : `D-${days}`}
        </span>
    );
}

/* ---------- 개요 ---------- */

export function OverviewSection({
    reservations, quotes, wishCount, today, productById, loading, go,
}: {
    reservations: MyReservation[];
    quotes: MyQuote[];
    wishCount: number;
    today: string;
    productById: Map<string, HomeProduct>;
    loading: boolean;
    go: Go;
}) {
    const active = reservations.filter((r) => !['cancelled', 'completed'].includes(r.status) && (r.end || r.start) >= today);
    const next = reservations
        .filter((r) => r.status !== 'cancelled' && !!r.start && r.start >= today)
        .sort((a, b) => a.start.localeCompare(b.start))[0];
    const stats = [
        { label: '예약', value: reservations.length, d: ICON.bookings, path: '/mypage/reservations' },
        { label: '진행 중', value: active.length, d: ICON.active, path: '/mypage/reservations' },
        { label: '견적', value: quotes.length, d: ICON.quotes, path: '/mypage/estimates' },
        { label: '찜', value: wishCount, d: ICON.wish, path: '/mypage/wishlist' },
    ];

    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,160px),1fr))', gap: 16 }}>
                {stats.map((s) => (
                    <button
                        key={s.label}
                        type="button"
                        onClick={() => go(s.path)}
                        style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 20, border: `1px solid ${MW.line}`, borderRadius: 20, background: '#fff', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', transition: 'border-color .15s,transform .15s', color: MW.navy }}
                        {...hover({ borderColor: MW.mint, transform: 'translateY(-2px)' }, { borderColor: MW.line, transform: '' })}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, width: '100%' }}>
                            <span style={{ width: 40, height: 40, borderRadius: 12, background: MW.mintBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Ico d={s.d} />
                            </span>
                            <span style={{ color: MW.mute2, fontSize: 14 }}>↗</span>
                        </div>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 24, fontWeight: 600 }}>{loading ? '—' : s.value}</span>
                        <span style={{ fontSize: 13, color: MW.mute }}>{s.label}</span>
                    </button>
                ))}
            </div>

            <div style={{ ...cardBox, gap: 20 }}>
                <PanelHead
                    eyebrow="UPCOMING TRIP"
                    title="다음 예약"
                    action={<button type="button" onClick={() => go('/mypage/reservations')} style={{ ...ghostBtn, color: MW.navy }} {...hover({ borderColor: MW.mint }, { borderColor: MW.line })}>전체 보기 →</button>}
                />
                {loading ? (
                    <Loading />
                ) : next ? (
                    <a
                        href={`/mypage/reservations/${next.id}`}
                        onClick={(e) => { e.preventDefault(); go(`/mypage/reservations/${next.id}`); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', borderRadius: 16, background: PAPER, color: MW.navy, textDecoration: 'none' }}
                        {...hover({ background: MW.mintBg }, { background: PAPER })}
                    >
                        <Thumb src={productById.get(next.productId)?.mainImages[0]} size={72} />
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                            <Badge label={reservationStatusLabel(next.status, next.depositReported)} tone={reservationTone(next.status)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6 }} />
                            <span style={{ fontSize: 16, fontWeight: 900 }}>{next.productName}</span>
                            <span style={{ fontSize: 13, color: MW.mute }}>{reservationMeta(next)}</span>
                        </div>
                        <DayChip days={daysUntil(next.start, today)} />
                        <span style={{ color: MW.mute, fontSize: 18 }}>›</span>
                    </a>
                ) : (
                    <EmptyBox text="예정된 예약이 없습니다." action={{ label: '투어 찾기', onClick: () => go('/products') }} />
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: 12 }}>
                <QuickLink primary title="견적 요청" sub="1분이면 요청 완료" d={ICON.quoteRequest} onClick={() => go('/custom-estimate')} />
                <QuickLink title="동행 찾기" sub="여행 경비 분담" d={ICON.mateAdd} onClick={() => go('/travel-mates/write')} />
                <QuickLink title="후기 쓰기" sub="경험 나누기" d={ICON.reviews} onClick={() => go('/reviews/write')} />
            </div>

            <div style={{ ...cardBox, gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 6 }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>최근 견적 요청</h2>
                    <button type="button" onClick={() => go('/mypage/estimates')} style={{ ...ghostBtn, color: MW.navy }} {...hover({ borderColor: MW.mint }, { borderColor: MW.line })}>전체 보기 →</button>
                </div>
                {loading ? <Loading /> : quotes.length > 0 ? (
                    <QuoteRows quotes={quotes.slice(0, 3)} go={go} />
                ) : (
                    <EmptyBox text="아직 견적 요청이 없습니다." action={{ label: '견적 요청하기', onClick: () => go('/custom-estimate') }} />
                )}
            </div>
        </>
    );
}

function QuickLink({ title, sub, d, onClick, primary }: { title: string; sub: string; d: string; onClick: () => void; primary?: boolean }) {
    const base: CSSProperties = primary
        ? { background: MW_GRADIENT, border: '1px solid transparent' }
        : { background: '#fff', border: `1px solid ${MW.line}` };
    return (
        <a
            href="#"
            onClick={(e) => { e.preventDefault(); onClick(); }}
            style={{ ...base, display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', borderRadius: 18, color: MW.navy, textDecoration: 'none', transition: 'transform .15s,border-color .15s' }}
            {...hover(
                primary ? { transform: 'translateY(-2px)' } : { transform: 'translateY(-2px)', borderColor: MW.mint },
                primary ? { transform: '' } : { transform: '', borderColor: MW.line },
            )}
        >
            <span style={{ width: 48, height: 48, borderRadius: 14, background: primary ? 'rgba(255,255,255,0.4)' : MW.mintBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico d={d} size={22} color={primary ? MW.navy : MW.mintDeep} />
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 900, whiteSpace: 'nowrap' }}>{title}</span>
                <span style={{ fontSize: 12, color: primary ? MW.navy : MW.mute }}>{sub}</span>
            </span>
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: primary ? 'rgba(255,255,255,0.4)' : PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, color: primary ? MW.navy : MW.mintDeep }}>→</span>
        </a>
    );
}

/* ---------- 예약 내역 / 견적 내역 ---------- */

export function ReservationsSection({ reservations, today, loading, go }: { reservations: MyReservation[]; today: string; loading: boolean; go: Go }) {
    return (
        <div style={{ ...cardBox, gap: 12 }}>
            <div style={{ marginBottom: 6 }}>
                <PanelHead eyebrow="BOOKINGS" title="예약 내역" count={loading ? undefined : reservations.length} sub="예약 상태·결제·여행 서류는 각 예약의 상세 화면에서 확인할 수 있습니다." />
            </div>
            {loading ? <Loading /> : reservations.length > 0 ? (
                <ReservationRows reservations={reservations} today={today} go={go} />
            ) : (
                <EmptyBox text="아직 예약이 없습니다." action={{ label: '투어 찾기', onClick: () => go('/products') }} />
            )}
        </div>
    );
}

export function EstimatesSection({ quotes, loading, go }: { quotes: MyQuote[]; loading: boolean; go: Go }) {
    return (
        <div style={{ ...cardBox, gap: 12 }}>
            <div style={{ marginBottom: 6 }}>
                <PanelHead
                    eyebrow="QUOTES"
                    title="견적 내역"
                    count={loading ? undefined : quotes.length}
                    sub="맞춤 여행 견적 요청과 답변 현황입니다."
                    action={<button type="button" onClick={() => go('/custom-estimate')} style={mintBtn} {...mintHover}>+ 새로 요청하기</button>}
                />
            </div>
            {loading ? <Loading /> : quotes.length > 0 ? (
                <QuoteRows quotes={quotes} go={go} />
            ) : (
                <EmptyBox text="아직 견적 요청이 없습니다." action={{ label: '견적 요청하기', onClick: () => go('/custom-estimate') }} />
            )}
        </div>
    );
}

/* ---------- 동행 찾기 글 ---------- */

type MateFilter = 'all' | 'open' | 'closed';

export function MatesSection({ me, posts, loading, go }: { me: MeUser; posts: MyMatePost[]; loading: boolean; go: Go }) {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const [filter, setFilter] = useState<MateFilter>('all');
    const key = ['myPage', 'mates', me.id];
    const items = posts.filter((p) => filter === 'all' || (filter === 'closed' ? p.status === 'closed' : p.status !== 'closed'));
    const write = () => go('/travel-mates/write');

    const toggleStatus = async (p: MyMatePost) => {
        const status = p.status === 'recruiting' ? 'closed' : 'recruiting';
        try {
            await api.travelMates.update(p.id, { status });
            queryClient.setQueryData<MyMatePost[]>(key, (cur = []) => cur.map((x) => (x.id === p.id ? { ...x, status } : x)));
        } catch (e) {
            console.error('Travel mate status update failed:', e);
            showToast('error', '모집 상태를 변경하지 못했습니다.');
        }
    };
    const remove = async (p: MyMatePost) => {
        if (!window.confirm('이 글을 삭제하시겠습니까?')) return;
        try {
            await api.travelMates.delete(p.id);
            queryClient.setQueryData<MyMatePost[]>(key, (cur = []) => cur.filter((x) => x.id !== p.id));
        } catch (e) {
            console.error('Travel mate delete failed:', e);
            showToast('error', '글을 삭제하지 못했습니다.');
        }
    };

    return (
        <div style={cardBox}>
            <PanelHead
                eyebrow="TRAVEL MATES"
                title="동행 찾기 글"
                count={loading ? undefined : posts.length}
                sub="함께 여행할 동행을 모집해 차량·가이드 비용을 나눌 수 있습니다."
                action={<button type="button" onClick={write} style={mintBtn} {...mintHover}>+ 새 글 쓰기</button>}
            />
            <FilterPills<MateFilter> items={[['all', '전체'], ['open', '모집 중'], ['closed', '모집 마감']]} value={filter} onChange={setFilter} />
            {loading ? <Loading /> : items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {items.map((p) => {
                        const closed = p.status === 'closed';
                        const tone = closed ? TONE.done : TONE.tint;
                        const pct = p.capacity > 0 ? Math.min(100, Math.round((p.joined / p.capacity) * 100)) : 0;
                        return (
                            <div
                                key={p.id}
                                style={{ display: 'flex', gap: 18, padding: '18px 20px', border: `1px solid ${MW.line}`, borderRadius: 18, background: '#fff', flexWrap: 'wrap', alignItems: 'center' }}
                                {...hover({ borderColor: MW.mint }, { borderColor: MW.line })}
                            >
                                <a
                                    href={`/travel-mates/${p.id}`}
                                    onClick={(e) => { e.preventDefault(); go(`/travel-mates/${p.id}`); }}
                                    style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, color: MW.navy, textDecoration: 'none' }}
                                >
                                    <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: tone.bg, color: tone.fg }}>{closed ? '모집 마감' : '모집 중'}</span>
                                        {p.region && <span style={{ fontSize: 12, color: MW.mute }}>{p.region}</span>}
                                    </span>
                                    <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.4, color: closed ? MW.mute : MW.navy }}>{p.title}</span>
                                    <span style={{ display: 'flex', gap: 16, fontSize: 12, color: MW.mute, flexWrap: 'wrap' }}>
                                        {(p.start || p.end) && <span>{dateRange(p.start, p.end)}{p.duration ? ` (${p.duration})` : ''}</span>}
                                        <span>댓글 {p.comments}</span>
                                        <span>조회 {p.views}</span>
                                        {p.createdAt && <span>{formatRelativeTime(parseDbTime(p.createdAt))}</span>}
                                    </span>
                                </a>
                                <span style={{ flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {p.capacity > 0 && (
                                        <>
                                            <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MW.mute }}>
                                                <span>참가자</span>
                                                <strong style={{ fontFamily: MW_FONT_EN, fontWeight: 600, color: MW.navy }}>{p.joined} / {p.capacity}명</strong>
                                            </span>
                                            <span style={{ height: 6, borderRadius: 999, background: HAIR, overflow: 'hidden' }}>
                                                <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#27AB8F,#3FC2A4)', borderRadius: 999 }} />
                                            </span>
                                        </>
                                    )}
                                    <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                        <button type="button" onClick={() => toggleStatus(p)} style={smallPill} {...ghostHover}>{closed ? '모집 재개' : '모집 마감'}</button>
                                        <button type="button" onClick={() => remove(p)} style={smallPill} {...ghostHover}>삭제</button>
                                    </span>
                                </span>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <EmptyBox text={posts.length ? '해당하는 글이 없습니다.' : '아직 작성한 글이 없습니다.'} action={{ label: '+ 새 글 쓰기', onClick: write }} />
            )}
        </div>
    );
}

/* ---------- 찜 목록 / 최근 본 상품 ---------- */

export interface TripCardData {
    key: string;
    productId: string;
    title: string;
    image?: string;
    duration?: string;
    category?: string;
    price: number;
}

function TripCard({ t, stat, fav, onFav, onRemove, removeLabel = '찜 목록에서 삭제', go }: {
    t: TripCardData;
    stat?: ReviewStat;
    fav: boolean;
    onFav: () => void;
    onRemove?: () => void;
    removeLabel?: string;
    go: Go;
}) {
    const stop = (fn: () => void) => (e: { preventDefault: () => void; stopPropagation: () => void }) => { e.preventDefault(); e.stopPropagation(); fn(); };
    const roundBtn: CSSProperties = { width: 34, height: 34, border: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
    return (
        <a
            href={`/products/${t.productId}`}
            onClick={(e) => { e.preventDefault(); go(`/products/${t.productId}`); }}
            style={{ position: 'relative', display: 'flex', flexDirection: 'column', border: `1px solid ${MW.line}`, borderRadius: 18, overflow: 'hidden', background: '#fff', color: MW.navy, textDecoration: 'none', transition: 'border-color .15s,transform .15s' }}
            {...hover({ borderColor: MW.mint, transform: 'translateY(-2px)' }, { borderColor: MW.line, transform: '' })}
        >
            <span style={{ position: 'relative', display: 'block', aspectRatio: '4/3', background: MW.chip }}>
                {isUsableImage(t.image) && <img src={t.image} alt={t.title} loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                {t.duration && (
                    <span style={{ position: 'absolute', left: 12, top: 12, fontSize: 11, fontWeight: 700, color: MW.navy, background: 'rgba(255,255,255,0.92)', padding: '4px 9px', borderRadius: 999 }}>{t.duration}</span>
                )}
                <span style={{ position: 'absolute', right: 10, top: 10, display: 'flex', gap: 6 }}>
                    <button type="button" onClick={stop(onFav)} aria-label={fav ? '찜 해제' : '찜하기'} aria-pressed={fav} style={roundBtn}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill={fav ? MW.mint : 'none'} stroke={fav ? MW.mint : MW.navy} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d={ICON.wish} />
                        </svg>
                    </button>
                    {onRemove && (
                        <button type="button" onClick={stop(onRemove)} aria-label={removeLabel} style={{ ...roundBtn, fontSize: 15, color: MW.mute, fontFamily: 'inherit' }}>×</button>
                    )}
                </span>
            </span>
            <span style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.4 }}>{t.title}</span>
                {t.category && <span style={{ fontSize: 12, color: MW.mute, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.category}</span>}
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
                    <span style={{ fontSize: 12, color: MW.mute }}>
                        {stat && stat.count > 0 && (
                            <><span style={{ color: MW.mintDeep }}>★</span> <strong style={{ color: MW.navy }}>{stat.avg.toFixed(1)}</strong> ({stat.count})</>
                        )}
                    </span>
                    {t.price > 0 && (
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 15, fontWeight: 600 }}>
                            {won(t.price)}<span style={{ fontFamily: 'inherit', fontSize: 11, fontWeight: 500, color: MW.mute }}>~</span>
                        </span>
                    )}
                </span>
            </span>
        </a>
    );
}

const productCard = (p: HomeProduct): TripCardData => ({
    key: p.id,
    productId: p.id,
    title: cleanTitle(p.name),
    image: p.mainImages[0],
    duration: p.duration,
    category: p.category,
    price: p.price,
});

const cardGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,240px),1fr))', gap: 16 };

export function WishlistSection({ items, stats, onRemove, onClearAll, go }: {
    items: HomeProduct[];
    stats: Record<string, ReviewStat>;
    onRemove: (p: HomeProduct) => void;
    onClearAll: () => void;
    go: Go;
}) {
    return (
        <div style={cardBox}>
            <PanelHead
                eyebrow="WISHLIST"
                title="찜 목록"
                count={items.length}
                sub="♡를 누른 투어가 저장됩니다. 가격과 일정을 한눈에 비교할 수 있습니다."
                action={items.length > 0 ? <button type="button" onClick={onClearAll} style={ghostBtn} {...ghostHover}>전체 삭제</button> : undefined}
            />
            {items.length > 0 ? (
                <div style={cardGrid}>
                    {items.map((p) => (
                        <TripCard key={p.id} t={productCard(p)} stat={stats[p.id]} fav onFav={() => onRemove(p)} onRemove={() => onRemove(p)} go={go} />
                    ))}
                </div>
            ) : (
                <EmptyBox text="아직 찜한 투어가 없습니다. 투어의 ♡를 눌러 저장해 보세요." action={{ label: '투어 찾기', onClick: () => go('/products') }} />
            )}
        </div>
    );
}

const WEEK = '일월화수목금토';
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function RecentSection({ items, now, productById, stats, isFav, onFav, onRemove, onClearAll, loading, go }: {
    items: RecentItem[];
    now: number;
    productById: Map<string, HomeProduct>;
    stats: Record<string, ReviewStat>;
    isFav: (productId: string) => boolean;
    onFav: (item: TripCardData) => void;
    /** Takes one tour out of the history. */
    onRemove: (productId: string) => void;
    onClearAll: () => void;
    loading: boolean;
    go: Go;
}) {
    const today = new Date(now);
    const yesterday = new Date(now - 86_400_000);
    const label = (d: Date) =>
        dayKey(d) === dayKey(today) ? '오늘' : dayKey(d) === dayKey(yesterday) ? '어제' : `${d.getMonth() + 1}월 ${d.getDate()}일(${WEEK[d.getDay()]})`;

    const groups: Array<{ label: string; cards: TripCardData[] }> = [];
    for (const it of items) {
        const d = parseDbTime(it.viewedAt);
        const g = Number.isNaN(d.getTime()) ? '이전' : label(d);
        const p = productById.get(it.productId);
        const card: TripCardData = p
            ? productCard(p)
            : { key: it.productId, productId: it.productId, title: cleanTitle(it.title), image: it.image, category: it.category, price: it.price };
        const last = groups[groups.length - 1];
        if (last && last.label === g) last.cards.push(card);
        else groups.push({ label: g, cards: [card] });
    }

    return (
        <div style={{ ...cardBox, gap: 24 }}>
            <PanelHead
                eyebrow="RECENTLY VIEWED"
                title="최근 본 상품"
                count={loading ? undefined : items.length}
                sub="최근에 본 투어(최대 20건)가 표시됩니다."
                action={!loading && items.length > 0 ? <button type="button" onClick={onClearAll} style={ghostBtn} {...ghostHover}>전체 삭제</button> : undefined}
            />
            {loading ? <Loading /> : groups.length > 0 ? (
                groups.map((g) => (
                    <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap' }}>{g.label}</span>
                            <span style={{ flex: 1, height: 1, background: HAIR }} />
                        </div>
                        <div style={cardGrid}>
                            {g.cards.map((c) => (
                                <TripCard key={c.key} t={c} stat={stats[c.productId]} fav={isFav(c.productId)} onFav={() => onFav(c)} onRemove={() => onRemove(c.productId)} removeLabel="기록에서 삭제" go={go} />
                            ))}
                        </div>
                    </div>
                ))
            ) : (
                <EmptyBox text="아직 최근 본 상품이 없습니다." action={{ label: '투어 찾기', onClick: () => go('/products') }} />
            )}
        </div>
    );
}

/* ---------- 내 후기 ---------- */

export function ReviewsSection({ me, reviews, pending, productById, loading, go }: {
    me: MeUser;
    reviews: MyReview[];
    pending: MyReservation[];
    productById: Map<string, HomeProduct>;
    loading: boolean;
    go: Go;
}) {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const remove = async (r: MyReview) => {
        if (!window.confirm('이 후기를 삭제하시겠습니까?')) return;
        try {
            await api.reviews.delete(r.id);
            queryClient.setQueryData<MyReview[]>(['myPage', 'reviews', me.id], (cur = []) => cur.filter((x) => x.id !== r.id));
        } catch (e) {
            console.error('Review delete failed:', e);
            showToast('error', '후기를 삭제하지 못했습니다.');
        }
    };

    return (
        <div style={cardBox}>
            <PanelHead eyebrow="MY REVIEWS" title="내 후기" sub="참여하신 투어의 소감을 들려주세요." />
            {loading ? <Loading /> : (
                <>
                    {pending.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <span style={{ fontSize: 14, fontWeight: 900 }}>작성 가능한 후기 <span style={{ color: MW.mintDeep }}>{pending.length}</span></span>
                            {pending.map((r) => (
                                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 18, background: `linear-gradient(135deg,${MW.mintBg} 0%,#FFFFFF 80%)`, border: `1px solid ${MW.mintTint}`, flexWrap: 'wrap' }}>
                                    <Thumb src={productById.get(r.productId)?.mainImages[0]} size={64} />
                                    <span style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <span style={{ fontSize: 15, fontWeight: 900 }}>{r.productName}</span>
                                        <span style={{ fontSize: 12, color: MW.mute }}>{dateRange(r.start, r.end)}</span>
                                    </span>
                                    <button type="button" onClick={() => go(`/reviews/write?reservationId=${encodeURIComponent(r.id)}`)} style={mintBtn} {...mintHover}>후기 쓰기</button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 900 }}>작성한 후기 <span style={{ color: MW.mintDeep }}>{reviews.length}</span></span>
                        {reviews.length === 0 && (
                            <EmptyBox text="아직 작성한 후기가 없습니다. 여행의 추억을 나눠 보세요." action={{ label: '후기 쓰기', onClick: () => go('/reviews/write') }} />
                        )}
                        {reviews.map((r) => (
                            <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20, border: `1px solid ${MW.line}`, borderRadius: 18, background: '#fff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                                    <a
                                        href={`/reviews/${r.id}`}
                                        onClick={(e) => { e.preventDefault(); go(`/reviews/${r.id}`); }}
                                        style={{ fontSize: 15, fontWeight: 900, color: MW.navy, textDecoration: 'none' }}
                                        {...hover({ color: MW.mintDeep }, { color: MW.navy })}
                                    >
                                        {r.productName}
                                    </a>
                                    <button type="button" onClick={() => remove(r)} style={smallPill} {...ghostHover}>삭제</button>
                                </div>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }} aria-label={`5점 만점에 ${r.rating}점`}>
                                    <span style={{ fontSize: 15, letterSpacing: 2, color: MW.mint }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                                    <strong style={{ fontFamily: MW_FONT_EN, fontSize: 13, fontWeight: 600 }}>{r.rating.toFixed(1)}</strong>
                                </span>
                                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: MW.ink3, whiteSpace: 'pre-wrap', textWrap: 'pretty' }}>{r.content}</p>
                                {r.images.filter(isUsableImage).length > 0 && (
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {r.images.filter(isUsableImage).slice(0, 4).map((src, i) => (
                                            <img key={i} src={src} alt={`후기 사진 ${i + 1}`} loading="lazy" decoding="async" style={{ width: 88, height: 88, borderRadius: 12, objectFit: 'cover', background: MW.chip }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                        ))}
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: MW.mute, paddingTop: 12, borderTop: `1px solid ${HAIR}` }}>
                                    <span>{r.createdAt ? `${r.createdAt.slice(0, 10).replace(/-/g, '/')} 작성` : ''}</span>
                                    <span>도움이 됐어요 <strong style={{ color: MW.mintDeep }}>{r.helpful}</strong>명</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

/* ---------- 알림 ---------- */

export function NoticeSection({ go }: { go: Go }) {
    const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotification();
    const [filter, setFilter] = useState('all');
    const types = Object.keys(NOTICE_TYPES).filter((t) => notifications.some((n) => (NOTICE_TYPES[n.type] ? n.type : 'system') === t));
    const typeOf = (n: Notification) => (NOTICE_TYPES[n.type] ? n.type : 'system');
    const items = notifications.filter((n) => filter === 'all' || (filter === 'unread' ? !n.is_read : typeOf(n) === filter));

    const open = async (n: Notification) => {
        if (!n.is_read) await markAsRead(n.id);
        if (n.link) go(n.link);
    };

    return (
        <div style={cardBox}>
            <PanelHead
                eyebrow="NOTIFICATIONS"
                title="알림"
                sub="예약·견적 업데이트와 이벤트 소식을 알려 드립니다."
                action={unreadCount > 0 ? <button type="button" onClick={() => markAllAsRead()} style={ghostBtn} {...ghostHover}>모두 읽음으로 표시</button> : undefined}
            />
            {notifications.length > 0 && (
                <FilterPills<string>
                    items={[['all', '전체'], ['unread', `안 읽음 ${unreadCount}`], ...types.map((t): [string, string] => [t, NOTICE_TYPES[t].label])]}
                    value={filter}
                    onChange={setFilter}
                />
            )}
            {loading ? <Loading /> : items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${HAIR}` }}>
                    {items.map((n) => {
                        const meta = NOTICE_TYPES[typeOf(n)];
                        const bg = n.is_read ? '#FFFFFF' : '#F7FCFA';
                        return (
                            <button
                                key={n.id}
                                type="button"
                                onClick={() => open(n)}
                                style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '18px 8px', border: 0, borderBottom: `1px solid ${HAIR}`, background: bg, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: MW.navy }}
                                {...hover({ background: PAPER }, { background: bg })}
                            >
                                <span style={{ width: 40, height: 40, borderRadius: 12, background: MW.mintBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Ico d={meta.d} />
                                </span>
                                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: MW.mintDeep }}>{meta.label}</span>
                                        {!n.is_read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: MW.mint }} />}
                                    </span>
                                    <span style={{ fontSize: 14, fontWeight: n.is_read ? 500 : 900, lineHeight: 1.5 }}>{n.title}</span>
                                    {n.message && <span style={{ fontSize: 13, color: MW.mute, lineHeight: 1.6 }}>{n.message}</span>}
                                </span>
                                <span style={{ fontSize: 12, color: MW.mute2, flexShrink: 0, whiteSpace: 'nowrap' }}>{formatRelativeTime(parseDbTime(n.created_at))}</span>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <EmptyBox text={notifications.length ? '해당하는 알림이 없습니다.' : '새 알림이 없습니다.'} />
            )}
        </div>
    );
}

/* ---------- 고객 지원 ---------- */

export function SupportCard({ go }: { go: Go }) {
    return (
        <div style={{ borderRadius: 20, padding: 28, background: `linear-gradient(135deg,${MW.mintBg} 0%,#FFFFFF 70%)`, border: `1px solid ${MW.mintTint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>CUSTOMER SUPPORT</span>
                <span style={{ fontSize: 18, fontWeight: 900 }}>도움이 필요하신가요?</span>
                <span style={{ fontSize: 13, color: MW.mute }}>한국어 담당 직원이 24시간 이내에 답변해 드립니다. FAQ도 함께 확인해 주세요.</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
                <a
                    href="/faq"
                    onClick={(e) => { e.preventDefault(); go('/faq'); }}
                    style={{ display: 'flex', alignItems: 'center', height: 48, padding: '0 22px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontSize: 14, fontWeight: 700, color: MW.navy, textDecoration: 'none' }}
                    {...hover({ borderColor: MW.mint }, { borderColor: MW.line })}
                >
                    FAQ 보기
                </a>
                <button type="button" onClick={openKakaoConsultation} style={{ ...mintBtn, height: 48, padding: '0 22px', fontSize: 14, gap: 8 }} {...mintHover}>
                    <Ico d={ICON.chat} size={18} color={MW.navy} />
                    카카오톡 문의
                </button>
            </div>
        </div>
    );
}
