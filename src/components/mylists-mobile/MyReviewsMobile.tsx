import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toTourDateKey } from '../../utils/formatDate';
import { useToast } from '../ui/Toast';
import { MW, MW_FONT_EN, isUsableImage } from '../desktop-primitives/mwTokens';
import { useMe, useMyPageData, type MyReview } from '../mypage-desktop/useMyPageData';
import { MobileShell } from '../mobile/MobileShell';
import { M_HAIR } from '../mobile/mobileTheme';
import { MEmpty, MLoading, SubPageBar } from '../mobile/mobileUi';
import { dateRange, pendingReviewList, useGo, useTripCatalog } from './myListsData';
import { CardPill, ScreenBody, Thumb } from './myListsUi';

/**
 * Mobile 내 후기 (Claude Design: "M My Reviews"). 작성 가능한 후기 = finished tours without a
 * review (same rule and link as PC), 작성한 후기 = the user's posted reviews.
 */
export function MyReviewsMobile() {
    const go = useGo();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { data: me } = useMe();
    const { reviews, reservations } = useMyPageData(me);
    const { productById } = useTripCatalog();
    // Captured once so render stays pure.
    const [today] = useState(() => toTourDateKey(new Date()));

    const list = reviews.data ?? [];
    const pending = useMemo(() => pendingReviewList(reservations.data ?? [], today), [reservations.data, today]);
    const loading = reviews.isPending || reservations.isPending;

    const remove = async (r: MyReview) => {
        if (!window.confirm('이 후기를 삭제하시겠습니까?')) return;
        try {
            await api.reviews.delete(r.id);
            queryClient.setQueryData<MyReview[]>(['myPage', 'reviews', me?.id], (cur = []) => cur.filter((x) => x.id !== r.id));
        } catch (e) {
            console.error('Review delete failed:', e);
            showToast('error', '후기를 삭제하지 못했습니다.');
        }
    };

    return (
        <MobileShell>
            <SubPageBar title="내 후기" onBack={() => go('/mypage')} />
            <ScreenBody eyebrow="MY REVIEWS" lead="참여하신 투어의 소감을 들려주세요." label="내 후기">
                {loading ? <MLoading /> : (
                    <>
                        {pending.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <span style={{ fontSize: 14, fontWeight: 900 }}>작성 가능한 후기 <span style={{ color: MW.mintDeep }}>{pending.length}</span></span>
                                {pending.map((r) => (
                                    <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRadius: 18, background: `linear-gradient(135deg,${MW.mintBg} 0%,#FFFFFF 80%)`, border: `1px solid ${MW.mintTint}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <Thumb src={productById.get(r.productId)?.mainImages[0]} size={56} />
                                            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <span style={{ fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.productName}</span>
                                                <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap' }}>{dateRange(r.start, r.end)}</span>
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => go(`/reviews/write?reservationId=${encodeURIComponent(r.id)}`)}
                                            style={{ height: 44, border: 0, borderRadius: 999, background: MW.mint, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}
                                        >
                                            후기 쓰기
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <span style={{ fontSize: 14, fontWeight: 900 }}>작성한 후기 <span style={{ color: MW.mintDeep }}>{list.length}</span></span>
                            {list.length === 0 && (
                                <MEmpty text="아직 작성한 후기가 없습니다. 여행의 추억을 나눠 보세요." action={{ label: '후기 쓰기', onClick: () => go('/reviews/write') }} />
                            )}
                            {list.map((r) => {
                                const photos = r.images.filter(isUsableImage).slice(0, 4);
                                return (
                                    <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, border: `1px solid ${MW.line}`, borderRadius: 18, background: '#fff' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                                            <a
                                                href={`/reviews/${r.id}`}
                                                onClick={(e) => { e.preventDefault(); go(`/reviews/${r.id}`); }}
                                                style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 900, lineHeight: '30px', color: MW.navy, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                            >
                                                {r.productName}
                                            </a>
                                            <CardPill onClick={() => remove(r)}>삭제</CardPill>
                                        </div>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }} aria-label={`5점 만점에 ${r.rating}점`}>
                                            <span style={{ fontSize: 14, letterSpacing: 2, color: MW.mint }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                                            <strong style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600 }}>{r.rating.toFixed(1)}</strong>
                                        </span>
                                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: MW.ink3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.content}</p>
                                        {photos.length > 0 && (
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {photos.map((src, i) => (
                                                    <img key={i} src={src} alt={`후기 사진 ${i + 1}`} loading="lazy" decoding="async" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', background: MW.chip }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                                ))}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, color: MW.mute, paddingTop: 10, borderTop: `1px solid ${M_HAIR}` }}>
                                            <span>{r.createdAt ? `${r.createdAt.slice(0, 10).replace(/-/g, '/')} 작성` : ''}</span>
                                            <span>도움이 됐어요 <strong style={{ color: MW.mintDeep }}>{r.helpful}</strong>명</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </ScreenBody>
        </MobileShell>
    );
}
