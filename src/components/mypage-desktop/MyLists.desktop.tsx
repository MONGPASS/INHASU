import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useNotification, type Notification } from '../../contexts/NotificationContext';
import { useToast } from '../ui/Toast';
import { formatRelativeTime } from '../../utils/formatDate';
import { cleanTitle, isUsableImage, won } from '../desktop-primitives/mwTokens';
import type { HomeProduct } from '../home-desktop/homeDesktopData';
import { SD, SIcon } from '../site-seed/seed';
import { TourTypeBadge } from '../tours-desktop/TourTypeBadge';
import { durationLabel } from '../tours-mobile/tourListFilters';
import { TripThumb } from './MyPageHome.desktop';
import { useMobileShell } from '../mobile/mobileShellContext';
import { chipStyle, dateRangeText, packageLabel } from './myBookingView';
import { parseDbTime, type MeUser, type MyMatePost, type MyReservation, type MyReview, type RecentItem } from './useMyPageData';

/**
 * 마이페이지 찜 목록 · 최근 본 상품 · 동행 찾기 글 · 내 후기 · 알림(Claude Design ‘마이페이지 — …’, ‘… — 모바일’).
 * 예약 내역·견적 내역과 같은 틀: PC는 흰 판(제목·개수·설명·오른쪽 단추 → 상태 칩 → 내용), 휴대폰(`compact`)은
 * 머리 아래 붙는 칩 줄 + 내용(제목 줄의 단추는 화면이 MobileShell에 둔다).
 */

type Go = (path: string) => void;

const linkTo = (go: Go, to: string) => ({ href: to, onClick: (e: MouseEvent) => { e.preventDefault(); go(to); } });

// ───────────────────────── 공용 틀 ─────────────────────────

function Panel({ title, count, sub, action, compact, children }: { title: string; count?: number; sub: string; action?: ReactNode; compact: boolean; children: ReactNode }) {
    if (compact) return <div style={{ background: SD.white, color: SD.gray900, minHeight: '60vh' }}>{children}</div>;
    return (
        <section style={{ background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 16, padding: '28px 28px 20px', color: SD.gray900 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{title} {count !== undefined && <span style={{ color: SD.gray500 }}>{count}</span>}</h2>
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: SD.gray600 }}>{sub}</p>
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

/** 오른쪽 위 흰 단추(새 글 쓰기·전체 삭제·모두 읽음). */
export function OutlineButton({ children, onClick, icon }: { children: ReactNode; onClick: () => void; icon?: string }) {
    return (
        <button type="button" onClick={onClick}
            style={{ flex: 'none', height: 40, padding: '0 16px', borderRadius: 10, border: `1px solid ${SD.gray300}`, background: SD.white, color: SD.gray900, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            {icon && <SIcon name={icon} size={16} stroke={2} />}{children}
        </button>
    );
}

function Chips<K extends string>({ items, value, onChange, compact }: { items: Array<{ key: K; label: string; count?: number }>; value: K; onChange: (k: K) => void; compact: boolean }) {
    const { stickyTop } = useMobileShell();
    return (
        <div role="tablist" className={compact ? 'ml-scroll' : undefined}
            style={compact
                ? { position: 'sticky', top: stickyTop, zIndex: 5, background: SD.white, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '12px 20px', borderBottom: `1px solid ${SD.gray100}` }
                : { marginTop: 20, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {compact && <style>{'.ml-scroll::-webkit-scrollbar{display:none}'}</style>}
            {items.map((t) => {
                const on = value === t.key;
                return (
                    <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.key)}
                        style={{ flex: 'none', height: compact ? 34 : 36, padding: compact ? '0 12px' : '0 14px', borderRadius: 9999, border: `1px solid ${on ? SD.gray900 : SD.gray200}`,
                            background: on ? SD.gray900 : SD.white, color: on ? SD.white : SD.gray700, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {t.label}{t.count !== undefined && <> <span style={{ fontWeight: compact ? 700 : 500, opacity: compact ? 1 : 0.7 }}>{t.count}</span></>}
                    </button>
                );
            })}
        </div>
    );
}

function Empty({ icon, title, sub, action, compact, top = true }: { icon: string; title: string; sub: ReactNode; action?: { label: string; onClick: () => void; icon?: string }; compact: boolean; top?: boolean }) {
    return (
        <div style={{ marginTop: compact ? 0 : 16, padding: compact ? '56px 20px 48px' : '48px 20px 44px', borderTop: compact || !top ? 'none' : `1px solid ${SD.gray100}`, textAlign: 'center' }}>
            <span aria-hidden="true" style={{ width: compact ? 52 : 56, height: compact ? 52 : 56, margin: '0 auto', borderRadius: 16, background: SD.gray50, color: SD.gray500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SIcon name={icon} size={24} stroke={1.6} />
            </span>
            <p style={{ margin: compact ? '14px 0 4px' : '16px 0 4px', fontSize: compact ? 15 : 16, fontWeight: 700, color: SD.gray900 }}>{title}</p>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: SD.gray600 }}>{sub}</p>
            {action && (
                <button type="button" onClick={action.onClick}
                    style={{ marginTop: compact ? 18 : 20, height: 44, padding: '0 20px', border: 'none', borderRadius: 10, background: SD.mint500, color: SD.white, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    {action.icon && <SIcon name={action.icon} size={16} stroke={2} />}{action.label}
                </button>
            )}
        </div>
    );
}

const Loading = () => <p style={{ margin: 0, padding: '48px 0', textAlign: 'center', fontSize: 14, color: SD.gray600 }}>불러오는 중…</p>;

// ───────────────────────── 찜 목록 ─────────────────────────

type PkgTab = 'all' | 'full' | 'value';

export function WishlistPanel({ items, onRemove, go, compact = false }: { items: HomeProduct[]; onRemove: (p: HomeProduct) => void; go: Go; compact?: boolean }) {
    const [tab, setTab] = useState<PkgTab>('all');
    const shown = items.filter((p) => tab === 'all' || p.packageType === tab);
    return (
        <Panel compact={compact} title="찜 목록" count={items.length} sub="♡를 누른 투어를 모아 봤어요. 가격과 일정을 비교해 보세요.">
            <Chips compact={compact} value={tab} onChange={setTab} items={[
                { key: 'all', label: '전체', count: items.length },
                { key: 'full', label: '풀패키지', count: items.filter((p) => p.packageType === 'full').length },
                { key: 'value', label: '실속형', count: items.filter((p) => p.packageType === 'value').length },
            ]} />
            {shown.length > 0 ? (
                <div style={{ marginTop: compact ? 0 : 20, padding: compact ? '16px 20px 28px' : 0, display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(3, 1fr)', gap: compact ? '22px 12px' : '28px 18px' }}>
                    {shown.map((p) => {
                        const img = p.mainImages.find(isUsableImage) || '';
                        const to = `/products/${p.id}`;
                        return (
                            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8, minWidth: 0 }}>
                                <div style={{ position: 'relative', aspectRatio: compact ? '1 / 1' : '4 / 3', borderRadius: 12, overflow: 'hidden', background: SD.gray100 }}>
                                    <a {...linkTo(go, to)} style={{ display: 'block', width: '100%', height: '100%' }}>
                                        {img && <img src={img} alt={p.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                                    </a>
                                    {p.packageType && <TourTypeBadge type={p.packageType} size={compact ? 'sm' : 'md'} style={{ position: 'absolute', left: compact ? 8 : 10, top: compact ? 8 : 10 }} />}
                                    <button type="button" aria-label={`${p.name} 찜 해제`} onClick={() => onRemove(p)}
                                        style={{ position: 'absolute', right: compact ? 2 : 8, top: compact ? 2 : 8, width: compact ? 44 : 34, height: compact ? 44 : 34, border: 'none', borderRadius: 9999,
                                            background: compact ? 'transparent' : SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', color: SD.gray900 }}>
                                        <span style={{ width: compact ? 30 : 'auto', height: compact ? 30 : 'auto', borderRadius: 9999, background: compact ? SD.white : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <SIcon name="heart" size={16} stroke={1.6} style={{ fill: 'currentColor' }} />
                                        </span>
                                    </button>
                                </div>
                                <span style={{ marginTop: compact ? 2 : 4, fontSize: compact ? 11 : 12, color: SD.gray600 }}>{[p.category, durationLabel(p.duration)].filter(Boolean).join(' · ')}</span>
                                <a {...linkTo(go, to)} style={{ fontSize: compact ? 14 : 15, fontWeight: 700, lineHeight: 1.4, color: SD.gray900, textDecoration: 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: compact ? 39 : 42 }}>{cleanTitle(p.name)}</a>
                                {p.price > 0 && <span style={{ fontSize: compact ? 15 : 17, fontWeight: 700 }}>{won(p.price)}<span style={{ fontSize: compact ? 12 : 13, fontWeight: 400, color: SD.gray600 }}> ~</span></span>}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <Empty compact={compact} icon="heart" title={items.length ? '이 구분의 찜한 투어가 없어요' : '아직 찜한 투어가 없어요'} sub="투어 상세에서 ♡를 누르면 여기에 모아 둘 수 있어요."
                    action={{ label: '투어 둘러보기', onClick: () => go('/products') }} />
            )}
        </Panel>
    );
}

// ───────────────────────── 최근 본 상품 ─────────────────────────

const WEEK = '일월화수목금토';
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function RecentPanel({ items, now, productById, isFav, onFav, onRemove, onClearAll, loading, go, compact = false }: {
    items: RecentItem[]; now: number; productById: Map<string, HomeProduct>; isFav: (productId: string) => boolean;
    onFav: (item: RecentItem) => void; onRemove: (productId: string) => void; onClearAll: () => void; loading: boolean; go: Go; compact?: boolean;
}) {
    const today = new Date(now);
    const yesterday = new Date(now - 86_400_000);
    const label = (d: Date) => (dayKey(d) === dayKey(today) ? '오늘' : dayKey(d) === dayKey(yesterday) ? '어제' : `${d.getMonth() + 1}월 ${d.getDate()}일(${WEEK[d.getDay()]})`);
    const groups: Array<{ label: string; items: RecentItem[] }> = [];
    for (const it of items) {
        const d = parseDbTime(it.viewedAt);
        const g = Number.isNaN(d.getTime()) ? '이전' : label(d);
        const last = groups[groups.length - 1];
        if (last && last.label === g) last.items.push(it);
        else groups.push({ label: g, items: [it] });
    }
    const round: CSSProperties = { flex: 'none', width: 36, height: 36, borderRadius: 9999, border: compact ? 'none' : `1px solid ${SD.gray200}`, background: compact ? 'transparent' : SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' };

    return (
        <Panel compact={compact} title="최근 본 상품" count={loading ? undefined : items.length} sub="최근에 본 투어가 최대 20개까지 보여요."
            action={!loading && items.length > 0 ? <OutlineButton onClick={onClearAll}>전체 삭제</OutlineButton> : undefined}>
            {loading ? <Loading /> : groups.length > 0 ? (
                <div style={{ padding: compact ? '0 20px 24px' : 0 }}>
                    {groups.map((g) => (
                        <div key={g.label} style={{ marginTop: compact ? 0 : 22, paddingTop: compact ? 18 : 0 }}>
                            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: SD.gray900 }}>{g.label}</p>
                            {g.items.map((it) => {
                                const p = productById.get(it.productId);
                                const title = cleanTitle(p?.name || it.title);
                                const img = p?.mainImages.find(isUsableImage) || (isUsableImage(it.image) ? it.image : '');
                                const price = p?.price || it.price;
                                const meta = [packageLabel(p), p?.category || it.category, durationLabel(p?.duration)].filter(Boolean).join(' · ');
                                const fav = isFav(it.productId);
                                const to = `/products/${it.productId}`;
                                return (
                                    <div key={it.id} style={{ display: 'flex', gap: compact ? 12 : 16, alignItems: 'center', padding: compact ? '12px 0' : '14px 0', borderBottom: `1px solid ${SD.gray100}` }}>
                                        <a {...linkTo(go, to)} style={{ display: 'flex', flex: 'none' }} tabIndex={-1} aria-hidden="true">
                                            {compact ? <TripThumb src={img} alt="" size={72} /> : (img
                                                ? <img src={img} alt="" style={{ width: 96, height: 72, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                                                : <span style={{ width: 96, height: 72, borderRadius: 10, background: SD.gray100, display: 'block' }} />)}
                                        </a>
                                        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: compact ? 3 : 4 }}>
                                            {meta && <span style={{ fontSize: compact ? 11 : 12, color: SD.gray600 }}>{meta}</span>}
                                            <a {...linkTo(go, to)} style={{ fontSize: compact ? 14 : 15, fontWeight: 700, color: SD.gray900, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</a>
                                            {price > 0 && <span style={{ fontSize: compact ? 14 : 15, fontWeight: 700 }}>{won(price)}<span style={{ fontSize: compact ? 11 : 12, fontWeight: 400, color: SD.gray600 }}> ~</span></span>}
                                        </div>
                                        <div style={{ flex: 'none', display: 'flex', flexDirection: compact ? 'column' : 'row', gap: compact ? 2 : 8 }}>
                                            <button type="button" aria-label={fav ? '찜 해제' : '찜하기'} aria-pressed={fav} onClick={() => onFav(it)} style={{ ...round, color: fav ? SD.gray900 : SD.gray900 }}>
                                                <SIcon name="heart" size={18} stroke={1.7} style={{ fill: fav ? 'currentColor' : 'none' }} />
                                            </button>
                                            <button type="button" aria-label="목록에서 삭제" onClick={() => onRemove(it.productId)} style={{ ...round, color: compact ? SD.gray500 : SD.gray600 }}>
                                                <SIcon name="close" size={14} stroke={2} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            ) : (
                <Empty compact={compact} icon="historyBack" title="최근 본 투어가 없어요" sub="투어를 둘러보면 여기에 기록돼요." action={{ label: '투어 둘러보기', onClick: () => go('/products') }} />
            )}
        </Panel>
    );
}

// ───────────────────────── 동행 찾기 글 ─────────────────────────

type MateTab = 'all' | 'open' | 'closed';

export function MatesPanel({ me, posts, loading, go, compact = false }: { me: MeUser; posts: MyMatePost[]; loading: boolean; go: Go; compact?: boolean }) {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const [tab, setTab] = useState<MateTab>('all');
    const key = ['myPage', 'mates', me.id];
    const isClosed = (p: MyMatePost) => p.status === 'closed';
    const shown = posts.filter((p) => tab === 'all' || (tab === 'closed' ? isClosed(p) : !isClosed(p)));
    const write = () => go('/travel-mates/write');

    const toggleStatus = async (p: MyMatePost) => {
        const status = p.status === 'recruiting' ? 'closed' : 'recruiting';
        try {
            await api.travelMates.update(p.id, { status });
            queryClient.setQueryData<MyMatePost[]>(key, (cur = []) => cur.map((x) => (x.id === p.id ? { ...x, status } : x)));
        } catch (e) {
            console.error('Travel mate status update failed:', e);
            showToast('error', '모집 상태를 바꾸지 못했어요.');
        }
    };
    const remove = async (p: MyMatePost) => {
        if (!window.confirm('이 글을 삭제할까요?')) return;
        try {
            await api.travelMates.delete(p.id);
            queryClient.setQueryData<MyMatePost[]>(key, (cur = []) => cur.filter((x) => x.id !== p.id));
        } catch (e) {
            console.error('Travel mate delete failed:', e);
            showToast('error', '글을 삭제하지 못했어요.');
        }
    };
    const small: CSSProperties = { height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${SD.gray200}`, background: SD.white, color: SD.gray700, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };

    return (
        <Panel compact={compact} title="동행 찾기 글" count={loading ? undefined : posts.length} sub="함께 떠날 동행을 모집하고 차량·가이드 비용을 나눠 보세요."
            action={<OutlineButton onClick={write} icon="plusLine">새 글 쓰기</OutlineButton>}>
            <Chips compact={compact} value={tab} onChange={setTab} items={[
                { key: 'all', label: '전체', count: posts.length },
                { key: 'open', label: '모집 중', count: posts.filter((p) => !isClosed(p)).length },
                { key: 'closed', label: '모집 마감', count: posts.filter(isClosed).length },
            ]} />
            {loading ? <Loading /> : shown.length > 0 ? (
                <div style={{ marginTop: compact ? 0 : 16, padding: compact ? '0 20px' : 0 }}>
                    {shown.map((p) => {
                        const closed = isClosed(p);
                        const pct = p.capacity > 0 ? Math.min(100, Math.round((p.joined / p.capacity) * 100)) : 0;
                        const to = `/travel-mates/${p.id}`;
                        return (
                            <article key={p.id} style={{ padding: compact ? '18px 0' : '20px 0', borderTop: compact ? 'none' : `1px solid ${SD.gray100}`, borderBottom: compact ? `1px solid ${SD.gray100}` : 'none',
                                display: 'flex', gap: compact ? 12 : 24, alignItems: compact ? 'stretch' : 'center', flexDirection: compact ? 'column' : 'row' }}>
                                <a {...linkTo(go, to)} style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, color: SD.gray900, textDecoration: 'none' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={chipStyle(closed ? 'muted' : 'solid', compact ? 'sm' : 'md')}>{closed ? '모집 마감' : '모집 중'}</span>
                                        {p.region && <span style={{ fontSize: 12, color: SD.gray500 }}>{p.region}</span>}
                                    </span>
                                    <span style={{ fontSize: compact ? 15 : 16, fontWeight: 700, lineHeight: 1.4, color: closed ? SD.gray500 : SD.gray900 }}>{p.title}</span>
                                    <span style={{ fontSize: compact ? 12 : 13, color: SD.gray600 }}>
                                        {[(p.start || p.end) ? `${dateRangeText(p.start, p.end)}${p.duration ? ` (${p.duration})` : ''}` : '', `댓글 ${p.comments}`, `조회 ${p.views}`, p.createdAt ? formatRelativeTime(parseDbTime(p.createdAt)) : ''].filter(Boolean).join(' · ')}
                                    </span>
                                </a>
                                <div style={{ flex: compact ? 'none' : '0 0 200px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {p.capacity > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: SD.gray600 }}>
                                                <span>참가자</span><strong style={{ color: SD.gray900 }}>{p.joined} / {p.capacity}명</strong>
                                            </span>
                                            <span style={{ height: 4, borderRadius: 9999, background: SD.gray100, overflow: 'hidden' }}>
                                                <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: SD.gray900 }} />
                                            </span>
                                        </div>
                                    )}
                                    <span style={{ display: 'flex', gap: 6, justifyContent: compact ? 'flex-start' : 'flex-end' }}>
                                        <button type="button" onClick={() => toggleStatus(p)} style={small}>{closed ? '모집 재개' : '모집 마감'}</button>
                                        <button type="button" onClick={() => remove(p)} style={small}>삭제</button>
                                    </span>
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <Empty compact={compact} icon="peopleTwo"
                    title={tab === 'all' ? '아직 작성한 글이 없어요' : tab === 'open' ? '모집 중인 글이 없어요' : '마감된 글이 없어요'}
                    sub={compact ? <>일정과 지역을 올리면 같은 여행을<br />준비하는 사람과 연결될 수 있어요.</> : '일정과 지역을 올리면 같은 여행을 준비하는 사람과 연결될 수 있어요.'}
                    action={{ label: '새 글 쓰기', onClick: write, icon: compact ? undefined : 'plusLine' }} />
            )}
        </Panel>
    );
}

// ───────────────────────── 내 후기 ─────────────────────────

export function ReviewsPanel({ me, reviews, pending, productById, loading, go, compact = false }: {
    me: MeUser; reviews: MyReview[]; pending: MyReservation[]; productById: Map<string, HomeProduct>; loading: boolean; go: Go; compact?: boolean;
}) {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const remove = async (r: MyReview) => {
        if (!window.confirm('이 후기를 삭제할까요?')) return;
        try {
            await api.reviews.delete(r.id);
            queryClient.setQueryData<MyReview[]>(['myPage', 'reviews', me.id], (cur = []) => cur.filter((x) => x.id !== r.id));
        } catch (e) {
            console.error('Review delete failed:', e);
            showToast('error', '후기를 삭제하지 못했어요.');
        }
    };
    const writeFor = (r: MyReservation) => go(`/reviews/write?reservationId=${encodeURIComponent(r.id)}`);
    const pad = compact ? '0 20px' : 0;

    return (
        <Panel compact={compact} title="내 후기" sub="다녀온 투어의 소감을 들려주세요.">
            {loading ? <Loading /> : (
                <>
                    <section style={compact ? { padding: 20, borderBottom: `8px solid ${SD.gray50}` } : { marginTop: 24 }}>
                        <p style={{ margin: compact ? '0 0 12px' : '0 0 10px', fontSize: compact ? 15 : 14, fontWeight: 700 }}>작성 가능한 후기 <span style={{ color: SD.gray500 }}>{pending.length}</span></p>
                        {pending.length === 0 ? (
                            <p style={{ margin: 0, padding: '14px 16px', borderRadius: 12, background: SD.gray50, fontSize: 13, color: SD.gray600 }}>여행을 마치면 여기에서 후기를 쓸 수 있어요.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {pending.map((r) => {
                                    const img = productById.get(r.productId)?.mainImages.find(isUsableImage) || '';
                                    return (
                                        <div key={r.id} style={{ padding: compact ? 14 : 16, borderRadius: 14, border: `1px solid ${SD.gray200}`, display: 'flex', flexDirection: compact ? 'column' : 'row', gap: compact ? 12 : 16, alignItems: compact ? 'stretch' : 'center' }}>
                                            <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', gap: compact ? 12 : 16, alignItems: 'center' }}>
                                                <TripThumb src={img} alt={r.productName} size={compact ? 60 : 72} />
                                                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: compact ? 3 : 4 }}>
                                                    {compact ? <span style={{ fontSize: 11, color: SD.gray500 }}>여행 완료</span> : <span><span style={chipStyle('muted')}>여행 완료</span></span>}
                                                    <span style={{ fontSize: compact ? 15 : 16, fontWeight: 700 }}>{cleanTitle(r.productName)}</span>
                                                    <span style={{ fontSize: compact ? 12 : 13, color: SD.gray600 }}>{dateRangeText(r.start, r.end)}</span>
                                                </div>
                                            </div>
                                            <button type="button" onClick={() => writeFor(r)}
                                                style={{ flex: 'none', height: compact ? 44 : 40, padding: '0 18px', border: 'none', borderRadius: 10, background: SD.mint500, color: SD.white, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                                                후기 쓰기
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                    <section style={{ marginTop: compact ? 0 : 32, padding: compact ? '20px 0 0' : 0 }}>
                        <p style={{ margin: 0, padding: pad, fontSize: compact ? 15 : 14, fontWeight: 700 }}>작성한 후기 <span style={{ color: SD.gray500 }}>{reviews.length}</span></p>
                        {reviews.length === 0 ? (
                            <Empty compact={compact} icon="reviewBubble" title="아직 작성한 후기가 없어요"
                                sub={compact ? <>여행의 추억을 나눠 주시면<br />다른 여행자에게 큰 도움이 돼요.</> : '여행의 추억을 나눠 주시면 다른 여행자에게 큰 도움이 돼요.'}
                                action={{ label: '후기 쓰기', onClick: () => go('/reviews/write') }} />
                        ) : (
                            <div style={{ marginTop: 6, padding: pad }}>
                                {reviews.map((r) => {
                                    const photos = r.images.filter(isUsableImage).slice(0, 4);
                                    return (
                                        <article key={r.id} style={{ padding: '18px 0', borderTop: `1px solid ${SD.gray100}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                                <a {...linkTo(go, `/reviews/${r.id}`)} style={{ fontSize: compact ? 15 : 16, fontWeight: 700, color: SD.gray900, textDecoration: 'none', minWidth: 0 }}>{cleanTitle(r.productName)}</a>
                                                <button type="button" onClick={() => remove(r)} style={{ flex: 'none', height: 30, padding: '0 10px', borderRadius: 8, border: `1px solid ${SD.gray200}`, background: SD.white, color: SD.gray600, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>삭제</button>
                                            </div>
                                            <span aria-label={`5점 만점에 ${r.rating}점`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span aria-hidden="true" style={{ fontSize: 14, letterSpacing: 1, color: SD.gray900 }}>{'★'.repeat(r.rating)}<span style={{ color: SD.gray300 }}>{'★'.repeat(5 - r.rating)}</span></span>
                                                <strong style={{ fontSize: 13 }}>{r.rating.toFixed(1)}</strong>
                                            </span>
                                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: SD.gray700, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.content}</p>
                                            {photos.length > 0 && (
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    {photos.map((src, i) => <img key={i} src={src} alt={`후기 사진 ${i + 1}`} loading="lazy" style={{ width: compact ? 72 : 88, height: compact ? 72 : 88, borderRadius: 10, objectFit: 'cover', background: SD.gray100 }} />)}
                                                </div>
                                            )}
                                            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: SD.gray500 }}>
                                                <span>{r.createdAt ? `${r.createdAt.slice(0, 10).replace(/-/g, '.')} 작성` : ''}</span>
                                                <span>도움돼요 <strong style={{ color: SD.gray900 }}>{r.helpful}</strong></span>
                                            </span>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </>
            )}
        </Panel>
    );
}

// ───────────────────────── 알림 ─────────────────────────

const NOTICE: Record<Notification['type'], { label: string; icon: string }> = {
    reservation: { label: '예약', icon: 'calendarCheck' },
    comment: { label: '댓글', icon: 'chatBubble' },
    event: { label: '이벤트', icon: 'gift' },
    system: { label: '안내', icon: 'bell' },
};
const noticeType = (n: Notification): Notification['type'] => (NOTICE[n.type] ? n.type : 'system');

export function NoticePanel({ go, compact = false }: { go: Go; compact?: boolean }) {
    const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotification();
    const [tab, setTab] = useState<string>('all');
    const types = (Object.keys(NOTICE) as Array<Notification['type']>).filter((t) => notifications.some((n) => noticeType(n) === t));
    const shown = notifications.filter((n) => tab === 'all' || (tab === 'unread' ? !n.is_read : noticeType(n) === tab));
    const open = async (n: Notification) => {
        if (!n.is_read) await markAsRead(n.id);
        if (n.link) go(n.link);
    };

    return (
        <Panel compact={compact} title="알림" sub="예약·견적 소식과 이벤트를 알려 드려요."
            action={unreadCount > 0 ? <OutlineButton onClick={() => markAllAsRead()}>모두 읽음으로 표시</OutlineButton> : undefined}>
            <Chips compact={compact} value={tab} onChange={setTab} items={[
                { key: 'all', label: '전체', count: notifications.length },
                { key: 'unread', label: '안 읽음', count: unreadCount },
                ...types.map((t) => ({ key: t, label: NOTICE[t].label, count: notifications.filter((n) => noticeType(n) === t).length })),
            ]} />
            {loading ? <Loading /> : shown.length > 0 ? (
                <ul style={{ margin: compact ? 0 : '16px 0 0', padding: compact ? '0 20px' : 0, listStyle: 'none' }}>
                    {shown.map((n) => {
                        const meta = NOTICE[noticeType(n)];
                        const time = formatRelativeTime(parseDbTime(n.created_at));
                        return (
                            <li key={n.id}>
                                <button type="button" onClick={() => open(n)}
                                    style={{ width: '100%', padding: compact ? '16px 0' : '18px 4px', border: 'none', borderTop: compact ? 'none' : `1px solid ${SD.gray100}`, borderBottom: compact ? `1px solid ${SD.gray100}` : 'none',
                                        background: 'transparent', textAlign: 'left', display: 'flex', gap: compact ? 12 : 14, alignItems: 'flex-start', fontFamily: 'inherit', cursor: 'pointer', color: SD.gray900 }}>
                                    <span aria-hidden="true" style={{ flex: 'none', width: compact ? 36 : 40, height: compact ? 36 : 40, borderRadius: compact ? 10 : 12, background: SD.gray50, color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <SIcon name={meta.icon} size={compact ? 18 : 20} stroke={1.7} />
                                    </span>
                                    <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: compact ? 3 : 4 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: compact ? 'space-between' : 'flex-start', gap: 6, fontSize: compact ? 11 : 12, color: SD.gray600 }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                                {meta.label}{!n.is_read && <span aria-label="안 읽음" style={{ width: 6, height: 6, borderRadius: 9999, background: SD.mint500 }} />}
                                            </span>
                                            {compact && <span style={{ color: SD.gray500 }}>{time}</span>}
                                        </span>
                                        <span style={{ fontSize: compact ? 14 : 15, lineHeight: 1.45, fontWeight: n.is_read ? 500 : 700, color: n.is_read ? SD.gray700 : SD.gray900 }}>{n.title}</span>
                                        {n.message && <span style={{ fontSize: compact ? 12 : 13, color: SD.gray600, lineHeight: 1.5 }}>{n.message}</span>}
                                    </span>
                                    {!compact && <span style={{ flex: 'none', fontSize: 12, color: SD.gray500, whiteSpace: 'nowrap' }}>{time}</span>}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <Empty compact={compact} icon="bell" title={notifications.length ? '이 구분의 알림이 없어요' : '새 알림이 없어요'} sub="예약·견적 진행 상황이 바뀌면 여기에서 알려 드려요."
                    action={{ label: '투어 둘러보기', onClick: () => go('/products') }} />
            )}
        </Panel>
    );
}

/** 휴대폰 제목 줄 오른쪽 글자 단추(전체 삭제·모두 읽음). */
export function HeaderTextButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            style={{ height: 44, padding: '0 12px', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: SD.gray700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {children}
        </button>
    );
}
