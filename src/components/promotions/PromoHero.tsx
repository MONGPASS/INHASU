import type { CSSProperties } from 'react';
import { MW, MW_FONT_EN, isUsableImage } from '../desktop-primitives/mwTokens';
import { artScale, type PromoItem } from './promotionsData';

const FADE_UP = 'linear-gradient(180deg,transparent 0%,#000 60%)';
const FADE_SIDE = 'linear-gradient(90deg,transparent 0%,#000 55%)';

/**
 * Header of a 여행 기획전 detail page: the promotion's list card (`PromoCard`) opened up into a hero —
 * same theme colours, lettering and badge, with the title as the page's h1 and the copy unclipped.
 */
export function PromoHero({ item, pc = false }: { item: PromoItem; pc?: boolean }) {
    const t = item.theme;
    const photo = isUsableImage(item.image);
    const lettering = !!item.art || !!item.badge;
    const visual = photo || lettering;
    const scale = item.art ? artScale(item.art) : 1;
    const drop = pc ? 6 : 4;

    // On PC the photo comes in from the right edge; on mobile it rises from the bottom like the card.
    const photoBox: CSSProperties = pc
        ? { top: 0, right: 0, bottom: 0, width: '58%', WebkitMaskImage: FADE_SIDE, maskImage: FADE_SIDE }
        : { left: 0, right: 0, bottom: 0, height: '62%', WebkitMaskImage: FADE_UP, maskImage: FADE_UP };

    const art = lettering && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: pc ? 10 : 6, transform: 'rotate(-4deg)' }}>
            {item.art && (
                <span
                    style={{
                        fontFamily: MW_FONT_EN, fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.02em', textAlign: 'center', whiteSpace: 'pre-line',
                        fontSize: pc ? `clamp(${44 * scale}px,${5 * scale}vw,${64 * scale}px)` : Math.round(44 * scale),
                        color: photo ? '#FFFFFF' : t.artFg,
                        textShadow: photo ? `0 ${drop}px 0 rgba(10,31,46,0.5), 0 0 18px rgba(10,31,46,0.35)` : `0 ${drop}px 0 ${t.artShadow}`,
                    }}
                >
                    {item.art}
                </span>
            )}
            {item.badge && (
                <span style={{ fontSize: pc ? 15 : 12, fontWeight: 900, color: t.badgeFg, background: t.badgeBg, padding: pc ? '6px 14px' : '4px 11px', borderRadius: 999, transform: 'rotate(4deg)', whiteSpace: 'nowrap' }}>{item.badge}</span>
            )}
        </div>
    );

    const tags = item.tags.length > 0 && (
        <div style={{ position: 'relative', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {item.tags.map((tg) => (
                <span key={tg} style={{ fontSize: pc ? 13 : 11, fontWeight: 700, color: MW.navy, background: '#FFFFFF', padding: pc ? '6px 13px' : '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>{tg}</span>
            ))}
        </div>
    );

    const copy = (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: pc ? 12 : 6, minWidth: 0 }}>
            <span style={{ fontSize: pc ? 13 : 11, fontWeight: 700, opacity: 0.85 }}>{item.group}</span>
            <h1 style={{ margin: 0, fontSize: pc ? 'clamp(30px,3.4vw,44px)' : 23, fontWeight: 900, lineHeight: pc ? 1.25 : 1.35, overflowWrap: 'anywhere' }}>{item.title}</h1>
            {item.sub && <p style={{ margin: 0, fontSize: pc ? 16 : 13, lineHeight: 1.75, color: t.subFg }}>{item.sub}</p>}
        </div>
    );

    const decor = (
        <>
            {photo && (
                <span aria-hidden="true" style={{ position: 'absolute', pointerEvents: 'none', ...photoBox }}>
                    <img src={item.image} alt="" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </span>
            )}
            <span style={{ position: 'absolute', right: pc ? -50 : -30, top: pc ? -50 : -30, width: pc ? 240 : 140, height: pc ? 240 : 140, borderRadius: '50%', background: t.glow, pointerEvents: 'none' }} />
        </>
    );

    const frame: CSSProperties = { position: 'relative', overflow: 'hidden', boxSizing: 'border-box', background: t.bg, color: t.fg, border: `1px solid ${t.edge}` };

    if (pc) {
        return (
            <header style={{ ...frame, borderRadius: 28, minHeight: visual ? 320 : undefined, display: 'grid', gridTemplateColumns: visual ? 'minmax(0,1.15fr) minmax(0,0.85fr)' : 'minmax(0,1fr)', alignItems: 'center' }}>
                {decor}
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 22, padding: visual ? '48px 0 48px 48px' : 48, minWidth: 0 }}>
                    {copy}
                    {tags}
                </div>
                {visual && (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 40px', minWidth: 0, pointerEvents: 'none' }}>{art}</div>
                )}
            </header>
        );
    }

    return (
        <header style={{ ...frame, borderRadius: 22, padding: '20px 18px 18px', minHeight: visual ? 256 : undefined, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {decor}
            {copy}
            {visual && (
                <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: lettering ? 96 : 0, pointerEvents: 'none' }}>{art}</div>
            )}
            {tags}
        </header>
    );
}
