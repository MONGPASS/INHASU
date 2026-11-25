import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveProductImage } from '../common/ResponsiveProductImage';
import { useWishlist } from '../../hooks/useWishlist';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import { SD, SIcon } from '../site-seed/seed';
import { discountPct, type HomeProduct } from './homeDesktopData';

export const packageLabel = (type: HomeProduct['packageType']) => (type === 'full' ? '풀패키지' : type === 'value' ? '실속형' : '');

/** 사진 위 왼쪽의 흰 꼬리표(풀패키지·실속형). */
export function CardBadge({ children }: { children: ReactNode }) {
    return (
        <span style={{ position: 'absolute', left: 10, top: 10, height: 24, padding: '0 8px', display: 'inline-flex', alignItems: 'center', borderRadius: 6, background: SD.white,
            color: SD.gray900, fontSize: 12, fontWeight: 700, pointerEvents: 'none' }}>
            {children}
        </span>
    );
}

/** 사진 위 오른쪽의 찜 버튼(누르는 칸 44px, 보이는 원 32px). 로그인하지 않았으면 로그인으로 보낸다(useWishlist). */
export function HeartButton({ product, inset = 10 }: { product: HomeProduct; inset?: number }) {
    const wishlist = useWishlist();
    const on = wishlist.has(product.id);
    return (
        <button type="button" aria-label={on ? '찜 목록에서 삭제' : '찜하기'} aria-pressed={on}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); wishlist.toggle(product); }}
            style={{ position: 'absolute', right: inset - 6, top: inset - 6, width: 44, height: 44, border: 'none', borderRadius: 9999, background: 'transparent', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9999, background: SD.white, color: on ? SD.red : SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" />
                </svg>
            </span>
        </button>
    );
}

/** 홈의 상품 카드: 사진(4:3 또는 16:10) · 기간 · 이름 · 가격. 카드 전체가 상품 상세로 간다. */
export function TourCardDesktop({ p, ratio = '4 / 3', sizes = '(max-width: 700px) 50vw, 260px' }: { p: HomeProduct; ratio?: string; sizes?: string }) {
    const navigate = useNavigate();
    const img = p.mainImages[0];
    const off = discountPct(p);
    const badge = packageLabel(p.packageType);
    const href = `/products/${p.id}`;
    return (
        <a href={href} onClick={(e) => { e.preventDefault(); navigate(href); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, color: SD.gray900, textDecoration: 'none' }}>
            <div style={{ position: 'relative', aspectRatio: ratio, borderRadius: 10, overflow: 'hidden', background: SD.gray100 }}>
                {isUsableImage(img) && (
                    <ResponsiveProductImage src={img} sizes={sizes} alt={`${p.name} | ${p.category}`} loading="lazy" decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
                {badge && <CardBadge>{badge}</CardBadge>}
                <HeartButton product={p} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {p.duration && <p style={{ margin: 0, fontSize: 13, color: SD.gray600 }}>{p.duration}</p>}
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700 }}>
                    {off > 0 && <span style={{ marginRight: 6, color: SD.red }}>{off}%</span>}
                    {won(p.price)}<span style={{ fontSize: 14, fontWeight: 400, color: SD.gray600 }}> ~</span>
                </p>
            </div>
        </a>
    );
}

/** ‘전체 보기 ›’ 링크. */
export function SeeAllLink({ to, label = '전체 보기' }: { to: string; label?: string }) {
    const navigate = useNavigate();
    return (
        <a href={to} onClick={(e) => { e.preventDefault(); navigate(to); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, color: SD.gray900, fontSize: 14, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {label}<SIcon name="chevronRight" size={16} stroke={1.6} />
        </a>
    );
}
