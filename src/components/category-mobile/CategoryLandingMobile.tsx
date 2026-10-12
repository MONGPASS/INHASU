import { useWishlist } from '../../hooks/useWishlist';
import { CATEGORY_LINEUP_ID, type CategoryLandingProps } from '../category/categoryContent';
import { CategoryExperiences, CategoryHeader, CategoryHero, CategoryLineupEmpty, CategoryLineupHead, CategoryQuoteCta } from '../category/CategoryParts';
import { useHomeReviews } from '../home-desktop/homeDesktopData';
import { useMobileShell } from '../mobile/mobileShellContext';
import { MLoading } from '../mobile/mobileUi';
import { TourCardMobile } from '../tours-mobile/TourCardMobile';

/**
 * Mobile category landing (Claude Design: "Milkyway Japan Mobile" — Category
 * Header / Hero / Experiences / Lineup / CTA). Rendered inside MobileShell.
 */
export function CategoryLandingMobile({ slug, content, products, isLoadingProducts = false }: CategoryLandingProps) {
    const { stickyTop } = useMobileShell();
    const { stats } = useHomeReviews();
    const wishlist = useWishlist();

    return (
        <div>
            <CategoryHeader slug={slug} content={content} compact />
            <CategoryHero content={content} compact />
            <CategoryExperiences content={content} compact />

            <section id={CATEGORY_LINEUP_ID} style={{ padding: '96px 16px 0', display: 'flex', flexDirection: 'column', gap: 24, scrollMarginTop: stickyTop + 16 }}>
                <CategoryLineupHead title={content.productGridTitle || `${content.name} 투어`} count={isLoadingProducts ? undefined : products.length} compact />
                {isLoadingProducts ? (
                    <MLoading pad={40} />
                ) : products.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '24px 12px' }}>
                        {products.map((p) => (
                            <TourCardMobile key={p.id} p={p} fav={wishlist.has(p.id)} onFav={() => wishlist.toggle(p)} stat={stats[p.id]} />
                        ))}
                    </div>
                ) : (
                    <CategoryLineupEmpty />
                )}
            </section>

            <CategoryQuoteCta content={content} compact />
        </div>
    );
}
