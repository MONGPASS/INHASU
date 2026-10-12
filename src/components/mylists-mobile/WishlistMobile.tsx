import { MobileShell } from '../mobile/MobileShell';
import { BarButton, MEmpty, MLoading, SubPageBar } from '../mobile/mobileUi';
import { productCard, useGo, useTripCatalog } from './myListsData';
import { ScreenBody, TripCardM, TripGrid } from './myListsUi';

/** Mobile 찜 목록 (Claude Design: "M Wishlist"). Saved tours resolved against the published list, as on PC. */
export function WishlistMobile() {
    const go = useGo();
    const { stats, wishlist, wishItems, wishLoading } = useTripCatalog();

    const clearAll = async () => {
        if (!window.confirm('찜 목록을 모두 삭제하시겠습니까?')) return;
        for (const p of wishItems) await wishlist.toggle(p);
    };

    return (
        <MobileShell>
            <SubPageBar
                title="찜 목록"
                count={wishLoading ? undefined : wishItems.length}
                onBack={() => go('/mypage')}
                right={!wishLoading && wishItems.length > 0 ? <BarButton onClick={clearAll}>전체 삭제</BarButton> : undefined}
            />
            <ScreenBody eyebrow="WISHLIST" lead="♡를 누른 투어가 저장됩니다. 가격과 일정을 한눈에 비교할 수 있습니다." label="찜 목록">
                {wishLoading ? <MLoading /> : wishItems.length > 0 ? (
                    <TripGrid>
                        {wishItems.map((p) => (
                            <TripCardM
                                key={p.id}
                                t={productCard(p)}
                                stat={stats[p.id]}
                                fav
                                onFav={() => wishlist.toggle(p)}
                                onRemove={() => wishlist.toggle(p)}
                                removeLabel="찜 목록에서 삭제"
                                go={go}
                            />
                        ))}
                    </TripGrid>
                ) : (
                    <MEmpty text="아직 찜한 투어가 없습니다. 투어의 ♡를 눌러 저장해 보세요." action={{ label: '투어 찾기', onClick: () => go('/products') }} />
                )}
            </ScreenBody>
        </MobileShell>
    );
}
