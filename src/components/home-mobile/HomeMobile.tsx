import type { HomeData } from '../../hooks/useHomeData';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { categoryImage, inCategory, isPublished, useHomeReviews } from '../home-desktop/homeDesktopData';
import { KAKAO_CHANNEL_CHAT_URL } from '../../constants/company';
import { M_TILE, QUICK_MENU } from '../mobile/mobileTheme';
import { MLoading, MPhoto } from '../mobile/mobileUi';
import { HeroCarouselMobile } from './HeroCarousel.mobile';
import { MagazineCardsMobile } from './MagazineCards.mobile';
import { ReviewCardsMobile } from './ReviewCards.mobile';
import { ThemeRowSectionMobile } from './ThemeRowSection.mobile';
import { TourTabsSectionMobile } from './TourTabsSection.mobile';
import { CUSTOM_TOUR_IMAGE, linkTo, useGo } from './homeMobileData';

interface Props {
    data: HomeData;
    isLoading: boolean;
}

/** Mobile home page content (Claude Design "Milkyway Japan Mobile"); the shell comes from Layout. */
export function HomeMobile({ data, isLoading }: Props) {
    const { reviews, stats } = useHomeReviews();
    const { categories, magazines } = data;
    const products = data.products.filter(isPublished);

    const gobi = categories.find((c) => c.id === 'gobi-desert');
    const horse = categories.find((c) => c.id === 'horse-riding-tour');
    const gobiRow = products.filter((p) => (gobi && inCategory(p, gobi)) || (horse && inCategory(p, horse)));

    return (
        <>
            <HeroCarouselMobile products={products} />
            <QuickMenu />

            {isLoading ? (
                <MLoading />
            ) : (
                <>
                    <TourTabsSectionMobile products={products} categories={categories} stats={stats} />
                    <ThemeRowSectionMobile
                        title="MILKYWAY × GOBI"
                        subtitle="모래언덕·기암·공룡 화석의 땅을 누비는 고비사막 투어"
                        products={gobiRow}
                        stats={stats}
                        image={categoryImage(gobi) || gobiRow.find((p) => p.mainImages[0])?.mainImages[0] || ''}
                        imageAlt="고비사막 투어 | 몽골 여행"
                        link={gobi ? `/category/${gobi.id}` : '/products'}
                    />
                </>
            )}

            <MagazineCardsMobile magazines={magazines} />
            <ReviewCardsMobile reviews={reviews} />
            <CustomTourBanner />
        </>
    );
}

function QuickMenu() {
    const go = useGo();
    return (
        <nav aria-label="퀵 메뉴" style={{ padding: '28px 16px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '18px 10px' }}>
                {QUICK_MENU.map((item) => (
                    <a key={item.key} {...linkTo(go, item.path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: MW.navy, minWidth: 0, textDecoration: 'none' }}>
                        <span style={{ position: 'relative', width: 76, height: 76 }}>
                            <span style={{ position: 'absolute', inset: 0, borderRadius: 24, background: M_TILE, border: '1.5px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                <img src={item.icon} alt="" width={58} height={58} style={{ width: 58, height: 58, objectFit: 'contain', pointerEvents: 'none' }} />
                            </span>
                            {/* The home grid only marks new entries; PICK / EVENT pills belong to the drawer. */}
                            {item.isNew && (
                                <span
                                    aria-label="신규"
                                    style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: MW.red, border: '2px solid #FFFFFF', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MW_FONT_EN, fontSize: 9, fontWeight: 700, color: '#FFFFFF', pointerEvents: 'none' }}
                                >
                                    N
                                </span>
                            )}
                        </span>
                        <span style={{ maxWidth: '100%', fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                    </a>
                ))}
            </div>
        </nav>
    );
}

function CustomTourBanner() {
    const go = useGo();
    const quote = linkTo(go, '/custom-estimate');
    return (
        <section style={{ margin: '48px 16px 0' }}>
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, background: 'linear-gradient(120deg,#F1FCF8 0%,#E3F8F1 55%,#D1F6EA 100%)', border: `1px solid ${MW.mintTint}`, minHeight: 176 }}>
                <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '46%' }}>
                    <MPhoto src={CUSTOM_TOUR_IMAGE} />
                    <span style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(90deg,#E3F8F1 0%,rgba(227,248,241,0) 45%)' }} />
                </div>
                <a {...quote} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, width: '62%', padding: '20px 0 64px 20px', boxSizing: 'border-box', color: MW.navy, textDecoration: 'none' }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>CUSTOM TOUR</span>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, lineHeight: 1.4, letterSpacing: '-0.02em' }}>
                        나만의 특별한 여행 플랜, <span style={{ color: MW.mintDeep }}>1분 만에</span> 요청하세요
                    </h2>
                    <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: MW.mute }}>한국어 담당 직원이 24시간 이내에 답변드립니다. 견적은 무료입니다.</p>
                </a>
                <div style={{ position: 'absolute', left: 20, bottom: 16, display: 'flex', gap: 6 }}>
                    <a {...quote} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 34, padding: '0 14px', borderRadius: 999, background: MW.navy, fontSize: 12, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                        맞춤 견적 →
                    </a>
                    <a
                        href={KAKAO_CHANNEL_CHAT_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="카카오톡으로 상담"
                        style={{ display: 'flex', alignItems: 'center', height: 34, padding: '0 14px', borderRadius: 999, background: 'rgba(255,255,255,0.85)', border: `1px solid ${MW.mintTint}`, fontSize: 12, fontWeight: 700, color: MW.navy, whiteSpace: 'nowrap', textDecoration: 'none' }}
                    >
                        상담
                    </a>
                </div>
            </div>
        </section>
    );
}
