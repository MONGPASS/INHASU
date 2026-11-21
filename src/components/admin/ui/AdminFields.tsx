import React, { useId } from 'react';
import { Checkbox, Option, SearchField, Select, Switch, TextArea, TextField } from '@montage-ui/core';
import { cx, type AdminSize } from './adminUiUtils';
import './admin-components.css';

/**
 * 입력 부품. 라벨은 칸 위(13px 600), 필수는 `required`(빨간 *, `adminValidateRequired`가 읽는 `adm-req`),
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
    /** 큰 칸(48) — 기본 40(휴대폰 44) */
    large?: boolean;
    /** 칸 앞 내용(단위·아이콘) */
    leading?: React.ReactNode;
    /** 칸 뒤 내용(단위 등) */
    trailing?: React.ReactNode;
}

export const AdminTextInput = React.forwardRef<HTMLInputElement, AdminTextInputProps>(function AdminTextInput(
    { invalid, large, leading, trailing, className, ...rest }, ref,
) {
    return (
        <TextField
            ref={ref}
            {...rest}
            aria-invalid={invalid || undefined}
            status={invalid ? 'negative' : 'normal'}
            size={large ? 'large' : 'medium'}
            leadingContent={leading}
            trailingContent={trailing}
            className={cx('adm-ui-input', className)}
        />
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

export const AdminTextArea = React.forwardRef<HTMLTextAreaElement, AdminTextAreaProps>(function AdminTextArea(
    { invalid, minRows = 3, maxRows = 12, className, ...rest }, ref,
) {
    return (
        <TextArea
            ref={ref}
            {...rest}
            aria-invalid={invalid || undefined}
            minRows={minRows}
            maxRows={maxRows}
            className={cx('adm-ui-textarea', invalid && 'is-invalid', className)}
        />
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

export const AdminSelect: React.FC<AdminSelectProps> = ({ options, onChange, invalid, className, ...rest }) => (
    <Select
        {...rest}
        onChange={(value) => onChange?.(value)}
        aria-invalid={invalid || undefined}
        className={cx('adm-ui-select', invalid && 'is-invalid', className)}
    >
        {options.map((option) => <Option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</Option>)}
    </Select>
);

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

export const AdminCheckbox: React.FC<AdminCheckboxProps> = ({ checked, onChange, label, indeterminate, disabled, size = 'md', className, id, ...rest }) => {
    const auto = useId();
    const boxId = id || `adm-c${auto.replace(/:/g, '')}`;
    const box = (
        <Checkbox
            {...rest}
            id={boxId}
            checked={checked}
            indeterminate={indeterminate}
            disabled={disabled}
            size={size === 'sm' ? 'small' : 'medium'}
            tight
            onCheckedChange={(state) => onChange?.(state)}
        />
    );
    if (!label) return <span className={cx('adm-ui-check', className)}>{box}</span>;
    return (
        <span className={cx('adm-ui-check', disabled && 'is-disabled', className)}>
            {box}
            <label htmlFor={boxId} className="adm-ui-check-label">{label}</label>
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

/** 켜기·끄기 스위치(즉시 반영되는 노출·사용 여부). 고르기 여러 개는 AdminCheckbox를 쓴다 */
export const AdminSwitch: React.FC<AdminSwitchProps> = ({ checked, onChange, label, description, disabled, size = 'md', className, id, ...rest }) => {
    const auto = useId();
    const switchId = id || `adm-s${auto.replace(/:/g, '')}`;
    const control = (
        <Switch
            {...rest}
            id={switchId}
            checked={checked}
            disabled={disabled}
            size={size === 'sm' ? 'small' : 'medium'}
            onCheckedChange={(state) => onChange(state)}
        />
    );
    if (!label) return <span className={cx('adm-ui-switch', className)}>{control}</span>;
    return (
        <span className={cx('adm-ui-switch', disabled && 'is-disabled', className)}>
            {control}
            <label htmlFor={switchId} className="adm-ui-switch-text">
                <span className="adm-ui-switch-label">{label}</span>
                {description && <span className="adm-ui-switch-desc">{description}</span>}
            </label>
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
    { value, onChange, wide, size = 'md', className, placeholder = '검색', ...rest }, ref,
) {
    return (
        <SearchField
            ref={ref}
            {...rest}
            type="search"
            value={value}
            placeholder={placeholder}
            aria-label={rest['aria-label'] ?? placeholder}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
            onReset={() => onChange('')}
            size={size === 'lg' ? 'large' : 'medium'}
            className={cx('adm-ui-search', wide && 'is-wide', className)}
        />
    );
});
