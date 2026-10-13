import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../../hooks/useWishlist';
import { MW, isUsableImage, won } from '../desktop-primitives/mwTokens';
import { TypePill } from '../desktop-primitives/TypePill';
import { FavButton } from '../home-desktop/TourTabsSection.desktop';
import { discountPct, type HomeProduct, type ReviewStat } from '../home-desktop/homeDesktopData';
import { durationLabel } from '../tours-mobile/tourListFilters';

interface Props {
    p: HomeProduct;
    /** Review aggregate; adds the rating line when the tour has reviews. */
    stat?: ReviewStat;
}

/** Square tour card of the PC tour grids (tour list, 여행 기획전 detail). */
export function TourCardDesktop({ p, stat }: Props) {
    const navigate = useNavigate();
    const wishlist = useWishlist();
    const off = discountPct(p);
    const img = p.mainImages[0];

    return (
        <a
            href={`/products/${p.id}`}
            onClick={(e) => { e.preventDefault(); navigate(`/products/${p.id}`); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, color: MW.navy, transition: 'transform .2s', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
        >
            <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 22, overflow: 'hidden', background: MW.mintTint }}>
                {isUsableImage(img) && (
                    <img src={img} alt={`${p.name} | ${p.category}`} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
                <FavButton on={wishlist.has(p.id)} onToggle={() => wishlist.toggle(p)} />
                {p.packageType && (
                    <div style={{ position: 'absolute', left: 12, top: 12, right: 56, display: 'flex', gap: 4, pointerEvents: 'none' }}>
                        <TypePill type={p.packageType} lg />
                    </div>
                )}
            </div>
            <span style={{ fontSize: 12, color: MW.mute, marginTop: 4 }}>{[p.category, durationLabel(p.duration)].filter(Boolean).join(' | ')}</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                {off > 0 && <span style={{ fontSize: 15, fontWeight: 700, color: MW.red }}>{off}%OFF</span>}
                <span style={{ fontSize: 20, fontWeight: 900 }}>
                    {won(p.price)}<span style={{ fontSize: 13, fontWeight: 700 }}>~</span>
                </span>
            </div>
            {stat && stat.count > 0 && (
                <span style={{ fontSize: 13, color: MW.mute }}>
                    <span style={{ color: MW.mintDeep }}>★</span> <strong style={{ color: MW.navy }}>{stat.avg.toFixed(1)}</strong> ({stat.count})
                </span>
            )}
        </a>
    );
}
