import { useEffect, useRef, useState } from 'react';
import type { AssignmentVehicle } from '../../utils/reservationAssignment';
import type { RegisteredVehicle } from '../../utils/registeredAssignmentResources';
import './CustomerResourcePicker.css';

export function CustomerVehicleAssignment({ value, vehicles, loading, resourceNotice, onRetry, onSave, onClose, onSaved, onDirtyChange, disabled = false }: {
    value: AssignmentVehicle; vehicles: RegisteredVehicle[]; loading: boolean; resourceNotice?: string; onRetry: () => void;
    onSave: (next: AssignmentVehicle & { resource?: Record<string, any> }) => Promise<boolean>;
    onClose: () => void; onSaved: () => void; onDirtyChange: (dirty: boolean) => void; disabled?: boolean;
}) {
    const [draft, setDraft] = useState(value);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState('');
    const [search, setSearch] = useState('');
    const lock = useRef(false);
    const dirty = draft.type !== value.type || draft.phone !== value.phone;
    const selected = vehicles.find(vehicle => vehicle.type === draft.type);
    const visible = vehicles.filter(vehicle => [vehicle.name, vehicle.snapshot.plate, vehicle.snapshot.seats].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
    const choose = (vehicle: RegisteredVehicle) => {
        if (disabled || saving || loading) return;
        setDraft(previous => ({ type: vehicle.type, phone: vehicle.type === previous.type ? previous.phone : vehicle.phone || '' }));
        setNotice('');
    };
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
        <header><div><strong>등록 차량 선택</strong><span className="crp-current">현재 배정 · {value.type || '미배정'}</span></div><button type="button" className="cw-text-button" disabled={saving || disabled} onClick={onClose}>닫기</button></header>
        <fieldset disabled={saving || disabled || loading}>
            <label>차량 찾기<input type="search" value={search} placeholder="차량 이름·번호 검색" onChange={e => setSearch(e.target.value)} /></label>
            <div className="crp-results-caption"><span>등록 차량 {vehicles.length}대{search.trim() ? ` · 검색 ${visible.length}대` : ''}</span><small>선택한 뒤 아래에서 저장하세요.</small></div>
            <div className="crp-vehicle-list" role="group" aria-label="등록된 차량 선택">
                {visible.map(vehicle => {
                    const chosen = vehicle.type === draft.type;
                    const photo = vehicle.snapshot.image || vehicle.snapshot.img || vehicle.snapshot.images?.[0];
                    return <button type="button" key={vehicle.type} className={`crp-vehicle-choice${chosen ? ' is-selected' : ''}`} aria-pressed={chosen} onClick={() => choose(vehicle)}>
                        {photo ? <img src={photo} alt="" loading="lazy" /> : <span className="crp-vehicle-placeholder" aria-hidden="true">차량</span>}
                        <span className="crp-vehicle-copy"><strong>{vehicle.name}</strong><small>{[vehicle.snapshot.seats, vehicle.snapshot.plate].filter(Boolean).join(' · ') || '등록 차량'}</small>{chosen && <b>{vehicle.type === value.type ? '현재 배정' : '선택됨 · 저장 전'}</b>}</span><span className="crp-choice-mark" aria-hidden="true">{chosen ? '✓' : '+'}</span>
                    </button>;
                })}
                {!loading && !visible.length && <p className="crp-empty">{vehicles.length ? '검색한 차량이 없습니다. 이름이나 차량번호를 확인해 주세요.' : '등록된 차량이 없습니다. 배정·자원에서 차량을 등록해 주세요.'}</p>}
            </div>
            <label>기사 연락처<input type="tel" value={draft.phone} maxLength={60} placeholder="기사 연락처" onChange={e => { setDraft(d => ({ ...d, phone: e.target.value })); setNotice(''); }} /></label>
            {draft.type && <button type="button" className="crp-clear" onClick={() => { setDraft({ type: '', phone: '' }); setNotice(''); }}>차량 배정 해제 선택</button>}
        </fieldset>
        <p role="status">{loading ? '등록된 배정 자원을 불러오는 중입니다…' : resourceNotice || (vehicles.length ? '배정·자원에 등록된 차량 목록입니다.' : '배정·자원에 등록된 차량이 없습니다.')}</p>
        <button type="button" className="cw-text-button" disabled={saving || disabled || loading} onClick={onRetry}>자원 목록 새로고침</button>
        <p>기사 연락처는 관리자에게만 표시됩니다.</p>
        {dirty && <p className="crp-save-summary"><strong>{draft.type || '배정 해제'}</strong>{draft.type ? ' 선택 내용을 저장하면 배정에 반영됩니다.' : ' 저장하면 기존 차량 배정이 해제됩니다.'}</p>}
        {notice && <p role="alert">{notice}</p>}
        <button type="button" className="cw-button cw-primary cw-wide" disabled={saving || disabled || loading || !dirty} onClick={() => void save()}>{saving ? '저장 중…' : '차량 배정 저장'}</button>
    </section>;
}
