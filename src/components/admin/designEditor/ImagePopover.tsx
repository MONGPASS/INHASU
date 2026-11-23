import { Ico } from '../v7/v7Ui';
import { AdminButton, AdminIconButton } from '../ui/AdminButton';
import { cx } from '../ui/adminUiUtils';
import { PopoverShell } from './PopoverShell';
import './design-editor.css';

/**
 * 사진 한 자리를 그 자리에서 바꾸는 편집창: 올리기 · 공통 사진 쓰기 · 지우기.
 * 업로드 중에는 모두 잠긴다(상품 폼의 fieldset 잠금 밖에 떠 있으므로 직접 잠근다).
 */
export function ImagePopover({ label, value, sharedUrl, uploading, disabled = false, anchor, onUpload, onUseShared, onClear, onClose, isInside }: {
    label: string; value: string; sharedUrl?: string; uploading: boolean; disabled?: boolean; anchor: DOMRect | null;
    onUpload: (file: File) => void; onUseShared: () => void; onClear: () => void; onClose: () => void; isInside?: (target: Element) => boolean;
}) {
    const shown = value || sharedUrl || '';
    const locked = disabled || uploading;
    const status = uploading ? '업로드 중…' : value ? '이 상품에 올린 사진' : sharedUrl ? '공통 사진 사용 중' : '사진 없음 — 올리면 이 자리에 들어갑니다';
    return <PopoverShell anchor={anchor} label={`${label} 사진`} width={380} onClose={onClose} isInside={isInside}>
        <div className="de-pop-head is-roomy">
            <b className="de-pop-title">{label}</b>
            <span className={cx('de-pop-status', uploading && 'is-busy')}>{status}</span>
            <AdminIconButton label="닫기" size="sm" className="de-push" onClick={onClose}><Ico name="lc-x" size={15} /></AdminIconButton>
        </div>
        <div className="de-pop-image">
            <div className={cx('de-pop-thumb', shown && 'is-shown', value && 'is-own')}>
                {shown ? <img src={shown} alt={label} className={uploading ? 'is-busy' : undefined} /> : <Ico name="lc-image-plus" size={26} color="var(--adm-text-3)" />}
                {!value && sharedUrl && <span className="de-pop-badge">공통</span>}
            </div>
            <div className="de-pop-actions">
                {/* 파일 칸을 감싼 라벨이라 부품 대신 같은 모양 클래스(AdminButton 주요·작게) */}
                <label className={cx('adm-ui-btn is-primary is-sm adm-on-primary de-upload', locked && 'is-locked')}>
                    <span className="adm-ui-btn-icon"><Ico name="lc-image-plus" size={14} /></span><span className="adm-ui-btn-label">{value ? '사진 바꾸기' : '사진 올리기'}</span>
                    <input type="file" accept="image/*" disabled={locked} className="de-file" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) onUpload(file); }} />
                </label>
                {value && sharedUrl && <AdminButton size="sm" disabled={locked} title="이 상품만의 사진을 지우고 공통 사진을 따라갑니다" leading={<Ico name="lc-rotate-ccw" size={13} />} onClick={() => { onUseShared(); onClose(); }}>공통 사진 쓰기</AdminButton>}
                {value && <AdminButton size="sm" className="de-btn-danger-text" disabled={locked} leading={<Ico name="lc-trash" size={13} />} onClick={() => { onClear(); onClose(); }}>지우기</AdminButton>}
                <span className="de-note-sm">파일을 이 자리에 끌어다 놓아도 올라갑니다</span>
            </div>
        </div>
    </PopoverShell>;
}
