import React, { useEffect } from 'react';
import { DashboardIcon, type DashboardIconName } from '../dashboard/DashboardIcon';

/**
 * 예약 관리 v7(Claude Design `예약 관리 v7.dc.html`)의 칩·버튼·드롭다운·진행 단계.
 * 디자인 원본이 인라인 style로 그려져 있어 같은 값을 style 객체로 옮겼다.
 */
type Css = React.CSSProperties;
export const V7_INK = 'var(--adm-ink)';
export const V7_MUTED = 'var(--adm-text-3)';

/* Montage 부품 모양(M3): 색·크기는 public/admin-tokens.css의 --adm-* 변수만 쓴다. */
// [바탕, 글자] — ContentBadge의 '글자색 + 같은 색 8% 바탕'
const CT: Record<string, [string, string]> = {
    red: ['var(--adm-badge-danger-bg)', 'var(--adm-badge-danger-fg)'], mint: ['var(--adm-badge-brand-bg)', 'var(--adm-badge-brand-fg)'],
    amber: ['var(--adm-badge-warn-bg)', 'var(--adm-badge-warn-fg)'], blue: ['var(--adm-badge-info-bg)', 'var(--adm-badge-info-fg)'],
    gray: ['var(--adm-badge-neutral-bg)', 'var(--adm-badge-neutral-fg)'], solid: ['var(--adm-primary-bg)', 'var(--semantic-static-white)'],
    ink: ['var(--semantic-surface-neutral-inverse)', 'var(--semantic-foreground-neutral-inverse)'],
};
export type V7Tone = 'red' | 'mint' | 'amber' | 'blue' | 'gray' | 'solid';
const dotBg = (color: string, x: number) => `radial-gradient(circle at ${x}px 50%, ${color} 3px, transparent 3.6px)`;

/** 상태 표시 배지(읽기 전용, Montage ContentBadge small). dot은 왼쪽 점. */
export const chip = (tone: V7Tone, dot: boolean, x?: Css): Css => {
    const [bg, fg] = CT[tone] || CT.gray;
    return { display: 'inline-flex', alignItems: 'center', gap: 4, padding: dot ? '4px 6px 4px 16px' : 'var(--adm-badge-pad)', boxSizing: 'border-box', borderRadius: 'var(--adm-badge-radius)',
        fontSize: 'var(--adm-badge-fs)', fontWeight: 'var(--adm-badge-fw)' as Css['fontWeight'], lineHeight: 1.334, whiteSpace: 'nowrap',
        background: (dot ? dotBg(fg, 9) + ', ' : '') + bg, color: fg, ...(x || {}) };
};

/** 눌러서 바꾸는 상태 버튼(점 + 옅은 색 바탕, 28px·모서리 8). */
export type PillTone = 'red' | 'mint' | 'gray' | 'amber' | 'blue' | 'ink' | 'solid';
export const pill = (tone: PillTone, x?: Css): Css => {
    const [bg, fg] = CT[tone] || CT.gray;
    return { display: 'inline-flex', alignItems: 'center', gap: 4, height: 'var(--adm-btn-h-xs)', padding: '0 var(--spacing-10) 0 20px', boxSizing: 'border-box', border: 0, borderRadius: 'var(--adm-btn-radius-xs)', font: 'inherit',
        fontSize: 'var(--typography-caption1-fontSize)', fontWeight: 'var(--adm-fw-semibold)' as Css['fontWeight'], whiteSpace: 'nowrap', cursor: 'pointer',
        background: `${dotBg(fg, 11)}, ${bg}`, color: fg, ...(x || {}) };
};

/** 선택 상자 모양 버튼(Montage Select small). empty면 빨간 선(선택 필요). */
export const sel = (empty: boolean, x?: Css): Css => ({ display: 'inline-flex', alignItems: 'center', gap: 6, height: 'var(--adm-input-h-sm)', padding: '0 var(--spacing-8) 0 var(--adm-input-pad-x-sm)', boxSizing: 'border-box', border: 0,
    borderRadius: 'var(--adm-input-radius-sm)', font: 'inherit', fontSize: 'var(--typography-label2-fontSize)', fontWeight: 'var(--adm-fw-medium)' as Css['fontWeight'], whiteSpace: 'nowrap', cursor: 'pointer',
    background: 'var(--adm-input-bg)', boxShadow: `inset 0 0 0 1px ${empty ? 'var(--adm-input-invalid-line)' : 'var(--adm-input-line)'}`, color: empty ? 'var(--adm-badge-danger-fg)' : 'var(--adm-input-fg)', ...(x || {}) });

/** 배정 칩(목록의 가이드·차량·숙소, 28px·모서리 8). c는 점 색. */
export const dchip = (c: string, bad: boolean, x?: Css): Css => ({ display: 'inline-flex', alignItems: 'center', gap: 5, height: 'var(--adm-btn-h-xs)', padding: '0 var(--spacing-10) 0 20px', boxSizing: 'border-box', border: 0,
    borderRadius: 'var(--adm-btn-radius-xs)', font: 'inherit', fontSize: 'var(--typography-caption1-fontSize)', fontWeight: 'var(--adm-fw-semibold)' as Css['fontWeight'], whiteSpace: 'nowrap', cursor: 'pointer', flex: '0 0 auto',
    background: `${dotBg(c, 10)}, ${bad ? 'var(--adm-badge-danger-bg)' : 'var(--adm-badge-neutral-bg)'}`, color: bad ? 'var(--adm-badge-danger-fg)' : 'var(--adm-ink)', ...(x || {}) });

/** 체크 상자(Montage Checkbox: 모서리 5, 고르면 진한 민트). */
export const checkBox = (on: boolean): Css => ({ width: 18, height: 18, padding: 0, borderRadius: 5, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: on ? 'var(--semantic-surface-brand-primary)' : 'var(--adm-surface)', boxShadow: on ? 'none' : 'inset 0 0 0 1.5px var(--semantic-line-neutral-primary)' });

export const card: Css = { display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, boxShadow: '0 0 0 1px #eef0f2', scrollMarginTop: 88 };
export const iconTile = (size = 30): Css => ({ width: size, height: size, flex: 'none', borderRadius: 'var(--adm-icon-btn-radius)', background: 'var(--semantic-surface-neutral-secondary)', color: 'var(--adm-text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' });

/** 버튼 높이(px)에 맞는 Montage Button 크기의 모서리·여백·글자. */
const btnSize = (h: number) => h >= 48 ? ['var(--adm-btn-radius-lg)', 'var(--adm-btn-pad-x-lg)', 'var(--adm-btn-fs-lg)']
    : h >= 40 ? ['var(--adm-btn-radius)', 'var(--adm-btn-pad-x)', 'var(--adm-btn-fs)']
    : h >= 32 ? ['var(--adm-btn-radius-sm)', 'var(--adm-btn-pad-x-sm)', 'var(--adm-btn-fs-sm)']
    : ['var(--adm-btn-radius-xs)', 'var(--adm-btn-pad-x-xs)', 'var(--adm-btn-fs-sm)'];
/** 테두리 버튼(Montage Button outlined). */
export const ghostBtn = (h = 36): Css => { const [r, p, f] = btnSize(h); return { display: 'inline-flex', alignItems: 'center', gap: 6, height: h, padding: `0 ${p}`, border: 0, borderRadius: r, background: 'var(--adm-surface)', boxShadow: 'inset 0 0 0 1px var(--adm-btn-line)', font: 'inherit', fontSize: f, fontWeight: 'var(--adm-btn-fw)' as Css['fontWeight'], color: 'var(--adm-text)', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }; };
/** 주요 버튼(Montage Button solid primary). */
export const inkBtn = (h = 36): Css => { const [r, p, f] = btnSize(h); return { display: 'inline-flex', alignItems: 'center', gap: 6, height: h, padding: `0 ${p}`, border: 0, borderRadius: r, background: 'var(--adm-primary-bg)', font: 'inherit', fontSize: f, fontWeight: 'var(--adm-btn-fw)' as Css['fontWeight'], color: 'var(--semantic-static-white)', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }; };

export const Ico = ({ name, size = 14, color }: { name: DashboardIconName; size?: number; color?: string }) => <DashboardIcon name={name} size={size} color={color} />;

const KEYFRAMES = `@keyframes rvPop{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}
@keyframes rvPulse{0%{box-shadow:0 0 0 0 rgba(255,79,79,.45),0 0 0 5px #ffecec}70%{box-shadow:0 0 0 12px rgba(255,79,79,0),0 0 0 5px #ffecec}100%{box-shadow:0 0 0 0 rgba(255,79,79,0),0 0 0 5px #ffecec}}
@keyframes rvGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes rvFlow{from{background-position:0 0}to{background-position:-40px 0}}
@keyframes rvDot{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
@keyframes rvBlink{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes rvUp{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
@media (prefers-reduced-motion:reduce){.v7-root *{animation:none!important}}
.v7-root a.v7-link{color:var(--adm-accent-strong);text-decoration:none}.v7-root a.v7-link:hover{color:var(--adm-accent-deep);text-decoration:underline}
.v7-hover-row:hover{background:var(--adm-table-row-hover)!important}
.v7-nav-btn:hover{box-shadow:0 0 0 1.5px var(--adm-accent),0 4px 12px rgba(var(--adm-accent-rgb),.12)!important}
.v7-dd-row:hover{background:var(--adm-menu-item-hover)!important}
.v7-toast{bottom:28px}@media (max-width:760px){.v7-toast{bottom:calc(var(--adm-tabbar-h) + var(--adm-safe-bottom) + 12px)}}
.v7-bulk-btn:hover{background:rgba(255,255,255,.2)!important}
.v7-dim:hover{filter:none!important;opacity:1!important}
@keyframes v7SecFlash{0%{box-shadow:0 0 0 1px #eef0f2}25%{box-shadow:0 0 0 2px var(--adm-accent),0 8px 24px rgba(var(--adm-accent-rgb),.18)}100%{box-shadow:0 0 0 1px #eef0f2}}
.v7-root .v7-sec-flash{animation:v7SecFlash 1.4s ease-out}`;
/** 디자인의 애니메이션·hover 규칙. 화면마다 한 번 넣는다. */
export const V7Styles = () => <style>{KEYFRAMES}</style>;

export interface V7MenuItem { key: string; label: string; sub?: string; subTone?: 'ok' | 'warn' | 'muted'; on?: boolean; muted?: boolean; disabled?: boolean; onPick: () => void }
export interface V7MenuState { title: string; items: V7MenuItem[]; x: number; y: number | null; b: number | null; wide?: boolean }

/** 버튼 아래(공간이 없으면 위)에 여는 고정 위치 메뉴. */
export function menuAt(target: HTMLElement, title: string, items: V7MenuItem[], wide = false): V7MenuState {
    const rc = target.getBoundingClientRect(), up = rc.bottom + 320 > window.innerHeight;
    return { title, items, wide, x: Math.max(8, Math.min(rc.left, window.innerWidth - (wide ? 268 : 236))), y: up ? null : rc.bottom + 6, b: up ? window.innerHeight - rc.top + 6 : null };
}

export function V7Menu({ menu, onClose }: { menu: V7MenuState | null; onClose: () => void }) {
    useEffect(() => {
        if (!menu) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
    }, [menu, onClose]);
    if (!menu) return null;
    return <>
        <div onClick={onClose} onWheel={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
        <div role="menu" aria-label={menu.title} style={{ position: 'fixed', left: menu.x, ...(menu.y !== null ? { top: menu.y } : { bottom: menu.b ?? 0 }), zIndex: 61, width: menu.wide ? 260 : 228, maxHeight: 340, overflowY: 'auto', boxSizing: 'border-box', padding: 'var(--adm-menu-pad)', display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--adm-menu-bg)', borderRadius: 'var(--adm-menu-radius)', boxShadow: 'var(--adm-menu-shadow)', animation: 'rvPop 140ms ease-out' }}>
            {menu.title && <span style={{ padding: '6px 8px 4px', fontSize: 11, fontWeight: 700, color: V7_MUTED }}>{menu.title}</span>}
            {menu.items.map(o => <button key={o.key} type="button" role="menuitemradio" aria-checked={!!o.on} disabled={o.disabled} className="v7-dd-row"
                onClick={e => { e.stopPropagation(); onClose(); o.onPick(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: o.sub ? 44 : 'var(--adm-menu-item-h)', padding: '4px 10px', border: 0, borderRadius: 'var(--adm-menu-item-radius)', font: 'inherit', cursor: o.disabled ? 'not-allowed' : 'pointer', opacity: o.disabled ? .5 : 1, background: o.on ? 'var(--adm-menu-item-hover)' : 'transparent', textAlign: 'left' }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: o.on ? 800 : 600, color: o.muted ? V7_MUTED : V7_INK }}>{o.label}</span>
                    {o.sub && <span style={{ fontSize: 11, fontWeight: 600, color: o.subTone === 'warn' ? 'var(--adm-badge-danger-fg)' : o.subTone === 'muted' ? V7_MUTED : 'var(--adm-accent-strong)' }}>{o.sub}</span>}
                </span>
                {o.on && <Ico name="lc-check" size={15} color="var(--adm-accent-strong)" />}
            </button>)}
            {!menu.items.length && <span style={{ padding: '8px 10px', fontSize: 12, color: V7_MUTED }}>선택할 수 있는 항목이 없어요.</span>}
        </div>
    </>;
}

export function V7Toast({ text }: { text: string }) {
    if (!text) return null;
    // Montage Toast: 아래 가운데, 어두운 반전 바탕(공통 adminNotify와 같은 자리·모양)
    return <div role="status" className="v7-toast" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: 'var(--adm-z-toast)' as Css['zIndex'], display: 'flex', alignItems: 'center', gap: 8, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', padding: 'var(--adm-toast-pad)', background: 'var(--adm-toast-bg)', color: 'var(--adm-toast-fg)', borderRadius: 'var(--adm-toast-radius)', boxShadow: 'var(--adm-toast-shadow)', fontSize: 'var(--adm-toast-fs)', fontWeight: 'var(--adm-toast-fw)' as Css['fontWeight'], animation: 'rvUp 180ms ease-out' }}>
        <Ico name="lc-circle-check" size={16} color="var(--semantic-foreground-positive-primary)" />{text}
    </div>;
}

export interface V7Step { label: string; done: boolean; sub: string }
/** 진행 단계 5칸. cancelled면 채우지 않는다. large는 상세 화면 크기. */
export function V7Steps({ steps, cancelled, large = false, onStep }: { steps: V7Step[]; cancelled: boolean; large?: boolean; onStep?: (index: number) => void }) {
    const cur = steps.findIndex(s => !s.done), dotSize = large ? 28 : 28;
    const fill: Css = { position: 'absolute', left: '10%', top: 13, height: 3, borderRadius: 3, transformOrigin: 'left center', background: 'linear-gradient(90deg,var(--adm-accent),#7fe8c9,var(--adm-accent))', backgroundSize: '40px 100%',
        animation: 'rvGrow 700ms cubic-bezier(.2,.8,.2,1) both, rvFlow 1.2s linear 700ms infinite', width: cancelled ? 0 : `${(cur < 0 ? steps.length - 1 : Math.max(cur, 0)) * (80 / Math.max(1, steps.length - 1))}%` };
    return <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${steps.length},minmax(0,1fr))` }}>
        <span style={{ position: 'absolute', left: '10%', right: '10%', top: 13, height: 3, borderRadius: 3, background: '#e9ecef' }} />
        <span style={fill} />
        {steps.map((s, j) => {
            const ok = s.done && !cancelled, now = j === cur && !cancelled;
            const inner = <>
                <span style={{ position: 'relative', zIndex: 1, width: dotSize, height: dotSize, borderRadius: 999, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: ok ? 'linear-gradient(135deg,var(--adm-accent),var(--adm-accent-strong))' : now ? '#FF4F4F' : '#fff', border: ok || now ? '0' : '2px solid #dee2e6',
                    boxShadow: now ? '0 0 0 5px #ffecec' : ok ? '0 2px 8px rgba(var(--adm-accent-rgb),.22)' : 'none',
                    animation: now ? `rvDot 420ms ${j * 120}ms both cubic-bezier(.2,.8,.2,1), rvPulse 1.8s ${j * 120 + 500}ms ease-out infinite` : ok ? `rvDot 420ms ${j * 120}ms both cubic-bezier(.2,.8,.2,1)` : 'none' }}>
                    {ok && <Ico name="lc-check" size={14} color="#fff" />}
                    {now && <span style={{ width: 8, height: 8, borderRadius: 999, background: '#fff' }} />}
                </span>
                <span style={{ fontSize: 13, fontWeight: now ? 800 : 700, whiteSpace: 'nowrap', color: ok ? 'var(--adm-accent-strong)' : now ? '#FF4F4F' : '#adb5bd' }}>{s.label}</span>
                <span className="v7-step-sub" style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', fontVariantNumeric: 'tabular-nums', color: now ? '#FF4F4F' : ok ? '#495057' : '#adb5bd', animation: now ? 'rvBlink 1.8s ease-in-out infinite' : 'none' }}>{s.sub}</span>
            </>;
            const box: Css = { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', minWidth: 0 };
            return onStep
                ? <button key={s.label} type="button" onClick={() => onStep(j)} title={`${s.label} · ${ok ? '완료' : now ? '지금 처리할 단계' : '대기'}`} style={{ ...box, padding: 0, border: 0, background: 'transparent', font: 'inherit', cursor: 'pointer' }}>{inner}</button>
                : <span key={s.label} style={box} title={`${s.label} · ${ok ? '완료' : now ? '지금 처리할 단계' : '대기'}`}>{inner}</span>;
        })}
    </div>;
}

/** 진행 단계 카드 머리: '진행 단계' + 지금 단계 칩 + 완료 수. */
export function V7StepHead({ label, tone, count, big = false }: { label: string; tone: 'red' | 'mint' | 'gray'; count: string; big?: boolean }) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: big ? 15 : 14, fontWeight: 800 }}>진행 단계</b>
        <span style={chip(tone, tone !== 'gray', { alignSelf: 'center', height: 24, fontSize: 12, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' })}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: V7_MUTED }}>{count}</span>
    </div>;
}
