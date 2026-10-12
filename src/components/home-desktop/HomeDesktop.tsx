import type { HomeData } from '../../hooks/useHomeData';
import { HeroCarouselDesktop } from './HeroCarousel.desktop';
import { TourTabsSectionDesktop } from './TourTabsSection.desktop';
import { ThemeRowSectionDesktop } from './ThemeRowSection.desktop';
import { MagazineCardsDesktop } from './MagazineCards.desktop';
import { ReviewCardsDesktop } from './ReviewCards.desktop';
import { categoryImage, inCategory, isPublished, useHomeReviews } from './homeDesktopData';

interface Props {
    data: HomeData;
    isLoading: boolean;
}

/** PC home page (Claude Design "Milkyway Japan Home"). */
export function HomeDesktop({ data, isLoading }: Props) {
    const { reviews, stats } = useHomeReviews();
    const { categories, magazines } = data;
    const products = data.products.filter(isPublished);

    const cat = (id: string) => categories.find((c) => c.id === id);
    const gobi = cat('gobi-desert');
    const horse = cat('horse-riding-tour');
    const central = cat('central-mongolia');

    const gobiRow = products.filter((p) => (gobi && inCategory(p, gobi)) || (horse && inCategory(p, horse)));
    const centralRow = central ? products.filter((p) => inCategory(p, central)) : [];
    const firstImage = (list: typeof products) => list.find((p) => p.mainImages[0])?.mainImages[0] || '';

    return (
        <>
            <HeroCarouselDesktop products={products} />

            {/* SEO H1 — visible to crawlers, visually offscreen */}
            <section className="sr-only">
                <h1>몽골 투어·몽골 여행 전문 현지 여행사</h1>
                <p>
                    몽골리아 은하수는 한국어 가이드가 동행하는 안심 몽골 투어를 안내합니다. 승마 여행, 고비사막, 테를지 국립공원 등 다채로운 플랜을 준비했습니다.
                </p>
            </section>

            {!isLoading && (
                <>
                    <TourTabsSectionDesktop products={products} categories={categories} />

                    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 24px 0', display: 'flex', flexDirection: 'column', gap: 72 }}>
                        <ThemeRowSectionDesktop
                            title="MILKYWAY × GOBI"
                            subtitle="모래언덕·기암·공룡 화석의 땅을 누비는 고비사막 투어"
                            products={gobiRow}
                            stats={stats}
                            image={categoryImage(gobi) || firstImage(gobiRow)}
                            imageAlt="고비사막 투어 | 몽골 여행"
                            link="/category/gobi-desert"
                        />
                        <ThemeRowSectionDesktop
                            title="별밤을 만나는 중앙 몽골"
                            subtitle="대초원·하르호린·고르히 계곡을 누비는 게르 숙박 투어"
                            products={centralRow}
                            stats={stats}
                            image={categoryImage(central) || firstImage(centralRow)}
                            imageAlt="중앙 몽골 투어 | 몽골 여행"
                            link="/category/central-mongolia"
                            reverse
                        />
                    </section>
                </>
            )}

            <MagazineCardsDesktop magazines={magazines} />
            <ReviewCardsDesktop reviews={reviews} />
        </>
    );
}
