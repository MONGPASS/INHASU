import { useMemo, useState } from 'react';
import { MW } from '../desktop-primitives/mwTokens';
import type { TripCardData } from '../mypage-desktop/MyPageSections';
import { useMe, useMyPageData, useRecentActions } from '../mypage-desktop/useMyPageData';
import { MobileShell } from '../mobile/MobileShell';
import { BarButton, MEmpty, MLoading, SubPageBar } from '../mobile/mobileUi';
import { cardAsWishProduct, groupRecentByDay, useGo, useTripCatalog } from './myListsData';
import { ScreenBody, TripCardM, TripGrid } from './myListsUi';

/**
 * Mobile 최근 본 상품 (Claude Design: "M Recently Viewed"). Same list as the PC tab: the last
 * 20 viewed tours grouped by day, each removable with ×, or all at once with 전체 삭제.
 */
export function RecentMobile() {
    const go = useGo();
    const { data: me } = useMe();
    const { recent } = useMyPageData(me);
    const { remove, clear } = useRecentActions(me?.id);
    const { productById, stats, wishlist } = useTripCatalog();
    // Captured once so render stays pure.
    const [now] = useState(() => Date.now());

    const groups = useMemo(() => groupRecentByDay(recent.data ?? [], now, productById), [recent.data, now, productById]);
    const loading = recent.isPending;
    const total = recent.data?.length ?? 0;
    const toggleFav = (t: TripCardData) => wishlist.toggle(productById.get(t.productId) ?? cardAsWishProduct(t));

    return (
        <MobileShell>
            <SubPageBar
                title="최근 본 상품"
                count={loading ? undefined : total}
                onBack={() => go('/mypage')}
                right={!loading && total > 0 ? <BarButton onClick={clear}>전체 삭제</BarButton> : undefined}
            />
            <ScreenBody eyebrow="RECENTLY VIEWED" lead="최근에 본 투어(최대 20건)가 표시됩니다." label="최근 본 상품">
                {loading ? <MLoading /> : groups.length > 0 ? (
                    groups.map((g) => (
                        <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 13, fontWeight: 900, whiteSpace: 'nowrap' }}>{g.label}</span>
                                <span style={{ flex: 1, height: 1, background: MW.line }} />
                            </div>
                            <TripGrid>
                                {g.cards.map((c) => (
                                    <TripCardM
                                        key={c.key}
                                        t={c}
                                        stat={stats[c.productId]}
                                        fav={wishlist.has(c.productId)}
                                        onFav={() => toggleFav(c)}
                                        onRemove={() => remove(c.productId)}
                                        removeLabel="기록에서 삭제"
                                        go={go}
                                    />
                                ))}
                            </TripGrid>
                        </div>
                    ))
                ) : (
                    <MEmpty text="아직 최근 본 상품이 없습니다." action={{ label: '투어 찾기', onClick: () => go('/products') }} />
                )}
            </ScreenBody>
        </MobileShell>
    );
}
