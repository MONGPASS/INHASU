import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { IconButton, TextButton } from '@montage-ui/core';
import { ActionButton } from '@seed-design/react';
import { cx, type AdminSize } from './adminUiUtils';
import './admin-seed.css';
import './admin-components.css';

/**
 * 관리자 버튼 세 가지. 화면 파일은 이 부품만 쓴다(docs/admin-design-system.md 3절).
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

const SEED_VARIANT = {
    primary: 'brandSolid',
    secondary: 'neutralOutline',
    weak: 'neutralWeak',
    danger: 'criticalSolid',
} as const;

const SEED_SIZE = { sm: 'small', md: 'medium', lg: 'large' } as const;

const linkOrButton = (to: string | undefined, replace: boolean | undefined, type: NativeButtonProps['type']) =>
    (to ? { as: Link, to, replace } : { type: type ?? 'button' }) as Record<string, unknown>;

export const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(function AdminButton(
    { variant = 'secondary', size = 'md', loading = false, fullWidth = false, leading, trailing, to, replace, type, className, children, onClick, ...rest }, ref,
) {
    const content = (
        <>
            {loading ? <span className="adm-ui-btn-spinner" aria-hidden="true" /> : leading}
            {children}
            {trailing}
        </>
    );
    return (
        <ActionButton
            ref={ref}
            {...rest}
            asChild={!!to}
            type={to ? undefined : loading ? 'button' : type ?? 'button'}
            onClick={loading ? event => event.preventDefault() : onClick}
            aria-busy={loading || undefined}
            aria-disabled={loading || rest.disabled || undefined}
            data-admin-seed="button"
            data-seed-color-mode="light-only"
            variant={SEED_VARIANT[variant]}
            size={SEED_SIZE[size]}
            className={cx('adm-ui-btn', `is-${variant}`, `is-${size}`, variant === 'primary' && 'adm-on-primary', loading && 'is-loading', fullWidth && 'is-full-width', className)}
        >
            {to ? <Link to={to} replace={replace}>{content}</Link> : content}
        </ActionButton>
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

export interface AdminFileButtonProps extends Omit<AdminButtonProps, 'onClick' | 'onChange' | 'to' | 'replace' | 'type'> {
    /** 받을 파일 종류(예: image/*) */
    accept?: string;
    multiple?: boolean;
    /** 고른 파일(한 개 이상)을 넘긴다. 같은 파일을 다시 고를 수 있게 칸은 바로 비운다 */
    onFiles: (files: File[]) => unknown;
}

/** 파일 고르기 버튼. 모양은 AdminButton 그대로이고, 숨은 파일 칸을 연다 */
export const AdminFileButton: React.FC<AdminFileButtonProps> = ({ accept, multiple, onFiles, disabled, variant = 'secondary', ...rest }) => {
    const input = useRef<HTMLInputElement>(null);
    return (
        <>
            <AdminButton {...rest} variant={variant} disabled={disabled} onClick={() => input.current?.click()} />
            <input
                ref={input}
                type="file"
                className="adm-ui-file-input"
                accept={accept}
                multiple={multiple}
                disabled={disabled}
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    event.target.value = '';
                    if (files.length) void onFiles(files);
                }}
            />
        </>
    );
};
