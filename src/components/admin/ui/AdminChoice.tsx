import React from 'react';
import { Chip, SegmentedControl, SegmentedControlItem, Tab, TabList, TabListItem } from '@montage-ui/core';
import { Badge } from '@seed-design/react';
import { cx } from './adminUiUtils';
import './admin-seed.css';
import './admin-components.css';

/**
 * 상태 배지: 모서리 6px, 12px 600, 옅은 상태색 바탕 + 상태색 글자. 색만으로 알리지 않도록 글자(문장)를 꼭 넣는다.
 * 상태색 뜻: danger 삭제·오류·미처리 · warn 주의·대기 · success 완료 · info 안내·진행(민트 글자) · neutral 보류·종료.
 * 사람·출처처럼 구분만 하는 색은 tag-*(Montage accent).
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
    'aria-label'?: string;
    role?: 'status';
}

export const AdminBadge: React.FC<AdminBadgeProps> = ({ tone = 'neutral', strong, outlined, size = 'sm', icon, className, title, children, ...attributes }) => (
    <Badge.Root
        {...attributes}
        data-admin-seed="badge"
        data-seed-color-mode="light-only"
        variant={outlined ? 'outline' : strong ? 'solid' : 'weak'}
        size={size === 'sm' ? 'medium' : 'large'}
        title={title}
        className={cx('adm-ui-badge', `is-${tone}`, strong && 'is-strong', outlined && 'is-outlined', className)}
    >
        {icon && <Badge.Prefix>{icon}</Badge.Prefix>}
        <Badge.Label>{children}</Badge.Label>
    </Badge.Root>
);

/** 필터 칩: 높이 32·테두리 없음, 고르면 옅은 민트 바탕 + 민트 글자. 숫자는 `count`로 */
export interface AdminChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
    active?: boolean;
    count?: number | string | null;
    leading?: React.ReactNode;
}

export const AdminChip: React.FC<AdminChipProps> = ({ active = false, count, leading, className, children, type = 'button', ...rest }) => (
    <Chip
        {...rest}
        type={type}
        size="small"
        variant="solid"
        active={active}
        aria-pressed={active}
        leadingContent={leading}
        className={cx('adm-ui-chip', className)}
    >
        {children}
        {count != null && count !== '' && <span className="adm-ui-chip-count">{count}</span>}
    </Chip>
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

/** 묶음 전환(보기·정렬처럼 서로 바꾸는 2~4개): 회색 바탕 안에서 고른 칸만 흰색 */
export function AdminSegmented<V extends string>({ label, items, value, onChange, size = 'sm', className }: { label: string; items: AdminChoiceItem<V>[]; value: V; onChange: (value: V) => void; size?: 'sm' | 'md'; className?: string }) {
    return (
        <SegmentedControl
            aria-label={label}
            size={size === 'sm' ? 'small' : 'medium'}
            value={value}
            onValueChange={(next) => onChange(next as V)}
            className={cx('adm-ui-segmented', className)}
        >
            {items.map((item) => <SegmentedControlItem key={item.value} value={item.value} disabled={item.disabled}>{item.label}</SegmentedControlItem>)}
        </SegmentedControl>
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
    return (
        <div className={cx('adm-ui-tabs', className)}>
            <Tab value={value} onValueChange={(next) => onChange(next as V)}>
                <TabList size={size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'medium'} aria-label={label}>
                    {items.map((item) => (
                        <TabListItem key={item.value} value={item.value} disabled={item.disabled} id={item.id} aria-controls={item.controls}>
                            {item.tone && <span className={cx('adm-ui-tab-dot', `is-${item.tone}`)} aria-hidden="true" />}
                            {item.label}
                            {item.count != null && item.count !== '' && <span className="adm-ui-tab-count">{item.count}</span>}
                        </TabListItem>
                    ))}
                </TabList>
            </Tab>
        </div>
    );
}
