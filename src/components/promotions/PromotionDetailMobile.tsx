import { useWishlist } from '../../hooks/useWishlist';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { useHomeReviews } from '../home-desktop/homeDesktopData';
import { useGo } from '../home-mobile/homeMobileData';
import { MagazineQuoteCta } from '../magazine-mobile/MagazineQuoteCta';
import { M_GRADIENT } from '../mobile/mobileTheme';
import { MEmpty, MLoading } from '../mobile/mobileUi';
import { TourCardMobile } from '../tours-mobile/TourCardMobile';
import { PromoHero } from './PromoHero';
import type { PromotionDetailView } from './promotionsData';

/** Mobile 여행 기획전 detail: the promotion's card as a hero, then its tours in the tour-list grid. */
export function PromotionDetailMobile({ view }: { view: PromotionDetailView }) {
    const go = useGo();
    const { stats } = useHomeReviews();
    const wishlist = useWishlist();
    const { item, tours, isLoading, toursLoading } = view;

    const open = (path: string) => {
        go(path);
        window.scrollTo(0, 0);
    };

    if (isLoading) return <MLoading />;

    if (!item) {
        return (
            <div style={{ padding: '24px 16px 36px' }}>
                <MEmpty text="찾으시는 기획전이 없습니다. 공개가 종료되었을 수 있습니다." action={{ label: '여행 기획전 목록으로', onClick: () => open('/promotions') }} />
            </div>
        );
    }

    return (
        <>
            <section style={{ padding: '16px 16px 0' }}>
                <PromoHero item={item} />
            </section>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '26px 16px 0' }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, lineHeight: 1.4 }}>이 기획전의 투어</h2>
                {!toursLoading && tours.length > 0 && (
                    <span style={{ flexShrink: 0, fontSize: 13, color: MW.mute, whiteSpace: 'nowrap' }}>
                        <strong style={{ fontFamily: MW_FONT_EN, fontSize: 15, fontWeight: 600, color: MW.navy }}>{tours.length}</strong>건
                    </span>
                )}
            </div>

            {toursLoading ? (
                <MLoading />
            ) : tours.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '24px 12px', padding: '18px 16px 0' }}>
                    {tours.map((p, i) => (
                        <TourCardMobile key={p.id} p={p} eager={i < 2} stat={stats[p.id]} fav={wishlist.has(p.id)} onFav={() => wishlist.toggle(p)} />
                    ))}
                </div>
            ) : (
                <div style={{ margin: '18px 16px 0', padding: '40px 20px', border: `1px dashed ${MW.line2}`, borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>이 기획전의 투어는 현재 준비 중입니다.</span>
                    <span style={{ fontSize: 13, lineHeight: 1.7, color: MW.mute }}>다른 투어를 둘러보시거나, 원하시는 조건에 맞춘 맞춤 견적을 이용해 주세요.</span>
                    <div style={{ alignSelf: 'stretch', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginTop: 8 }}>
                        <button type="button" onClick={() => open('/products')} style={{ height: 46, border: `1px solid ${MW.line}`, borderRadius: 999, background: '#FFFFFF', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            투어 상품 보기
                        </button>
                        <button type="button" onClick={() => open('/custom-estimate')} style={{ height: 46, border: 0, borderRadius: 999, background: M_GRADIENT, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            맞춤 견적
                        </button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 16px 20px' }}>
                <a
                    href="/promotions"
                    onClick={(e) => { e.preventDefault(); open('/promotions'); }}
                    style={{ display: 'flex', alignItems: 'center', height: 44, padding: '0 22px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#FFFFFF', fontSize: 14, fontWeight: 700, color: MW.navy, textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                    여행 기획전 목록으로
                </a>
            </div>

            {/* The empty state already offers the quote button. */}
            {tours.length > 0 && <MagazineQuoteCta />}
        </>
    );
}
