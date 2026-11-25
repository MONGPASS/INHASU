import type { HomeData } from '../../hooks/useHomeData';
import { isPublished, useHomeReviews } from '../home-desktop/homeDesktopData';
import { ConnectSection } from '../home/ConnectSection';
import { HOME_PROMISES, THEME_ROWS, inTheme } from '../home/homeContent';
import { MLoading } from '../mobile/mobileUi';
import { SD, SIcon } from '../site-seed/seed';
import { BenefitBandMobile } from './BenefitBand.mobile';
import { HeroCarouselMobile } from './HeroCarousel.mobile';
import { MagazineCardsMobile } from './MagazineCards.mobile';
import { MonthlyPickMobile } from './MonthlyPick.mobile';
import { ReviewCardsMobile } from './ReviewCards.mobile';
import { ThemeRowSectionMobile } from './ThemeRowSection.mobile';
import { TourTabsSectionMobile } from './TourTabsSection.mobile';
import { VideoPlaylistMobile } from './VideoPlaylist.mobile';

interface Props {
    data: HomeData;
    isLoading: boolean;
}

/**
 * 휴대폰 홈 본문(Claude Design ‘홈 · 휴대폰’, 2026-11-25). 머리·검색·메뉴 줄·바닥·하단 메뉴는 MobileShell이 그린다.
 * 기획전 배너 → 여행 약속 → 추천 투어(분류 칩) → 테마 줄 2개 → 혜택 띠 → 이달의 추천 PICK → 후기 → 매거진 → 영상 → 소셜·문의·협력 업체.
 * 상품·후기·매거진·배너는 관리자에 등록한 자료이고, 고정 문구·사진은 home/homeContent.ts에 있다(PC 홈과 함께 쓴다).
 */
export function HomeMobile({ data, isLoading }: Props) {
    const { reviews } = useHomeReviews();
    const { categories, magazines } = data;
    const products = data.products.filter(isPublished);

    return (
        <div style={{ background: SD.white, color: SD.gray900 }}>
            <HeroCarouselMobile products={products} />

            {/* SEO H1 — 검색 로봇에는 보이고 화면에서는 가린다 */}
            <section className="sr-only">
                <h1>몽골 투어·몽골 여행 전문 현지 여행사</h1>
                <p>몽골리아 은하수는 한국어 가이드가 동행하는 안심 몽골 투어를 안내합니다. 승마 여행, 고비사막, 테를지 국립공원 등 다채로운 플랜을 준비했습니다.</p>
            </section>

            <section aria-label="여행 약속" style={{ margin: '20px 20px 0', padding: '18px 8px', borderRadius: 12, background: SD.gray50, display: 'flex', gap: 4 }}>
                {HOME_PROMISES.map((item) => (
                    <div key={item.title} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
                        <span style={{ display: 'flex', color: SD.mint700 }}><SIcon name={item.icon} size={24} stroke={1.6} /></span>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: SD.gray900 }}>{item.title}</p>
                        <p style={{ margin: 0, fontSize: 11, color: SD.gray600 }}>{item.sub}</p>
                    </div>
                ))}
            </section>

            {isLoading ? (
                <MLoading />
            ) : (
                <>
                    <TourTabsSectionMobile products={products} categories={categories} />

                    <section aria-label="테마 여행" style={{ paddingTop: 44, display: 'flex', flexDirection: 'column', gap: 32 }}>
                        {THEME_ROWS.map((row) => (
                            <ThemeRowSectionMobile key={row.theme} title={row.title} subtitle={row.subShort} products={products.filter((p) => inTheme(p, row.theme))}
                                image={row.image} imageAlt={row.imageAlt} link={row.link} />
                        ))}
                    </section>

                    <BenefitBandMobile />
                    <MonthlyPickMobile products={products} />
                </>
            )}

            <ReviewCardsMobile reviews={reviews} products={products} />
            <MagazineCardsMobile magazines={magazines} />
            <VideoPlaylistMobile />
            <ConnectSection compact />
        </div>
    );
}
