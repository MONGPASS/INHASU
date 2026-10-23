import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveProductImage } from '../common/ResponsiveProductImage';
import { useWishlist } from '../../hooks/useWishlist';
import { MW, isUsableImage } from '../desktop-primitives/mwTokens';
import { TypePill } from '../desktop-primitives/TypePill';
import { FavButton } from './TourTabsSection.desktop';
import { type HomeProduct, type ReviewStat } from './homeDesktopData';
import { StartingPrice } from '../product/StartingPrice';

interface Props {
    title: string;
    subtitle: string;
    products: HomeProduct[];
    stats: Record<string, ReviewStat>;
    image: string;
    imageAlt: string;
    link: string;
    /** Photo on the left instead of the right. */
    reverse?: boolean;
}

const STEP = 236; // card width (220) + gap (16)

export function ThemeRowSectionDesktop({ title, subtitle, products, stats, image, imageAlt, link, reverse = false }: Props) {
    const navigate = useNavigate();
    const rowRef = useRef<HTMLDivElement>(null);
    const paused = useRef(false);

    const scroll = (d: 1 | -1) => {
        const el = rowRef.current;
        if (!el) return;
        const max = el.scrollWidth - el.clientWidth;
        if (d > 0 && el.scrollLeft >= max - 4) el.scrollTo({ left: 0, behavior: 'smooth' });
        else if (d < 0 && el.scrollLeft <= 4) el.scrollTo({ left: max, behavior: 'smooth' });
        else el.scrollBy({ left: d * STEP, behavior: 'smooth' });
    };

    useEffect(() => {
        const t = window.setInterval(() => {
            const el = rowRef.current;
            if (paused.current || !el || document.visibilityState !== 'visible') return;
            if (el.scrollWidth - el.clientWidth <= 4) return;
            const max = el.scrollWidth - el.clientWidth;
            if (el.scrollLeft >= max - 4) el.scrollTo({ left: 0, behavior: 'smooth' });
            else el.scrollBy({ left: STEP, behavior: 'smooth' });
        }, 3500);
        return () => window.clearInterval(t);
    }, []);

    if (products.length === 0) return null;

    const photo = (
        <a
            href={link}
            onClick={(e) => { e.preventDefault(); navigate(link); }}
            aria-label={imageAlt}
            style={{ flex: '0 1 300px', minWidth: 240, aspectRatio: '1/1', borderRadius: 28, overflow: 'hidden', display: 'block', background: MW.mintTint }}
        >
            {isUsableImage(image) && (
                <ResponsiveProductImage src={image} alt={imageAlt} sizes="300px" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
        </a>
    );

    return (
        <div style={{ display: 'flex', flexWrap: reverse ? 'wrap-reverse' : 'wrap', gap: 32, alignItems: 'stretch' }}>
            {reverse && photo}
            <div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, lineHeight: 1.3 }}>{title}</h2>
                        <p style={{ margin: 0, fontSize: 13, color: MW.mute }}>{subtitle}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <ArrowButton label="이전" onClick={() => scroll(-1)}>‹</ArrowButton>
                        <ArrowButton label="다음" onClick={() => scroll(1)}>›</ArrowButton>
                    </div>
                </div>
                <div
                    ref={rowRef}
                    onMouseEnter={() => { paused.current = true; }}
                    onMouseLeave={() => { paused.current = false; }}
                    onFocus={() => { paused.current = true; }}
                    onBlur={() => { paused.current = false; }}
                    style={{ display: 'flex', gap: 16, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', paddingBottom: 4 }}
                >
                    {products.map((p) => (
                        <MiniCard key={p.id} p={p} stat={stats[p.id]} />
                    ))}
                </div>
            </div>
            {!reverse && photo}
        </div>
    );
}

function MiniCard({ p, stat }: { p: HomeProduct; stat?: ReviewStat }) {
    const navigate = useNavigate();
    const wishlist = useWishlist();
    const img = p.mainImages[0];

    return (
        <a
            href={`/products/${p.id}`}
            onClick={(e) => { e.preventDefault(); navigate(`/products/${p.id}`); }}
            style={{ flex: '0 0 220px', width: 220, minWidth: 0, scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', gap: 8, color: MW.navy, textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
            <div style={{ position: 'relative', aspectRatio: '16/10', borderRadius: 18, overflow: 'hidden', background: MW.mintTint }}>
                {isUsableImage(img) && (
                    <ResponsiveProductImage src={img} alt={`${p.name} | ${p.category}`} sizes="220px" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
                <FavButton variant="ghost" on={wishlist.has(p.id)} onToggle={() => wishlist.toggle(p)} />
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 500, lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.duration ? `[${p.duration}] ` : ''}{p.name}
            </h3>
            {p.packageType && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 22, overflow: 'hidden', marginTop: 4 }}>
                    <TypePill type={p.packageType} />
                </div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <StartingPrice product={p} amountStyle={{ fontSize: 18, fontWeight: 900 }} />
            </div>
            {stat && stat.count > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: MW.mute }}>
                    <span style={{ color: MW.star }}>★</span>
                    {stat.avg.toFixed(1)}({stat.count})
                </div>
            )}
        </a>
    );
}

function ArrowButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${MW.line}`, background: '#fff', color: MW.mintDeep, cursor: 'pointer', fontSize: 14 }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = MW.mintDeep)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = MW.line)}
        >
            {children}
        </button>
    );
}
