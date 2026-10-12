import { useWishlist } from '../../hooks/useWishlist';
import { MW, MW_FONT_EN, isUsableImage } from '../desktop-primitives/mwTokens';
import type { HomeProduct, ReviewStat } from '../home-desktop/homeDesktopData';
import { MPhoto } from '../mobile/mobileUi';
import { linkTo, useGo } from './homeMobileData';
import { TourRowCardMobile } from './TourCard.mobile';

interface Props {
    title: string;
    subtitle: string;
    products: HomeProduct[];
    stats: Record<string, ReviewStat>;
    image: string;
    imageAlt: string;
    link: string;
}

/** Category feature: a wide photo banner over a swipeable row of that category's tours. */
export function ThemeRowSectionMobile({ title, subtitle, products, stats, image, imageAlt, link }: Props) {
    const go = useGo();
    const wishlist = useWishlist();
    if (products.length === 0) return null;

    return (
        <section style={{ padding: '48px 0 0' }}>
            <a
                {...linkTo(go, link)}
                style={{ display: 'block', margin: '0 16px', position: 'relative', borderRadius: 24, overflow: 'hidden', aspectRatio: '16/9', background: MW.navySoft, textDecoration: 'none' }}
            >
                {isUsableImage(image) && <MPhoto src={image} alt={imageAlt} sizes="(max-width: 480px) 100vw, 480px" />}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(90deg,rgba(10,31,46,0.7) 0%,rgba(10,31,46,0) 70%)' }} />
                <div style={{ position: 'absolute', left: 20, bottom: 18, right: 20, display: 'flex', flexDirection: 'column', gap: 4, color: '#fff', pointerEvents: 'none' }}>
                    <h2 style={{ margin: 0, fontFamily: MW_FONT_EN, fontSize: 20, fontWeight: 700 }}>{title}</h2>
                    <span style={{ fontSize: 12, color: '#EAF7F3' }}>{subtitle}</span>
                </div>
            </a>
            <div data-noscroll="" style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', padding: '18px 16px 0', scrollPadding: '0 16px' }}>
                {products.map((p) => (
                    <TourRowCardMobile key={p.id} p={p} stat={stats[p.id]} fav={wishlist.has(p.id)} onFav={() => wishlist.toggle(p)} />
                ))}
            </div>
        </section>
    );
}
