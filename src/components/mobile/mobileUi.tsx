import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { productImageSet, productImageUrl, uploadedImageDimensions } from '../../utils/productImage';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { useMobileShell } from './mobileShellContext';
import { D, M_AMBER, type QuickMenuItem } from './mobileTheme';

/**
 * Shared atoms for the mobile redesign (Claude Design: "Milkyway Japan Mobile").
 * Same mint + navy tokens as the PC redesign; values are copied from the design file.
 */

export function Ico({
    d, size = 20, color = MW.navy, width = 1.8, fill = 'none', style,
}: { d: string; size?: number; color?: string; width?: number; fill?: string; style?: CSSProperties }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
            <path d={d} />
        </svg>
    );
}

/** Round white heart button that sits on tour photos. */
export function HeartButton({
    on, onClick, size = 36, icon = 17, activeColor = MW.red, style,
}: { on: boolean; onClick: () => void; size?: number; icon?: number; activeColor?: string; style?: CSSProperties }) {
    const stop = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    };
    return (
        <button
            type="button"
            onClick={stop}
            aria-label="찜"
            aria-pressed={on}
            style={{ width: size, height: size, border: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, ...style }}
        >
            <Ico d={D.heart} size={icon} fill={on ? activeColor : 'none'} color={on ? activeColor : MW.navy} />
        </button>
    );
}

/** 풀패키지 / 실속형 pill shown bottom-left on tour photos. */
export function TypeBadge({ type, style }: { type: 'full' | 'value' | null | undefined; style?: CSSProperties }) {
    if (type !== 'full' && type !== 'value') return null;
    const full = type === 'full';
    return (
        <span
            style={{
                fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 700, letterSpacing: '-0.01em', padding: '3px 7px', borderRadius: 999,
                background: full ? MW.mintDeep : 'rgba(255,255,255,0.92)', color: full ? '#FFFFFF' : MW.mintDeep, ...style,
            }}
        >
            {full ? '풀패키지' : '실속형'}
        </span>
    );
}

/** Illustrated Mongolian traveller: the signed-in avatar when the account has no photo. */
export function TravellerAvatar({ size = 96 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
            <circle cx="48" cy="48" r="48" fill="#D1F6EA" />
            <circle cx="78" cy="22" r="10" fill="#FFFFFF" opacity="0.7" />
            <path d="M14 96c2-18 16-28 34-28s32 10 34 28z" fill="#1C8571" />
            <path d="M48 68l-16 4c4 4 10 7 16 8z" fill="#27AB8F" />
            <path d="M48 68c6 0 12 1 17 4L44 96h-7z" fill="#27AB8F" />
            <path d="M65 72L44 96" stroke="#F2B544" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M36 68c3 3 7 4 12 4s9-1 12-4" stroke="#F2B544" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <circle cx="55" cy="84" r="2" fill="#F2B544" />
            <rect x="42" y="58" width="12" height="12" rx="4" fill="#E9B98F" />
            <ellipse cx="48" cy="48" rx="17" ry="16" fill="#F4C9A0" />
            <ellipse cx="31" cy="50" rx="3" ry="4" fill="#E9B98F" />
            <ellipse cx="65" cy="50" rx="3" ry="4" fill="#E9B98F" />
            <circle cx="41" cy="49" r="2" fill="#0A1F2E" />
            <circle cx="55" cy="49" r="2" fill="#0A1F2E" />
            <ellipse cx="37" cy="55" rx="3.5" ry="2.2" fill="#F08A7A" opacity="0.55" />
            <ellipse cx="59" cy="55" rx="3.5" ry="2.2" fill="#F08A7A" opacity="0.55" />
            <path d="M44 56c2 2 6 2 8 0" stroke="#0A1F2E" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <path d="M48 12c-12 0-20 10-21 24h42c-1-14-9-24-21-24z" fill="#C8453A" />
            <path d="M40 16l8-6 8 6" stroke="#F2B544" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M48 10v26" stroke="#F2B544" strokeWidth="1.6" opacity="0.8" />
            <circle cx="48" cy="9" r="4" fill="#F2B544" />
            <path d="M24 38c0-5 6-7 12-6 4 .6 8 .6 12 .6s8 0 12-.6c6-1 12 1 12 6 0 3-3 4-6 3-5-1-12-1.5-18-1.5S35 40 30 41c-3 1-6 0-6-3z" fill="#6B4A36" />
            <path d="M26 37c6-2 14-2.5 22-2.5s16 .5 22 2.5" stroke="#8C6649" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
    );
}

/** PICK / EVENT pill and the red "N" dot on quick-menu tiles. */
export function QuickMenuBadge({ item, inset = 6 }: { item: QuickMenuItem; inset?: number }) {
    if (item.tag) {
        return (
            <span
                style={{
                    position: 'absolute', top: inset, right: inset, height: 16, padding: '0 6px', borderRadius: 999,
                    background: item.tag === 'PICK' ? MW.mint : M_AMBER, display: 'flex', alignItems: 'center',
                    fontFamily: MW_FONT_EN, fontSize: 8, fontWeight: 700, color: MW.navy,
                }}
            >
                {item.tag}
            </span>
        );
    }
    if (item.isNew) {
        return (
            <span
                aria-label="신규"
                style={{
                    position: 'absolute', top: inset, right: inset, width: 16, height: 16, borderRadius: '50%', background: MW.red,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MW_FONT_EN, fontSize: 8, fontWeight: 700, color: '#FFFFFF',
                }}
            >
                N
            </span>
        );
    }
    return null;
}

/**
 * Sticky title bar for screens that carry their own back button, count and action
 * (my page sub screens, notifications …). Sits right under the shell header.
 */
export function SubPageBar({
    title, count, sub, onBack, right, children,
}: { title: string; count?: number | string; sub?: ReactNode; onBack: () => void; right?: ReactNode; children?: ReactNode }) {
    const { stickyTop } = useMobileShell();
    return (
        <div style={{ position: 'sticky', top: stickyTop, zIndex: 10, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${MW.line}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto', alignItems: 'center', gap: 6, padding: '4px 10px 4px 6px', minHeight: 52, boxSizing: 'border-box' }}>
                <button type="button" onClick={onBack} aria-label="뒤로" style={{ width: 44, height: 44, border: 0, borderRadius: '50%', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                    <Ico d={D.back} size={22} />
                </button>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <h1 style={{ margin: 0, fontSize: 16, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {title}
                        {count !== undefined && <span style={{ fontFamily: MW_FONT_EN, fontSize: 13, fontWeight: 600, color: MW.mintDeep, marginLeft: 6 }}>{count}</span>}
                    </h1>
                    {sub}
                </div>
                {right ?? <span />}
            </div>
            {children}
        </div>
    );
}

/** Small outlined pill button used on the right of a SubPageBar ("전체 삭제" …). */
export function BarButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{ height: 34, padding: '0 12px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: disabled ? '#B8C4C1' : MW.mute, cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
        >
            {children}
        </button>
    );
}

/** Filter chips row (전체 / 모집 중 …) used across list screens. */
export function MPills<K extends string>({ items, value, onChange, style }: { items: Array<[K, string]>; value: K; onChange: (k: K) => void; style?: CSSProperties }) {
    return (
        <div data-noscroll="" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', ...style }}>
            {items.map(([k, label]) => {
                const on = k === value;
                return (
                    <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onChange(k)}
                        style={{
                            flexShrink: 0, height: 34, padding: '0 14px', borderRadius: 999, border: `1px solid ${on ? MW.mint : MW.line}`, background: on ? MW.mintTint : '#FFFFFF',
                            fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: on ? MW.mintDeep : MW.mute, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

/** White empty-state card with an optional mint action. */
export function MEmpty({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
    return (
        <div style={{ padding: '44px 20px', borderRadius: 18, background: '#FFFFFF', border: `1px solid ${MW.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
            <span style={{ fontSize: 13, lineHeight: 1.7, color: MW.mute }}>{text}</span>
            {action && (
                <button type="button" onClick={action.onClick} style={{ height: 44, padding: '0 20px', border: 0, borderRadius: 999, background: MW.mint, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>
                    {action.label}
                </button>
            )}
        </div>
    );
}

export function MLoading({ pad = 60 }: { pad?: number }) {
    return <div style={{ padding: `${pad}px 20px`, textAlign: 'center', fontSize: 13, color: MW.mute }}>불러오는 중…</div>;
}

/**
 * Photo that fills its (relatively positioned) parent; neutral tile when there is no image.
 * New uploaded photos use the sizes stored in R2; older photos use an enabled zone service.
 * (`sizes` = how wide the photo is shown; the default suits a two-column card). Other
 * sources, and an uploaded photo whose resized variant fails, load as they are.
 */
export function MPhoto({
    src, alt = '', eager, priority, sizes = '(max-width: 480px) 50vw, 240px', style,
}: { src?: string; alt?: string; eager?: boolean; priority?: boolean; sizes?: string; style?: CSSProperties }) {
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    if (!src) return <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: MW.chip, ...style }} />;
    const srcSet = failedSrc === src ? undefined : productImageSet(src);
    const dimensions = uploadedImageDimensions(src);
    return (
        <img
            width={dimensions?.width} height={dimensions?.height}
            src={srcSet ? productImageUrl(src, 640) : src}
            srcSet={srcSet}
            sizes={srcSet ? sizes : undefined}
            alt={alt}
            loading={eager || priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            onError={() => { if (srcSet) setFailedSrc(src); }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }}
        />
    );
}
