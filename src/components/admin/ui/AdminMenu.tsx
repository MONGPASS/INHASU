import React, { useState } from 'react';
import { Menu, MenuContent, MenuItem, MenuList, MenuTrigger } from '@montage-ui/core';
import { cx } from './adminUiUtils';
import './admin-components.css';

/**
 * 버튼을 누르면 뜨는 고르기 메뉴(Montage Menu). 항목은 이름 + 설명 한 줄.
 * 예: 통합 예약 목록의 ‘Excel 내보내기’ 범위(지금 보이는 목록 · 선택한 예약 · 전체 확정 팀).
 * 트리거는 우리 버튼(`AdminButton` 등)을 그대로 넘긴다.
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

export const AdminMenu: React.FC<AdminMenuProps> = ({ label, trigger, items, heading, className }) => {
    // Montage Menu는 열림을 스스로 들고 있다. 항목을 고른 뒤 닫으려고 열림을 key로 다시 그린다.
    const [round, setRound] = useState(0);
    return (
        <Menu key={round}>
            <MenuTrigger>{trigger}</MenuTrigger>
            <MenuContent position="bottom-end">
                <div className={cx('adm-ui-menu', className)} aria-label={label}>
                    {heading && <p className="adm-ui-menu-heading">{heading}</p>}
                    <MenuList>
                        {items.map((item) => (
                            <MenuItem
                                key={item.key}
                                value={item.key}
                                disabled={item.disabled}
                                className="adm-ui-menu-item"
                                textProps={item.description ? { description: item.description } : undefined}
                                onClick={() => { if (item.disabled) return; setRound((n) => n + 1); item.onSelect(); }}
                            >
                                {item.label}
                            </MenuItem>
                        ))}
                    </MenuList>
                </div>
            </MenuContent>
        </Menu>
    );
};
