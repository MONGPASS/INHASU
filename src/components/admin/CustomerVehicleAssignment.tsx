import { useEffect, useRef, useState } from 'react';
import type { AssignmentVehicle } from '../../utils/reservationAssignment';
import type { RegisteredVehicle } from '../../utils/registeredAssignmentResources';

export function CustomerVehicleAssignment({ value, vehicles, loading, resourceNotice, onRetry, onSave, onClose, onSaved, onDirtyChange, disabled = false }: {
    value: AssignmentVehicle; vehicles: RegisteredVehicle[]; loading: boolean; resourceNotice?: string; onRetry: () => void;
    onSave: (next: AssignmentVehicle & { resource?: Record<string, any> }) => Promise<boolean>;
    onClose: () => void; onSaved: () => void; onDirtyChange: (dirty: boolean) => void; disabled?: boolean;
}) {
    const [draft, setDraft] = useState(value);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState('');
    const lock = useRef(false);
    const dirty = draft.type !== value.type || draft.phone !== value.phone;
    const selected = vehicles.find(vehicle => vehicle.type === draft.type);
    useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
    useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
    const save = async () => {
        if (disabled || lock.current || !dirty) return;
        if (loading) return;
        if (draft.type !== value.type && draft.type && !selected) { setNotice('등록된 차량을 선택해 주세요.'); return; }
        if (!draft.type.trim() && draft.phone.trim()) { setNotice('기사 연락처를 저장하려면 차량을 선택하세요.'); return; }
        lock.current = true; setSaving(true); setNotice('');
        try {
            if (await onSave({ type: draft.type.trim(), phone: draft.phone.trim(), ...(draft.type !== value.type && selected ? { resource: selected.snapshot } : {}) })) {
                onDirtyChange(false); onSaved();
            } else setNotice('차량을 저장하지 못했습니다. 입력한 내용은 유지됩니다. 다시 시도해 주세요.');
        } catch { setNotice('차량을 저장하지 못했습니다. 입력한 내용은 유지됩니다. 다시 시도해 주세요.'); }
        finally { lock.current = false; setSaving(false); }
    };
    return <section className="cw-quick-assignment" aria-label="차량 바로 배정">
        <header><strong>차량 바로 배정</strong><button type="button" className="cw-text-button" disabled={saving || disabled} onClick={onClose}>닫기</button></header>
        <fieldset disabled={saving || disabled || loading}>
            <label>등록된 차량 선택<select value={draft.type} onChange={e => { const vehicle = vehicles.find(item => item.type === e.target.value); setDraft({ type: e.target.value, phone: vehicle?.phone || '' }); setNotice(''); }}><option value="">{value.type ? '배정 해제' : '차량을 선택하세요'}</option>{value.type && !vehicles.some(vehicle => vehicle.type === value.type) && <option value={value.type}>{value.type} (현재 배정)</option>}{vehicles.map(vehicle => <option key={vehicle.type} value={vehicle.type}>{vehicle.name}</option>)}</select></label>
            <label>기사 연락처<input type="tel" value={draft.phone} maxLength={60} placeholder="기사 연락처" onChange={e => { setDraft(d => ({ ...d, phone: e.target.value })); setNotice(''); }} /></label>
        </fieldset>
        {selected && <div className="cw-quick-resource-preview">{(selected.snapshot.image || selected.snapshot.img || selected.snapshot.images?.[0]) && <img src={selected.snapshot.image || selected.snapshot.img || selected.snapshot.images?.[0]} alt={selected.name} />}<div><strong>{selected.name}</strong><small>{[selected.snapshot.seats && String(selected.snapshot.seats), selected.snapshot.plate].filter(Boolean).join(' · ')}</small></div></div>}
        <p role="status">{loading ? '등록된 배정 자원을 불러오는 중입니다…' : resourceNotice || (vehicles.length ? '배정·자원에 등록된 차량 목록입니다.' : '배정·자원에 등록된 차량이 없습니다.')}</p>
        <button type="button" className="cw-text-button" disabled={saving || disabled || loading} onClick={onRetry}>자원 목록 새로고침</button>
        <p>기사 연락처는 관리자에게만 표시됩니다.</p>
        {notice && <p role="alert">{notice}</p>}
        <button type="button" className="cw-button cw-primary cw-wide" disabled={saving || disabled || loading || !dirty} onClick={() => void save()}>{saving ? '저장 중…' : '차량 배정 저장'}</button>
    </section>;
}
