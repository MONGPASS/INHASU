import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveProductImage } from '../common/ResponsiveProductImage';
import type { Category } from '../../types/category';
import { useWishlist } from '../../hooks/useWishlist';
import { MW, MW_EYEBROW as eyebrow, MW_SEE_ALL as seeAll, isUsableImage } from '../desktop-primitives/mwTokens';
import { TypePill } from '../desktop-primitives/TypePill';
import { inCategory, type HomeProduct } from './homeDesktopData';
import { StartingPrice } from '../product/StartingPrice';

interface Props {
    products: HomeProduct[];
    categories: Category[];
}

const ALL_DESC = '한국어 가이드 동행, 게르 숙박과 유목민 문화 체험이 포함된 몽골 투어. 테마와 일정에 맞춰 골라 보세요.';

export function TourTabsSectionDesktop({ products, categories }: Props) {
    const navigate = useNavigate();
    const [tab, setTab] = useState('all');

    const tabs = [
        { id: 'all', label: '추천', desc: ALL_DESC, count: products.length },
        ...categories.map((c) => ({ id: c.id, label: c.name, desc: c.description, count: products.filter((p) => inCategory(p, c)).length })),
    ];
    const current = tabs.find((t) => t.id === tab) || tabs[0];
    const currentCat = categories.find((c) => c.id === current.id);
    const list = currentCat
        ? products.filter((p) => inCategory(p, currentCat))
        : [...products].sort((a, b) => Number(b.isFeatured || b.isPopular) - Number(a.isFeatured || a.isPopular));

    return (
        <section id="tours" style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 24px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 720 }}>
                    <span style={eyebrow}>TOURS</span>
                    <h2 style={{ margin: 0, fontSize: 32, fontWeight: 900, lineHeight: 1.3 }}>{current.label}</h2>
                    {current.desc && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: MW.mute }}>{current.desc}</p>}
                </div>
                <a
                    href={currentCat ? `/category/${currentCat.id}` : '/products'}
                    onClick={(e) => { e.preventDefault(); navigate(currentCat ? `/category/${currentCat.id}` : '/products'); }}
                    style={seeAll}
                >
                    전체 보기 →
                </a>
            </div>

            <div role="tablist" style={{ display: 'flex', gap: 28, overflowX: 'auto', scrollbarWidth: 'none', margin: '32px 0 28px', borderBottom: `1px solid ${MW.line}` }}>
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
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                height: 52,
                                padding: '0 2px',
                                marginBottom: -1,
                                border: 0,
                                borderBottom: `3px solid ${on ? MW.mint : 'transparent'}`,
                                background: 'transparent',
                                fontFamily: 'inherit',
                                fontSize: 15,
                                fontWeight: on ? 700 : 500,
                                color: on ? MW.navy : MW.mute,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {t.label}
                            <span
                                style={{
                                    minWidth: 22,
                                    height: 22,
                                    padding: '0 7px',
                                    boxSizing: 'border-box',
                                    borderRadius: 999,
                                    background: on ? MW.mintTint : MW.chip,
                                    color: on ? MW.mintDeep : MW.mute2,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                {t.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {list.length === 0 ? (
                <div style={{ border: `1px dashed ${MW.line2}`, borderRadius: 16, padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 15, color: MW.ink3 }}>현재 등록된 투어가 없습니다.</p>
                    <a href="/custom-estimate" onClick={(e) => { e.preventDefault(); navigate('/custom-estimate'); }} style={{ fontSize: 14, fontWeight: 700, color: MW.mintDeep, textDecoration: 'none' }}>
                        맞춤 견적으로 상담해 보세요 →
                    </a>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: '32px 20px' }}>
                    {list.map((p) => (
                        <TourCard key={p.id} p={p} />
                    ))}
                </div>
            )}
        </section>
    );
}

function TourCard({ p }: { p: HomeProduct }) {
    const navigate = useNavigate();
    const wishlist = useWishlist();
    const fav = wishlist.has(p.id);
    const img = p.mainImages[0];

    return (
        <a
            href={`/products/${p.id}`}
            onClick={(e) => { e.preventDefault(); navigate(`/products/${p.id}`); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', color: MW.navy, textDecoration: 'none', transition: 'opacity .15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
            <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 20, overflow: 'hidden', background: MW.mintTint }}>
                {isUsableImage(img) && (
                    <ResponsiveProductImage
                        src={img}
                        sizes="(max-width: 700px) 50vw, 280px"
                        alt={`${p.name} | ${p.category}`}
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                )}
                <FavButton on={fav} onToggle={() => wishlist.toggle(p)} />
                {p.packageType && (
                    <div style={{ position: 'absolute', left: 8, top: 8, right: 48, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', pointerEvents: 'none' }}>
                        <TypePill type={p.packageType} />
                    </div>
                )}
            </div>
            <h3 style={{ margin: '6px 0 0', fontSize: 16, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.duration ? `[${p.duration}] ` : ''}{p.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <StartingPrice product={p} amountStyle={{ fontSize: 20, fontWeight: 900 }} />
            </div>
        </a>
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

