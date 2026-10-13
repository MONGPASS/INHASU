import type { CSSProperties } from 'react';
import { MW, MW_FONT_EN, isUsableImage } from '../desktop-primitives/mwTokens';
import { linkTo, useGo } from '../home-mobile/homeMobileData';
import { artScale, type PromoItem } from './promotionsData';

/** `wide` / `small` are the mobile grid cells (first card spans both columns); `desktop` is the PC tile. */
type Variant = 'wide' | 'small' | 'desktop';

const DIMS = {
    wide: { ratio: '16/9', radius: 20, pad: 14, glow: 120, headGap: 3, cat: 10, title: 14, sub: 11, subLh: 1.5, art: 40, artGap: 6, drop: 4, badge: 11, badgePad: '3px 10px', tag: 10, tagPad: '3px 8px', tagGap: 4 },
    small: { ratio: '1/1.12', radius: 20, pad: 14, glow: 120, headGap: 3, cat: 10, title: 14, sub: 11, subLh: 1.5, art: 26, artGap: 6, drop: 4, badge: 11, badgePad: '3px 10px', tag: 10, tagPad: '3px 8px', tagGap: 4 },
    desktop: { ratio: '1/1', radius: 28, pad: 28, glow: 160, headGap: 6, cat: 12, title: 20, sub: 13, subLh: 1.6, art: 46, artGap: 8, drop: 5, badge: 13, badgePad: '5px 12px', tag: 12, tagPad: '5px 11px', tagGap: 6 },
} as const;

const clip: CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const clamp2: CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
const PHOTO_FADE = 'linear-gradient(180deg,transparent 0%,#000 60%)';

export function PromoCard({ item, variant }: { item: PromoItem; variant: Variant }) {
    const go = useGo();
    const d = DIMS[variant];
    const t = item.theme;
    const pc = variant === 'desktop';
    const photo = isUsableImage(item.image);
    const scale = item.art ? artScale(item.art) : 1;
    const artSize = pc ? `clamp(${34 * scale}px,${3.6 * scale}vw,${46 * scale}px)` : Math.round(d.art * scale);

    return (
        <a
            {...linkTo(go, item.path)}
            style={{
                gridColumn: variant === 'wide' ? 'span 2' : undefined, position: 'relative', display: 'flex', flexDirection: 'column', aspectRatio: d.ratio,
                borderRadius: d.radius, overflow: 'hidden', padding: d.pad, boxSizing: 'border-box', background: t.bg, color: t.fg, border: `1px solid ${t.edge}`,
                minWidth: 0, textDecoration: 'none', transition: pc ? 'transform .2s,box-shadow .2s' : undefined,
            }}
            onMouseEnter={pc ? (e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 18px 36px rgba(10,31,46,0.16)'; } : undefined}
            onMouseLeave={pc ? (e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; } : undefined}
        >
            {/* The photo rises out of the theme colour so the heading above it stays readable. */}
            {photo && (
                <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%', pointerEvents: 'none', WebkitMaskImage: PHOTO_FADE, maskImage: PHOTO_FADE }}>
                    <img src={item.image} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </span>
            )}
            <span style={{ position: 'absolute', right: -30, top: -30, width: d.glow, height: d.glow, borderRadius: '50%', background: t.glow, pointerEvents: 'none' }} />

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: d.headGap, minWidth: 0 }}>
                <span style={{ fontSize: d.cat, fontWeight: 700, opacity: 0.85, whiteSpace: 'nowrap' }}>{item.group}</span>
                <span style={{ fontSize: d.title, fontWeight: 900, lineHeight: 1.4, ...(pc ? undefined : clip) }}>{item.title}</span>
                {item.sub && (
                    <span style={{ fontSize: d.sub, lineHeight: d.subLh, color: t.subFg, ...(pc ? clamp2 : clip) }}>{item.sub}</span>
                )}
            </div>

            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', minHeight: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: d.artGap, transform: 'rotate(-4deg)' }}>
                    {item.art && (
                        <span
                            style={{
                                fontFamily: MW_FONT_EN, fontSize: artSize, fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.02em', textAlign: 'center', whiteSpace: 'pre-line',
                                color: photo ? '#FFFFFF' : t.artFg,
                                textShadow: photo ? `0 ${d.drop}px 0 rgba(10,31,46,0.5), 0 0 18px rgba(10,31,46,0.35)` : `0 ${d.drop}px 0 ${t.artShadow}`,
                            }}
                        >
                            {item.art}
                        </span>
                    )}
                    {item.badge && (
                        <span style={{ fontSize: d.badge, fontWeight: 900, color: t.badgeFg, background: t.badgeBg, padding: d.badgePad, borderRadius: 999, transform: 'rotate(4deg)', whiteSpace: 'nowrap' }}>{item.badge}</span>
                    )}
                </div>
            </div>

            {item.tags.length > 0 && (
                <div style={{ position: 'relative', display: 'flex', gap: d.tagGap, flexWrap: pc ? 'wrap' : undefined, overflow: pc ? undefined : 'hidden' }}>
                    {item.tags.map((tg) => (
                        <span key={tg} style={{ flexShrink: 0, fontSize: d.tag, fontWeight: 700, color: MW.navy, background: '#FFFFFF', padding: d.tagPad, borderRadius: 999, whiteSpace: 'nowrap' }}>{tg}</span>
                    ))}
                </div>
            )}
        </a>
    );
}
