import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Category } from '../../types/category';
import { MW } from '../desktop-primitives/mwTokens';
import { SD, SD_CONTAINER, SSectionHead } from '../site-seed/seed';
import { inCategory, type HomeProduct } from './homeDesktopData';
import { SeeAllLink, TourCardDesktop } from './TourCard.desktop';

interface Props {
    products: HomeProduct[];
    categories: Category[];
}

/** 지금 떠나기 좋은 몽골 투어: 추천 + 분류 탭(상품 수, 0개 탭은 눌리지 않음) + 상품 카드 격자. */
export function TourTabsSectionDesktop({ products, categories }: Props) {
    const navigate = useNavigate();
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
        <section id="tours" style={{ ...SD_CONTAINER, paddingTop: 80, display: 'flex', flexDirection: 'column', gap: 28 }}>
            <SSectionHead icon="trophyCup" title="지금 떠나기 좋은 몽골 투어" sub="풀패키지와 실속형 패키지에서 선택하고 떠나요!"
                more={<SeeAllLink to={currentCat ? `/category/${currentCat.id}` : '/products'} />} />

            <div role="tablist" aria-label="투어 분류" style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none', marginLeft: -16, borderBottom: `1px solid ${SD.gray200}` }}>
                {tabs.map((t) => {
                    const on = t.id === current.id;
                    const empty = t.count === 0 && t.id !== 'all';
                    return (
                        <button key={t.id} type="button" role="tab" aria-selected={on} disabled={empty} onClick={() => setTab(t.id)}
                            style={{ flexShrink: 0, height: 44, padding: '0 16px', marginBottom: -1, border: 0, borderBottom: `2px solid ${on ? SD.gray900 : 'transparent'}`, background: 'transparent',
                                fontFamily: 'inherit', fontSize: 16, fontWeight: 700, color: on ? SD.gray900 : empty ? SD.gray500 : SD.gray600, cursor: empty ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                            {t.label} {t.count}
                        </button>
                    );
                })}
            </div>

            {list.length === 0 ? (
                <div style={{ border: `1px dashed ${SD.gray300}`, borderRadius: 12, padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 15, color: SD.gray700 }}>현재 등록된 투어가 없습니다.</p>
                    <a href="/custom-estimate" onClick={(e) => { e.preventDefault(); navigate('/custom-estimate'); }} style={{ fontSize: 14, fontWeight: 700, color: SD.mint700, textDecoration: 'none' }}>
                        맞춤 견적으로 상담해 보세요 →
                    </a>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '32px 20px' }}>
                    {list.map((p) => <TourCardDesktop key={p.id} p={p} />)}
                </div>
            )}
        </section>
    );
}

export function FavButton({ on, onToggle, variant = 'solid' }: { on: boolean; onToggle: () => void; variant?: 'solid' | 'ghost' }) {
    const ghost = variant === 'ghost';
    return (
        <button
            type="button"
            aria-label={on ? '찜 목록에서 삭제' : '찜 목록에 추가'}
            aria-pressed={on}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggle();
            }}
            style={{
                position: 'absolute',
                right: 8,
                top: 8,
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: 0,
                background: ghost ? 'transparent' : 'rgba(255,255,255,0.92)',
                cursor: 'pointer',
                fontSize: ghost ? 20 : 16,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: on ? MW.red : ghost ? '#fff' : MW.ink3,
                textShadow: ghost ? '0 1px 4px rgba(0,0,0,0.4)' : undefined,
            }}
        >
            {on ? '♥' : '♡'}
        </button>
    );
}

