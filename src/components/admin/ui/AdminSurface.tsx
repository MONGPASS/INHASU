import React from 'react';
import { Loading } from '@montage-ui/core';
import { IconCircleExclamationFill, IconInbox } from '@montage-ui/icon';
import { AdminButton } from './AdminButton';
import { cx } from './adminUiUtils';
import './admin-components.css';

/** 카드: 흰 바탕 + 1px 선, 모서리 16, 그림자 없음, 안 여백 20. 제목(18px)·오른쪽 행동은 선택 */
export interface AdminCardProps {
    title?: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    /** 안 여백 없이(표·탭을 카드 끝까지 붙일 때) */
    flush?: boolean;
    /** 조치가 필요한 카드(주의 테두리) */
    attention?: boolean;
    as?: 'section' | 'div' | 'article';
    className?: string;
    id?: string;
    children?: React.ReactNode;
}

export const AdminCard: React.FC<AdminCardProps> = ({ title, description, actions, flush, attention, as: Tag = 'section', className, id, children }) => (
    <Tag id={id} className={cx('adm-ui-card', flush && 'is-flush', attention && 'is-attention', className)}>
        {(title || actions) && (
            <header className="adm-ui-card-head">
                <div className="adm-ui-card-titles">
                    {title && <h2 className="adm-ui-card-title">{title}</h2>}
                    {description && <p className="adm-ui-card-desc">{description}</p>}
                </div>
                {actions && <div className="adm-ui-card-actions">{actions}</div>}
            </header>
        )}
        {children}
    </Tag>
);

/** 지표 카드: 이름 · 큰 숫자(700) · 보조 글. 처리할 일이 있으면 `attention`(채움이 아니라 주의 테두리 + 주의 아이콘). 누르면 필터가 되는 카드는 `onClick` + `active` */
export interface AdminStatProps {
    label: React.ReactNode;
    value: React.ReactNode;
    unit?: React.ReactNode;
    hint?: React.ReactNode;
    attention?: boolean;
    active?: boolean;
    onClick?: () => void;
    className?: string;
}

export const AdminStat: React.FC<AdminStatProps> = ({ label, value, unit, hint, attention, active, onClick, className }) => {
    const body = (
        <>
            <span className="adm-ui-stat-label">
                {attention && <IconCircleExclamationFill className="adm-ui-stat-icon" aria-hidden="true" />}
                {label}
            </span>
            <span className="adm-ui-stat-value">{value}{unit && <small>{unit}</small>}</span>
            {hint && <span className="adm-ui-stat-hint">{hint}</span>}
        </>
    );
    const state = cx(attention && 'is-attention', active && 'is-active', className);
    if (!onClick) return <div className={cx('adm-ui-stat', state)}>{body}</div>;
    // 누르는 지표 카드(=필터)는 공통 클래스를 단 버튼이다. 모양은 admin-components.css.
    return <button type="button" className={cx('adm-ui-stat', 'is-button', state)} aria-pressed={active} onClick={onClick}>{body}</button>;
};

/** 지표 카드 줄(넓으면 4칸, 좁으면 2칸) */
export const AdminStatRow: React.FC<{ children: React.ReactNode; label?: string; className?: string }> = ({ children, label = '요약', className }) => (
    <div role="group" aria-label={label} className={cx('adm-ui-stat-row', className)}>{children}</div>
);

/** 화면 안 알림(Montage SectionMessage 모양, `adm-msg` — 견적 도구와 같은 모양). 상태색 상자를 새로 그리지 않는다 */
export interface AdminMessageProps {
    tone?: 'info' | 'cautionary' | 'negative' | 'positive';
    title?: React.ReactNode;
    children?: React.ReactNode;
    /** 아래 글자 버튼들(첫 버튼 민트) */
    actions?: React.ReactNode;
    role?: 'status' | 'alert';
    className?: string;
}

export const AdminMessage: React.FC<AdminMessageProps> = ({ tone = 'info', title, children, actions, role, className }) => (
    <div className={cx('adm-msg', tone !== 'info' && `is-${tone}`, className)} role={role ?? (tone === 'negative' ? 'alert' : 'status')}>
        {title && <strong>{title}</strong>}
        {children && <p>{children}</p>}
        {actions && <div className="adm-msg-actions">{actions}</div>}
    </div>
);

/** 불러오는 중: 본문 자리에 회전 표시 + 글자 */
export const AdminLoading: React.FC<{ label?: string; className?: string; inline?: boolean }> = ({ label = '불러오는 중…', className, inline }) => (
    <div className={cx('adm-ui-state', 'is-loading', inline && 'is-inline', className)} role="status" aria-live="polite">
        <Loading variant="circular" size={inline ? 20 : 28} />
        <p className="adm-ui-state-text">{label}</p>
    </div>
);

/** 빈 목록: 안내 한 줄 + 첫 행동 버튼 */
export interface AdminEmptyProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
}

export const AdminEmpty: React.FC<AdminEmptyProps> = ({ title, description, action, icon, className }) => (
    <div className={cx('adm-ui-state', 'is-empty', className)}>
        <span className="adm-ui-state-icon" aria-hidden="true">{icon ?? <IconInbox />}</span>
        <p className="adm-ui-state-title">{title}</p>
        {description && <p className="adm-ui-state-text">{description}</p>}
        {action && <div className="adm-ui-state-action">{action}</div>}
    </div>
);

/** 오류: 이유 + 다시 시도. 실패해도 입력·이전 목록은 지우지 않는다(부르는 쪽 책임) */
export interface AdminErrorProps {
    title?: React.ReactNode;
    reason?: React.ReactNode;
    onRetry?: () => void;
    retrying?: boolean;
    className?: string;
}

export const AdminError: React.FC<AdminErrorProps> = ({ title = '불러오지 못했습니다', reason, onRetry, retrying, className }) => (
    <div className={cx('adm-ui-state', 'is-error', className)} role="alert">
        <span className="adm-ui-state-icon" aria-hidden="true"><IconCircleExclamationFill /></span>
        <p className="adm-ui-state-title">{title}</p>
        {reason && <p className="adm-ui-state-text">{reason}</p>}
        {onRetry && <div className="adm-ui-state-action"><AdminButton variant="secondary" loading={retrying} onClick={onRetry}>다시 시도</AdminButton></div>}
    </div>
);
