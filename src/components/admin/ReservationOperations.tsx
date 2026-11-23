import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminButton, AdminSelect, AdminTextArea, AdminTextInput } from './ui';
import { AIRFARE_OPTIONS, CATEGORY_OPTIONS, RECEIPT_LABELS, SERVICE_TYPE_OPTIONS, emptyReservationOperations, type ReceiptStatus, type ReservationOperations as Operations } from '../../utils/reservationWorkspace';

const JOINING_CHOICES = [{ value: 'undecided', label: '미정' }, { value: 'private', label: '단독 투어' }, { value: 'join', label: '조인 투어' }];
const SERVICE_TYPE_CHOICES = [{ value: '', label: '미정' }, ...SERVICE_TYPE_OPTIONS.map(o => ({ value: o, label: o }))];
const AIRFARE_CHOICES = [{ value: '', label: '미정' }, ...AIRFARE_OPTIONS.map(o => ({ value: o, label: o }))];
const RECEIPT_CHOICES = (Object.keys(RECEIPT_LABELS) as ReceiptStatus[]).map(status => ({ value: status, label: RECEIPT_LABELS[status] }));

export interface ReservationOperationsControl {
    cancel: () => void;
}

export interface ReservationOperationsStatus {
    dirty: boolean;
    busy: boolean;
    message: string;
    failed: boolean;
}

interface Props {
    reservationId: string;
    value?: Operations;
    onSave: (next: Operations) => Promise<boolean>;
    disabled?: boolean;
    onDirtyChange?: (dirty: boolean) => void;
    externalActions?: boolean;
    formId?: string;
    onControlChange?: (control: ReservationOperationsControl | null) => void;
    onStatusChange?: (status: ReservationOperationsStatus) => void;
}

export function ReservationOperations(p: Props) {
    const { reservationId, value, onSave, disabled, onDirtyChange, externalActions, formId } = p;
    const [draft, setDraft] = useState<Operations>(() => value || emptyReservationOperations());
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState('');
    const [failed, setFailed] = useState(false);
    const callbacks = useRef(p);
    callbacks.current = p;
    const savingRef = useRef(false);
    useEffect(() => { setDraft(value || emptyReservationOperations()); setDirty(false); setNotice(''); setFailed(false); }, [reservationId]);
    useEffect(() => { if (!dirty) setDraft(value || emptyReservationOperations()); }, [value, dirty]);
    useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
    const message = notice || (dirty ? '저장하지 않은 변경사항이 있습니다.' : '현금영수증은 발급 이력을 기록합니다. 실제 발급은 기존 발급 서비스에서 진행하세요.');
    useEffect(() => { callbacks.current.onStatusChange?.({ dirty, busy: saving, message, failed }); }, [dirty, saving, message, failed]);
    const cancel = useCallback(() => {
        if (savingRef.current || callbacks.current.disabled) return;
        setDraft(callbacks.current.value || emptyReservationOperations());
        setDirty(false); setNotice('변경사항을 취소했습니다.'); setFailed(false);
    }, []);
    useEffect(() => {
        callbacks.current.onControlChange?.({ cancel });
        return () => callbacks.current.onControlChange?.(null);
    }, [cancel]);
    const change = (key: keyof Operations, next: any) => { setDraft(prev => ({ ...prev, [key]: next })); setDirty(true); setNotice(''); setFailed(false); };
    const receipt = (key: keyof Operations['receipt'], next: string) => change('receipt', { ...draft.receipt, [key]: next });
    const save = async () => {
        if (savingRef.current || disabled || !dirty) return;
        if (draft.receipt.status === 'issued' && !draft.receipt.issuedDate) { setNotice('발급 완료로 기록하려면 발행일을 입력하세요.'); setFailed(true); return; }
        savingRef.current = true;
        setFailed(false);
        setSaving(true);
        try { if (await onSave(draft)) { setDirty(false); setNotice('운영 정보를 저장했습니다.'); } else { setNotice('저장하지 못했습니다. 다시 시도하세요.'); setFailed(true); } }
        catch { setNotice('저장하지 못했습니다. 다시 시도하세요.'); setFailed(true); }
        finally { savingRef.current = false; setSaving(false); }
    };
    return <section id="sec-ops" className="card rw-operations" aria-label="주문 운영 정보">
        <div className="card-head rw-section-head"><div><span className="rw-kicker">주문서</span><h2>예약 운영 정보</h2><p>예약별 차량과 정산 정보를 기록하세요. 관리자에게만 표시됩니다.</p></div>{!externalActions && <div className="row ri-ops-actions"><AdminButton variant="secondary" size="sm" disabled={!dirty || saving || disabled} onClick={cancel}>변경 취소</AdminButton><AdminButton type="submit" form={formId || `reservation-operations-${reservationId}`} variant="primary" size="sm" disabled={!dirty || saving || disabled}>{saving ? '저장 중…' : '운영 정보 저장'}</AdminButton></div>}</div>
        <form id={formId || `reservation-operations-${reservationId}`} noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
        <fieldset disabled={saving || disabled} className="rw-operations-fields">
            <section className="rw-operations-group" aria-label="투어·차량 정보">
                <h3>투어·차량 정보</h3>
                <div className="rw-operations-group-fields">
                    <label className="rw-field"><span>조인 여부</span><AdminSelect value={draft.joining} onChange={next => change('joining', next)} options={JOINING_CHOICES} /></label>
                    <label className="rw-field"><span>지역</span><AdminTextInput value={draft.region} maxLength={200} placeholder="예: 고비사막 · 테를지" onChange={e => change('region', e.target.value)}/></label>
                    <label className="rw-field"><span>분류</span><AdminTextInput value={draft.category} maxLength={200} placeholder="예: 가족여행" list={`reservation-categories-${reservationId}`} onChange={e => change('category', e.target.value)}/><datalist id={`reservation-categories-${reservationId}`}>{CATEGORY_OPTIONS.map(o => <option key={o} value={o} />)}</datalist></label>
                    <label className="rw-field"><span>구분</span><AdminSelect value={draft.serviceType || ''} onChange={next => change('serviceType', next)} options={SERVICE_TYPE_CHOICES} /></label>
                    <label className="rw-field"><span>항공</span><AdminSelect value={draft.airfare || ''} onChange={next => change('airfare', next)} options={AIRFARE_CHOICES} /></label>
                    <label className="rw-field"><span>차량</span><AdminTextInput value={draft.vehicle} maxLength={200} placeholder="배정 차량" onChange={e => change('vehicle', e.target.value)}/></label>
                    <label className="rw-field"><span>기사 연락처</span><AdminTextInput type="tel" value={draft.driverPhone} maxLength={60} onChange={e => change('driverPhone', e.target.value)}/></label>
                </div>
            </section>
            <section className="rw-operations-group" aria-label="현금영수증 기록">
                <h3>현금영수증 기록</h3>
                <div className="rw-operations-group-fields">
                    <label className="rw-field"><span>현금영수증 상태</span><AdminSelect value={draft.receipt.status} onChange={next => receipt('status', next)} options={RECEIPT_CHOICES} /></label>
                    <label className="rw-field"><span>발급수단 번호</span><AdminTextInput value={draft.receipt.number} maxLength={60} placeholder="요청받은 휴대폰·사업자 번호" onChange={e => receipt('number', e.target.value)}/></label>
                    <label className="rw-field"><span>현금영수증 발행일</span><AdminTextInput type="date" value={draft.receipt.issuedDate} onChange={e => receipt('issuedDate', e.target.value)}/></label>
                </div>
            </section>
            <label className="rw-field rw-wide rw-operations-group rw-operations-group-wide"><span>내부 운영 메모</span><AdminTextArea minRows={3} value={draft.opsNote} maxLength={3000} onChange={e => change('opsNote', e.target.value)}/></label>
        </fieldset>
        <div className="rw-operations-note"><span role={failed ? 'alert' : 'status'}>{saving ? '운영 정보를 저장하고 있습니다…' : message}</span></div>
        </form>
    </section>;
}
