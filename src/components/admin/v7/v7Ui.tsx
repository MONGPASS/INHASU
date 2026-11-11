import React, { useEffect } from 'react';
import { DashboardIcon, type DashboardIconName } from '../dashboard/DashboardIcon';

/**
 * 예약 관리 v7(Claude Design `예약 관리 v7.dc.html`)의 칩·버튼·드롭다운·진행 단계.
 * 디자인 원본이 인라인 style로 그려져 있어 같은 값을 style 객체로 옮겼다.
 */
type Css = React.CSSProperties;
export const V7_INK = '#1A1B1E';
export const V7_MUTED = '#868e96';

const CT: Record<string, [string, string, string, string]> = {
    red: ['#fff7f7', '#ffe8e8', '#ffc9c9', '#FF4F4F'], mint: ['#f3fdf9', '#ddf6ec', '#b2ebd6', 'var(--adm-accent-strong)'],
    amber: ['#fffaf2', '#ffeed6', '#ffc98a', '#e8590c'], blue: ['#f5faff', '#e3f0ff', '#b9d8ff', '#1c6fd1'],
    gray: ['#ffffff', '#f1f3f5', '#dee2e6', '#495057'], solid: ['var(--adm-accent)', 'var(--adm-accent-strong)', 'var(--adm-accent-strong)', '#ffffff'],
};
export type V7Tone = 'red' | 'mint' | 'amber' | 'blue' | 'gray' | 'solid';

/** 상태 표시 칩(읽기 전용). dot은 왼쪽 점. */
export const chip = (tone: V7Tone, dot: boolean, x?: Css): Css => {
    const T = CT[tone] || CT.gray, d = tone === 'solid' ? '#fff' : T[3];
    return { display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: dot ? '0 9px 0 19px' : '0 9px', boxSizing: 'border-box', borderRadius: 999, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
        background: (dot ? `radial-gradient(circle at 10px 50%, ${d} 2.6px, ${tone === 'solid' ? 'transparent' : T[2]} 3px, transparent 4.6px), ` : '') + `linear-gradient(180deg,${T[0]},${T[1]})`,
        boxShadow: `inset 0 0 0 1px ${T[2]}` + (tone === 'solid' ? ', 0 2px 8px rgba(var(--adm-accent-rgb),.22)' : ''), color: T[3], ...(x || {}) };
};

/** 눌러서 바꾸는 상태 버튼(점 + 그라데이션). */
export type PillTone = 'red' | 'mint' | 'gray' | 'amber' | 'blue' | 'ink' | 'solid';
export const pill = (tone: PillTone, x?: Css): Css => {
    const T = ({ red: CT.red, mint: CT.mint, gray: ['#fff', '#f4f6f8', '#dee2e6', '#495057'], amber: CT.amber, blue: CT.blue, ink: [V7_INK, V7_INK, V7_INK, '#fff'], solid: ['var(--adm-accent)', 'var(--adm-accent-strong)', 'var(--adm-accent-strong)', '#fff'] } as Record<PillTone, string[]>)[tone];
    const filled = tone === 'ink' || tone === 'solid', dot = filled ? '#fff' : T[3];
    return { display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px 0 20px', border: 0, borderRadius: 999, font: 'inherit', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
        background: `radial-gradient(circle at 11px 50%, ${dot} 3px, ${filled ? 'transparent' : T[2]} 3.4px, transparent 5px), linear-gradient(180deg,${T[0]},${T[1]})`,
        boxShadow: `inset 0 0 0 1px ${T[2]}` + (tone === 'solid' ? ', 0 2px 8px rgba(var(--adm-accent-rgb),.22)' : ''), color: T[3], ...(x || {}) };
};

/** 선택 상자 모양 버튼. empty면 빨간 테두리(선택 필요). */
export const sel = (empty: boolean, x?: Css): Css => ({ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px 0 12px', boxSizing: 'border-box', border: 0, borderRadius: 10, font: 'inherit', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
    background: '#fff', boxShadow: empty ? 'inset 0 0 0 1.5px #ffc9c9' : 'inset 0 0 0 1px #dee2e6', color: empty ? '#FF4F4F' : V7_INK, ...(x || {}) });

/** 배정 칩(목록의 가이드·차량·숙소). c는 점 색. */
export const dchip = (c: string, bad: boolean, x?: Css): Css => ({ display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px 0 20px', boxSizing: 'border-box', border: 0, borderRadius: 999, font: 'inherit', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', flex: '0 0 auto',
    background: `radial-gradient(circle at 10px 50%, ${c} 3px, transparent 3.6px), ${bad ? '#ffecec' : '#f4f6f8'}`, boxShadow: `inset 0 0 0 1px ${bad ? '#ffc9c9' : '#e9ecef'}`, color: bad ? '#FF4F4F' : V7_INK, ...(x || {}) });

export const checkBox = (on: boolean): Css => ({ width: 18, height: 18, padding: 0, borderRadius: 6, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: on ? 'linear-gradient(135deg,var(--adm-accent),var(--adm-accent-strong))' : '#fff', boxShadow: on ? 'none' : 'inset 0 0 0 1.5px #ced4da' });

export const card: Css = { display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, boxShadow: '0 0 0 1px #eef0f2', scrollMarginTop: 88 };
export const iconTile = (size = 30): Css => ({ width: size, height: size, flex: 'none', borderRadius: size >= 34 ? 10 : size >= 30 ? 10 : 9, background: '#f1f3f5', color: '#495057', display: 'flex', alignItems: 'center', justifyContent: 'center' });
export const ghostBtn = (h = 36): Css => ({ display: 'inline-flex', alignItems: 'center', gap: 6, height: h, padding: '0 14px', border: 0, borderRadius: 999, background: '#fff', boxShadow: 'inset 0 0 0 1px #dee2e6', font: 'inherit', fontSize: 13, fontWeight: 700, color: V7_INK, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' });
export const inkBtn = (h = 36): Css => ({ display: 'inline-flex', alignItems: 'center', gap: 6, height: h, padding: '0 16px', border: 0, borderRadius: 999, background: 'var(--adm-primary-bg)', font: 'inherit', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' });

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
.v7-hover-row:hover{background:#f0fcf7!important}
.v7-nav-btn:hover{box-shadow:0 0 0 1.5px var(--adm-accent),0 4px 12px rgba(var(--adm-accent-rgb),.12)!important}
.v7-dd-row:hover{background:#f8f9fa!important}
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
        <div role="menu" aria-label={menu.title} style={{ position: 'fixed', left: menu.x, ...(menu.y !== null ? { top: menu.y } : { bottom: menu.b ?? 0 }), zIndex: 61, width: menu.wide ? 260 : 228, maxHeight: 340, overflowY: 'auto', boxSizing: 'border-box', padding: 6, display: 'flex', flexDirection: 'column', gap: 2, background: '#fff', borderRadius: 14, boxShadow: '0 0 0 1px rgba(16,24,40,.06),0 12px 32px rgba(16,24,40,.16)', animation: 'rvPop 140ms ease-out' }}>
            {menu.title && <span style={{ padding: '6px 8px 4px', fontSize: 11, fontWeight: 700, color: V7_MUTED }}>{menu.title}</span>}
            {menu.items.map(o => <button key={o.key} type="button" role="menuitemradio" aria-checked={!!o.on} disabled={o.disabled} className="v7-dd-row"
                onClick={e => { e.stopPropagation(); onClose(); o.onPick(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: o.sub ? 44 : 36, padding: '4px 10px', border: 0, borderRadius: 10, font: 'inherit', cursor: o.disabled ? 'not-allowed' : 'pointer', opacity: o.disabled ? .5 : 1, background: o.on ? '#f8f9fa' : 'transparent', textAlign: 'left' }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: o.on ? 800 : 600, color: o.muted ? V7_MUTED : V7_INK }}>{o.label}</span>
                    {o.sub && <span style={{ fontSize: 11, fontWeight: 600, color: o.subTone === 'warn' ? '#FF4F4F' : o.subTone === 'muted' ? V7_MUTED : 'var(--adm-accent-strong)' }}>{o.sub}</span>}
                </span>
                {o.on && <Ico name="lc-check" size={15} color="var(--adm-accent-strong)" />}
            </button>)}
            {!menu.items.length && <span style={{ padding: '8px 10px', fontSize: 12, color: V7_MUTED }}>선택할 수 있는 항목이 없어요.</span>}
        </div>
    </>;
}

export function V7Toast({ text }: { text: string }) {
    if (!text) return null;
    return <div role="status" style={{ position: 'fixed', left: '50%', top: 20, transform: 'translateX(-50%)', zIndex: 70, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', background: '#fff', borderRadius: 14, boxShadow: '0 0 0 1px #eef0f2,0 12px 32px rgba(16,24,40,.16)', fontSize: 14, fontWeight: 700, animation: 'rvUp 180ms ease-out' }}>
        <Ico name="lc-circle-check" size={16} color="var(--adm-accent-strong)" />{text}
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
