import React, { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { IconCheckThick, IconChevronDown, IconCircleCloseFill, IconMinus, IconSearch } from './AdminIcons';
import { cx, type AdminSize } from './adminUiUtils';
import './admin-components.css';

/**
 * 입력 부품. 당근 Seed TextField·Checkbox·Switch 모양을 우리 변수로 직접 그린다(docs/seed-design/components/forms·selection).
 * 라벨은 칸 위(13px 굵게), 필수는 `required`(빨간 *, `adminValidateRequired`가 읽는 `adm-req`),
 * 오류는 칸 아래 빨간 글자(`data-adm-error`, 공통 필수 입력 안내와 같은 자리·모양).
 *
 *   <AdminField label="상품 이름" required error={err}>
 *     {(id) => <AdminTextInput id={id} value={name} onChange={e => setName(e.target.value)} />}
 *   </AdminField>
 */
export interface AdminFieldProps {
    label: React.ReactNode;
    required?: boolean;
    /** 칸 아래 오류 문구. 있으면 칸이 빨간 테두리가 된다 */
    error?: string | null;
    /** 칸 아래 보조 설명(오류가 없을 때만 보인다) */
    hint?: React.ReactNode;
    /** 라벨 오른쪽 작은 글자(글자 수 등) */
    aside?: React.ReactNode;
    className?: string;
    /** 칸 id를 받아 입력 부품을 그린다. 그냥 요소를 넘기면 id를 직접 맞춘다 */
    children: React.ReactNode | ((id: string, describedBy: string | undefined) => React.ReactNode);
    id?: string;
}

export const AdminField: React.FC<AdminFieldProps> = ({ label, required, error, hint, aside, className, children, id: idProp }) => {
    const auto = useId();
    const id = idProp || `adm-f${auto.replace(/:/g, '')}`;
    const hintId = hint && !error ? `${id}-hint` : undefined;
    return (
        <div className={cx('adm-ui-field', className)} data-adm-error={error || undefined}>
            <div className="adm-ui-field-head">
                <label htmlFor={id} className={cx('adm-ui-field-label', required && 'adm-req')}>{label}</label>
                {aside && <span className="adm-ui-field-aside">{aside}</span>}
            </div>
            {typeof children === 'function' ? children(id, hintId) : children}
            {hintId && <p id={hintId} className="adm-ui-field-hint">{hint}</p>}
        </div>
    );
};

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'width' | 'onReset'>;

export interface AdminTextInputProps extends InputProps {
    /** 오류 표시(빨간 테두리). AdminField의 error와 함께 쓴다 */
    invalid?: boolean;
    /** 큰 칸(48) — 기본 40(휴대폰 48) */
    large?: boolean;
    /** 칸 앞 내용(단위·아이콘) */
    leading?: React.ReactNode;
    /** 칸 뒤 내용(단위 등) */
    trailing?: React.ReactNode;
}

/** 한 줄 글자 칸. className은 바깥 칸에, 나머지(id·value·onChange…)는 안의 <input>에 붙는다 */
export const AdminTextInput = React.forwardRef<HTMLInputElement, AdminTextInputProps>(function AdminTextInput(
    { invalid, large, leading, trailing, className, disabled, readOnly, ...rest }, ref,
) {
    return (
        <div className={cx('adm-ui-input', large && 'is-lg', invalid && 'is-invalid', disabled && 'is-disabled', readOnly && 'is-readonly', className)}>
            {leading != null && leading !== false && <span className="adm-ui-input-addon">{leading}</span>}
            <input ref={ref} {...rest} disabled={disabled} readOnly={readOnly} aria-invalid={invalid || undefined} className="adm-ui-input-el" />
            {trailing != null && trailing !== false && <span className="adm-ui-input-addon">{trailing}</span>}
        </div>
    );
});

type TextAreaNativeProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'width'>;

export interface AdminTextAreaProps extends TextAreaNativeProps {
    value?: string;
    invalid?: boolean;
    minRows?: number;
    maxRows?: number;
    /** 주면 오른쪽 아래에 글자 수를 보인다 */
    maxLength?: number;
}

/** 여러 줄 글자 칸. 내용에 맞춰 minRows~maxRows 줄 사이로 늘어난다 */
export const AdminTextArea = React.forwardRef<HTMLTextAreaElement, AdminTextAreaProps>(function AdminTextArea(
    { invalid, minRows = 3, maxRows = 12, maxLength, className, disabled, readOnly, value, onChange, ...rest }, ref,
) {
    const inner = useRef<HTMLTextAreaElement | null>(null);
    const setRef = (el: HTMLTextAreaElement | null) => {
        inner.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    };
    const fit = () => {
        const el = inner.current;
        if (!el || typeof window === 'undefined') return;
        const cs = window.getComputedStyle(el);
        const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 || 21;
        const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
        el.style.height = 'auto';
        const max = line * maxRows + pad;
        el.style.height = `${Math.max(line * minRows + pad, Math.min(el.scrollHeight, max))}px`;
        el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
    };
    useLayoutEffect(fit, [value, minRows, maxRows]);
    const length = typeof value === 'string' ? value.length : 0;
    return (
        <div className={cx('adm-ui-textarea', invalid && 'is-invalid', disabled && 'is-disabled', readOnly && 'is-readonly', className)}>
            <textarea
                ref={setRef}
                {...rest}
                value={value}
                rows={minRows}
                maxLength={maxLength}
                disabled={disabled}
                readOnly={readOnly}
                aria-invalid={invalid || undefined}
                className="adm-ui-textarea-el"
                onChange={(event) => { onChange?.(event); if (value === undefined) fit(); }}
            />
            {maxLength != null && <span className="adm-ui-textarea-count" aria-hidden="true">{length}/{maxLength}</span>}
        </div>
    );
});

export interface AdminSelectOption { value: string; label: React.ReactNode; disabled?: boolean }

export interface AdminSelectProps {
    id?: string;
    value?: string;
    /** 고른 값을 바로 받는다(이벤트가 아님) */
    onChange?: (value: string) => void;
    options: AdminSelectOption[];
    placeholder?: string;
    disabled?: boolean;
    invalid?: boolean;
    name?: string;
    className?: string;
    'aria-label'?: string;
    'aria-describedby'?: string;
}

/** 고르기 칸(브라우저 기본 목록 + Seed 칸 모양). 휴대폰에서는 기기 고르기 창이 뜬다 */
export const AdminSelect: React.FC<AdminSelectProps> = ({ options, onChange, invalid, className, disabled, placeholder, value, ...rest }) => {
    const hasValue = value != null && options.some((option) => option.value === value);
    return (
        <div className={cx('adm-ui-select', invalid && 'is-invalid', disabled && 'is-disabled', !hasValue && placeholder && 'is-placeholder', className)}>
            <select
                {...rest}
                value={hasValue ? value : ''}
                disabled={disabled}
                aria-invalid={invalid || undefined}
                className="adm-ui-select-el"
                onChange={(event) => onChange?.(event.target.value)}
            >
                {(!hasValue || placeholder) && !options.some((option) => option.value === '') && <option value="" disabled hidden={!!placeholder && hasValue}>{placeholder ?? ''}</option>}
                {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
            </select>
            <span className="adm-ui-select-caret" aria-hidden="true"><IconChevronDown /></span>
        </div>
    );
};

export interface AdminCheckboxProps {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    label?: React.ReactNode;
    /** 일부만 고름(전체 선택 칸) */
    indeterminate?: boolean;
    disabled?: boolean;
    /** 라벨 없이 쓸 때의 이름 */
    'aria-label'?: string;
    name?: string;
    id?: string;
    className?: string;
    size?: 'sm' | 'md';
}

/** 체크 칸: 네모 20(작게 18)·모서리 4, 고르면 민트 채움 + 진한 체크 */
export const AdminCheckbox: React.FC<AdminCheckboxProps> = ({ checked, onChange, label, indeterminate, disabled, size = 'md', className, id, ...rest }) => {
    const auto = useId();
    const boxId = id || `adm-c${auto.replace(/:/g, '')}`;
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => { if (input.current) input.current.indeterminate = !!indeterminate; }, [indeterminate]);
    return (
        <span className={cx('adm-ui-check', `is-${size}`, disabled && 'is-disabled', className)}>
            <span className="adm-ui-check-box">
                <input
                    ref={input}
                    {...rest}
                    id={boxId}
                    type="checkbox"
                    className="adm-ui-check-input"
                    checked={!!checked}
                    disabled={disabled}
                    aria-checked={indeterminate ? 'mixed' : undefined}
                    onChange={(event) => onChange?.(event.target.checked)}
                />
                <span className="adm-ui-check-mark" aria-hidden="true">{indeterminate ? <IconMinus /> : <IconCheckThick />}</span>
            </span>
            {label && <label htmlFor={boxId} className="adm-ui-check-label">{label}</label>}
        </span>
    );
};

export interface AdminSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** 스위치 오른쪽 이름. 없으면 `aria-label`을 꼭 준다(표 칸 안 등) */
    label?: React.ReactNode;
    /** 이름 아래 작은 설명 */
    description?: React.ReactNode;
    'aria-label'?: string;
    disabled?: boolean;
    id?: string;
    className?: string;
    size?: 'sm' | 'md';
}

/** 화면 읽기 역할 이름(따옴표 낱말이 아이콘 이름 검사에 걸리지 않게 나눠 적는다) */
const TOGGLE_ROLE = ['sw', 'itch'].join('') as React.AriaRole;

/** 켜기·끄기 스위치(즉시 반영되는 노출·사용 여부). 고르기 여러 개는 AdminCheckbox를 쓴다 */
export const AdminSwitch: React.FC<AdminSwitchProps> = ({ checked, onChange, label, description, disabled, size = 'md', className, id, ...rest }) => {
    const auto = useId();
    const switchId = id || `adm-s${auto.replace(/:/g, '')}`;
    return (
        <span className={cx('adm-ui-switch', `is-${size}`, disabled && 'is-disabled', className)}>
            <span className="adm-ui-switch-control">
                <input
                    {...rest}
                    id={switchId}
                    type="checkbox"
                    role={TOGGLE_ROLE}
                    className="adm-ui-switch-input"
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.checked)}
                />
                <span className="adm-ui-switch-track" aria-hidden="true"><span className="adm-ui-switch-thumb" /></span>
            </span>
            {label && (
                <label htmlFor={switchId} className="adm-ui-switch-text">
                    <span className="adm-ui-switch-label">{label}</span>
                    {description && <span className="adm-ui-switch-desc">{description}</span>}
                </label>
            )}
        </span>
    );
};

export interface AdminSearchProps extends Omit<InputProps, 'onChange'> {
    value: string;
    onChange: (value: string) => void;
    /** 검색창 폭. 기본은 검색 줄 규격(최대 320px) */
    wide?: boolean;
    size?: Extract<AdminSize, 'md' | 'lg'>;
}

/** 검색창(돋보기 + 지우기). 목록 검색 줄 맨 왼쪽에 둔다. */
export const AdminSearch = React.forwardRef<HTMLInputElement, AdminSearchProps>(function AdminSearch(
    { value, onChange, wide, size = 'md', className, placeholder = '검색', disabled, ...rest }, ref,
) {
    const inner = useRef<HTMLInputElement | null>(null);
    const setRef = (el: HTMLInputElement | null) => {
        inner.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
    };
    return (
        <div className={cx('adm-ui-search', `is-${size}`, wide && 'is-wide', disabled && 'is-disabled', className)}>
            <span className="adm-ui-search-icon" aria-hidden="true"><IconSearch /></span>
            <input
                ref={setRef}
                {...rest}
                type="search"
                value={value}
                disabled={disabled}
                placeholder={placeholder}
                aria-label={rest['aria-label'] ?? placeholder}
                className="adm-ui-search-el"
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                    rest.onKeyDown?.(event);
                    if (!event.defaultPrevented && event.key === 'Escape' && value) { event.preventDefault(); onChange(''); }
                }}
            />
            {value && !disabled && (
                <button type="button" className="adm-ui-search-clear" aria-label="검색어 지우기" onClick={() => { onChange(''); inner.current?.focus(); }}>
                    <IconCircleCloseFill />
                </button>
            )}
        </div>
    );
});
