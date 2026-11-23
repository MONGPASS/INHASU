import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { cx, type AdminSize } from './adminUiUtils';
import './admin-components.css';

/**
 * 관리자 버튼 세 가지. 당근 Seed BoxButton·TextButton 모양을 우리 변수(--adm-*)로 직접 그린다
 * (설계: docs/seed-design/components/actions/, 규칙: docs/admin-design-system.md 3절).
 * - AdminButton: 주요(민트 채움 + --adm-on-primary 글자) · 보조(흰 바탕 테두리) · 약한(회색) · 위험(빨강). 화면당 주요 하나.
 * - AdminIconButton: 아이콘만 있는 버튼. 이름(label)은 꼭 준다(화면 읽기·툴팁).
 * - AdminTextButton: 글자 버튼(더 보기·목록으로 같은 가벼운 이동).
 * `to`를 주면 같은 모양의 링크(react-router Link)가 된다.
 */
export type AdminButtonVariant = 'primary' | 'secondary' | 'weak' | 'danger';

type NativeButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'>;

export interface AdminButtonProps extends NativeButtonProps {
    variant?: AdminButtonVariant;
    /** sm 32 · md 40 · lg 48(휴대폰 40 · 48 · 52) */
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

type ClickableProps = NativeButtonProps & { to?: string; replace?: boolean };

/** to가 있으면 Link, 없으면 <button>. 링크에서는 disabled 대신 aria-disabled + 누르기 막기 */
const Clickable = React.forwardRef<HTMLButtonElement, ClickableProps>(function Clickable({ to, replace, type, disabled, onClick, ...rest }, ref) {
    if (to) {
        const anchorProps = rest as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>;
        return (
            <Link
                ref={ref as unknown as React.Ref<HTMLAnchorElement>}
                to={to}
                replace={replace}
                {...anchorProps}
                aria-disabled={disabled || undefined}
                tabIndex={disabled ? -1 : anchorProps.tabIndex}
                onClick={(event) => {
                    if (disabled) { event.preventDefault(); return; }
                    (onClick as unknown as React.MouseEventHandler<HTMLAnchorElement> | undefined)?.(event);
                }}
            />
        );
    }
    return <button ref={ref} type={type ?? 'button'} disabled={disabled} onClick={onClick} {...rest} />;
});

export const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(function AdminButton(
    { variant = 'secondary', size = 'md', loading = false, fullWidth = false, leading, trailing, to, replace, type, className, children, onClick, ...rest }, ref,
) {
    // 저장 중: 글자(‘저장 중…’)를 그대로 보이고 앞에 작은 회전 표시. 누르기·제출을 막는다(onClick 떼기 + type=button + CSS pointer-events).
    // disabled는 회색으로 바뀌므로 쓰지 않는다.
    const lead = loading ? <span className="adm-ui-btn-spinner" aria-hidden="true" /> : leading;
    return (
        <Clickable
            ref={ref}
            to={to}
            replace={replace}
            type={loading ? 'button' : type}
            {...rest}
            onClick={loading ? undefined : onClick}
            aria-busy={loading || undefined}
            // 민트 채움 위 글자·아이콘은 --adm-on-primary(흰 글자 대비 1.9:1 금지, tests/admin-design-tokens.test.mjs)
            className={cx('adm-ui-btn', `is-${variant}`, `is-${size}`, variant === 'primary' && 'adm-on-primary', fullWidth && 'is-full', loading && 'is-loading', className)}
        >
            {lead != null && lead !== false && <span className="adm-ui-btn-icon">{lead}</span>}
            {children != null && children !== false && <span className="adm-ui-btn-label">{children}</span>}
            {trailing != null && trailing !== false && <span className="adm-ui-btn-icon">{trailing}</span>}
        </Clickable>
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

export const AdminIconButton = React.forwardRef<HTMLButtonElement, AdminIconButtonProps>(function AdminIconButton(
    { label, variant = 'normal', size = 'md', to, title, className, children, ...rest }, ref,
) {
    return (
        <Clickable
            ref={ref}
            to={to}
            {...rest}
            aria-label={label}
            title={title ?? label}
            className={cx('adm-ui-icon-btn', `is-${variant}`, `is-${size}`, className)}
        >
            {children}
        </Clickable>
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
    { tone = 'primary', size = 'md', loading = false, leading, trailing, to, type, className, children, onClick, ...rest }, ref,
) {
    const lead = loading ? <span className="adm-ui-btn-spinner" aria-hidden="true" /> : leading;
    return (
        <Clickable
            ref={ref}
            to={to}
            type={loading ? 'button' : type}
            {...rest}
            onClick={loading ? undefined : onClick}
            aria-busy={loading || undefined}
            className={cx('adm-ui-text-btn', `is-${tone}`, `is-${size}`, loading && 'is-loading', className)}
        >
            {lead != null && lead !== false && <span className="adm-ui-btn-icon">{lead}</span>}
            <span>{children}</span>
            {trailing != null && trailing !== false && <span className="adm-ui-btn-icon">{trailing}</span>}
        </Clickable>
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
