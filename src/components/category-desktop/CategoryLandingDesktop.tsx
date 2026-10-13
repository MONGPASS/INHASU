import { CATEGORY_LINEUP_ID, type CategoryLandingProps } from '../category/categoryContent';
import { CategoryExperiences, CategoryHeader, CategoryHero, CategoryLineupEmpty, CategoryLineupHead, CategoryQuoteCta } from '../category/CategoryParts';
import { MW, MW_STICKY_TOP } from '../desktop-primitives/mwTokens';
import { useHomeReviews } from '../home-desktop/homeDesktopData';
import { TourCardDesktop } from '../tours-desktop/TourCardDesktop';

/**
 * PC (≥1024px) category landing (Claude Design: "Milkyway Japan Home" — Category
 * Header / Hero / Experiences / Lineup / CTA). Rendered inside DesktopLayout.
 */
export function CategoryLandingDesktop({ slug, content, products, isLoadingProducts = false }: CategoryLandingProps) {
    const { stats } = useHomeReviews();

    return (
        <div>
            <CategoryHeader slug={slug} content={content} />
            <CategoryHero content={content} />
            <CategoryExperiences content={content} />

            <section id={CATEGORY_LINEUP_ID} style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 24px 0', display: 'flex', flexDirection: 'column', gap: 28, scrollMarginTop: MW_STICKY_TOP + 32 }}>
                <CategoryLineupHead title={content.productGridTitle || `${content.name} 투어`} count={isLoadingProducts ? undefined : products.length} />
                {isLoadingProducts ? (
                    <div style={{ padding: '72px 24px', textAlign: 'center', fontSize: 14, color: MW.mute }}>불러오는 중…</div>
                ) : products.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))', gap: '36px 20px' }}>
                        {products.map((p) => (
                            <TourCardDesktop key={p.id} p={p} stat={stats[p.id]} />
                        ))}
                    </div>
                ) : (
                    <CategoryLineupEmpty />
                )}
            </section>

            <CategoryQuoteCta content={content} />
        </div>
    );
}
