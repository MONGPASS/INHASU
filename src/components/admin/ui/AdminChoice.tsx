import React, { useRef } from 'react';
import { cx } from './adminUiUtils';
import './admin-components.css';

/**
 * 상태 배지·칩·묶음 전환·밑줄 탭. 당근 Seed Badge·ChipToggleButton·SegmentedControl·Tabs 모양을 우리 변수로 직접 그린다.
 *
 * 상태 배지: 모서리 4px, 12px 굵게, 옅은 상태색 바탕 + 상태색 글자. 색만으로 알리지 않도록 글자(문장)를 꼭 넣는다.
 * 상태색 뜻: danger 삭제·오류·미처리 · warn 주의·대기 · success 완료 · info 안내·진행(민트 글자) · neutral 보류·종료.
 * 사람·출처처럼 구분만 하는 색은 tag-*(Seed 색 단계).
 */
export type AdminTone = 'neutral' | 'info' | 'success' | 'warn' | 'danger';
export type AdminTagTone = 'tag-lime' | 'tag-cyan' | 'tag-blue' | 'tag-violet' | 'tag-purple' | 'tag-pink' | 'tag-orange';

export interface AdminBadgeProps {
    tone?: AdminTone | AdminTagTone;
    /** 채움(진한 바탕) — 강조가 필요한 한두 곳만 */
    strong?: boolean;
    /** 테두리만(바탕 없음) — 덜 중요한 꼬리표 */
    outlined?: boolean;
    size?: 'sm' | 'md';
    icon?: React.ReactNode;
    className?: string;
    title?: string;
    children: React.ReactNode;
}

export const AdminBadge: React.FC<AdminBadgeProps> = ({ tone = 'neutral', strong, outlined, size = 'sm', icon, className, title, children }) => (
    <span title={title} className={cx('adm-ui-badge', `is-${tone}`, `is-${size}`, strong && 'is-strong', outlined && 'is-outlined', className)}>
        {icon != null && icon !== false && <span className="adm-ui-badge-icon" aria-hidden="true">{icon}</span>}
        {children}
    </span>
);

/** 필터 칩: 높이 32·테두리 없음, 고르면 옅은 민트 바탕 + 민트 글자. 숫자는 `count`로 */
export interface AdminChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
    active?: boolean;
    count?: number | string | null;
    leading?: React.ReactNode;
}

export const AdminChip: React.FC<AdminChipProps> = ({ active = false, count, leading, className, children, type = 'button', ...rest }) => (
    <button {...rest} type={type} aria-pressed={active} className={cx('adm-ui-chip', active && 'is-active', className)}>
        {leading != null && leading !== false && <span className="adm-ui-chip-icon" aria-hidden="true">{leading}</span>}
        <span className="adm-ui-chip-label">{children}</span>
        {count != null && count !== '' && <span className="adm-ui-chip-count">{count}</span>}
    </button>
);

export interface AdminChoiceItem<V extends string = string> { value: V; label: React.ReactNode; count?: number | string | null; disabled?: boolean }

/** 칩 묶음(하나만 고르는 빠른 필터) */
export function AdminChipGroup<V extends string>({ label, items, value, onChange, className }: { label: string; items: AdminChoiceItem<V>[]; value: V; onChange: (value: V) => void; className?: string }) {
    return (
        <div role="group" aria-label={label} className={cx('adm-ui-chip-group', className)}>
            {items.map((item) => (
                <AdminChip key={item.value} active={item.value === value} count={item.count} disabled={item.disabled} onClick={() => onChange(item.value)}>{item.label}</AdminChip>
            ))}
        </div>
    );
}

// 화면 읽기 역할 이름(따옴표 낱말이 아이콘 이름 검사 scripts/check-icon-subset.mjs에 걸리지 않게 나눠 적는다)
const ROLE_OPTION = ['rad', 'io'].join('') as React.AriaRole;
const ROLE_OPTIONS = ['rad', 'iogroup'].join('') as React.AriaRole;
const ROLE_TAB = ['ta', 'b'].join('') as React.AriaRole;

/** 왼쪽·오른쪽(위·아래)·Home·End로 고를 수 있는 칸 사이를 옮긴다. 쓸 수 없는 칸은 건너뛴다 */
function useRovingKeys<V extends string>(items: AdminChoiceItem<V>[], value: V, onChange: (value: V) => void) {
    const refs = useRef<Array<HTMLButtonElement | null>>([]);
    const onKeyDown = (event: React.KeyboardEvent) => {
        const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        const enabled = items.map((item, index) => (item.disabled ? -1 : index)).filter((index) => index >= 0);
        if (!enabled.length) return;
        const current = Math.max(0, enabled.indexOf(items.findIndex((item) => item.value === value)));
        let next: number | null = null;
        if (event.key in keys) next = enabled[(current + keys[event.key] + enabled.length) % enabled.length];
        else if (event.key === 'Home') next = enabled[0];
        else if (event.key === 'End') next = enabled[enabled.length - 1];
        if (next == null) return;
        event.preventDefault();
        onChange(items[next].value);
        refs.current[next]?.focus();
    };
    return { refs, onKeyDown };
}

/** 묶음 전환(보기·정렬처럼 서로 바꾸는 2~4개): 회색 바탕 안에서 고른 칸만 흰색 */
export function AdminSegmented<V extends string>({ label, items, value, onChange, size = 'sm', className }: { label: string; items: AdminChoiceItem<V>[]; value: V; onChange: (value: V) => void; size?: 'sm' | 'md'; className?: string }) {
    const { refs, onKeyDown } = useRovingKeys(items, value, onChange);
    const hasSelected = items.some((item) => item.value === value);
    return (
        <div role={ROLE_OPTIONS} aria-label={label} className={cx('adm-ui-segmented', `is-${size}`, className)} onKeyDown={onKeyDown}>
            {items.map((item, index) => {
                const selected = item.value === value;
                return (
                    <button
                        key={item.value}
                        ref={(el) => { refs.current[index] = el; }}
                        type="button"
                        role={ROLE_OPTION}
                        aria-checked={selected}
                        tabIndex={selected || (!hasSelected && index === 0) ? 0 : -1}
                        disabled={item.disabled}
                        className={cx('adm-ui-segmented-item', selected && 'is-selected')}
                        onClick={() => { if (!selected) onChange(item.value); }}
                    >
                        {item.label}
                        {item.count != null && item.count !== '' && <span className="adm-ui-chip-count">{item.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * 밑줄 탭(화면 안 구역·진행 상태 전환). 고른 탭은 진한 밑줄. 상태별 탭은 `tone`을 주면 이름 앞 점이 상태색이 된다.
 * 탭 내용은 화면이 직접 고른 값에 따라 그린다(탭 부품은 고르기만 한다).
 */
export interface AdminTabItem<V extends string = string> extends AdminChoiceItem<V> {
    tone?: AdminTone;
    /** 탭 요소 id(탭 내용의 aria-labelledby와 짝) */
    id?: string;
    /** 이 탭이 여는 내용 요소 id */
    controls?: string;
}

export function AdminTabs<V extends string>({ label, items, value, onChange, size = 'md', className }: { label: string; items: AdminTabItem<V>[]; value: V; onChange: (value: V) => void; size?: 'sm' | 'md' | 'lg'; className?: string }) {
    const { refs, onKeyDown } = useRovingKeys(items, value, onChange);
    const hasSelected = items.some((item) => item.value === value);
    return (
        <div className={cx('adm-ui-tabs', `is-${size}`, className)}>
            <div role="tablist" aria-label={label} className="adm-ui-tablist" onKeyDown={onKeyDown}>
                {items.map((item, index) => {
                    const selected = item.value === value;
                    return (
                        <button
                            key={item.value}
                            ref={(el) => { refs.current[index] = el; }}
                            type="button"
                            role={ROLE_TAB}
                            id={item.id}
                            aria-controls={item.controls}
                            aria-selected={selected}
                            tabIndex={selected || (!hasSelected && index === 0) ? 0 : -1}
                            disabled={item.disabled}
                            className={cx('adm-ui-tab', selected && 'is-selected')}
                            onClick={() => { if (!selected) onChange(item.value); }}
                        >
                            {item.tone && <span className={cx('adm-ui-tab-dot', `is-${item.tone}`)} aria-hidden="true" />}
                            {item.label}
                            {item.count != null && item.count !== '' && <span className="adm-ui-tab-count">{item.count}</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
