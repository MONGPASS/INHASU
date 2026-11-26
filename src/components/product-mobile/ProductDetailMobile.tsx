import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../../hooks/useWishlist';
import { ResponsiveProductImage } from '../common/ResponsiveProductImage';
import { cleanTitle, won } from '../desktop-primitives/mwTokens';
import { ConnectSection } from '../home/ConnectSection';
import { MobileShell } from '../mobile/MobileShell';
import { useMobileShell } from '../mobile/mobileShellContext';
import { DetailBlocks, OverviewBody, PhotoOverlay } from '../product/detail/DetailParts';
import { DesignItinerary } from '../product/designTemplates/DesignItinerary';
import {
    detailFlags, detailTabs, summariseReviews, tourFacts, tourGallery, tourImageAlt, usePopularTours, useRelatedTours, useSectionTabs, useTourFaqItems, useTourPricing, useTourReviews,
    type ShareResult, type TourDetailViewProps, type TourPricing,
} from '../product/detail/productDetailData';
import { CollapsibleDetail, FaqFolds, IncludedFolds, RelatedRow, ReviewList, SectionTitle } from '../product/detail/TourDetailSections';
import { SD, SIcon } from '../site-seed/seed';
import { durationLabel } from '../tours-mobile/tourListFilters';

const TAB_ROW_H = 46;

/**
 * 휴대폰 투어 상품 상세(Claude Design ‘투어 상품 상세 — 모바일’, 2026-11-26). PC와 따로 그리는 휴대폰 전용 화면이다.
 * 뒤로 가기 줄(‘투어 상품 상세’ · 공유) → 넘기는 사진(1 / N) → 꼬리표 · 이름 → 2열 정보 → 붙는 목차
 * → 투어 소개 · 상세 정보(접기) · 일정 · 포함/불포함 · 후기(같은 지역 후기 포함) · FAQ → 함께 본 상품 · 비슷한 상품 → 문의 구역.
 * 아래 예약 줄은 조금 내리면 올라오고, 누르면 인원·결제 금액 시트가 펼쳐진다(하단 메뉴 자리를 대신한다).
 */
export function ProductDetailMobile(props: TourDetailViewProps) {
    const { product, onBook, onShare } = props;
    const pricing = useTourPricing(product);
    const wishlist = useWishlist();
    const fav = wishlist.has(product.id);
    const toggleFav = props.previewNotice ?? (() => wishlist.toggle(product));
    const [shared, setShared] = useState<ShareResult>(null);

    // 다른 투어 상세에서 넘어와도 맨 위에서 시작한다.
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const share = async () => {
        const result = await onShare();
        if (result === 'copied') {
            setShared(result);
            window.setTimeout(() => setShared(null), 2000);
        }
    };

    return (
        <MobileShell title="투어 상품 상세" headerScrolls
            titleAction={(
                <button type="button" onClick={share} aria-label={shared === 'copied' ? '링크 복사됨' : '공유'}
                    style={{ width: 44, height: 44, border: 'none', background: 'transparent', color: shared ? SD.mint700 : SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                    <SIcon name="share" size={22} stroke={1.7} />
                </button>
            )}
            bottomBar={<BookingBarMobile pricing={pricing} fav={fav} onFav={toggleFav} onBook={onBook} />}>
            <TourDetailBody {...props} pricing={pricing} />
        </MobileShell>
    );
}

function TourDetailBody({ product, reviews, pricing }: TourDetailViewProps & { pricing: TourPricing }) {
    const navigate = useNavigate();
    const { stickyTop } = useMobileShell();
    const tabs = useMemo(() => detailTabs(product), [product]);
    const { active, pick } = useSectionTabs(tabs, stickyTop + TAB_ROW_H + 14);
    const summary = useMemo(() => summariseReviews(reviews), [reviews]);
    const shownReviews = useTourReviews(product, summary.list);
    const gallery = useMemo(() => tourGallery(product), [product]);
    const faq = useTourFaqItems(product);
    const flags = detailFlags(product);
    const facts = tourFacts(product, pricing.minPeople, false);
    const popular = usePopularTours(product.id, 10);
    const similar = useRelatedTours(product.id, product.category, 10);
    const [photosOpen, setPhotosOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const title = cleanTitle(product.name) || product.name;
    const typeLabel = product.packageType === 'full' ? '풀패키지' : product.packageType === 'value' ? '실속형' : '';
    const chips = [product.category, durationLabel(product.duration)].filter(Boolean);


    return (
        <div style={{ background: SD.white, color: SD.gray900, paddingBottom: 40 }}>
            <PhotoCarousel images={gallery} name={product.name} onOpen={() => setPhotosOpen(true)} />

            <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(typeLabel || chips.length > 0) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {typeLabel && <span style={{ ...CHIP, background: SD.white, border: `1px solid ${SD.gray200}`, color: SD.gray900, fontWeight: 700 }}>{typeLabel}</span>}
                        {chips.map((c) => <span key={c} style={{ ...CHIP, background: SD.gray100, color: SD.gray700 }}>{c}</span>)}
                    </div>
                )}
                <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, lineHeight: 1.4, color: SD.gray900, wordBreak: 'keep-all' }}>{title}</h1>
            </div>

            {facts.length > 0 && (
                <ul style={{ margin: '16px 20px 0', padding: '16px 0 0', borderTop: `1px solid ${SD.gray100}`, listStyle: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 8px' }}>
                    {facts.map((f) => (
                        <li key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, fontSize: 13, color: SD.gray700 }}>
                            <span style={{ width: 32, height: 32, borderRadius: 9999, background: SD.gray50, color: SD.gray700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={f.d} /></svg>
                            </span>
                            <span style={{ minWidth: 0, wordBreak: 'keep-all' }}>{f.label === '최소 인원' ? `최소 인원 ${f.value.replace('~', '')}부터` : f.value}</span>
                        </li>
                    ))}
                </ul>
            )}

            <nav aria-label="상품 정보 목차" data-noscroll=""
                style={{ position: 'sticky', top: stickyTop, zIndex: 15, marginTop: 24, background: SD.white, borderTop: `8px solid ${SD.gray50}`, borderBottom: `1px solid ${SD.gray200}`, display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', padding: '0 12px' }}>
                {tabs.map((t) => {
                    const on = t.id === active;
                    return (
                        <a key={t.id} href={`#${t.id}`} aria-current={on ? 'location' : undefined} onClick={(e) => { e.preventDefault(); pick(t.id); }}
                            style={{ flex: 'none', height: TAB_ROW_H, padding: '0 10px', display: 'inline-flex', alignItems: 'center', fontSize: 14, fontWeight: on ? 700 : 400, color: on ? SD.gray900 : SD.gray600,
                                borderBottom: `2px solid ${on ? SD.gray900 : 'transparent'}`, textDecoration: 'none', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
                            {t.label}
                        </a>
                    );
                })}
            </nav>

            <section style={{ padding: '28px 0 0' }}>
                <div style={{ padding: '0 20px' }}>
                    <SectionTitle id="td-about" compact marginBottom={14}>투어 소개</SectionTitle>
                    <OverviewBody product={product} compact />
                </div>
                {flags.hasDetail && (
                    <div style={{ marginTop: 20 }}>
                        <CollapsibleDetail compact open={detailOpen} onToggle={() => setDetailOpen(!detailOpen)}>
                            {/* 상세 그림은 화면 끝까지(DetailBlocks compact가 좌우 -16px로 넓히므로 그만큼 되돌린다) */}
                            <div style={{ padding: '0 16px' }}><DetailBlocks product={product} compact withItinerary={false} /></div>
                        </CollapsibleDetail>
                    </div>
                )}
            </section>

            {flags.hasItinerary && (
                <section style={{ padding: '36px 20px 0' }}>
                    <SectionTitle id="td-plan" compact marginBottom={14}>일정</SectionTitle>
                    <div data-itinerary-design style={{ margin: '0 -20px' }}><DesignItinerary product={product} variant="mobile" collapsible /></div>
                </section>
            )}

            {flags.hasIncluded && (
                <section style={{ padding: '32px 20px 0' }}>
                    <SectionTitle id="td-incl" compact marginBottom={0}>포함 사항</SectionTitle>
                    <IncludedFolds product={product} compact />
                </section>
            )}

            <section style={{ padding: '36px 20px 0' }}>
                <SectionTitle id="td-rev" compact marginBottom={0}
                    right={<a href="/reviews" onClick={(e) => { e.preventDefault(); navigate('/reviews'); }} style={{ fontSize: 13, color: SD.gray700, textDecoration: 'none', whiteSpace: 'nowrap' }}>전체 보기 ›</a>}>
                    후기 {shownReviews.length > 0 && <span style={{ fontSize: 15, color: SD.gray500 }}>{shownReviews.length}</span>}
                </SectionTitle>
                <ReviewList reviews={shownReviews} productId={product.id} compact />
            </section>

            <section style={{ padding: '36px 20px 0' }}>
                <SectionTitle id="td-faq" compact marginBottom={4}>유의 사항·FAQ</SectionTitle>
                <FaqFolds items={faq} compact />
            </section>

            {popular.length > 0 && <div style={{ paddingTop: 40 }}><RelatedRow title="다른 여행자가 함께 본 상품" tours={popular} compact /></div>}
            {similar.length > 0 && <div style={{ paddingTop: 40 }}><RelatedRow title="비슷한 상품과 비교해보세요" tours={similar} compact /></div>}

            <div aria-hidden="true" style={{ height: 44 }} />
            <ConnectSection compact />

            {photosOpen && <PhotoOverlay title={title} images={gallery} onClose={() => setPhotosOpen(false)} />}
        </div>
    );
}

const CHIP: CSSProperties = { height: 24, padding: '0 8px', borderRadius: 6, fontSize: 12, display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box' };

/** 화면 너비 사진을 손가락으로 넘긴다(4:3). 오른쪽 아래 ‘1 / N’, 사진을 누르면 전체 사진. */
function PhotoCarousel({ images, name, onOpen }: { images: string[]; name: string; onOpen: () => void }) {
    const [index, setIndex] = useState(0);
    if (images.length === 0) {
        return <div style={{ aspectRatio: '4 / 3', background: SD.gray100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: SD.gray600 }}>사진 준비 중입니다</div>;
    }
    return (
        <div role="region" aria-roledescription="carousel" aria-label="상품 사진" style={{ position: 'relative', background: SD.gray100 }}>
            <div data-noscroll=""
                onScroll={(e) => {
                    const el = e.currentTarget;
                    const i = Math.round(el.scrollLeft / (el.clientWidth || 1));
                    if (i !== index) setIndex(i);
                }}
                style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
                {images.map((img, i) => (
                    <button key={i} type="button" onClick={onOpen} aria-label={`사진 ${i + 1} 크게 보기`}
                        style={{ position: 'relative', flex: '0 0 100%', aspectRatio: '4 / 3', padding: 0, border: 0, background: SD.gray100, scrollSnapAlign: 'start', cursor: 'pointer' }}>
                        <ResponsiveProductImage src={img} alt={tourImageAlt(name, i)} sizes="100vw" loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'} decoding="async"
                            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </button>
                ))}
            </div>
            {images.length > 1 && (
                <span aria-live="polite" style={{ position: 'absolute', right: 12, bottom: 12, height: 24, padding: '0 10px', borderRadius: 9999, background: 'rgba(0,0,0,0.55)', color: SD.white, fontSize: 12, fontWeight: 500,
                    display: 'flex', alignItems: 'center', fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>
                    {Math.min(index, images.length - 1) + 1} / {images.length}
                </span>
            )}
        </div>
    );
}

/**
 * 아래 예약 줄(한 줄, 약 64px): 조금 내리면 올라온다. 찜 · ‘n명 · 1인 가격 / 합계’ · 예약하기.
 * 합계나 예약하기를 누르면 인원별 요금·예약금/잔금 시트가 펼쳐지고, 시트 안의 예약하기로 예약 화면에 간다.
 * (디자인의 위쪽 ‘1인 가격·예약금 안내’ 카드는 화면을 많이 가려 빼고, 그 내용은 시트에 둔다 — 2026-11-26 오너 요청)
 */
function BookingBarMobile({ pricing, fav, onFav, onBook }: { pricing: TourPricing; fav: boolean; onFav: () => void; onBook: () => void }) {
    const { options, people, unit, total, depositPer, localPer } = pricing;
    const [show, setShow] = useState(false);
    const [sheet, setSheet] = useState(false);
    const deposit = depositPer * people;
    const balance = localPer > 0 ? localPer * people : Math.max(0, total - deposit);
    const top = options[0]?.pricePerPerson || 0;
    const visible = show || sheet;

    useEffect(() => {
        const onScroll = () => setShow(window.scrollY > 380);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (!sheet) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [sheet]);

    const openSheet = () => setSheet(true);

    return (
        <div aria-hidden={!visible} style={{ position: 'sticky', bottom: 0, zIndex: 30, transform: visible ? 'translateY(0)' : 'translateY(110%)', opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none',
            visibility: visible ? 'visible' : 'hidden', transition: 'transform 0.3s ease, opacity 0.3s ease, visibility 0.3s' }}>
            {sheet && (
                <div role="dialog" aria-label="인원 선택 및 결제 금액"
                    style={{ background: SD.white, borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 28px rgba(0,0,0,0.14)', padding: '10px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <span aria-hidden="true" style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 9999, background: SD.gray200 }} />
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 16, fontWeight: 700, color: SD.gray900 }}>인원 선택</span>
                            {pricing.groupSaves && <span style={{ fontSize: 12, color: SD.gray600 }}>함께 가는 인원이 많을수록 1인 요금이 저렴해요</span>}
                        </span>
                        <button type="button" aria-label="닫기" onClick={() => setSheet(false)} autoFocus
                            style={{ width: 44, height: 44, margin: '-10px -12px 0 0', border: 'none', background: 'transparent', color: SD.gray600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' }}>
                            <SIcon name="close" size={18} />
                        </button>
                    </div>
                    {options.length > 1 ? (
                        <div role="radiogroup" aria-label="인원" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {options.map((o) => {
                                const on = o.people === people;
                                const pct = top > 0 ? Math.max(8, Math.round((o.pricePerPerson / top) * 100)) : 100;
                                return (
                                    <button key={o.people} type="button" role="radio" aria-checked={on} onClick={() => pricing.setPeople(o.people)}
                                        style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', alignItems: 'center', gap: 12, height: 44, padding: '0 12px', border: 'none', borderRadius: 10,
                                            background: on ? SD.mint50 : 'transparent', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                                        <span style={{ fontSize: 14, fontWeight: on ? 700 : 500, color: SD.gray900 }}>{o.people}명</span>
                                        <span aria-hidden="true" style={{ height: 6, borderRadius: 9999, background: SD.gray100, overflow: 'hidden' }}>
                                            <span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 9999, background: on ? SD.mint400 : SD.gray300 }} />
                                        </span>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: on ? SD.mint700 : SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(o.pricePerPerson)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, padding: '0 6px 0 14px', border: `1px solid ${SD.gray200}`, borderRadius: 12 }}>
                            <span style={{ fontSize: 15, fontWeight: 700 }}>성인 {people}명</span>
                            <span style={{ display: 'flex' }}>
                                <button type="button" aria-label="인원 줄이기" onClick={pricing.dec} disabled={!pricing.canDec} style={{ ...STEP, opacity: pricing.canDec ? 1 : 0.3 }}>−</button>
                                <button type="button" aria-label="인원 늘리기" onClick={pricing.inc} disabled={!pricing.canInc} style={{ ...STEP, opacity: pricing.canInc ? 1 : 0.3 }}>+</button>
                            </span>
                        </div>
                    )}
                    <div style={{ borderRadius: 14, background: SD.gray50, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: SD.gray700 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <span>총 여행 금액 <span style={{ color: SD.gray600, fontSize: 12 }}>{won(unit)} × {people}명</span></span>
                            <span style={{ fontWeight: 700, color: SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(total)}</span>
                        </div>
                        {depositPer > 0 && (
                            <>
                                <div style={{ height: 1, background: SD.gray200 }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                    <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>총 결제금액</span>
                                        <span style={{ fontSize: 12, color: SD.gray600 }}><strong style={{ color: SD.mint700 }}>지금 결제</strong> · 예약금 · 계좌이체</span>
                                    </span>
                                    <span style={{ fontSize: 18, fontWeight: 700, color: SD.mint600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(deposit)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                    <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>총 결제 예정 금액</span>
                                        <span style={{ fontSize: 12, color: SD.gray600 }}><strong style={{ color: SD.gray700 }}>현지 결제</strong> · 잔금 · 현금</span>
                                    </span>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(balance)}</span>
                                </div>
                            </>
                        )}
                    </div>
                    <p style={{ margin: '-4px 0 0', display: 'flex', gap: 6, fontSize: 11, lineHeight: '17px', color: SD.gray600 }}>
                        <span style={{ flex: 'none', height: 17, display: 'flex', alignItems: 'center' }}><SIcon name="info" size={13} stroke={1.8} /></span>
                        <span>예약금은 숙박 시설 선결제에 쓰여 취소 시에도 환불되지 않아요.</span>
                    </p>
                </div>
            )}
            <div style={{ background: SD.white, borderTop: `1px solid ${sheet ? SD.gray100 : SD.gray200}`, boxShadow: sheet ? 'none' : '0 -4px 16px rgba(0,0,0,0.06)',
                padding: sheet ? '10px 16px calc(14px + env(safe-area-inset-bottom))' : '8px 16px calc(8px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', gap: 12 }}>
                {sheet ? (
                    <>
                        <button type="button" onClick={onFav} aria-pressed={fav} style={{ ...BAR_BUTTON, flex: '0 0 110px', background: SD.white, color: SD.gray900, border: `1px solid ${SD.gray300}` }}>
                            <HeartIcon on={fav} />{fav ? '찜함' : '찜하기'}
                        </button>
                        <button type="button" onClick={onBook} style={{ ...BAR_BUTTON, flex: '1 1 auto', background: SD.mint700, color: SD.white }}>예약하기</button>
                    </>
                ) : (
                    <>
                        <button type="button" onClick={onFav} aria-pressed={fav} aria-label={fav ? '찜 목록에서 삭제' : '찜하기'}
                            style={{ flex: 'none', width: 44, height: 44, borderRadius: 9999, border: `1px solid ${SD.gray200}`, background: SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' }}>
                            <HeartIcon on={fav} />
                        </button>
                        <button type="button" onClick={openSheet} aria-haspopup="dialog" aria-label={`${people}명 · 1인 ${won(unit)} · 합계 ${won(total)} — 인원·결제 금액 보기`}
                            style={{ flex: '1 1 auto', minWidth: 0, padding: 0, border: 'none', background: 'transparent', fontFamily: 'inherit', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 1, cursor: 'pointer' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, color: SD.gray600, whiteSpace: 'nowrap' }}>
                                <strong style={{ color: SD.gray900 }}>{people}명</strong>&nbsp;· 1인 {won(unit)}
                                <SIcon name="chevronUp" size={14} stroke={2} />
                            </span>
                            <span style={{ fontSize: 17, fontWeight: 700, color: SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>합계 {won(total)}</span>
                        </button>
                        <button type="button" onClick={openSheet} style={{ ...BAR_BUTTON, height: 44, flex: '0 0 112px', borderRadius: 9999, fontSize: 15, background: SD.mint700, color: SD.white }}>예약하기</button>
                    </>
                )}
            </div>
        </div>
    );
}

function HeartIcon({ on }: { on: boolean }) {
    return (
        <span style={{ display: 'flex', color: on ? SD.red : SD.gray900 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" />
            </svg>
        </span>
    );
}

const STEP: CSSProperties = { width: 40, height: 40, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 20, color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' };
const BAR_BUTTON: CSSProperties = { height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', borderRadius: 10, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };

/** 불러오는 동안 화면 모양대로 보이는 자리. */
export function ProductDetailMobileSkeleton() {
    const bar = (w: string | number, h: number, r = 8): CSSProperties => ({ width: w, height: h, borderRadius: r, background: SD.gray100, flexShrink: 0 });
    return (
        <div aria-busy="true" aria-label="불러오는 중" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 40 }}>
            <span style={{ aspectRatio: '4 / 3', background: SD.gray100 }} />
            <div style={{ padding: '8px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    <span style={bar(56, 24, 6)} />
                    <span style={bar(72, 24, 6)} />
                    <span style={bar(56, 24, 6)} />
                </div>
                <span style={bar('88%', 24)} />
                <span style={bar('56%', 24)} />
                <span style={bar('100%', 80, 12)} />
            </div>
        </div>
    );
}
