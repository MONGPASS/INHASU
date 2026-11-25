import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import { SD, SD_CONTAINER, SIcon } from '../site-seed/seed';
import type { Category } from '../../types/category';
import { HOME_IMG, PICK_TABS } from '../home/homeContent';
import { PICK_FALLBACK, PICK_TAB_IMAGES, slotProducts, type HomeSettings } from '../home/homeSettings';
import type { HomeProduct } from './homeDesktopData';
import { packageLabel } from './TourCard.desktop';

const CARD = 384, GAP = 28;

/** 카드 한 장: 사진 3장 모자이크(큰 사진 + 작은 사진 둘) · 이름 · 해시태그 · 가격. */
function PickCard({ p }: { p: HomeProduct }) {
    const navigate = useNavigate();
    const images = p.mainImages.filter(isUsableImage);
    const [a, b = a, c = b] = images;
    const tags = [p.duration, packageLabel(p.packageType), ...p.tags.slice(0, 2)].filter(Boolean).map((t) => `#${t}`).join(' ');
    const href = `/products/${p.id}`;
    const img = { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block', background: SD.gray200 } as const;
    return (
        <a href={href} onClick={(e) => { e.preventDefault(); navigate(href); }}
            style={{ flex: `0 0 ${CARD}px`, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 10, color: SD.gray900, textDecoration: 'none' }}>
            <span style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'repeat(2, minmax(0, 1fr))', gap: 8, height: 230, marginBottom: 16 }}>
                {a ? <img src={a} alt={`${p.name} | ${p.category}`} loading="lazy" decoding="async" style={{ ...img, gridRow: 'span 2' }} /> : <span style={{ ...img, gridRow: 'span 2' }} />}
                {b ? <img src={b} alt="" loading="lazy" decoding="async" style={img} /> : <span style={img} />}
                {c ? <img src={c} alt="" loading="lazy" decoding="async" style={img} /> : <span style={img} />}
            </span>
            <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
            <span style={{ fontSize: 14, color: SD.gray700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tags}</span>
            <span style={{ alignSelf: 'flex-end', marginTop: 10, fontSize: 22, fontWeight: 700 }}>
                {won(p.price)}<span style={{ fontSize: 15, fontWeight: 400, color: SD.gray700 }}> ~</span>
            </span>
        </a>
    );
}

/** 이달의 추천 PICK: 왼쪽 테마 탭(사진 알약) + 오른쪽 옆으로 넘기는 상품 카드와 넘김 막대. 추천·인기 상품이 먼저 온다. */
export function MonthlyPickDesktop({ products, categories, settings }: { products: HomeProduct[]; categories: Category[]; settings: HomeSettings }) {
    const [tab, setTab] = useState('all');
    const [value, setValue] = useState(0);
    const viewport = useRef<HTMLDivElement>(null);
    const [room, setRoom] = useState(0);

    const ranked = [...products].sort((x, y) => Number(y.isFeatured) * 2 + Number(y.isPopular) - (Number(x.isFeatured) * 2 + Number(x.isPopular)));
    // 탭: 전체 + 관리자가 정한 탭 3개(이름 · 카테고리, 홈 화면 관리). 카테고리를 고르지 않은 탭은 낱말로 묶는다.
    const tabs = [{ id: 'all', label: PICK_TABS[0].label, image: PICK_TABS[0].image, categoryId: '', fallback: PICK_FALLBACK[0] },
        ...settings.pickTabs.map((t, i) => ({ id: String(i), label: t.label, image: PICK_TAB_IMAGES[i] || PICK_TABS[0].image, categoryId: t.categoryId, fallback: PICK_FALLBACK[i] }))];
    const current = tabs.find((t) => t.id === tab) || tabs[0];
    const list = (current.id === 'all' ? ranked : slotProducts(ranked, categories, current.categoryId, current.fallback)).slice(0, 8);

    // 넘길 수 있는 거리 = 카드 줄 전체 너비 − 보이는 칸 너비
    useEffect(() => {
        const measure = () => {
            const width = viewport.current?.clientWidth || 0;
            setRoom(Math.max(0, list.length * CARD + Math.max(0, list.length - 1) * GAP - width));
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [list.length]);

    if (products.length === 0) return null;

    return (
        <section aria-label="이달의 추천 PICK" style={{ background: SD.gray50 }}>
            <div style={{ ...SD_CONTAINER, paddingTop: 72, paddingBottom: 64, display: 'flex', flexWrap: 'wrap', gap: '40px 56px' }}>
                <div style={{ flex: '0 0 248px', display: 'flex', flexDirection: 'column', gap: 32 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 26, fontWeight: 700, lineHeight: 1.35, color: SD.gray900, whiteSpace: 'nowrap' }}>
                            <img src={HOME_IMG.pickHeart} alt="" width={44} height={44} style={{ width: 44, height: 44, margin: '-4px 0', objectFit: 'contain', flex: 'none' }} /><span>이달의 추천 PICK</span>
                        </h2>
                        <p style={{ margin: 0, fontSize: 15, color: SD.gray700 }}>이번 시즌에 떠나기 좋은 몽골 여행</p>
                    </div>
                    <div role="tablist" aria-label="추천 테마" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {tabs.map((t) => {
                            const on = t.id === current.id;
                            return (
                                <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => { setTab(t.id); setValue(0); }}
                                    style={{ position: 'relative', width: 190, height: 52, padding: 0, border: 'none', borderRadius: 9999, overflow: 'hidden', cursor: 'pointer', background: SD.gray900 }}>
                                    <img src={t.image} alt="" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    <span style={{ position: 'absolute', inset: 0, background: 'rgba(23,23,26,0.55)' }} />
                                    {on && <span style={{ position: 'absolute', inset: 0, border: `2px solid ${SD.mint400}`, borderRadius: 9999, background: 'rgba(7,118,97,0.45)' }} />}
                                    <span style={{ position: 'absolute', left: 24, right: 20, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: SD.white, fontSize: 15, fontWeight: 700, fontFamily: 'inherit' }}>
                                        {t.label}{on && <SIcon name="arrowRight" size={20} />}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
                    <div ref={viewport} role="tabpanel" style={{ overflow: 'hidden', marginRight: -32, paddingRight: 32 }}>
                        {list.length === 0 ? (
                            <p style={{ margin: 0, padding: '80px 0', fontSize: 15, color: SD.gray700 }}>이 테마의 상품을 준비하고 있어요.</p>
                        ) : (
                            <div style={{ display: 'flex', gap: GAP, transition: 'transform 120ms linear', transform: `translateX(${-Math.round((room * value) / 100)}px)` }}>
                                {list.map((p) => <PickCard key={p.id} p={p} />)}
                            </div>
                        )}
                    </div>
                    {room > 0 && (
                        <input type="range" className="home-pick-range" min={0} max={100} step={1} value={value} onChange={(e) => setValue(Number(e.target.value))}
                            aria-label="추천 상품 넘겨보기" style={{ width: '100%', maxWidth: 760, margin: 0 }} />
                    )}
                </div>
            </div>
        </section>
    );
}
