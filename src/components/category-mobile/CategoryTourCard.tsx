import { useNavigate } from 'react-router-dom';
import { MW, isUsableImage, won } from '../desktop-primitives/mwTokens';
import { TypePill } from '../desktop-primitives/TypePill';
import { discountPct, type HomeProduct, type ReviewStat } from '../home-desktop/homeDesktopData';
import { HeartButton, MPhoto } from '../mobile/mobileUi';
import { durationLabel } from '../tours-mobile/tourListFilters';

interface Props {
    p: HomeProduct;
    /** Load the photo right away (first card of the lineup). */
    eager?: boolean;
    fav: boolean;
    onFav: () => void;
    /** Review aggregate; adds the rating line when the tour has reviews. */
    stat?: ReviewStat;
}

/**
 * Tour card of the mobile category lineup (Claude Design: "Category Lineup").
 * One card per row: square photo with the type pill and heart, then duration | category,
 * title, rating and price.
 */
export function CategoryTourCard({ p, eager = false, fav, onFav, stat }: Props) {
    const navigate = useNavigate();
    const off = discountPct(p);
    const img = p.mainImages[0];
    const meta = [durationLabel(p.duration), p.category].filter(Boolean).join(' | ');

    return (
        <a
            href={`/products/${p.id}`}
            onClick={(e) => { e.preventDefault(); navigate(`/products/${p.id}`); window.scrollTo(0, 0); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, color: MW.navy, minWidth: 0, textDecoration: 'none' }}
        >
            <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 22, overflow: 'hidden', background: MW.chip }}>
                <MPhoto src={isUsableImage(img) ? img : undefined} alt={`${p.name} | ${p.category}`} eager={eager} sizes="(max-width: 480px) 100vw, 480px" />
                <TypePill type={p.packageType} style={{ position: 'absolute', left: 12, top: 12, pointerEvents: 'none' }} />
                <HeartButton on={fav} onClick={onFav} size={38} icon={18} activeColor={MW.mint} style={{ position: 'absolute', right: 10, top: 10 }} />
            </div>
            {meta && (
                <span style={{ fontSize: 12, color: MW.mute, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</span>
            )}
            <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{p.name}</span>
            {stat && stat.count > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: MW.mute }}>
                    <span style={{ color: MW.star }}>★</span>
                    <strong style={{ color: MW.navy }}>{stat.avg.toFixed(1)}</strong>({stat.count})
                </span>
            )}
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                {off > 0 && <span style={{ fontSize: 13, fontWeight: 900, color: MW.red }}>{off}%OFF</span>}
                <span style={{ fontSize: 19, fontWeight: 900 }}>
                    {won(p.price)}<span style={{ fontSize: 12 }}>~</span>
                </span>
            </span>
        </a>
    );
}
