import type { HomeData } from '../../hooks/useHomeData';
import { SD, SD_CONTAINER } from '../site-seed/seed';
import { ConnectSection } from '../home/ConnectSection';
import { THEME_ROWS, inTheme } from '../home/homeContent';
import { HeroCarouselDesktop } from './HeroCarousel.desktop';
import { TourTabsSectionDesktop } from './TourTabsSection.desktop';
import { ThemeRowSectionDesktop } from './ThemeRowSection.desktop';
import { BenefitBandDesktop } from './BenefitBand.desktop';
import { MonthlyPickDesktop } from './MonthlyPick.desktop';
import { MagazineCardsDesktop } from './MagazineCards.desktop';
import { ReviewCardsDesktop } from './ReviewCards.desktop';
import { VideoPlaylistDesktop } from './VideoPlaylist.desktop';
import { isPublished, useHomeReviews } from './homeDesktopData';

interface Props {
    data: HomeData;
    isLoading: boolean;
}

/**
 * PC 홈 (Claude Design ‘홈’, 2026-11-25).
 * 기획전 배너 → 추천 투어(분류 탭) → 테마 줄 2개 → 혜택 띠 → 이달의 추천 PICK → 후기 → 매거진 → 영상 → 소셜·문의·협력 업체.
 * 상품·후기·매거진·배너는 관리자에 등록한 자료이고, 고정 문구·사진은 home/homeContent.ts에 있다.
 */
export function HomeDesktop({ data, isLoading }: Props) {
    const { reviews } = useHomeReviews();
    const { categories, magazines } = data;
    const products = data.products.filter(isPublished);

    return (
        <div style={{ background: SD.white, color: SD.gray900 }}>
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

                    <section aria-label="테마 여행" style={{ ...SD_CONTAINER, paddingTop: 96, display: 'flex', flexDirection: 'column', gap: 64 }}>
                        {THEME_ROWS.map((row, i) => (
                            <ThemeRowSectionDesktop key={row.theme} title={row.title} subtitle={row.sub} products={products.filter((p) => inTheme(p, row.theme))}
                                image={row.image} imageAlt={row.imageAlt} link={row.link} reverse={i % 2 === 1} />
                        ))}
                    </section>

                    <BenefitBandDesktop />
                    <MonthlyPickDesktop products={products} />
                </>
            )}

            {/* 후기가 없으면 후기 구역이 통째로 빠지므로 매거진 위 여백을 대신 둔다 */}
            {reviews.length === 0 && <div aria-hidden="true" style={{ height: 96 }} />}
            <ReviewCardsDesktop reviews={reviews} products={products} />
            <MagazineCardsDesktop magazines={magazines} />
            <VideoPlaylistDesktop />
            <ConnectSection />
        </div>
    );
}
