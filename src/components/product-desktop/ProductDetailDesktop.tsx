import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../../hooks/useWishlist';
import { MW_STICKY_TOP, cleanTitle } from '../desktop-primitives/mwTokens';
import { ConnectSection } from '../home/ConnectSection';
import { OverviewBody, DetailBlocks, PhotoOverlay } from '../product/detail/DetailParts';
import { DesignItinerary } from '../product/designTemplates/DesignItinerary';
import {
    detailFlags, detailTabs, summariseReviews, useTourReviews, tourFacts, tourGallery, usePopularTours, useRelatedTours, useSectionTabs, useTourFaqItems, useTourPricing,
    type ShareResult, type TourDetailViewProps,
} from '../product/detail/productDetailData';
import { SD, SD_CONTAINER, SIcon } from '../site-seed/seed';
import { durationLabel } from '../tours-mobile/tourListFilters';
import { BookingCardDesktop } from './BookingCardDesktop';
import { CollapsibleDetail, FaqFolds, GalleryStrip, IncludedFolds, RelatedRow, ReviewList, SectionTitle } from '../product/detail/TourDetailSections';

const TAB_ROW_H = 52;
/** 목차를 눌렀을 때 구역 제목이 멈추는 자리(붙는 메뉴 줄 + 목차 줄 아래). */
const SECTION_OFFSET = MW_STICKY_TOP + TAB_ROW_H + 24;
/** 예약 상자가 붙는 높이. */
const ASIDE_TOP = MW_STICKY_TOP + TAB_ROW_H + 24;

/**
 * PC 투어 상품 상세(Claude Design ‘투어 상품 상세’, 2026-11-26).
 * 경로 → 꼬리표(상품 구분·분류·기간) · 이름 · 공유 → 오른쪽 끝까지 이어지는 사진 줄 → 한 줄 정보 → 붙는 목차
 * → 왼쪽 본문(투어 소개 · 상세 정보(접기) · 일정 · 포함/불포함 · 후기 · 유의 사항·FAQ) + 오른쪽 붙는 예약 상자
 * → 다른 여행자가 함께 본 상품 · 비슷한 상품과 비교 → 협력 업체·문의·SNS(홈 부품).
 */
export function ProductDetailDesktop({ product, reviews, onBook, onShare, previewNotice }: TourDetailViewProps) {
    const navigate = useNavigate();
    const pricing = useTourPricing(product);
    const wishlist = useWishlist();
    const fav = wishlist.has(product.id);
    const tabs = useMemo(() => detailTabs(product), [product]);
    const { active, pick } = useSectionTabs(tabs, SECTION_OFFSET);
    const summary = useMemo(() => summariseReviews(reviews), [reviews]);
    // 이 투어 후기 + 같은 지역 다른 투어의 후기(여행 후기)
    const shownReviews = useTourReviews(product, summary.list);
    const gallery = useMemo(() => tourGallery(product), [product]);
    const faq = useTourFaqItems(product);
    const flags = detailFlags(product);
    const facts = tourFacts(product, pricing.minPeople, false).filter((f) => f.label !== '기간');
    const popular = usePopularTours(product.id, 10);
    const similar = useRelatedTours(product.id, product.category, 10);
    const [photosOpen, setPhotosOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [shared, setShared] = useState<ShareResult>(null);
    const asideRef = useRef<HTMLElement>(null);
    const title = cleanTitle(product.name) || product.name;
    const typeLabel = product.packageType === 'full' ? '풀패키지' : product.packageType === 'value' ? '실속형' : '';
    const chips = [typeLabel, product.category, durationLabel(product.duration)].filter(Boolean);

    // 다른 투어 상세에서 넘어와도 맨 위에서 시작한다.
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }, []);

    // 창이 낮아 예약 상자가 목차 아래 공간보다 길면 아래쪽 끝 기준으로 붙여 ‘예약하기’가 화면 밖으로 나가지 않게 한다.
    useEffect(() => {
        const el = asideRef.current;
        if (!el) return;
        const place = () => {
            el.style.top = `${Math.min(ASIDE_TOP, window.innerHeight - el.offsetHeight - 16)}px`;
        };
        place();
        const observer = new ResizeObserver(place);
        observer.observe(el);
        window.addEventListener('resize', place);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', place);
        };
    }, []);


    const share = async () => {
        const result = await onShare();
        if (result === 'copied') {
            setShared(result);
            window.setTimeout(() => setShared(null), 2000);
        }
    };

    const go = (to: string) => (e: { preventDefault: () => void }) => {
        e.preventDefault();
        navigate(to);
    };

    return (
        <div style={{ background: SD.white, color: SD.gray900 }}>
            <div style={{ ...SD_CONTAINER, paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
                <nav aria-label="현재 위치" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 13, color: SD.gray600, whiteSpace: 'nowrap' }}>
                    <a href="/" onClick={go('/')} style={crumb}>홈</a>
                    <span aria-hidden="true">/</span>
                    <a href="/products" onClick={go('/products')} style={crumb}>투어 상품</a>
                    <span aria-hidden="true">/</span>
                    <span style={{ minWidth: 0, color: SD.gray900, overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                </nav>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {chips.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {chips.map((c) => (
                                    <span key={c} style={{ height: 26, padding: '0 10px', display: 'inline-flex', alignItems: 'center', borderRadius: 6, background: SD.gray100, color: SD.gray700, fontSize: 13, fontWeight: 700 }}>{c}</span>
                                ))}
                            </div>
                        )}
                        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, lineHeight: 1.3, color: SD.gray900, wordBreak: 'keep-all' }}>{title}</h1>
                    </div>
                    <button type="button" onClick={share}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px', border: `1px solid ${SD.gray300}`, borderRadius: 9999, background: SD.white, color: SD.gray900,
                            fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <SIcon name="share" size={18} stroke={1.7} />{shared === 'copied' ? '링크 복사됨' : '공유'}
                    </button>
                </div>

                <GalleryStrip images={gallery} name={product.name} onOpen={() => setPhotosOpen(true)} />

                {facts.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 40px', padding: '4px 0 8px' }}>
                        {facts.map((f) => (
                            <span key={f.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, color: SD.gray900 }}>
                                <span style={{ display: 'flex', color: SD.gray700 }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={f.d} /></svg>
                                </span>
                                {f.label === '최소 인원' ? `최소 ${f.value}` : f.value}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <nav aria-label="상품 정보 목차" data-noscroll=""
                style={{ position: 'sticky', top: MW_STICKY_TOP, zIndex: 30, background: SD.white, borderBottom: `1px solid ${SD.gray200}` }}>
                <div style={{ ...SD_CONTAINER, display: 'flex', gap: 28, overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {tabs.map((t) => {
                        const on = t.id === active;
                        return (
                            <a key={t.id} href={`#${t.id}`} aria-current={on ? 'location' : undefined} onClick={(e) => { e.preventDefault(); pick(t.id); }}
                                style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', height: TAB_ROW_H, borderBottom: `2px solid ${on ? SD.mint500 : 'transparent'}`, color: on ? SD.gray900 : SD.gray600,
                                    fontSize: 15, fontWeight: 700, textDecoration: 'none', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
                                {t.label}
                            </a>
                        );
                    })}
                </div>
            </nav>

            {/* minmax(0, …) + minWidth 0: 넓은 상세 내용이 예약 상자를 화면 밖으로 밀지 않게 */}
            <div style={{ ...SD_CONTAINER, paddingTop: 40, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 48, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 56 }}>
                    <section>
                        <SectionTitle id="td-about">투어 소개</SectionTitle>
                        <OverviewBody product={product} />
                        {flags.hasDetail && (
                            <div style={{ marginTop: 28 }}>
                                <CollapsibleDetail open={detailOpen} onToggle={() => setDetailOpen(!detailOpen)}>
                                    <DetailBlocks product={product} withItinerary={false} />
                                </CollapsibleDetail>
                            </div>
                        )}
                    </section>

                    {flags.hasItinerary && (
                        <section>
                            <SectionTitle id="td-plan">일정</SectionTitle>
                            <div data-itinerary-design style={{ borderRadius: 16, overflow: 'hidden' }}><DesignItinerary product={product} collapsible /></div>
                        </section>
                    )}

                    {flags.hasIncluded && (
                        <section>
                            <SectionTitle id="td-incl" marginBottom={0}>포함 사항</SectionTitle>
                            <IncludedFolds product={product} />
                        </section>
                    )}

                    <section>
                        <SectionTitle id="td-rev" marginBottom={4}
                            right={<a href="/reviews" onClick={go('/reviews')} style={{ fontSize: 14, color: SD.gray700, textDecoration: 'none', whiteSpace: 'nowrap' }}>전체 보기 ›</a>}>
                            후기 {shownReviews.length > 0 && <span style={{ fontSize: 18, color: SD.gray500 }}>{shownReviews.length}</span>}
                        </SectionTitle>
                        <ReviewList reviews={shownReviews} productId={product.id} />
                    </section>

                    <section>
                        <SectionTitle id="td-faq" marginBottom={8}>유의 사항·FAQ</SectionTitle>
                        <FaqFolds items={faq} />
                    </section>
                </div>

                <aside ref={asideRef} aria-label="예약" style={{ position: 'sticky', top: ASIDE_TOP }}>
                    <BookingCardDesktop product={product} pricing={pricing} onBook={onBook} fav={fav} onFav={previewNotice ?? (() => wishlist.toggle(product))} />
                </aside>
            </div>

            {(popular.length > 0 || similar.length > 0) && (
                <div style={{ ...SD_CONTAINER, paddingTop: 0 }}>
                    <div style={{ marginTop: 56, paddingTop: 40, borderTop: `1px solid ${SD.gray200}`, display: 'flex', flexDirection: 'column', gap: 48 }}>
                        <RelatedRow title="다른 여행자가 함께 본 상품" tours={popular} />
                        <RelatedRow title="비슷한 상품과 비교해보세요" tours={similar} />
                    </div>
                </div>
            )}

            <div aria-hidden="true" style={{ height: 96 }} />
            <ConnectSection />

            {photosOpen && <PhotoOverlay title={title} images={gallery} onClose={() => setPhotosOpen(false)} />}
        </div>
    );
}

const crumb: CSSProperties = { color: SD.gray600, textDecoration: 'none' };

/** 불러오는 동안 화면 모양대로 보이는 자리. */
export function ProductDetailDesktopSkeleton() {
    const bar = (w: string | number, h: number, r = 8): CSSProperties => ({ width: w, height: h, borderRadius: r, background: SD.gray100, flexShrink: 0 });
    return (
        <section aria-busy="true" aria-label="불러오는 중" style={{ ...SD_CONTAINER, paddingTop: 24, paddingBottom: 160, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <span style={bar(280, 16)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    <span style={bar(64, 26, 6)} />
                    <span style={bar(80, 26, 6)} />
                    <span style={bar(64, 26, 6)} />
                </div>
                <span style={bar('60%', 42)} />
            </div>
            <div style={{ display: 'flex', gap: 4, height: 460, overflow: 'hidden' }}>
                <span style={bar(460, 460, 10)} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={bar(228, 228, 10)} /><span style={bar(228, 228, 10)} /></span>
                <span style={bar(392, 460, 10)} />
            </div>
        </section>
    );
}
