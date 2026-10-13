import type { CSSProperties } from 'react';
import { MW, MW_FONT_EN, MW_GRADIENT } from '../desktop-primitives/mwTokens';
import { useHomeReviews } from '../home-desktop/homeDesktopData';
import { linkTo, useGo } from '../home-mobile/homeMobileData';
import { TourCardDesktop } from '../tours-desktop/TourCardDesktop';
import { PromoHero } from './PromoHero';
import type { PromotionDetailView } from './promotionsData';

const crumb: CSSProperties = { color: MW.mute, textDecoration: 'none' };
const outlineBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 22px', border: `1.5px solid ${MW.mint}`, borderRadius: 999, background: '#FFFFFF', fontSize: 14, fontWeight: 700, color: MW.mintDeep, textDecoration: 'none', whiteSpace: 'nowrap' };
const solidBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 22px', borderRadius: 999, background: MW_GRADIENT, fontSize: 14, fontWeight: 700, color: MW.navy, textDecoration: 'none', whiteSpace: 'nowrap' };

/** PC 여행 기획전 detail: breadcrumb, the promotion's card as a hero, then its tours in the tour-list grid. */
export function PromotionDetailDesktop({ view }: { view: PromotionDetailView }) {
    const go = useGo();
    const { stats } = useHomeReviews();
    const { item, tours, isLoading, toursLoading } = view;

    const link = (path: string) => linkTo((to) => { go(to); window.scrollTo(0, 0); }, path);

    return (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 104px', display: 'flex', flexDirection: 'column', gap: 32 }}>
            <nav aria-label="현재 위치" style={{ display: 'flex', gap: 8, fontSize: 13, color: MW.mute, minWidth: 0 }}>
                <a {...link('/')} style={crumb}>홈</a>
                <span>›</span>
                <a {...link('/promotions')} style={{ ...crumb, flexShrink: 0 }}>여행 기획전</a>
                {item && (
                    <>
                        <span>›</span>
                        <span style={{ color: MW.navy, fontWeight: 700, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                    </>
                )}
            </nav>

            {isLoading ? (
                <p style={{ margin: 0, padding: '80px 0', textAlign: 'center', fontSize: 14, color: MW.mute }}>불러오는 중…</p>
            ) : !item ? (
                <div style={{ border: `1px dashed ${MW.line2}`, borderRadius: 16, padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                    <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>찾으시는 기획전이 없습니다.</h1>
                    <p style={{ margin: 0, fontSize: 14, color: MW.mute }}>공개가 종료되었을 수 있습니다. 진행 중인 기획전은 목록에서 확인해 주세요.</p>
                    <a {...link('/promotions')} style={{ ...solidBtn, marginTop: 8 }}>여행 기획전 목록으로</a>
                </div>
            ) : (
                <>
                    <PromoHero item={item} pc />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', paddingBottom: 16, borderBottom: `1px solid ${MW.line}` }}>
                            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, lineHeight: 1.3 }}>이 기획전의 투어</h2>
                            {!toursLoading && tours.length > 0 && (
                                <span style={{ fontSize: 15, color: MW.mute }}>
                                    <strong style={{ fontSize: 20, fontWeight: 900, color: MW.navy }}>{tours.length}</strong>건의 투어
                                </span>
                            )}
                        </div>

                        {toursLoading ? (
                            <p style={{ margin: 0, padding: '56px 0', textAlign: 'center', fontSize: 14, color: MW.mute }}>불러오는 중…</p>
                        ) : tours.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,250px),1fr))', gap: '40px 20px' }}>
                                {tours.map((p) => (
                                    <TourCardDesktop key={p.id} p={p} stat={stats[p.id]} />
                                ))}
                            </div>
                        ) : (
                            <div style={{ borderRadius: 28, background: `linear-gradient(135deg,${MW.mintBg},#FFFFFF)`, border: `1px solid ${MW.mintTint}`, padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
                                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: MW.navy }}>이 기획전의 투어는 현재 준비 중입니다.</p>
                                <p style={{ margin: 0, fontSize: 14, color: MW.mute }}>다른 투어를 둘러보시거나, 원하시는 조건에 맞춘 맞춤 견적을 이용해 주세요.</p>
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
                                    <a {...link('/products')} style={outlineBtn}>투어 상품 보기</a>
                                    <a {...link('/custom-estimate')} style={solidBtn}>맞춤 견적</a>
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <a {...link('/promotions')} style={{ fontSize: 14, fontWeight: 700, color: MW.navy, textDecoration: 'none' }}>← 여행 기획전 목록으로</a>
                    </div>

                    {/* The empty state already offers the quote button. */}
                    {tours.length > 0 && (
                        <div style={{ borderRadius: 28, padding: '36px 40px', background: 'radial-gradient(360px 220px at 100% 0%,rgba(39,171,143,0.18),rgba(39,171,143,0) 70%),#FFFFFF', border: `1.5px solid ${MW.mintTint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>CUSTOM TOUR</span>
                                <span style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.45 }}>나만의 특별한 플랜을 1분 만에 요청하세요</span>
                                <span style={{ fontSize: 14, lineHeight: 1.7, color: MW.mute }}>한국어 스태프가 24시간 이내에 답변드립니다. 견적은 무료입니다.</span>
                            </div>
                            <a {...link('/custom-estimate')} style={{ ...solidBtn, height: 52, padding: '0 36px', fontSize: 15, boxShadow: '0 8px 20px rgba(39,171,143,0.28)' }}>맞춤 견적</a>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
