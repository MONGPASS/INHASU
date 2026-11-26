import { useMemo, useState, type MouseEvent } from 'react';
import { useHomeData } from '../../hooks/useHomeData';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import { categoryCircleImage, inCategory, isPublished } from '../home-desktop/homeDesktopData';
import { SD, SD_CONTAINER, SIcon } from '../site-seed/seed';
import { TourTypeBadge } from '../tours-desktop/TourTypeBadge';
import { durationLabel } from '../tours-mobile/tourListFilters';
import { myQuotePath, type QuoteDoneState } from './quoteLinks';
import { requestNo } from './quoteSeed';
import { QKakaoLink } from './QuoteSeedParts';

const STATUS = ['요청 접수', '견적 작성 중', '견적 도착', '예약 진행'];

/**
 * 견적 요청 완료(Claude Design ‘맞춤 견적 — 요청 완료 (PC)’·‘맞춤 견적 요청 완료 — 모바일’):
 * 완료 표시 · 요청 번호 → 진행 4단계(STEP 1 요청 접수) + 알림톡 안내 → 카카오톡 상담 · 내 견적서 확인하기 →
 * 견적을 기다리는 동안 투어 상품 둘러보기(지역 동그라미 + 상품 4개). 내 견적서 주소(`/내견적.html?t=…`)는 알림톡과 같다.
 */
export function QuoteDoneBody({ done, go, compact = false }: { done: QuoteDoneState; go: (path: string) => void; compact?: boolean }) {
    const mine = myQuotePath(done.token);
    const no = done.id ? requestNo(done.id) : '';
    const link = (to: string) => ({ href: to, onClick: (e: MouseEvent) => { e.preventDefault(); go(to); } });
    const btn = { flex: '1 1 0', height: 52, borderRadius: 12, boxSizing: 'border-box' as const, fontSize: compact ? 14 : 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: compact ? 6 : 8, textDecoration: 'none' };

    const head = (
        <section aria-labelledby="qd-title" style={compact
            ? { padding: '36px 20px 32px', textAlign: 'center', borderBottom: `8px solid ${SD.gray50}` }
            : { margin: '56px auto 0', maxWidth: 640, textAlign: 'center' }}>
            <span aria-hidden="true" style={{ width: 56, height: 56, margin: '0 auto', borderRadius: 9999, background: SD.mint500, color: SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SIcon name="checkMark" size={26} stroke={2.6} />
            </span>
            <h1 id="qd-title" style={{ margin: '20px 0 8px', fontSize: compact ? 22 : 28, fontWeight: 700, color: SD.gray900 }}>견적 요청이 완료되었습니다.</h1>
            <p style={{ margin: 0, fontSize: compact ? 13 : 15, lineHeight: 1.6, color: SD.gray600 }}>
                {compact ? '담당자 확인 후 빠른 연락을 드려요.' : '담당자가 확인한 뒤 영업시간 기준 24시간 이내에 연락드립니다.'}
            </p>
            {no && <p style={{ margin: '14px 0 0', fontSize: 13, color: SD.gray500 }}>요청 번호 <strong style={{ marginLeft: 6, color: SD.gray900, letterSpacing: '0.02em' }}>{no}</strong></p>}
            <div style={{ marginTop: compact ? 28 : 36, padding: compact ? '20px 16px 0' : '28px 28px 0', borderRadius: 16, background: SD.white, border: `1px solid ${SD.gray200}`, textAlign: 'left', overflow: 'hidden' }}>
                <ol aria-label="견적 진행 상태" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', gap: compact ? 6 : 12 }}>
                    {STATUS.map((s, i) => {
                        const on = i === 0;
                        return (
                            <li key={s} aria-current={on || undefined} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <span aria-hidden="true" style={{ height: 4, borderRadius: 9999, background: on ? SD.gray900 : SD.gray200 }} />
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: compact ? 10 : 11, fontWeight: 700, letterSpacing: '0.04em', color: on ? SD.gray900 : SD.gray500 }}>
                                        STEP {i + 1}
                                        {on && <span style={{ width: 16, height: 16, borderRadius: 9999, background: SD.gray900, color: SD.white, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><SIcon name="checkMark" size={10} stroke={3} /></span>}
                                    </span>
                                    <span style={{ fontSize: compact ? 13 : 14, fontWeight: on ? 700 : 500, color: on ? SD.gray900 : SD.gray500, whiteSpace: 'nowrap' }}>{s}</span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
                <div style={{ margin: compact ? '20px -16px 0' : '24px -28px 0', padding: compact ? '12px 16px' : '14px 28px', background: SD.gray50, borderTop: `1px solid ${SD.gray100}`,
                    display: 'flex', alignItems: 'center', justifyContent: compact ? 'center' : 'flex-start', gap: compact ? 6 : 8, fontSize: 13, color: SD.gray700 }}>
                    <SIcon name="bell" size={16} stroke={1.8} />견적서가 준비되면 카카오 알림톡으로 알려 드립니다.
                </div>
            </div>
            <div style={{ marginTop: 28, width: '100%', display: 'flex', gap: 10 }}>
                <QKakaoLink label={compact ? '카카오톡 상담' : '카카오톡 상담하기'} style={{ ...btn, border: `1px solid ${SD.gray300}`, background: SD.white }} />
                <a href={mine} style={{ ...btn, border: `1px solid ${SD.mint500}`, background: SD.mint500, color: SD.white }}>내 견적서 확인하기</a>
            </div>
        </section>
    );

    if (compact) {
        return (
            <div style={{ background: SD.white, color: SD.gray900 }}>
                {head}
                <TourBrowse compact go={go} />
                <div style={{ paddingBottom: 32, textAlign: 'center' }}>
                    <a {...link('/')} style={{ fontSize: 13, color: SD.gray600, textDecoration: 'underline', textUnderlineOffset: 3 }}>홈으로 돌아가기</a>
                </div>
            </div>
        );
    }
    return (
        <main style={{ background: SD.gray50, color: SD.gray900 }}>
            <div style={{ ...SD_CONTAINER, paddingTop: 20 }}>
                <nav aria-label="현재 위치" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: SD.gray600 }}>
                    <a {...link('/')} style={{ color: SD.gray600, textDecoration: 'none' }}>홈</a><span aria-hidden="true">›</span>
                    <a {...link('/custom-estimate')} style={{ color: SD.gray600, textDecoration: 'none' }}>맞춤 견적</a><span aria-hidden="true">›</span>
                    <span style={{ color: SD.gray900, fontWeight: 700 }}>요청 완료</span>
                </nav>
                {head}
            </div>
            <div style={{ ...SD_CONTAINER, paddingTop: 72, paddingBottom: 96 }}>
                <TourBrowse go={go} />
                <div style={{ marginTop: 48, textAlign: 'center' }}>
                    <a {...link('/')} style={{ fontSize: 14, color: SD.gray600, textDecoration: 'underline', textUnderlineOffset: 3 }}>홈으로 돌아가기</a>
                </div>
            </div>
        </main>
    );
}

/** 견적을 기다리는 동안 둘러볼 투어: 지역 동그라미(전체 + 관리자 분류) + 판매 중 상품 4개. */
function TourBrowse({ go, compact = false }: { go: (path: string) => void; compact?: boolean }) {
    const { data: home } = useHomeData();
    const [region, setRegion] = useState('all');
    const products = useMemo(() => home.products.filter(isPublished), [home.products]);
    const regions = useMemo(() => [
        { id: 'all', label: '전체', img: products.find((p) => isUsableImage(p.mainImages[0]))?.mainImages[0] || '' },
        ...home.categories.slice(0, 4).map((c) => ({ id: c.id, label: c.name, img: categoryCircleImage(c) || products.find((p) => inCategory(p, c) && isUsableImage(p.mainImages[0]))?.mainImages[0] || '' })),
    ], [home.categories, products]);
    const cat = home.categories.find((c) => c.id === region);
    const items = products.filter((p) => !cat || inCategory(p, cat)).slice(0, 4);
    const size = compact ? 72 : 148;

    return (
        <section aria-label="투어 상품 둘러보기" style={compact ? { padding: '28px 0 32px' } : undefined}>
            <div style={{ padding: compact ? '0 20px' : 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: compact ? 12 : 24 }}>
                <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: compact ? 18 : 24, fontWeight: 700 }}>{compact ? '투어 상품 둘러보기' : '견적을 기다리는 동안 투어 상품 둘러보기'}</h2>
                    <p style={{ margin: 0, fontSize: compact ? 13 : 14, color: SD.gray600 }}>{compact ? '견적을 기다리는 동안 미리 살펴보세요.' : '지역별 인기 투어를 미리 살펴보세요.'}</p>
                </div>
                <a href="/products" onClick={(e) => { e.preventDefault(); go('/products'); }} style={{ flex: 'none', fontSize: compact ? 13 : 14, fontWeight: 700, color: SD.gray700, textDecoration: 'none' }}>
                    {compact ? '전체 ›' : '전체 투어 보기 ›'}
                </a>
            </div>
            <div role="radiogroup" aria-label="여행 지역" className={compact ? 'qd-hscroll' : undefined}
                style={compact
                    ? { marginTop: 18, padding: '4px 20px', display: 'flex', gap: 14, overflowX: 'auto', scrollbarWidth: 'none' }
                    : { marginTop: 32, display: 'flex', justifyContent: 'center', gap: 36 }}>
                {compact && <style>{'.qd-hscroll::-webkit-scrollbar{display:none}'}</style>}
                {regions.map((r) => {
                    const on = r.id === region;
                    return compact ? (
                        <button key={r.id} type="button" role="radio" aria-checked={on} onClick={() => setRegion(r.id)}
                            style={{ flex: 'none', width: 76, padding: 0, border: 'none', background: 'transparent', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: size, height: size, borderRadius: 9999, overflow: 'hidden', background: SD.gray200, outline: on ? `3px solid ${SD.gray900}` : '0 solid transparent', outlineOffset: 2, display: 'block' }}>
                                {isUsableImage(r.img) && <img src={r.img} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: SD.gray900, textAlign: 'center', lineHeight: 1.3, wordBreak: 'keep-all' }}>{r.label}</span>
                        </button>
                    ) : (
                        <button key={r.id} type="button" role="radio" aria-checked={on} onClick={() => setRegion(r.id)}
                            style={{ flex: 'none', position: 'relative', width: size, height: size, padding: 0, border: 'none', borderRadius: 9999, overflow: 'hidden', background: SD.gray200,
                                outline: on ? `3px solid ${SD.mint400}` : '0 solid transparent', outlineOffset: 3, fontFamily: 'inherit', cursor: 'pointer' }}>
                            {isUsableImage(r.img) && <img src={r.img} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                            <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${on ? 0.28 : 0.4})` }} />
                            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px', textAlign: 'center', color: SD.white, fontSize: 17, fontWeight: 700, lineHeight: 1.25, wordBreak: 'keep-all', textShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>{r.label}</span>
                        </button>
                    );
                })}
            </div>
            {items.length > 0 ? (
                <div style={compact
                    ? { marginTop: 20, padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px 12px' }
                    : { marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
                    {items.map((p) => {
                        const img = p.mainImages.find(isUsableImage) || '';
                        return (
                            <a key={p.id} href={`/products/${p.id}`} onClick={(e) => { e.preventDefault(); go(`/products/${p.id}`); }}
                                style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8, minWidth: 0, color: SD.gray900, textDecoration: 'none' }}>
                                <span style={{ position: 'relative', aspectRatio: compact ? '1 / 1' : '4 / 3', borderRadius: 12, overflow: 'hidden', background: SD.gray100, display: 'block' }}>
                                    {img && <img src={img} alt={p.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                                    {p.packageType && <TourTypeBadge type={p.packageType} size={compact ? 'sm' : 'md'} style={{ position: 'absolute', left: compact ? 8 : 10, top: compact ? 8 : 10 }} />}
                                </span>
                                <span style={{ marginTop: compact ? 2 : 4, fontSize: compact ? 12 : 13, color: SD.gray600 }}>{[p.category, durationLabel(p.duration)].filter(Boolean).join(' · ')}</span>
                                <span style={{ fontSize: compact ? 14 : 16, fontWeight: 700, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: compact ? 39 : 45 }}>{p.name}</span>
                                {p.price > 0 && <span style={{ fontSize: compact ? 16 : 18, fontWeight: 700 }}>{won(p.price)}<span style={{ fontSize: compact ? 12 : 13, fontWeight: 400, color: SD.gray600 }}> ~</span></span>}
                            </a>
                        );
                    })}
                </div>
            ) : (
                <div style={{ margin: compact ? '20px 20px 0' : '40px 0 0', padding: compact ? '36px 16px' : '48px 24px', borderRadius: compact ? 14 : 16, background: compact ? SD.gray50 : SD.white,
                    border: compact ? 'none' : `1px solid ${SD.gray200}`, textAlign: 'center', fontSize: compact ? 13 : 14, color: SD.gray600 }}>
                    이 지역 상품은 준비 중이에요.
                </div>
            )}
        </section>
    );
}
