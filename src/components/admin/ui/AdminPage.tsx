import React from 'react';
import { IconCheck, IconChevronLeft } from './AdminIcons';
import { AdminLayout } from '../AdminLayout';
import { AdminButton, AdminTextButton } from './AdminButton';
import { AdminCard } from './AdminSurface';
import { cx } from './adminUiUtils';
import './admin-components.css';

/**
 * 화면 틀 4종(docs/admin-design-system.md 4절). 같은 유형이면 제목·주요 버튼·검색 조건·본문 위치가 같다.
 * 제목·설명·제목 오른쪽 버튼은 `AdminLayout`의 title·description·actions를 그대로 쓴다(화면 위 작은 라벨은 쓰지 않는다).
 */
interface FrameProps {
    activePage: string;
    title: string;
    description?: string;
    /** 제목 오른쪽(주요 행동 하나 + 보조) */
    actions?: React.ReactNode;
    showSearch?: boolean;
    /** 본문 맨 위 안내(불러오기 실패·일부 누락·초안 복원 — AdminMessage) */
    notice?: React.ReactNode;
    className?: string;
}

const Frame: React.FC<FrameProps & { kind: string; children: React.ReactNode; hideHeading?: boolean }> = ({ kind, activePage, title, description, actions, showSearch, notice, className, hideHeading, children }) => (
    <AdminLayout activePage={activePage} title={title} description={description} eyebrow={null} actions={actions} showSearch={showSearch} hideHeading={hideHeading}>
        <div className={cx('adm-ui-page', `is-${kind}`, className)}>
            {notice && <div className="adm-ui-page-notice">{notice}</div>}
            {children}
        </div>
    </AdminLayout>
);

/** 목록형: 제목 + 추가 → 요약 지표 → [탭 → 검색 줄 → 표 → 페이지](카드 하나) */
export interface ListPageProps extends FrameProps {
    /** 요약 지표 줄(AdminStatRow) */
    summary?: React.ReactNode;
    /** 카드 맨 위 밑줄 탭(AdminTabs) */
    tabs?: React.ReactNode;
    /** 검색 줄(AdminFilterBar) */
    filters?: React.ReactNode;
    /** 표 아래 페이지 이동(AdminPagination) */
    pagination?: React.ReactNode;
    children: React.ReactNode;
}

export const ListPage: React.FC<ListPageProps> = ({ summary, tabs, filters, pagination, children, ...frame }) => (
    <Frame kind="list" {...frame}>
        {summary}
        <AdminCard flush className="adm-ui-list-card">
            {tabs && <div className="adm-ui-list-tabs">{tabs}</div>}
            {filters && <div className="adm-ui-list-filters">{filters}</div>}
            <div className="adm-ui-list-body">{children}</div>
            {pagination && <div className="adm-ui-list-foot">{pagination}</div>}
        </AdminCard>
    </Frame>
);

/** 검색 줄: 왼쪽 검색창, 가운데 필터 칩·선택 상자, 오른쪽 정렬·보기 전환 */
export const AdminFilterBar: React.FC<{ search?: React.ReactNode; filters?: React.ReactNode; end?: React.ReactNode; className?: string }> = ({ search, filters, end, className }) => (
    <div className={cx('adm-ui-filterbar', className)}>
        {search && <div className="adm-ui-filterbar-search">{search}</div>}
        {filters && <div className="adm-ui-filterbar-filters">{filters}</div>}
        {end && <div className="adm-ui-filterbar-end">{end}</div>}
    </div>
);

/** 입력형: 목록으로 → 구역 카드(구역 제목 18px) → 아래 고정 막대(왼쪽 상태, 오른쪽 취소·저장). 본문 폭 960px */
export interface FormPageProps extends FrameProps {
    backTo?: string;
    backLabel?: string;
    /** 아래 막대 왼쪽(‘자동 보관됨’·‘고친 내용 있음’ 같은 상태) */
    status?: React.ReactNode;
    onCancel?: () => void;
    cancelLabel?: string;
    onSubmit?: () => void;
    submitLabel?: string;
    submitting?: boolean;
    submitDisabled?: boolean;
    children: React.ReactNode;
}

export const FormPage: React.FC<FormPageProps> = ({ backTo, backLabel = '목록으로', status, onCancel, cancelLabel = '취소', onSubmit, submitLabel = '저장', submitting = false, submitDisabled, children, ...frame }) => (
    <Frame kind="form" {...frame}>
        {backTo && <div className="adm-ui-back"><AdminTextButton to={backTo} tone="assistive" leading={<IconChevronLeft />}>{backLabel}</AdminTextButton></div>}
        <div className="adm-ui-form-sections adm-form">{children}</div>
        {(onSubmit || onCancel || status) && (
            <div className="adm-ui-form-bar" role="region" aria-label="저장">
                <div className="adm-ui-form-bar-status">{status}</div>
                <div className="adm-ui-form-bar-actions">
                    {onCancel && <AdminButton variant="secondary" disabled={submitting} onClick={onCancel}>{cancelLabel}</AdminButton>}
                    {onSubmit && <AdminButton variant="primary" loading={submitting} disabled={submitDisabled} onClick={onSubmit}>{submitting ? '저장 중…' : submitLabel}</AdminButton>}
                </div>
            </div>
        )}
    </Frame>
);

/** 입력형의 구역 카드 */
export const AdminFormSection: React.FC<{ title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; id?: string; children: React.ReactNode }> = ({ title, description, actions, id, children }) => (
    <AdminCard id={id} title={title} description={description} actions={actions} className="adm-ui-form-section">
        <div className="adm-ui-form-grid">{children}</div>
    </AdminCard>
);

/** 상세형: 머리 카드 → 진행 단계 → 왼쪽 업무 / 오른쪽 고정 정보 → 이력 */
export interface DetailPageProps extends FrameProps {
    backTo?: string;
    backLabel?: string;
    /** 머리 카드(AdminDetailHeader) */
    header: React.ReactNode;
    /** 진행 단계(AdminSteps) */
    steps?: React.ReactNode;
    /** 오른쪽 고정 정보 */
    aside?: React.ReactNode;
    /** 맨 아래 이력 */
    history?: React.ReactNode;
    children: React.ReactNode;
}

export const DetailPage: React.FC<DetailPageProps> = ({ backTo, backLabel = '목록으로', header, steps, aside, history, children, ...frame }) => (
    <Frame kind="detail" {...frame}>
        {backTo && <div className="adm-ui-back"><AdminTextButton to={backTo} tone="assistive" leading={<IconChevronLeft />}>{backLabel}</AdminTextButton></div>}
        {header}
        {steps}
        <div className={cx('adm-ui-detail-cols', !aside && 'is-single')}>
            <div className="adm-ui-detail-main">{children}</div>
            {aside && <aside className="adm-ui-detail-aside">{aside}</aside>}
        </div>
        {history}
    </Frame>
);

/** 상세형 머리 카드: 이름 · 상태 배지 · 보조 정보 · 주요 행동 */
export const AdminDetailHeader: React.FC<{ title: React.ReactNode; badges?: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode }> = ({ title, badges, meta, actions }) => (
    <AdminCard className="adm-ui-detail-head">
        <div className="adm-ui-detail-head-row">
            <div className="adm-ui-detail-head-main">
                <div className="adm-ui-detail-head-title"><h2>{title}</h2>{badges}</div>
                {meta && <div className="adm-ui-detail-head-meta">{meta}</div>}
            </div>
            {actions && <div className="adm-ui-detail-head-actions">{actions}</div>}
        </div>
    </AdminCard>
);

/** 진행 단계(예약 접수 → 예약금 확인 → 계약 동의 → 일정 준비 → 일정표 공개 같은 업무 순서) */
export interface AdminStep { key: string; label: React.ReactNode; state: 'done' | 'current' | 'todo'; hint?: React.ReactNode }
export const AdminSteps: React.FC<{ steps: AdminStep[]; label?: string }> = ({ steps, label = '진행 단계' }) => (
    <ol className="adm-ui-steps" aria-label={label}>
        {steps.map((step, index) => (
            <li key={step.key} className={cx('adm-ui-step', `is-${step.state}`)} aria-current={step.state === 'current' || undefined}>
                <span className="adm-ui-step-mark" aria-hidden="true">{step.state === 'done' ? <IconCheck /> : index + 1}</span>
                <span className="adm-ui-step-text">
                    <span className="adm-ui-step-label">{step.label}</span>
                    {step.hint && <span className="adm-ui-step-hint">{step.hint}</span>}
                </span>
                <span className="adm-ui-sr">{step.state === 'done' ? '완료' : step.state === 'current' ? '진행 중' : '대기'}</span>
            </li>
        ))}
    </ol>
);

/** 대시보드형: 제목 + 기간 선택(actions) → 요약 카드 줄 → 그래프·목록 카드 격자 */
export interface DashboardPageProps extends FrameProps {
    summary?: React.ReactNode;
    children: React.ReactNode;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ summary, children, ...frame }) => (
    <Frame kind="dashboard" {...frame}>
        {summary}
        {children}
    </Frame>
);

/** 카드 격자(넓으면 2칸 또는 3칸, 휴대폰 1칸) */
export const AdminGrid: React.FC<{ columns?: 2 | 3; children: React.ReactNode; className?: string }> = ({ columns = 2, children, className }) => (
    <div className={cx('adm-ui-grid', `is-${columns}`, className)}>{children}</div>
);
