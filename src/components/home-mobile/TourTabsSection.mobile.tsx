import { useState } from 'react';
import type { Category } from '../../types/category';
import { inCategory, type HomeProduct } from '../home-desktop/homeDesktopData';
import { SD } from '../site-seed/seed';
import { HOME_IMG } from '../home/homeContent';
import { linkTo, useGo } from './homeMobileData';
import { ChipRow, HSCROLL, SectionHeadMobile } from './SectionHead.mobile';
import { TourCardMobile } from './TourCard.mobile';

interface Props {
    products: HomeProduct[];
    categories: Category[];
}

/** 지금 떠나기 좋은 몽골 투어: 추천 + 분류 칩(상품 수, 0개 칩은 눌리지 않음) + 옆으로 넘기는 상품 카드. */
export function TourTabsSectionMobile({ products, categories }: Props) {
    const go = useGo();
    const [tab, setTab] = useState('all');

    const tabs = [
        { id: 'all', label: '추천', count: products.length },
        ...categories.map((c) => ({ id: c.id, label: c.name, count: products.filter((p) => inCategory(p, c)).length })),
    ];
    const current = tabs.find((t) => t.id === tab) || tabs[0];
    const currentCat = categories.find((c) => c.id === current.id);
    const list = (currentCat
        ? products.filter((p) => inCategory(p, currentCat))
        : [...products].sort((a, b) => Number(b.isFeatured || b.isPopular) - Number(a.isFeatured || a.isPopular))
    ).slice(0, 10);

    return (
        <section id="tours" style={{ paddingTop: 40, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeadMobile icon="trophyCup" iconImage={HOME_IMG.trophy} title="지금 떠나기 좋은 몽골 투어" sub="한국어 가이드 동행, 게르 숙박이 포함된 투어예요" link={currentCat ? `/category/${currentCat.id}` : '/products'} />
            <ChipRow label="투어 분류" value={current.id} onChange={setTab}
                items={tabs.map((t) => ({ id: t.id, label: t.count > 0 ? `${t.label} ${t.count}` : t.label, disabled: t.count === 0 && t.id !== 'all' }))} />
            {list.length === 0 ? (
                <div style={{ margin: '0 20px', border: `1px dashed ${SD.gray300}`, borderRadius: 12, padding: '36px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 14, color: SD.gray700 }}>현재 등록된 투어가 없습니다.</p>
                    <a {...linkTo(go, '/custom-estimate')} style={{ fontSize: 13, fontWeight: 700, color: SD.mint700, textDecoration: 'none' }}>맞춤 견적으로 상담해 보세요 →</a>
                </div>
            ) : (
                <div data-noscroll="" style={{ ...HSCROLL, gap: 12 }}>
                    {list.map((p) => <TourCardMobile key={p.id} p={p} />)}
                </div>
            )}
        </section>
    );
}
