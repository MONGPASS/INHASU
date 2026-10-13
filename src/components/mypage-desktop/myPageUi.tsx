import type { CSSProperties, ReactNode } from 'react';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { PAPER, mintBtn, mintHover } from './myPageTheme';

export function Ico({ d, size = 20, color = MW.mintDeep, width = 1.8, style }: { d: string; size?: number; color?: string; width?: number; style?: CSSProperties }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
            <path d={d} />
        </svg>
    );
}

/** Panel header: English eyebrow, h2 with optional count, sub copy and a right-side action. */
export function PanelHead({ eyebrow, title, count, sub, action }: { eyebrow?: string; title: string; count?: number; sub?: string; action?: ReactNode }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {eyebrow && <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>{eyebrow}</span>}
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
                    {title}
                    {count !== undefined && <span style={{ fontFamily: MW_FONT_EN, fontSize: 15, fontWeight: 600, color: MW.mintDeep, marginLeft: 6 }}>{count}</span>}
                </h2>
                {sub && <span style={{ fontSize: 13, color: MW.mute }}>{sub}</span>}
            </div>
            {action}
        </div>
    );
}

export function EmptyBox({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
    return (
        <div style={{ padding: '48px 20px', borderRadius: 14, background: PAPER, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
            <span style={{ fontSize: 14, color: MW.mute }}>{text}</span>
            {action && (
                <button type="button" onClick={action.onClick} style={{ ...mintBtn, height: 44, padding: '0 20px', fontSize: 14 }} {...mintHover}>
                    {action.label}
                </button>
            )}
        </div>
    );
}

export function Loading() {
    return <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 14, color: MW.mute }}>불러오는 중…</div>;
}

/** Filter chips (전체 / 모집 중 …). */
export function FilterPills<K extends string>({ items, value, onChange }: { items: Array<[K, string]>; value: K; onChange: (k: K) => void }) {
    return (
        <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {items.map(([k, label]) => {
                const on = k === value;
                return (
                    <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => onChange(k)}
                        style={{
                            height: 36, padding: '0 16px', borderRadius: 999, border: `1px solid ${on ? MW.mint : MW.line}`, background: on ? MW.mintTint : '#fff',
                            fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: on ? MW.mintDeep : MW.mute, cursor: 'pointer',
                        }}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
