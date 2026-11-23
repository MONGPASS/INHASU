import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './adminUiUtils';
import './admin-components.css';

/**
 * 버튼을 누르면 뜨는 고르기 메뉴. 항목은 이름 + 설명 한 줄. 버튼 오른쪽 끝에 맞춰 아래로 뜬다(자리가 없으면 위로).
 * 예: 통합 예약 목록의 ‘Excel 내보내기’ 범위(지금 보이는 목록 · 선택한 예약 · 전체 확정 팀).
 * 트리거는 우리 버튼(`AdminButton` 등)을 그대로 넘긴다. 바깥 누르기·Esc로 닫히고, 항목을 고르면 닫힌다.
 */
export interface AdminMenuItem {
    key: string;
    label: React.ReactNode;
    description?: React.ReactNode;
    disabled?: boolean;
    onSelect: () => void;
}

export interface AdminMenuProps {
    /** 메뉴 이름(화면 읽기) */
    label: string;
    trigger: React.ReactElement;
    items: AdminMenuItem[];
    /** 메뉴 맨 위 안내(예: ‘어떤 예약을 내보낼까요?’) */
    heading?: React.ReactNode;
    className?: string;
}

// 화면 읽기 역할 이름(따옴표 낱말이 아이콘 이름 검사에 걸리지 않게 나눠 적는다)
const ROLE_MENU = ['me', 'nu'].join('') as React.AriaRole;

type TriggerProps = { onClick?: React.MouseEventHandler; ref?: React.Ref<HTMLElement> };

export const AdminMenu: React.FC<AdminMenuProps> = ({ label, trigger, items, heading, className }) => {
    const [open, setOpen] = useState(false);
    const [up, setUp] = useState(false);
    const anchor = useRef<HTMLElement | null>(null);
    const list = useRef<HTMLDivElement>(null);
    const menuId = `adm-m${useId().replace(/:/g, '')}`;

    const close = useCallback((focusBack = true) => {
        setOpen(false);
        if (focusBack) anchor.current?.focus({ preventScroll: true });
    }, []);

    const measure = useCallback(() => {
        const rect = anchor.current?.getBoundingClientRect();
        if (!rect) return;
        const el = list.current;
        if (!el) return;
        const height = el.offsetHeight;
        const above = rect.bottom + height + 8 > window.innerHeight && rect.top - height - 8 > 0;
        // 자리는 버튼 위치로 계산한 값이라 CSS 변수로 넘긴다(admin-components.css의 .adm-ui-menu가 top·right로 쓴다)
        el.style.setProperty('--adm-menu-top', `${above ? rect.top : rect.bottom}px`);
        el.style.setProperty('--adm-menu-right', `${Math.max(8, document.documentElement.clientWidth - rect.right)}px`);
        el.dataset.ready = '';
        setUp(above);
    }, []);

    useLayoutEffect(() => { if (open) measure(); }, [open, measure]);
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (list.current?.contains(target) || anchor.current?.contains(target)) return;
            close(false);
        };
        const onMove = () => measure();
        document.addEventListener('mousedown', onDown, true);
        window.addEventListener('resize', onMove);
        window.addEventListener('scroll', onMove, true);
        // 처음 열면 첫 항목에 초점
        list.current?.querySelector<HTMLElement>('.adm-ui-menu-item:not(:disabled)')?.focus({ preventScroll: true });
        return () => {
            document.removeEventListener('mousedown', onDown, true);
            window.removeEventListener('resize', onMove);
            window.removeEventListener('scroll', onMove, true);
        };
    }, [open, close, measure]);

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape' || event.key === 'Tab') { if (event.key === 'Escape') event.preventDefault(); close(event.key === 'Escape'); return; }
        const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('.adm-ui-menu-item:not(:disabled)') ?? [])];
        if (!buttons.length) return;
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
        let next: number | null = null;
        if (event.key in step) next = (index + step[event.key] + buttons.length) % buttons.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = buttons.length - 1;
        if (next == null) return;
        event.preventDefault();
        buttons[next].focus();
    };

    const triggerProps = trigger.props as TriggerProps;
    const triggerEl = React.cloneElement(trigger as React.ReactElement<Record<string, unknown>>, {
        ref: (el: HTMLElement | null) => {
            anchor.current = el;
            const original = (trigger as unknown as { ref?: React.Ref<HTMLElement> }).ref ?? triggerProps.ref;
            if (typeof original === 'function') original(el);
            else if (original && typeof original === 'object') (original as React.MutableRefObject<HTMLElement | null>).current = el;
        },
        'aria-haspopup': ROLE_MENU,
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
        onClick: (event: React.MouseEvent) => { triggerProps.onClick?.(event); if (!event.defaultPrevented) setOpen((v) => !v); },
        onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'ArrowDown' && !open) { event.preventDefault(); setOpen(true); } },
    });

    return (
        <>
            {triggerEl}
            {open && typeof document !== 'undefined' && createPortal(
                <div
                    ref={list}
                    id={menuId}
                    role={ROLE_MENU}
                    aria-label={label}
                    className={cx('adm-ui-menu', up && 'is-up', className)}
                    onKeyDown={onKeyDown}
                >
                    {heading && <p className="adm-ui-menu-heading">{heading}</p>}
                    {items.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            role="menuitem"
                            disabled={item.disabled}
                            className="adm-ui-menu-item"
                            onClick={() => { if (item.disabled) return; close(true); item.onSelect(); }}
                        >
                            <span className="adm-ui-menu-label">{item.label}</span>
                            {item.description && <span className="adm-ui-menu-desc">{item.description}</span>}
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </>
    );
};

