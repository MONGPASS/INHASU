import { useState } from 'react';
import type { Category } from '../../types/category';
import { useWishlist } from '../../hooks/useWishlist';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { inCategory, type HomeProduct, type ReviewStat } from '../home-desktop/homeDesktopData';
import { MEmpty } from '../mobile/mobileUi';
import { useGo } from './homeMobileData';
import { SectionHeadMobile } from './SectionHead.mobile';
import { TourGridCardMobile } from './TourCard.mobile';

interface Props {
    products: HomeProduct[];
    categories: Category[];
    stats: Record<string, ReviewStat>;
}

/** "TOURS": category pills over a two-column grid of tour cards. */
export function TourTabsSectionMobile({ products, categories, stats }: Props) {
    const go = useGo();
    const wishlist = useWishlist();
    const [tab, setTab] = useState('all');

    const tabs = [
        { id: 'all', label: '추천', count: products.length },
        ...categories.map((c) => ({ id: c.id, label: c.name, count: products.filter((p) => inCategory(p, c)).length })),
    ];
    const current = tabs.find((t) => t.id === tab) || tabs[0];
    const currentCat = categories.find((c) => c.id === current.id);
    const list = currentCat
        ? products.filter((p) => inCategory(p, currentCat))
        : [...products].sort((a, b) => Number(b.isFeatured || b.isPopular) - Number(a.isFeatured || a.isPopular));

    return (
        <section id="tours" style={{ padding: '44px 0 0' }}>
            <SectionHeadMobile
                eyebrow="TOURS"
                title="몽골 투어 상품"
                link={currentCat ? `/category/${currentCat.id}` : '/products'}
                linkLabel="전체 보기 →"
            />

            <div role="tablist" data-noscroll="" style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '16px 16px 4px' }}>
                {tabs.map((t) => {
                    const on = t.id === current.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            onClick={() => setTab(t.id)}
                            style={{
                                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', borderRadius: 999,
                                border: `1px solid ${on ? MW.navy : MW.line}`, background: on ? MW.navy : '#FFFFFF',
                                fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: on ? '#FFFFFF' : MW.ink3, cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                        >
                            {t.label}
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, color: on ? MW.mintLight : MW.mute2 }}>{t.count}</span>
                        </button>
                    );
                })}
            </div>

            {list.length === 0 ? (
                <div style={{ padding: '16px 16px 0' }}>
                    <MEmpty text="현재 등록된 투어가 없습니다." action={{ label: '맞춤 견적으로 상담하기', onClick: () => go('/custom-estimate') }} />
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '22px 12px', padding: '16px 16px 0' }}>
                    {list.map((p) => (
                        <TourGridCardMobile key={p.id} p={p} stat={stats[p.id]} fav={wishlist.has(p.id)} onFav={() => wishlist.toggle(p)} />
                    ))}
                </div>
            )}
        </section>
    );
}
