import { MW, isUsableImage, won } from '../desktop-primitives/mwTokens';
import { discountPct, type HomeProduct, type ReviewStat } from '../home-desktop/homeDesktopData';
import { HeartButton, MPhoto, TypeBadge } from '../mobile/mobileUi';
import { durationLabel } from '../tours-mobile/tourListFilters';
import { linkTo, useGo } from './homeMobileData';

interface CardProps {
    p: HomeProduct;
    stat?: ReviewStat;
    fav: boolean;
    onFav: () => void;
}

const oneLine = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;

function Rating({ stat }: { stat?: ReviewStat }) {
    if (!stat || stat.count === 0) return null;
    return (
        <span style={{ fontSize: 11, color: MW.mute }}>
            <span style={{ color: MW.mintDeep }}>★</span> <strong style={{ color: MW.navy }}>{stat.avg.toFixed(1)}</strong> ({stat.count})
        </span>
    );
}

function Photo({ p, fav, onFav, heart, icon }: CardProps & { heart: number; icon: number }) {
    const img = p.mainImages[0];
    return (
        <>
            <MPhoto src={isUsableImage(img) ? img : undefined} alt={`${p.name} | ${p.category}`} />
            <TypeBadge type={p.packageType} style={{ position: 'absolute', left: 8, bottom: 8, pointerEvents: 'none' }} />
            <HeartButton on={fav} onClick={onFav} size={heart} icon={icon} style={{ position: 'absolute', right: 6, top: 6 }} />
        </>
    );
}

/** Square tour card of the two-column grid under the category tabs. */
export function TourGridCardMobile(props: CardProps) {
    const { p, stat } = props;
    const go = useGo();
    const off = discountPct(p);
    const duration = durationLabel(p.duration);
    return (
        <a {...linkTo(go, `/products/${p.id}`)} style={{ display: 'flex', flexDirection: 'column', gap: 6, color: MW.navy, minWidth: 0, textDecoration: 'none' }}>
            <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 18, overflow: 'hidden', background: MW.chip }}>
                <Photo {...props} heart={36} icon={17} />
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, lineHeight: 1.45, ...oneLine }}>
                {duration ? `[${duration}] ` : ''}{p.name}
            </h3>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                {off > 0 && <span style={{ fontSize: 14, fontWeight: 900, color: MW.red }}>{off}%OFF</span>}
                <span style={{ fontSize: 15, fontWeight: 900 }}>{won(p.price)}~</span>
            </span>
            <Rating stat={stat} />
        </a>
    );
}

/** Wide tour card of the horizontal theme row. */
export function TourRowCardMobile(props: CardProps) {
    const { p, stat } = props;
    const go = useGo();
    const off = discountPct(p);
    const duration = durationLabel(p.duration);
    return (
        <a {...linkTo(go, `/products/${p.id}`)} style={{ flex: '0 0 62%', minWidth: 0, scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', gap: 6, color: MW.navy, textDecoration: 'none' }}>
            <div style={{ position: 'relative', aspectRatio: '16/11', borderRadius: 16, overflow: 'hidden', background: MW.chip }}>
                <Photo {...props} heart={34} icon={16} />
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 500, lineHeight: 1.45, ...oneLine }}>
                {duration ? `[${duration}] ` : ''}{p.name}
            </h3>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                {off > 0 && <span style={{ fontSize: 11, color: MW.mute2, textDecoration: 'line-through' }}>{won(p.originalPrice!)}</span>}
                <span style={{ fontSize: 15, fontWeight: 900 }}>{won(p.price)}</span>
            </span>
            <Rating stat={stat} />
        </a>
    );
}
