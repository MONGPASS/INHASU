import { useWishlist } from '../../hooks/useWishlist';
import { CATEGORY_LINEUP_ID, type CategoryLandingProps } from '../category/categoryContent';
import { CategoryExperiences, CategoryHeader, CategoryHero, CategoryLineupEmpty, CategoryLineupHead, CategoryQuoteCta } from '../category/CategoryParts';
import { useHomeReviews } from '../home-desktop/homeDesktopData';
import { useMobileShell } from '../mobile/mobileShellContext';
import { MLoading } from '../mobile/mobileUi';
import { CategoryTourCard } from './CategoryTourCard';

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

            <section id={CATEGORY_LINEUP_ID} style={{ padding: '96px 16px 0', display: 'flex', flexDirection: 'column', gap: 28, scrollMarginTop: stickyTop + 16 }}>
                <CategoryLineupHead title={content.productGridTitle || `${content.name} 투어`} count={isLoadingProducts ? undefined : products.length} />
                {isLoadingProducts ? (
                    <MLoading pad={40} />
                ) : products.length > 0 ? (
                    // Same grid rule as the design; inside the phone frame it resolves to one card per row.
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))', gap: '36px 20px' }}>
                        {products.map((p, i) => (
                            <CategoryTourCard key={p.id} p={p} eager={i === 0} fav={wishlist.has(p.id)} onFav={() => wishlist.toggle(p)} stat={stats[p.id]} />
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
