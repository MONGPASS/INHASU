import React from 'react';
import { Link } from 'react-router-dom';
import { Button, IconButton, TextButton } from '@montage-ui/core';
import { cx, MONTAGE_SIZE, type AdminSize } from './adminUiUtils';
import './admin-components.css';

/**
 * 관리자 버튼 세 가지. 화면 파일은 Montage를 직접 쓰지 않고 이 부품만 쓴다(docs/admin-design-system.md 3절).
 * - AdminButton: 주요(민트 채움 + --adm-on-primary 글자) · 보조(흰 바탕 테두리) · 약한(회색) · 위험(빨강). 화면당 주요 하나.
 * - AdminIconButton: 아이콘만 있는 버튼. 이름(label)은 꼭 준다(화면 읽기·툴팁).
 * - AdminTextButton: 글자 버튼(더 보기·목록으로 같은 가벼운 이동).
 * `to`를 주면 같은 모양의 링크(react-router Link)가 된다.
 */
export type AdminButtonVariant = 'primary' | 'secondary' | 'weak' | 'danger';

type NativeButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'>;

export interface AdminButtonProps extends NativeButtonProps {
    variant?: AdminButtonVariant;
    /** sm 32 · md 40 · lg 48(휴대폰 36 · 44 · 48) */
    size?: AdminSize;
    loading?: boolean;
    fullWidth?: boolean;
    /** 글자 앞 아이콘 */
    leading?: React.ReactNode;
    /** 글자 뒤 아이콘 */
    trailing?: React.ReactNode;
    /** 주면 링크로 그린다(화면 이동) */
    to?: string;
    replace?: boolean;
}

const MONTAGE_VARIANT: Record<AdminButtonVariant, { variant: 'solid' | 'outlined'; color: 'primary' | 'assistive' | 'negative' }> = {
    primary: { variant: 'solid', color: 'primary' },
    secondary: { variant: 'outlined', color: 'assistive' },
    weak: { variant: 'solid', color: 'assistive' },
    danger: { variant: 'solid', color: 'negative' },
};

const linkOrButton = (to: string | undefined, replace: boolean | undefined, type: NativeButtonProps['type']) =>
    (to ? { as: Link, to, replace } : { type: type ?? 'button' }) as Record<string, unknown>;

export const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(function AdminButton(
    { variant = 'secondary', size = 'md', loading = false, fullWidth = false, leading, trailing, to, replace, type, className, children, onClick, ...rest }, ref,
) {
    const m = MONTAGE_VARIANT[variant];
    // 저장 중: Montage loading은 글자를 감추므로 쓰지 않는다. 글자(‘저장 중…’)를 그대로 보이고 앞에 작은 회전 표시,
    // 누르기·제출을 막는다(onClick 떼기 + type=button + CSS pointer-events). disabled·aria-disabled는 Montage가 회색으로 바꾸므로 쓰지 않는다.
    return (
        <Button
            ref={ref}
            {...linkOrButton(to, replace, loading ? 'button' : type)}
            {...rest}
            onClick={loading ? undefined : onClick}
            aria-busy={loading || undefined}
            variant={m.variant}
            color={m.color}
            size={MONTAGE_SIZE[size]}
            fullWidth={fullWidth}
            leadingContent={loading ? <span className="adm-ui-btn-spinner" aria-hidden="true" /> : leading}
            trailingContent={trailing}
            // 민트 채움 위 글자·아이콘은 --adm-on-primary(흰 글자 대비 1.5:1 금지, tests/admin-design-tokens.test.mjs)
            className={cx('adm-ui-btn', `is-${variant}`, `is-${size}`, variant === 'primary' && 'adm-on-primary', loading && 'is-loading', className)}
        >
            {children}
        </Button>
    );
});

export interface AdminIconButtonProps extends NativeButtonProps {
    /** 화면 읽기·툴팁용 이름(필수) */
    label: string;
    /** normal 바탕 없음 · outlined 테두리 · background 회색 바탕 */
    variant?: 'normal' | 'outlined' | 'background';
    size?: AdminSize;
    to?: string;
    children: React.ReactNode;
}

const ICON_SIZE = { sm: 'small', md: 'medium', lg: 'large' } as const;

export const AdminIconButton = React.forwardRef<HTMLButtonElement, AdminIconButtonProps>(function AdminIconButton(
    { label, variant = 'normal', size = 'md', to, type, title, className, children, ...rest }, ref,
) {
    return (
        <IconButton
            ref={ref}
            {...linkOrButton(to, undefined, type)}
            {...rest}
            aria-label={label}
            title={title ?? label}
            variant={variant}
            size={ICON_SIZE[size]}
            className={cx('adm-ui-icon-btn', `is-${size}`, className)}
        >
            {children}
        </IconButton>
    );
});

export interface AdminTextButtonProps extends NativeButtonProps {
    /** primary 민트 글자 · assistive 회색 글자 */
    tone?: 'primary' | 'assistive';
    size?: 'sm' | 'md';
    loading?: boolean;
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
    to?: string;
}

export const AdminTextButton = React.forwardRef<HTMLButtonElement, AdminTextButtonProps>(function AdminTextButton(
    { tone = 'primary', size = 'md', loading = false, leading, trailing, to, type, className, children, ...rest }, ref,
) {
    return (
        <TextButton
            ref={ref}
            {...linkOrButton(to, undefined, type)}
            {...rest}
            color={tone}
            size={size === 'sm' ? 'small' : 'medium'}
            loading={loading}
            leadingContent={leading}
            trailingContent={trailing}
            className={cx('adm-ui-text-btn', className)}
        >
            {children}
        </TextButton>
    );
});
