import { useNavigate } from 'react-router-dom';
import { MW, isUsableImage } from '../desktop-primitives/mwTokens';
import type { HomeProduct, ReviewStat } from '../home-desktop/homeDesktopData';
import { HeartButton, MPhoto, TypeBadge } from '../mobile/mobileUi';
import { durationLabel } from './tourListFilters';
import { StartingPrice } from '../product/StartingPrice';

interface Props {
    p: HomeProduct;
    /** Load the photo right away (first rows of a grid). */
    eager?: boolean;
    fav: boolean;
    onFav: () => void;
    /** Review aggregate; adds the rating line when the tour has reviews. */
    stat?: ReviewStat;
}

/** Square tour card of the mobile two-column tour grids (tour list, 여행 기획전 detail). */
export function TourCardMobile({ p, eager = false, fav, onFav, stat }: Props) {
    const navigate = useNavigate();
    const img = p.mainImages[0];
    const duration = durationLabel(p.duration);

    return (
        <a
            href={`/products/${p.id}`}
            onClick={(e) => { e.preventDefault(); navigate(`/products/${p.id}`); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 5, color: MW.navy, minWidth: 0, textDecoration: 'none' }}
        >
            <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 18, overflow: 'hidden', background: MW.chip, marginBottom: 6 }}>
                <MPhoto src={isUsableImage(img) ? img : undefined} alt={`${p.name} | ${p.category}`} eager={eager} />
                <HeartButton on={fav} onClick={onFav} style={{ position: 'absolute', right: 6, top: 6 }} />
                <TypeBadge type={p.packageType} style={{ position: 'absolute', left: 8, bottom: 8 }} />
            </div>
            <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.category}
                {p.category && duration && <span style={{ color: '#C9D0CD' }}> | </span>}
                {duration}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <StartingPrice product={p} amountStyle={{ fontSize: 15, fontWeight: 900 }} />
            </span>
            {stat && stat.count > 0 && (
                <span style={{ fontSize: 11, color: MW.mute }}>
                    <span style={{ color: MW.mintDeep }}>★</span> <strong style={{ color: MW.navy }}>{stat.avg.toFixed(1)}</strong> ({stat.count})
                </span>
            )}
        </a>
    );
}
