import React, { useEffect } from 'react';
import { DashboardIcon, type DashboardIconName } from '../dashboard/DashboardIcon';
import { AdminBadge, type AdminTone } from '../ui';
import './reservation-detail-cards.css';

/**
 * 예약 관리 v7(Claude Design `예약 관리 v7.dc.html`)의 메뉴·알림·진행 단계.
 * 모양은 reservation-detail-cards.css(v7-*·adm-v7-*)가 --adm-* 변수로 정한다. 실행 중 계산되는 값(위치·너비·순서)만 인라인으로 넘긴다.
 */
type Css = React.CSSProperties;

/** 읽기 전용 상태 표시의 색 이름(예전 chip). AdminBadge 톤으로 바꿔 그린다. */
export type V7Tone = 'red' | 'mint' | 'amber' | 'blue' | 'gray' | 'solid';
/** 눌러서 바꾸는 상태 버튼의 색 이름(예전 pill). 모양은 .adm-v7-pill.is-{tone} */
export type PillTone = 'red' | 'mint' | 'gray' | 'amber' | 'blue' | 'ink' | 'solid';

/** v7 색 이름 → Seed 배지 톤(완료 초록 · 안내 민트 · 주의 노랑 · 미처리 빨강 · 보류 회색). solid는 민트 채움. */
export const v7BadgeTone = (tone: V7Tone | PillTone): { tone: AdminTone; strong: boolean } => ({
    red: { tone: 'danger', strong: false }, mint: { tone: 'success', strong: false }, amber: { tone: 'warn', strong: false }, blue: { tone: 'info', strong: false },
    gray: { tone: 'neutral', strong: false }, solid: { tone: 'info', strong: true }, ink: { tone: 'neutral', strong: true },
} as Record<V7Tone | PillTone, { tone: AdminTone; strong: boolean }>)[tone] || { tone: 'neutral', strong: false };

/** 읽기 전용 상태 배지(AdminBadge). */
export const V7Badge = ({ tone, size = 'md', title, className, children }: { tone: V7Tone | PillTone; size?: 'sm' | 'md'; title?: string; className?: string; children: React.ReactNode }) => {
    const t = v7BadgeTone(tone);
    return <AdminBadge tone={t.tone} strong={t.strong} size={size} title={title} className={className}>{children}</AdminBadge>;
};

export const Ico = ({ name, size = 14, color }: { name: DashboardIconName; size?: number; color?: string }) => <DashboardIcon name={name} size={size} color={color} />;

const KEYFRAMES = `@keyframes rvPop{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}
@keyframes rvPulse{0%{box-shadow:0 0 0 0 rgba(255,79,79,.45),0 0 0 5px var(--adm-danger-soft)}70%{box-shadow:0 0 0 12px rgba(255,79,79,0),0 0 0 5px var(--adm-danger-soft)}100%{box-shadow:0 0 0 0 rgba(255,79,79,0),0 0 0 5px var(--adm-danger-soft)}}
@keyframes rvGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes rvFlow{from{background-position:0 0}to{background-position:-40px 0}}
@keyframes rvDot{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
@keyframes rvBlink{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes rvUp{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
@media (prefers-reduced-motion:reduce){.v7-root *{animation:none!important}}
.v7-root a.v7-link{color:var(--adm-accent-strong);text-decoration:none}.v7-root a.v7-link:hover{color:var(--adm-accent-deep);text-decoration:underline}
.v7-hover-row:hover{background:var(--adm-accent-soft)!important}
.v7-nav-btn:hover{box-shadow:0 0 0 1.5px var(--adm-accent),0 4px 12px rgba(var(--adm-accent-rgb),.12)!important}
.v7-dd-row:hover{background:var(--adm-gray-50)!important}
.v7-bulk-btn:hover{background:rgba(255,255,255,.2)!important}
.v7-dim:hover{filter:none!important;opacity:1!important}
@keyframes v7SecFlash{0%{box-shadow:0 0 0 1px var(--adm-line-subtle)}25%{box-shadow:0 0 0 2px var(--adm-accent),0 8px 24px rgba(var(--adm-accent-rgb),.18)}100%{box-shadow:0 0 0 1px var(--adm-line-subtle)}}
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
    // 위치는 누른 버튼에 따라 실행 중에 정해진다.
    const at: Css = menu.y !== null ? { left: menu.x, top: menu.y } : { left: menu.x, bottom: menu.b ?? 0 };
    return <>
        <div className="v7-menu-scrim" onClick={onClose} onWheel={onClose} />
        <div role="menu" aria-label={menu.title} className={menu.wide ? 'v7-menu is-wide' : 'v7-menu'} style={at}>
            {menu.title && <span className="v7-menu-title">{menu.title}</span>}
            {menu.items.map(o => <button key={o.key} type="button" role="menuitemradio" aria-checked={!!o.on} disabled={o.disabled}
                className={['adm-v7-menu-row', 'v7-dd-row', o.sub && 'has-sub', o.on && 'is-on'].filter(Boolean).join(' ')}
                onClick={e => { e.stopPropagation(); onClose(); o.onPick(); }}>
                <span className="v7-menu-text">
                    <span className={o.muted ? 'v7-menu-label is-muted' : 'v7-menu-label'}>{o.label}</span>
                    {o.sub && <span className={`v7-menu-sub is-${o.subTone || 'ok'}`}>{o.sub}</span>}
                </span>
                {o.on && <Ico name="lc-check" size={15} color="var(--adm-accent-strong)" />}
            </button>)}
            {!menu.items.length && <span className="v7-menu-empty">선택할 수 있는 항목이 없어요.</span>}
        </div>
    </>;
}

export function V7Toast({ text }: { text: string }) {
    if (!text) return null;
    return <div role="status" className="v7-toast">
        <Ico name="lc-circle-check" size={16} color="var(--adm-accent-strong)" />{text}
    </div>;
}

export interface V7Step { label: string; done: boolean; sub: string }
/** 진행 단계 5칸. cancelled면 채우지 않는다. large는 상세 화면 크기. */
export function V7Steps({ steps, cancelled, large = false, onStep }: { steps: V7Step[]; cancelled: boolean; large?: boolean; onStep?: (index: number) => void }) {
    const cur = steps.findIndex(s => !s.done);
    // 채운 막대 너비는 지금 단계에 따라 실행 중에 정해진다.
    const fillWidth = cancelled ? '0%' : `${(cur < 0 ? steps.length - 1 : Math.max(cur, 0)) * (80 / Math.max(1, steps.length - 1))}%`;
    return <div className={['v7-steps', steps.length > 5 && 'v7-steps-many', large && 'is-large'].filter(Boolean).join(' ')}>
        <span className="v7-steps-track" />
        <span className="v7-steps-fill" style={{ width: fillWidth }} />
        {steps.map((s, j) => {
            const ok = s.done && !cancelled, now = j === cur && !cancelled;
            const state = ok ? 'is-ok' : now ? 'is-now' : 'is-wait';
            const inner = <>
                <span className={`v7-step-dot ${state}`}>
                    {ok && <Ico name="lc-check" size={14} color="var(--adm-on-primary)" />}
                    {now && <span className="v7-step-core" />}
                </span>
                <span className={`v7-step-label ${state}`}>{s.label}</span>
                <span className={`v7-step-sub ${state}`}>{s.sub}</span>
            </>;
            const title = `${s.label} · ${ok ? '완료' : now ? '지금 처리할 단계' : '대기'}`;
            // 단계 순서(애니메이션 지연)만 변수로 넘긴다.
            const order = { '--v7-i': j } as Css;
            return onStep
                ? <button key={s.label} data-now={now ? '' : undefined} type="button" className="adm-v7-step v7-step" onClick={() => onStep(j)} title={title} style={order}>{inner}</button>
                : <span key={s.label} data-now={now ? '' : undefined} className="v7-step" title={title} style={order}>{inner}</span>;
        })}
    </div>;
}

/** 진행 단계 카드 머리: '진행 단계' + 지금 단계 배지 + 완료 수. */
export function V7StepHead({ label, tone, count, big = false }: { label: string; tone: 'red' | 'mint' | 'gray'; count: string; big?: boolean }) {
    return <div className="v7-stephead">
        <b className={big ? 'v7-stephead-title is-big' : 'v7-stephead-title'}>진행 단계</b>
        <V7Badge tone={tone} className="v7-stephead-badge">{label}</V7Badge>
        <span className="v7-stephead-count">{count}</span>
    </div>;
}
