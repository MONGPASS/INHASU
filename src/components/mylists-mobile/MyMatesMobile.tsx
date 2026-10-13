import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatRelativeTime } from '../../utils/formatDate';
import { useToast } from '../ui/Toast';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { parseDbTime, useMe, useMyPageData, type MyMatePost } from '../mypage-desktop/useMyPageData';
import { MobileShell } from '../mobile/MobileShell';
import { M_HAIR } from '../mobile/mobileTheme';
import { MEmpty, MLoading, MPills, SubPageBar } from '../mobile/mobileUi';
import { dateRange, useGo } from './myListsData';
import { CardPill, ScreenBody } from './myListsUi';

type MateFilter = 'all' | 'open' | 'closed';

const FILTERS: Array<[MateFilter, string]> = [['all', '전체'], ['open', '모집 중'], ['closed', '모집 마감']];

/** Mobile 동행 찾기 글 (Claude Design: "M My Mate Posts"). Same posts, filters and owner actions as the PC tab. */
export function MyMatesMobile() {
    const go = useGo();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { data: me } = useMe();
    const { mates } = useMyPageData(me);
    const [filter, setFilter] = useState<MateFilter>('all');

    const posts = mates.data ?? [];
    const loading = mates.isPending;
    const key = ['myPage', 'mates', me?.id];
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
        <MobileShell>
            <SubPageBar
                title="동행 찾기 글"
                count={loading ? undefined : posts.length}
                onBack={() => go('/mypage')}
                right={(
                    <button type="button" onClick={write} style={{ height: 34, padding: '0 12px', border: 0, borderRadius: 999, background: MW.mint, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        + 새 글 쓰기
                    </button>
                )}
            />
            <ScreenBody eyebrow="TRAVEL MATES" lead="함께 여행할 동행을 모집해 차량·가이드 비용을 나눌 수 있습니다." label="동행 찾기 글">
                <MPills<MateFilter> items={FILTERS} value={filter} onChange={setFilter} style={{ margin: '0 -16px', padding: '0 16px' }} />
                {loading ? <MLoading /> : items.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {items.map((p) => {
                            const closed = p.status === 'closed';
                            const pct = p.capacity > 0 ? Math.min(100, Math.round((p.joined / p.capacity) * 100)) : 0;
                            return (
                                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, border: `1px solid ${MW.line}`, borderRadius: 18, background: '#fff', color: MW.navy }}>
                                    <a
                                        href={`/travel-mates/${p.id}`}
                                        onClick={(e) => { e.preventDefault(); go(`/travel-mates/${p.id}`); }}
                                        style={{ display: 'flex', flexDirection: 'column', gap: 10, color: MW.navy, textDecoration: 'none', minWidth: 0 }}
                                    >
                                        <span style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
                                            <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: closed ? MW.chip : MW.mintTint, color: closed ? MW.mute : MW.mintDeep, whiteSpace: 'nowrap' }}>
                                                {closed ? '모집 마감' : '모집 중'}
                                            </span>
                                            {p.region && <span style={{ fontSize: 12, color: MW.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.region}</span>}
                                        </span>
                                        <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.45, color: closed ? MW.mute : MW.navy }}>{p.title}</span>
                                        <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 11, color: MW.mute }}>
                                            {(p.start || p.end) && <span>{dateRange(p.start, p.end)}{p.duration ? ` (${p.duration})` : ''}</span>}
                                            <span>댓글 {p.comments}</span>
                                            <span>조회 {p.views}</span>
                                            {p.createdAt && <span>{formatRelativeTime(parseDbTime(p.createdAt))}</span>}
                                        </span>
                                    </a>
                                    <span style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: `1px solid ${M_HAIR}` }}>
                                        {p.capacity > 0 && (
                                            <>
                                                <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MW.mute }}>
                                                    <span>참가자</span>
                                                    <strong style={{ fontFamily: MW_FONT_EN, fontWeight: 600, color: MW.navy }}>{p.joined} / {p.capacity}명</strong>
                                                </span>
                                                <span style={{ height: 6, borderRadius: 999, background: M_HAIR, overflow: 'hidden' }}>
                                                    <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#27AB8F,#3FC2A4)', borderRadius: 999 }} />
                                                </span>
                                            </>
                                        )}
                                        <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: p.capacity > 0 ? 4 : 0 }}>
                                            <CardPill onClick={() => toggleStatus(p)}>{closed ? '모집 재개' : '모집 마감'}</CardPill>
                                            <CardPill onClick={() => remove(p)}>삭제</CardPill>
                                        </span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <MEmpty text={posts.length ? '해당하는 글이 없습니다.' : '아직 작성한 글이 없습니다.'} action={{ label: '+ 새 글 쓰기', onClick: write }} />
                )}
            </ScreenBody>
        </MobileShell>
    );
}
