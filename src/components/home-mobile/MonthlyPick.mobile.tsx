import { useState } from 'react';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import type { HomeProduct } from '../home-desktop/homeDesktopData';
import { packageLabel } from '../home-desktop/TourCard.desktop';
import { PICK_TABS, inTheme, type ThemeKey } from '../home/homeContent';
import { MPhoto } from '../mobile/mobileUi';
import { SD } from '../site-seed/seed';
import { linkTo, useGo } from './homeMobileData';
import { ChipRow, HSCROLL, SectionHeadMobile } from './SectionHead.mobile';

/** 카드 한 장: 사진 3장 모자이크(큰 사진 + 작은 사진 둘) · 이름 · 해시태그 · 가격. */
function PickCard({ p }: { p: HomeProduct }) {
    const go = useGo();
    const images = p.mainImages.filter(isUsableImage);
    const [a, b = a, c = b] = images;
    const tags = [p.duration, packageLabel(p.packageType), ...p.tags.slice(0, 1)].filter(Boolean).map((t) => `#${t}`).join(' ');
    const cell = { position: 'relative', borderRadius: 8, overflow: 'hidden', background: SD.gray200 } as const;
    return (
        <a {...linkTo(go, `/products/${p.id}`)} style={{ flex: '0 0 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, color: SD.gray900, textDecoration: 'none' }}>
            <span style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'repeat(2, minmax(0, 1fr))', gap: 6, height: 170, marginBottom: 8 }}>
                <span style={{ ...cell, gridRow: 'span 2' }}><MPhoto src={a} alt={`${p.name} | ${p.category}`} sizes="140px" /></span>
                <span style={cell}><MPhoto src={b} sizes="140px" /></span>
                <span style={cell}><MPhoto src={c} sizes="140px" /></span>
            </span>
            <span style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
            <span style={{ fontSize: 12, color: SD.gray700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tags}</span>
            <span style={{ alignSelf: 'flex-end', fontSize: 18, fontWeight: 700 }}>
                {won(p.price)}<span style={{ fontSize: 13, fontWeight: 400, color: SD.gray700 }}> ~</span>
            </span>
        </a>
    );
}

/** 이달의 추천 PICK(휴대폰): 테마 칩 + 옆으로 넘기는 모자이크 카드. 추천·인기 상품이 먼저 온다. */
export function MonthlyPickMobile({ products }: { products: HomeProduct[] }) {
    const [tab, setTab] = useState<'all' | ThemeKey>('all');
    if (products.length === 0) return null;

    const ranked = [...products].sort((x, y) => Number(y.isFeatured) * 2 + Number(y.isPopular) - (Number(x.isFeatured) * 2 + Number(x.isPopular)));
    const list = (tab === 'all' ? ranked : ranked.filter((p) => inTheme(p, tab))).slice(0, 8);

    return (
        <section aria-label="이달의 추천 PICK" style={{ background: SD.gray50, padding: '40px 0 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeadMobile icon="pushPin" title="이달의 추천 PICK" sub="이번 시즌에 떠나기 좋은 몽골 여행" />
            <ChipRow label="추천 테마" value={tab} onChange={(id) => setTab(id as 'all' | ThemeKey)} items={PICK_TABS.map((t) => ({ id: t.id, label: t.label }))} />
            {list.length === 0 ? (
                <p style={{ margin: 0, padding: '40px 20px', fontSize: 14, color: SD.gray700 }}>이 테마의 상품을 준비하고 있어요.</p>
            ) : (
                <div data-noscroll="" style={{ ...HSCROLL, gap: 16 }}>
                    {list.map((p) => <PickCard key={p.id} p={p} />)}
                </div>
            )}
        </section>
    );
}
