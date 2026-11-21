import React, { useEffect, useState } from 'react';
import { Modal, ModalContainer } from '@montage-ui/core';
import { IconClose } from '@montage-ui/icon';
import { AdminButton, AdminIconButton } from './AdminButton';
import { cx, useAdminNarrow } from './adminUiUtils';
import './admin-components.css';

/**
 * 팝업(가운데 창). 폭 440(확인·짧은 입력) / 640(입력), 모서리 24, 머리(제목·닫기) / 본문 / 발.
 * 발은 왼쪽 삭제(`onDelete`), 오른쪽 취소·저장(`onSubmit`) 순서다. 휴대폰에서는 아래에서 올라오는 시트.
 * Esc·바깥 누르기·닫기 버튼으로 닫히고, `dirty`(고친 내용 있음)이면 바로 닫지 않고 발에서 한 번 묻는다.
 * 저장 중(`submitting`)에는 버튼을 잠그고 ‘저장 중…’을 보인다. 필수 입력 검사(`adminValidateRequired`)는 본문(.adm-form) 안에서 한다.
 *
 * 확인만 묻는 창은 이 부품 대신 `await adminConfirm()`을 쓴다.
 */
export interface AdminDialogProps {
    open: boolean;
    onClose: () => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    /** sm 440 · md 640 · lg 920(목록 + 옆 메뉴처럼 넓은 고르기 창) */
    size?: 'sm' | 'md' | 'lg';
    /** 본문 여백·스크롤을 없앤다 — 안에서 칸마다 따로 스크롤할 때 */
    flush?: boolean;
    /** 발 오른쪽, 버튼 바로 앞에 둘 글(고른 항목 요약 등) */
    footNote?: React.ReactNode;
    /** 고친 내용이 있으면 닫기 전에 묻는다 */
    dirty?: boolean;
    /** 저장 버튼(주요). 없으면 발에 ‘닫기’만 */
    onSubmit?: () => void;
    submitLabel?: string;
    submitting?: boolean;
    submitDisabled?: boolean;
    cancelLabel?: string;
    /** 발 왼쪽 삭제 글자 버튼 */
    onDelete?: () => void;
    deleteLabel?: string;
    /** 발 왼쪽(삭제 자리)에 둘 다른 것 — 상태 글 등 */
    footStart?: React.ReactNode;
    /** 발을 직접 그린다(버튼 순서 규칙은 지킨다) */
    footer?: React.ReactNode;
    className?: string;
    children?: React.ReactNode;
}

export const AdminDialog: React.FC<AdminDialogProps> = ({
    open, onClose, title, description, size = 'md', flush = false, footNote, dirty = false,
    onSubmit, submitLabel = '저장', submitting = false, submitDisabled = false, cancelLabel = '취소',
    onDelete, deleteLabel = '삭제', footStart, footer, className, children,
}) => {
    const narrow = useAdminNarrow();
    const [askClose, setAskClose] = useState(false);
    useEffect(() => { if (!open) setAskClose(false); }, [open]);

    const requestClose = () => {
        if (submitting) return;
        if (dirty) { setAskClose(true); return; }
        onClose();
    };
    const titleId = React.useId();

    const foot = askClose ? (
        <div className="adm-ui-dialog-foot is-asking" role="alert">
            <span className="adm-ui-dialog-ask">저장하지 않은 내용이 있습니다. 닫으면 고친 내용이 사라집니다.</span>
            <div className="adm-ui-dialog-foot-end">
                <AdminButton variant="secondary" onClick={() => setAskClose(false)}>계속 편집</AdminButton>
                <AdminButton variant="danger" onClick={() => { setAskClose(false); onClose(); }}>닫기</AdminButton>
            </div>
        </div>
    ) : footer !== undefined ? footer : (
        <div className="adm-ui-dialog-foot">
            <div className="adm-ui-dialog-foot-start">
                {onDelete && <AdminButton variant="weak" className="adm-ui-dialog-delete" disabled={submitting} onClick={onDelete}>{deleteLabel}</AdminButton>}
                {footStart}
            </div>
            <div className="adm-ui-dialog-foot-end">
                {footNote && <span className="adm-ui-dialog-note">{footNote}</span>}
                {onSubmit ? <>
                    <AdminButton variant="secondary" disabled={submitting} onClick={requestClose}>{cancelLabel}</AdminButton>
                    <AdminButton variant="primary" loading={submitting} disabled={submitDisabled} onClick={onSubmit}>{submitting ? '저장 중…' : submitLabel}</AdminButton>
                </> : <AdminButton variant="secondary" onClick={requestClose}>닫기</AdminButton>}
            </div>
        </div>
    );

    return (
        <Modal open={open} onOpenChange={(next) => { if (!next) requestClose(); }}>
            <ModalContainer
                variant={narrow ? 'bottom' : 'popup'}
                size="medium"
                aria-labelledby={titleId}
                // 겹침 순서를 관리자 규격(--adm-z-modal)으로: 공통 알림·확인 창이 팝업 위에 뜬다
                wrapperProps={{ className: 'adm-ui-dialog-layer' }}
                className={cx('adm-ui-dialog', `is-${size}`, narrow && 'is-sheet', className)}
            >
                <header className="adm-ui-dialog-head">
                    <div className="adm-ui-dialog-titles">
                        <h2 id={titleId} className="adm-ui-dialog-title">{title}</h2>
                        {description && <p className="adm-ui-dialog-desc">{description}</p>}
                    </div>
                    <AdminIconButton label="닫기" onClick={requestClose} disabled={submitting}><IconClose /></AdminIconButton>
                </header>
                <div className={cx('adm-ui-dialog-body', 'adm-form', flush && 'is-flush')}>{children}</div>
                {foot}
            </ModalContainer>
        </Modal>
    );
};
