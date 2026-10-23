import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import type { ReviewStat } from '../home-desktop/homeDesktopData';
import { MW, MW_FONT_EN, isUsableImage } from '../desktop-primitives/mwTokens';
import type { TripCardData } from '../mypage-desktop/MyPageSections';
import { M_PAPER } from '../mobile/mobileTheme';
import { HeartButton, MPhoto } from '../mobile/mobileUi';
import { StartingPrice } from '../product/StartingPrice';

/**
 * Shared pieces of the mobile my-page sub screens (Claude Design: "M Recently Viewed",
 * "M Wishlist", "M My Mate Posts", "M My Reviews", "M FAQ", "M Contact").
 */

/** Soft-paper page body that opens with the English eyebrow and a one-line lead. */
export function ScreenBody({ eyebrow, lead, label, children }: { eyebrow: string; lead: string; label?: string; children: ReactNode }) {
    return (
        <section aria-label={label} style={{ background: M_PAPER, minHeight: '60vh', padding: '16px 16px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 2px' }}>
                <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>{eyebrow}</span>
                <span style={{ fontSize: 12, lineHeight: 1.7, color: MW.mute }}>{lead}</span>
            </div>
            {children}
        </section>
    );
}

/** Two-column grid the tour cards sit in. */
export function TripGrid({ children }: { children: ReactNode }) {
    return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>{children}</div>;
}

const ellipsis: CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

/** Square tour card: duration chip, heart (+ optional remove) on the photo, title / category / rating / price. */
export function TripCardM({
    t, stat, fav, onFav, onRemove, removeLabel, go,
}: {
    t: TripCardData;
    stat?: ReviewStat;
    fav: boolean;
    onFav: () => void;
    onRemove?: () => void;
    removeLabel?: string;
    go: (path: string) => void;
}) {
    const remove = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove?.();
    };
    return (
        <a
            href={`/products/${t.productId}`}
            onClick={(e) => { e.preventDefault(); go(`/products/${t.productId}`); }}
            style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${MW.line}`, borderRadius: 16, overflow: 'hidden', background: '#fff', color: MW.navy, minWidth: 0, textDecoration: 'none' }}
        >
            <span style={{ position: 'relative', display: 'block', aspectRatio: '1/1', background: MW.chip }}>
                <MPhoto src={isUsableImage(t.image) ? t.image : undefined} alt={t.title} />
                {t.duration && (
                    <span style={{ position: 'absolute', left: 8, top: 8, maxWidth: `calc(100% - ${onRemove ? 90 : 54}px)`, boxSizing: 'border-box', fontSize: 10, fontWeight: 700, color: MW.navy, background: 'rgba(255,255,255,0.92)', padding: '3px 8px', borderRadius: 999, ...ellipsis }}>
                        {t.duration}
                    </span>
                )}
                <span style={{ position: 'absolute', right: 6, top: 6, display: 'flex', gap: 4 }}>
                    <HeartButton on={fav} onClick={onFav} size={32} icon={16} activeColor={MW.mint} />
                    {onRemove && (
                        <button type="button" onClick={remove} aria-label={removeLabel} style={{ width: 32, height: 32, border: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: MW.mute, padding: 0 }}>×</button>
                    )}
                </span>
            </span>
            <span style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.4, ...ellipsis }}>{t.title}</span>
                {t.category && <span style={{ fontSize: 11, color: MW.mute, ...ellipsis }}>{t.category}</span>}
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4, marginTop: 2, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, color: MW.mute }}>
                        {stat && stat.count > 0 && (
                            <><span style={{ color: MW.mintDeep }}>★</span> <strong style={{ color: MW.navy }}>{stat.avg.toFixed(1)}</strong></>
                        )}
                    </span>
                    <StartingPrice product={t} amountStyle={{ fontSize: 12, fontWeight: 600 }} />
                </span>
            </span>
        </a>
    );
}

/** Small outlined pill inside a card (삭제, 모집 마감 …). */
export function CardPill({ children, onClick }: { children: ReactNode; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} style={{ height: 30, padding: '0 10px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: MW.mute, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {children}
        </button>
    );
}

/** Rounded square thumbnail; mint tile when the tour has no usable photo. */
export function Thumb({ src, size, radius = 12 }: { src?: string; size: number; radius?: number }) {
    return (
        <span style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', flexShrink: 0, background: MW.mintTint, display: 'block' }}>
            {isUsableImage(src) && <img src={src} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
        </span>
    );
}
